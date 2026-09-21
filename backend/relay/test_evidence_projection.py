import os
from datetime import date
from decimal import Decimal
from io import StringIO
from pathlib import Path
from unittest import skipUnless
from uuid import UUID, uuid4

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import SimpleTestCase, TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from relay.models import (
    AssessmentAuditEvent,
    Cohort,
    CommuteImport,
    CommuterRecord,
    DataSource,
    EvidenceProjectionBinding,
    Institution,
    Membership,
    Site,
)
from relay.services.commute_schema import validate_and_normalize_rows
from relay.services.evidence_projection import (
    EvidenceProjectionUnavailable,
    SOURCE_SYSTEM_RELAY_RIDER_PROJECTION,
    normalize_record_for_evidence,
    project_commute_import_to_evidence,
)


ORG_UUID = UUID('11111111-1111-4111-8111-111111111111')
SITE_UUID = UUID('22222222-2222-4222-8222-222222222222')
COHORT_UUID = UUID('33333333-3333-4333-8333-333333333333')
SOURCE_UUID = UUID('44444444-4444-4444-8444-444444444444')
BASELINE_UUID = UUID('55555555-5555-4555-8555-555555555555')


class EvidenceProjectionModelTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name='Pasadena Demo', slug='pasadena-demo', status='active')
        self.site = Site.objects.create(institution=self.institution, name='Pasadena HQ', slug='pasadena-hq')
        self.cohort = Cohort.objects.create(institution=self.institution, site=self.site, name='Employees', slug='employees')

    def test_binding_accepts_same_tenant_hierarchy(self):
        binding = EvidenceProjectionBinding(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            organization_uuid=ORG_UUID,
            site_uuid=SITE_UUID,
            cohort_uuid=COHORT_UUID,
        )
        binding.full_clean()

    def test_binding_rejects_cross_tenant_site(self):
        other = Institution.objects.create(name='Other', slug='other')
        other_site = Site.objects.create(institution=other, name='Other Site', slug='other-site')
        binding = EvidenceProjectionBinding(
            institution=self.institution,
            site=other_site,
            organization_uuid=ORG_UUID,
            site_uuid=SITE_UUID,
        )
        with self.assertRaises(ValidationError):
            binding.full_clean()

    def test_binding_rejects_cross_site_cohort(self):
        second_site = Site.objects.create(institution=self.institution, name='Second', slug='second')
        binding = EvidenceProjectionBinding(
            institution=self.institution,
            site=second_site,
            cohort=self.cohort,
            organization_uuid=ORG_UUID,
            site_uuid=SITE_UUID,
            cohort_uuid=COHORT_UUID,
        )
        with self.assertRaises(ValidationError):
            binding.full_clean()

    def test_active_binding_is_unique_per_institution_site_cohort(self):
        EvidenceProjectionBinding.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            organization_uuid=ORG_UUID,
            site_uuid=SITE_UUID,
            cohort_uuid=COHORT_UUID,
        )
        with self.assertRaises(ValidationError):
            EvidenceProjectionBinding.objects.create(
                institution=self.institution,
                site=self.site,
                cohort=self.cohort,
                organization_uuid=uuid4(),
                site_uuid=uuid4(),
                cohort_uuid=uuid4(),
            )

    def test_observation_fields_are_optional_on_canonical_records(self):
        user = User.objects.create_user(username='importer', password='pw')
        source = DataSource.objects.create(
            institution=self.institution,
            site=self.site,
            name='Synthetic',
            source_type='synthetic',
            provenance_label='synthetic',
        )
        commute_import = CommuteImport.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=source,
            imported_by=user,
            file_name='synthetic.csv',
            file_sha256='b' * 64,
            status='validated',
        )
        record = CommuterRecord.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            commute_import=commute_import,
            external_id='EMP-OPTIONAL',
            origin_zone='Eagle Rock',
            destination_zone='Pasadena HQ',
            commute_days=['Mon'],
            arrival_window='07:30-08:00',
            departure_window='16:30-17:00',
            current_mode='drive_alone',
            consent_confirmed=True,
            source_row_number=2,
        )
        self.assertIsNone(record.observation_date)
        self.assertIsNone(record.one_way_miles)


class EvidenceReadyImportContractTests(SimpleTestCase):
    def _row(self, **overrides):
        row = {
            'external_id': 'EMP-1',
            'origin_zone': 'Eagle Rock',
            'destination_zone': 'Pasadena',
            'commute_days': 'Mon|Tue',
            'arrival_window': '07:30-08:00',
            'departure_window': '16:30-17:00',
            'current_mode': 'drive_alone',
            'consent_confirmed': 'yes',
            'schedule_flex_minutes': '15',
            'occupants': '',
            'vehicle_fuel_type': 'gasoline',
            'parking_difficulty': 'high',
            'ev_interest': 'no',
            'access_point_willing': 'yes',
        }
        row.update(overrides)
        return row

    def test_optional_date_and_distance_normalize_when_present(self):
        [(normalized, errors)] = validate_and_normalize_rows([
            self._row(observation_date='2026-09-08', one_way_miles='8.40')
        ])
        self.assertEqual(errors, [])
        self.assertEqual(normalized['observation_date'], date(2026, 9, 8))
        self.assertEqual(normalized['one_way_miles'], Decimal('8.40'))

    def test_optional_date_and_distance_remain_none_when_omitted(self):
        [(normalized, errors)] = validate_and_normalize_rows([self._row()])
        self.assertEqual(errors, [])
        self.assertIsNone(normalized['observation_date'])
        self.assertIsNone(normalized['one_way_miles'])

    def test_invalid_evidence_fields_are_auditable_errors(self):
        [(normalized, errors)] = validate_and_normalize_rows([
            self._row(observation_date='09/08/2026', one_way_miles='-2')
        ])
        self.assertIn('observation_date must be an ISO date (YYYY-MM-DD)', errors)
        self.assertIn('one_way_miles must be a non-negative decimal', errors)
        self.assertIsNone(normalized['observation_date'])
        self.assertIsNone(normalized['one_way_miles'])


class EvidenceProjectionNormalizationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='admin', password='pw')
        self.institution = Institution.objects.create(name='Pasadena Demo', slug='pasadena-demo', status='active')
        self.site = Site.objects.create(institution=self.institution, name='Pasadena HQ', slug='pasadena-hq')
        self.cohort = Cohort.objects.create(institution=self.institution, site=self.site, name='Employees', slug='employees')
        self.source = DataSource.objects.create(
            institution=self.institution,
            site=self.site,
            name='Synthetic',
            source_type='synthetic',
            provenance_label='synthetic',
        )
        self.commute_import = CommuteImport.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            imported_by=self.user,
            file_name='synthetic.csv',
            file_sha256='a' * 64,
            status='validated',
            total_rows=1,
            valid_rows=1,
        )

    def _record(self, **overrides):
        values = {
            'institution': self.institution,
            'site': self.site,
            'cohort': self.cohort,
            'commute_import': self.commute_import,
            'external_id': 'EMP-42',
            'origin_zone': 'Eagle Rock',
            'destination_zone': 'Pasadena HQ',
            'commute_days': ['Mon'],
            'arrival_window': '07:30-08:00',
            'departure_window': '16:30-17:00',
            'schedule_flex_minutes': 15,
            'current_mode': 'drive_alone',
            'occupants': None,
            'vehicle_fuel_type': 'gasoline',
            'parking_difficulty': 'high',
            'ev_interest': False,
            'access_point_willing': True,
            'consent_confirmed': True,
            'validation_status': 'valid',
            'source_row_number': 2,
            'source_payload': {'external_id': 'EMP-42', 'private_note': 'must-not-project'},
            'observation_date': date(2026, 9, 8),
            'one_way_miles': Decimal('8.40'),
        }
        values.update(overrides)
        return CommuterRecord.objects.create(**values)

    def test_normalization_pseudonymizes_identity_and_minimizes_provenance(self):
        record = self._record()
        row, issues = normalize_record_for_evidence(record, participant_key_secret='test-secret')
        self.assertEqual(issues, [])
        self.assertTrue(row['participant_key'].startswith('rr_'))
        self.assertNotIn(record.external_id, row['participant_key'])
        self.assertEqual(row['origin_zone'], 'Eagle Rock')
        self.assertEqual(row['commute_mode'], 'drive_alone')
        self.assertEqual(row['vehicle_occupancy'], 1)
        self.assertEqual(row['ev_hybrid_status'], 'ice')
        self.assertEqual(row['parking_difficulty'], 5)
        self.assertEqual(row['observation_date'], date(2026, 9, 8))
        self.assertEqual(row['one_way_miles'], Decimal('8.40'))
        self.assertEqual(row['original_payload']['source_system'], SOURCE_SYSTEM_RELAY_RIDER_PROJECTION)
        self.assertEqual(row['original_payload']['canonical_record_id'], record.id)
        self.assertEqual(row['original_payload']['source_type'], 'synthetic')
        self.assertEqual(row['original_payload']['contract_version'], row['original_payload']['projector_version'])
        self.assertNotIn('private_note', row['original_payload'])
        self.assertNotIn('external_id', row['original_payload'])

    def test_participant_key_is_stable_for_same_record(self):
        record = self._record()
        first, _ = normalize_record_for_evidence(record, participant_key_secret='test-secret')
        second, _ = normalize_record_for_evidence(record, participant_key_secret='test-secret')
        self.assertEqual(first['participant_key'], second['participant_key'])
        self.assertEqual(first['original_payload']['relay_projection_key'], second['original_payload']['relay_projection_key'])

    def test_missing_observation_date_is_blocking(self):
        record = self._record(observation_date=None)
        row, issues = normalize_record_for_evidence(record, participant_key_secret='test-secret')
        self.assertIsNone(row)
        self.assertIn('OBSERVATION_DATE_MISSING', [issue.code for issue in issues])

    def test_invalid_consent_is_blocking(self):
        record = self._record(consent_confirmed=False)
        row, issues = normalize_record_for_evidence(record, participant_key_secret='test-secret')
        self.assertIsNone(row)
        self.assertIn('CONSENT_INVALID', [issue.code for issue in issues])

    def test_motor_vehicle_distance_is_required(self):
        record = self._record(one_way_miles=None)
        row, issues = normalize_record_for_evidence(record, participant_key_secret='test-secret')
        self.assertIsNone(row)
        self.assertIn('DISTANCE_MISSING', [issue.code for issue in issues])

    def test_carpool_requires_valid_occupancy(self):
        record = self._record(current_mode='carpool', occupants=1)
        row, issues = normalize_record_for_evidence(record, participant_key_secret='test-secret')
        self.assertIsNone(row)
        self.assertIn('OCCUPANCY_INVALID', [issue.code for issue in issues])

    def test_unsupported_mode_is_blocking(self):
        record = self._record(current_mode='teleporter')
        row, issues = normalize_record_for_evidence(record, participant_key_secret='test-secret')
        self.assertIsNone(row)
        self.assertIn('MODE_UNSUPPORTED', [issue.code for issue in issues])

    def test_projection_refuses_non_postgresql_database(self):
        self._record()
        EvidenceProjectionBinding.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            organization_uuid=ORG_UUID,
            site_uuid=SITE_UUID,
            cohort_uuid=COHORT_UUID,
        )
        with self.assertRaises(EvidenceProjectionUnavailable):
            project_commute_import_to_evidence(
                self.commute_import,
                actor=self.user,
                participant_key_secret='test-secret',
            )
        self.assertTrue(AssessmentAuditEvent.objects.filter(
            institution=self.institution,
            action='evidence_projection.failed',
            entity_type='CommuteImport',
            entity_id=str(self.commute_import.id),
        ).exists())

    def test_operator_command_requires_postgresql(self):
        with self.assertRaises(CommandError):
            call_command('project_commute_import_to_evidence', import_id=self.commute_import.id)


class EvidenceBrowserAuthorshipMigrationTests(SimpleTestCase):
    def test_supabase_migration_blocks_browser_mutation_of_relay_rider_evidence(self):
        migration = Path(__file__).resolve().parents[2] / 'supabase' / 'migrations' / '20260909171500_restrict_relay_rider_evidence_browser_authorship.sql'
        sql = migration.read_text(encoding='utf-8')
        self.assertIn("source_system", sql)
        self.assertIn("relay_rider", sql)
        self.assertIn("relay_rider_projection", sql)
        self.assertIn("authenticated", sql)
        self.assertIn("TG_OP", sql)
        self.assertIn("BEFORE INSERT OR UPDATE OR DELETE", sql)

    def test_unapplied_unique_index_sql_is_documented_outside_active_migrations(self):
        pending = Path(__file__).resolve().parents[2] / 'supabase' / 'unapplied' / '20260914190000_evidence_projection_key_unique_index.sql'
        sql = pending.read_text(encoding='utf-8')
        self.assertIn('UNAPPLIED', sql)
        self.assertIn('relay_projection_key', sql)


class InstitutionAqmdFeedTests(APITestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name='Pasadena Demo', slug='pasadena-feed', status='active')
        self.other = Institution.objects.create(name='Other', slug='other-feed', status='active')
        self.site = Site.objects.create(institution=self.institution, name='Pasadena HQ', slug='pasadena-hq')
        self.cohort = Cohort.objects.create(institution=self.institution, site=self.site, name='Employees', slug='employees')
        self.admin = User.objects.create_user(username='feed-admin', password='pw')
        self.participant = User.objects.create_user(username='feed-participant', password='pw')
        self.outsider = User.objects.create_user(username='feed-outsider', password='pw')
        Membership.objects.create(user=self.admin, institution=self.institution, role='institution_admin')
        Membership.objects.create(user=self.participant, institution=self.institution, role='participant')
        Membership.objects.create(user=self.outsider, institution=self.other, role='institution_admin')
        self.admin_token = Token.objects.create(user=self.admin)
        self.participant_token = Token.objects.create(user=self.participant)
        self.outsider_token = Token.objects.create(user=self.outsider)
        source = DataSource.objects.create(
            institution=self.institution,
            site=self.site,
            name='Synthetic',
            source_type='synthetic',
            provenance_label='synthetic',
        )
        commute_import = CommuteImport.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=source,
            imported_by=self.admin,
            file_name='synthetic.csv',
            file_sha256='c' * 64,
            status='validated',
        )
        CommuterRecord.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            commute_import=commute_import,
            external_id='valid-row',
            origin_zone='Eagle Rock',
            destination_zone='Pasadena HQ',
            commute_days=['Mon'],
            arrival_window='07:30-08:00',
            departure_window='16:30-17:00',
            current_mode='drive_alone',
            consent_confirmed=True,
            validation_status='valid',
            source_row_number=2,
        )
        CommuterRecord.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            commute_import=commute_import,
            external_id='invalid-row',
            origin_zone='Eagle Rock',
            destination_zone='Pasadena HQ',
            commute_days=['Mon'],
            arrival_window='07:30-08:00',
            departure_window='16:30-17:00',
            current_mode='drive_alone',
            consent_confirmed=False,
            validation_status='invalid',
            source_row_number=3,
        )

    def test_unauthenticated_feed_is_rejected(self):
        response = self.client.get(f'/api/institutions/{self.institution.id}/aqmd-feed/')
        self.assertEqual(response.status_code, 401)

    def test_participant_and_cross_tenant_feed_are_forbidden(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.participant_token.key}')
        denied = self.client.get(f'/api/institutions/{self.institution.id}/aqmd-feed/')
        self.assertEqual(denied.status_code, 403)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.outsider_token.key}')
        cross = self.client.get(f'/api/institutions/{self.institution.id}/aqmd-feed/')
        self.assertEqual(cross.status_code, 403)

    def test_staff_feed_is_validated_only_and_omits_private_payload(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        response = self.client.get(f'/api/institutions/{self.institution.id}/aqmd-feed/')
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['contract_version'], 'rr-aqmd-feed-v1')
        self.assertFalse(body['guardrails']['writes_to_beta'])
        self.assertFalse(body['guardrails']['rule2202_is_certification'])
        self.assertEqual([row['external_id'] for row in body['records']], ['valid-row'])
        self.assertNotIn('source_payload', body['records'][0])
        self.assertNotIn('email', body['records'][0])


@skipUnless(connection.vendor == 'postgresql', 'Evidence writes require PostgreSQL')
class EvidenceProjectionPostgresTests(TestCase):
    def setUp(self):
        os.environ['RELAY_EVIDENCE_PARTICIPANT_KEY_SECRET'] = 'test-secret'
        self.user = User.objects.create_user(username='pg-admin', password='pw')
        self.institution = Institution.objects.create(name='Pasadena PG', slug='pasadena-pg', status='active')
        self.site = Site.objects.create(institution=self.institution, name='Pasadena HQ', slug='pasadena-hq-pg')
        self.cohort = Cohort.objects.create(institution=self.institution, site=self.site, name='Employees', slug='employees-pg')
        self.source = DataSource.objects.create(
            institution=self.institution,
            site=self.site,
            name='Synthetic',
            source_type='synthetic',
            provenance_label='synthetic',
        )
        self.commute_import = CommuteImport.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            imported_by=self.user,
            file_name='synthetic.csv',
            file_sha256='d' * 64,
            status='validated',
            total_rows=2,
            valid_rows=1,
            invalid_rows=1,
        )
        self._create_public_fixture()
        EvidenceProjectionBinding.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            organization_uuid=ORG_UUID,
            site_uuid=SITE_UUID,
            cohort_uuid=COHORT_UUID,
            source_uuid=SOURCE_UUID,
        )

    def _create_public_fixture(self):
        with connection.cursor() as cursor:
            cursor.execute('''
                create table if not exists public.organizations (
                    id uuid primary key,
                    name text not null
                );
                create table if not exists public.organization_sites (
                    id uuid primary key,
                    organization_id uuid not null,
                    name text not null
                );
                create table if not exists public.cohorts (
                    id uuid primary key,
                    organization_id uuid not null,
                    site_id uuid null,
                    name text not null
                );
                create table if not exists public.data_sources (
                    id uuid primary key,
                    organization_id uuid not null,
                    site_id uuid null,
                    name text not null
                );
                create table if not exists public.evidence_baselines (
                    id uuid primary key,
                    organization_id uuid not null,
                    site_id uuid not null,
                    locked_at timestamptz null
                );
                create table if not exists public.evidence_observation_periods (
                    id uuid primary key,
                    organization_id uuid not null,
                    site_id uuid not null,
                    locked_at timestamptz null
                );
                create table if not exists public.evidence_commute_observations (
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
            cursor.execute('insert into public.organizations (id, name) values (%s, %s) on conflict do nothing', [str(ORG_UUID), 'Fictional Public Organization'])
            cursor.execute(
                'insert into public.organization_sites (id, organization_id, name) values (%s, %s, %s) on conflict do nothing',
                [str(SITE_UUID), str(ORG_UUID), 'Fictional Public Site'],
            )
            cursor.execute(
                'insert into public.cohorts (id, organization_id, site_id, name) values (%s, %s, %s, %s) on conflict do nothing',
                [str(COHORT_UUID), str(ORG_UUID), str(SITE_UUID), 'Fictional Public Cohort'],
            )
            cursor.execute(
                'insert into public.data_sources (id, organization_id, site_id, name) values (%s, %s, %s, %s) on conflict do nothing',
                [str(SOURCE_UUID), str(ORG_UUID), str(SITE_UUID), 'Fictional Public Source'],
            )
            cursor.execute(
                'insert into public.evidence_baselines (id, organization_id, site_id, locked_at) values (%s, %s, %s, null) on conflict do nothing',
                [str(BASELINE_UUID), str(ORG_UUID), str(SITE_UUID)],
            )

    def _record(self, **overrides):
        values = {
            'institution': self.institution,
            'site': self.site,
            'cohort': self.cohort,
            'commute_import': self.commute_import,
            'external_id': 'EMP-42',
            'origin_zone': 'Eagle Rock',
            'destination_zone': 'Pasadena HQ',
            'commute_days': ['Mon'],
            'arrival_window': '07:30-08:00',
            'departure_window': '16:30-17:00',
            'schedule_flex_minutes': 15,
            'current_mode': 'drive_alone',
            'occupants': None,
            'vehicle_fuel_type': 'gasoline',
            'parking_difficulty': 'high',
            'ev_interest': False,
            'access_point_willing': True,
            'consent_confirmed': True,
            'validation_status': 'valid',
            'source_row_number': 2,
            'source_payload': {'external_id': 'EMP-42', 'private_note': 'must-not-project'},
            'observation_date': date(2026, 9, 8),
            'one_way_miles': Decimal('8.40'),
        }
        values.update(overrides)
        return CommuterRecord.objects.create(**values)

    def _count_evidence(self):
        with connection.cursor() as cursor:
            cursor.execute('select count(*) from public.evidence_commute_observations where organization_id = %s', [str(ORG_UUID)])
            return cursor.fetchone()[0]

    def test_insert_then_retry_is_idempotent(self):
        record = self._record()
        first = project_commute_import_to_evidence(self.commute_import, actor=self.user, participant_key_secret='test-secret')
        second = project_commute_import_to_evidence(self.commute_import, actor=self.user, participant_key_secret='test-secret')
        self.assertEqual((first.inserted, first.updated, first.blocked), (1, 0, 0))
        self.assertEqual((second.inserted, second.updated, second.blocked), (0, 1, 0))
        self.assertEqual(self._count_evidence(), 1)
        self.assertTrue(AssessmentAuditEvent.objects.filter(action='evidence_projection.completed').count() >= 2)
        with connection.cursor() as cursor:
            cursor.execute(
                "select participant_key, original_payload->>'source_system', original_payload->>'canonical_record_id' from public.evidence_commute_observations where organization_id = %s",
                [str(ORG_UUID)],
            )
            participant_key, source_system, canonical_record_id = cursor.fetchone()
        self.assertTrue(participant_key.startswith('rr_'))
        self.assertNotIn(record.external_id, participant_key)
        self.assertEqual(source_system, SOURCE_SYSTEM_RELAY_RIDER_PROJECTION)
        self.assertEqual(canonical_record_id, str(record.id))

    def test_invalid_and_incomplete_records_are_counted_not_written(self):
        self._record(external_id='ready', source_row_number=2)
        self._record(external_id='no-consent', consent_confirmed=False, source_row_number=3)
        self._record(external_id='invalid', validation_status='invalid', source_row_number=4)
        result = project_commute_import_to_evidence(self.commute_import, actor=self.user, participant_key_secret='test-secret')
        self.assertEqual(result.inserted, 1)
        self.assertEqual(result.blocked, 1)
        self.assertEqual(result.skipped, 1)
        self.assertEqual(self._count_evidence(), 1)
        self.assertIn('CONSENT_INVALID', [issue.code for issue in result.issues])
        self.assertIn('RECORD_NOT_VALID', [issue.code for issue in result.issues])

    def test_cross_tenant_public_site_is_rejected(self):
        other_org = uuid4()
        with connection.cursor() as cursor:
            cursor.execute('insert into public.organizations (id, name) values (%s, %s)', [str(other_org), 'Other public org'])
        EvidenceProjectionBinding.objects.filter(institution=self.institution).delete()
        EvidenceProjectionBinding.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            organization_uuid=other_org,
            site_uuid=SITE_UUID,
            cohort_uuid=COHORT_UUID,
            source_uuid=SOURCE_UUID,
        )
        self._record(external_id='cross-tenant')
        with self.assertRaises(EvidenceProjectionUnavailable):
            project_commute_import_to_evidence(self.commute_import, actor=self.user, participant_key_secret='test-secret')
        self.assertEqual(self._count_evidence(), 0)
        self.assertTrue(AssessmentAuditEvent.objects.filter(action='evidence_projection.failed').exists())

    def test_locked_baseline_blocks_without_overwrite(self):
        record = self._record()
        first = project_commute_import_to_evidence(
            self.commute_import,
            actor=self.user,
            baseline_id=BASELINE_UUID,
            participant_key_secret='test-secret',
        )
        self.assertEqual(first.inserted, 1)
        with connection.cursor() as cursor:
            cursor.execute('update public.evidence_baselines set locked_at = now() where id = %s', [str(BASELINE_UUID)])
        record.one_way_miles = Decimal('9.10')
        record.save()
        second = project_commute_import_to_evidence(
            self.commute_import,
            actor=self.user,
            baseline_id=BASELINE_UUID,
            participant_key_secret='test-secret',
        )
        self.assertEqual(second.updated, 0)
        self.assertEqual(second.blocked, 1)
        self.assertIn('TARGET_LOCKED', [issue.code for issue in second.issues])
        with connection.cursor() as cursor:
            cursor.execute('select one_way_miles from public.evidence_commute_observations where organization_id = %s', [str(ORG_UUID)])
            miles = cursor.fetchone()[0]
        self.assertEqual(Decimal(str(miles)), Decimal('8.40'))

    def test_duplicate_projection_rows_fail_closed(self):
        record = self._record()
        project_commute_import_to_evidence(self.commute_import, actor=self.user, participant_key_secret='test-secret')
        with connection.cursor() as cursor:
            cursor.execute(
                '''insert into public.evidence_commute_observations (
                    organization_id, site_id, participant_key, observation_date, commute_mode,
                    reported_to_site, remote_day, ev_hybrid_status, validation_status, original_payload
                ) values (%s,%s,%s,%s,%s,true,false,'ice','valid',%s::jsonb)''',
                [
                    str(ORG_UUID), str(SITE_UUID), 'rr_duplicate', date(2026, 9, 8), 'drive_alone',
                    '{"relay_projection_key":"commuter_record:%s:relay-evidence-v1-20260909","source_system":"relay_rider_projection"}' % record.id,
                ],
            )
        with self.assertRaises(EvidenceProjectionUnavailable):
            project_commute_import_to_evidence(self.commute_import, actor=self.user, participant_key_secret='test-secret')

    def test_operator_command_prints_research_beta_guardrails(self):
        self._record()
        buffer = StringIO()
        call_command('project_commute_import_to_evidence', import_id=self.commute_import.id, stdout=buffer)
        output = buffer.getvalue()
        self.assertIn(f'canonical_import_id={self.commute_import.id}', output)
        self.assertIn('inserted=1', output)
        self.assertIn('calculation_output_only_not_certification', output)
        self.assertIn('research_beta=true', output)
