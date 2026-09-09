import os
from datetime import date
from decimal import Decimal
from uuid import UUID

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from relay.models import (
    Cohort,
    CommuteImport,
    CommuterRecord,
    DataSource,
    EvidenceProjectionBinding,
    Institution,
    Site,
)
from relay.services.evidence_projection import PROJECTOR_VERSION, project_commute_import_to_evidence


ORG_UUID = UUID('11111111-1111-4111-8111-111111111111')
SITE_UUID = UUID('22222222-2222-4222-8222-222222222222')
COHORT_UUID = UUID('33333333-3333-4333-8333-333333333333')
SOURCE_UUID = UUID('44444444-4444-4444-8444-444444444444')


class Command(BaseCommand):
    help = 'Verify the canonical Relay Rider -> public evidence projection in a rollback-only synthetic PostgreSQL fixture.'

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError('Evidence projection verification requires PostgreSQL.')
        if os.environ.get('RELAY_ALLOW_SYNTHETIC_EVIDENCE_FIXTURE', '').lower() != 'true':
            raise CommandError('Set RELAY_ALLOW_SYNTHETIC_EVIDENCE_FIXTURE=true to run this rollback-only verification.')
        if not settings.DEBUG:
            raise CommandError('Rollback-only synthetic evidence verification is disabled when DJANGO_DEBUG is false.')

        with transaction.atomic():
            self._create_public_fixture()
            actor = get_user_model().objects.create_user(username='evidence-proof-admin', email='evidence-proof@example.invalid')
            institution = Institution.objects.create(name='Fictional Pasadena Evidence Proof', slug='fictional-pasadena-evidence-proof', status='active')
            site = Site.objects.create(institution=institution, name='Pasadena HQ Proof', slug='pasadena-hq-proof', city='Pasadena')
            cohort = Cohort.objects.create(institution=institution, site=site, name='Synthetic Employees', slug='synthetic-employees')
            source = DataSource.objects.create(
                institution=institution,
                site=site,
                name='Synthetic evidence proof',
                source_type='synthetic',
                provenance_label='synthetic',
            )
            commute_import = CommuteImport.objects.create(
                institution=institution,
                site=site,
                cohort=cohort,
                data_source=source,
                imported_by=actor,
                file_name='synthetic-evidence-proof.csv',
                file_sha256='a' * 64,
                status='validated',
                total_rows=1,
                valid_rows=1,
            )
            record = CommuterRecord.objects.create(
                institution=institution,
                site=site,
                cohort=cohort,
                commute_import=commute_import,
                external_id='SYNTH-001',
                origin_zone='Eagle Rock generalized zone',
                destination_zone='Pasadena HQ Proof',
                commute_days=['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                arrival_window='07:30-08:00',
                departure_window='16:30-17:00',
                schedule_flex_minutes=15,
                current_mode='drive_alone',
                vehicle_fuel_type='gasoline',
                parking_difficulty='high',
                consent_confirmed=True,
                validation_status='valid',
                source_row_number=2,
                source_payload={'fixture': True},
                observation_date=date(2026, 9, 8),
                one_way_miles=Decimal('8.40'),
            )
            EvidenceProjectionBinding.objects.create(
                institution=institution,
                site=site,
                cohort=cohort,
                organization_uuid=ORG_UUID,
                site_uuid=SITE_UUID,
                cohort_uuid=COHORT_UUID,
                source_uuid=SOURCE_UUID,
            )

            first = project_commute_import_to_evidence(commute_import, actor=actor)
            second = project_commute_import_to_evidence(commute_import, actor=actor)
            if (first.inserted, first.updated, first.blocked) != (1, 0, 0):
                raise CommandError(f'Unexpected first projection result: {first.to_dict()}')
            if (second.inserted, second.updated, second.blocked) != (0, 1, 0):
                raise CommandError(f'Projection is not idempotent: {second.to_dict()}')

            with connection.cursor() as cursor:
                cursor.execute(
                    """select count(*), min(participant_key), min(original_payload->>'source_system'),
                              min(original_payload->>'canonical_record_id'), min(original_payload->>'projector_version')
                       from public.evidence_commute_observations"""
                )
                count, participant_key, source_system, canonical_record_id, projector_version = cursor.fetchone()
            if count != 1:
                raise CommandError(f'Expected one evidence row after repeat projection, found {count}.')
            if not participant_key.startswith('rr_') or record.external_id in participant_key:
                raise CommandError('Participant pseudonymization contract failed.')
            if source_system != 'relay_rider' or canonical_record_id != str(record.id) or projector_version != PROJECTOR_VERSION:
                raise CommandError('Evidence provenance contract failed.')

            self.stdout.write(self.style.SUCCESS(
                f'Evidence projection verified: inserted=1 updated=1 duplicates=0 projector={PROJECTOR_VERSION} '
                'regulatory_status=calculation_output_only_not_certification'
            ))
            transaction.set_rollback(True)

    def _create_public_fixture(self):
        with connection.cursor() as cursor:
            cursor.execute('''
                create table public.organizations (
                    id uuid primary key,
                    name text not null
                );
                create table public.organization_sites (
                    id uuid primary key,
                    organization_id uuid not null,
                    name text not null
                );
                create table public.cohorts (
                    id uuid primary key,
                    organization_id uuid not null,
                    site_id uuid null,
                    name text not null
                );
                create table public.data_sources (
                    id uuid primary key,
                    organization_id uuid not null,
                    site_id uuid null,
                    name text not null
                );
                create table public.evidence_commute_observations (
                    id uuid primary key default gen_random_uuid(),
                    organization_id uuid not null,
                    site_id uuid not null,
                    cohort_id uuid null,
                    baseline_id uuid null,
                    observation_period_id uuid null,
                    source_id uuid null,
                    participant_key text not null,
                    observation_date date not null,
                    origin_zone text null,
                    commute_mode text not null,
                    source_mode text null,
                    one_way_miles numeric null,
                    vehicle_occupancy numeric null,
                    reported_to_site boolean not null,
                    remote_day boolean not null,
                    ev_hybrid_status text not null,
                    parking_difficulty smallint null,
                    arrival_window text null,
                    departure_window text null,
                    validation_status text not null,
                    exclusion_reason text null,
                    source_row_number integer null,
                    original_payload jsonb not null default '{}'::jsonb,
                    created_at timestamptz not null default now(),
                    updated_at timestamptz not null default now()
                );
            ''')
            cursor.execute('insert into public.organizations (id, name) values (%s, %s)', [str(ORG_UUID), 'Fictional Public Organization'])
            cursor.execute('insert into public.organization_sites (id, organization_id, name) values (%s, %s, %s)', [str(SITE_UUID), str(ORG_UUID), 'Fictional Public Site'])
            cursor.execute('insert into public.cohorts (id, organization_id, site_id, name) values (%s, %s, %s, %s)', [str(COHORT_UUID), str(ORG_UUID), str(SITE_UUID), 'Fictional Public Cohort'])
            cursor.execute('insert into public.data_sources (id, organization_id, site_id, name) values (%s, %s, %s, %s)', [str(SOURCE_UUID), str(ORG_UUID), str(SITE_UUID), 'Fictional Public Source'])
