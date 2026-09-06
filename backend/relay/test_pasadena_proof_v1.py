import csv
import io
import json
from decimal import Decimal
from pathlib import Path

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from relay.models import Cohort, DataSource, Institution, Membership, Site
from relay.services.ingestion import import_commute_csv
from relay.services.vertical_slice import run_vertical_slice


FIXTURE_PATH = Path(__file__).resolve().parent / 'fixtures' / 'pasadena_proof_v1.csv'


class FakeRule2202Calculator:
    """Deterministic SQLite boundary; PostgreSQL CI verifies the real SQL implementation separately."""

    def vehicle_trip_weight(self, mode, occupants=None):
        if mode == 'drive_alone':
            return Decimal('1')
        if mode == 'carpool':
            return Decimal('1') / Decimal(str(occupants))
        return Decimal('0')

    def calculate_avr(self, employees, vehicle_trips):
        if not vehicle_trips:
            return Decimal('0.00')
        return (Decimal(str(employees)) / Decimal(str(vehicle_trips))).quantize(Decimal('0.01'))


class PasadenaProofV1ValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='pasadena-proof-admin', password='pw')
        self.institution = Institution.objects.create(
            name='Pasadena Demonstration Institution',
            slug='pasadena-demonstration-institution',
            status='active',
        )
        Membership.objects.create(
            user=self.user,
            institution=self.institution,
            role='institution_admin',
        )
        self.site = Site.objects.create(
            institution=self.institution,
            name='PDI Central Campus',
            slug='pdi-central-campus',
            site_type='campus',
            city='Pasadena',
        )
        self.cohort = Cohort.objects.create(
            institution=self.institution,
            site=self.site,
            name='Fall 2026 Commuter Research Cohort',
            slug='fall-2026-commuter-research-cohort',
            cohort_type='synthetic_demo',
        )
        self.source = DataSource.objects.create(
            institution=self.institution,
            site=self.site,
            name='Pasadena Proof v1 synthetic cohort',
            source_type='synthetic',
            provenance_label='synthetic',
            source_reference='backend/relay/fixtures/pasadena_proof_v1.csv',
            metadata={'fictional': True, 'acceptance_fixture': 'pasadena-proof-v1'},
        )

    def _import(self):
        return import_commute_csv(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            actor=self.user,
            file_name=FIXTURE_PATH.name,
            content=FIXTURE_PATH.read_text(encoding='utf-8'),
        )

    def test_fixture_reconciles_to_28_valid_and_4_invalid_rows(self):
        commute_import = self._import()

        self.assertEqual(commute_import.total_rows, 32)
        self.assertEqual(commute_import.valid_rows, 28)
        self.assertEqual(commute_import.invalid_rows, 4)
        self.assertEqual(commute_import.records.count(), 31)
        self.assertEqual(commute_import.records.filter(validation_status='valid').count(), 28)
        self.assertEqual(commute_import.records.filter(validation_status='invalid').count(), 3)
        self.assertEqual(len(commute_import.validation_summary['rejected_rows']), 1)
        self.assertEqual(commute_import.validation_summary['provenance_label'], 'synthetic')
        self.assertEqual(len(commute_import.file_sha256), 64)

    def test_reversed_arrival_window_is_retained_as_invalid_audit_record(self):
        commute_import = self._import()
        record = commute_import.records.get(external_id='PDI-X001')

        self.assertEqual(record.validation_status, 'invalid')
        self.assertIn('arrival_window start must be before end', record.validation_errors)

    def test_drive_alone_without_vehicle_fuel_type_is_invalid(self):
        commute_import = self._import()
        record = commute_import.records.get(external_id='PDI-X003')

        self.assertEqual(record.validation_status, 'invalid')
        self.assertIn('vehicle_fuel_type is required for drive_alone', record.validation_errors)

    def test_duplicate_external_id_is_rejected_with_raw_provenance_retained(self):
        commute_import = self._import()
        rejected = commute_import.validation_summary['rejected_rows']

        self.assertEqual(len(rejected), 1)
        self.assertEqual(rejected[0]['source_row_number'], 33)
        self.assertEqual(rejected[0]['external_id'], 'PDI-C001')
        self.assertIn('external_id must be unique within import', rejected[0]['validation_errors'])
        self.assertEqual(rejected[0]['source_payload']['external_id'], 'PDI-C001')
        self.assertEqual(commute_import.records.filter(external_id='PDI-C001').count(), 1)

    def test_missing_origin_zone_remains_invalid(self):
        commute_import = self._import()
        record = commute_import.records.get(external_id='PDI-X002')

        self.assertEqual(record.validation_status, 'invalid')
        self.assertIn('origin_zone is required', record.validation_errors)


class PasadenaProofV1FullChainTests(APITestCase):
    def test_32_row_fixture_reaches_reviewed_decision_card_dashboard_and_export(self):
        institution = Institution.objects.create(
            name='Pasadena Demonstration Institution RC Proof',
            slug='pasadena-demonstration-institution-rc-proof',
            status='active',
        )
        site = Site.objects.create(
            institution=institution,
            name='PDI Central Campus RC Proof',
            slug='pdi-central-campus-rc-proof',
            site_type='campus',
            city='Pasadena',
        )
        cohort = Cohort.objects.create(
            institution=institution,
            site=site,
            name='Fall 2026 Commuter Research Cohort RC Proof',
            slug='fall-2026-commuter-research-cohort-rc-proof',
            cohort_type='synthetic_demo',
        )
        source = DataSource.objects.create(
            institution=institution,
            site=site,
            name='Pasadena Proof v1 synthetic cohort',
            source_type='synthetic',
            provenance_label='synthetic',
            source_reference='backend/relay/fixtures/pasadena_proof_v1.csv',
            metadata={'fictional': True, 'acceptance_fixture': 'pasadena-proof-v1'},
        )
        admin = User.objects.create_user(username='pasadena-proof-chain-admin', password='synthetic')
        Membership.objects.create(user=admin, institution=institution, role='institution_admin')
        token = Token.objects.create(user=admin)

        result = run_vertical_slice(
            institution=institution,
            site=site,
            cohort=cohort,
            data_source=source,
            actor=admin,
            file_name=FIXTURE_PATH.name,
            csv_content=FIXTURE_PATH.read_text(encoding='utf-8'),
            rule2202_calculator=FakeRule2202Calculator(),
        )

        self.assertEqual(result['commute_import'].total_rows, 32)
        self.assertEqual(result['commute_import'].valid_rows, 28)
        self.assertEqual(result['commute_import'].invalid_rows, 4)
        self.assertEqual(len(result['scores']), 28)
        self.assertEqual(result['rule2202_run'].status, 'completed')
        self.assertEqual(result['decision_card'].status, 'ready_for_review')
        self.assertEqual(result['decision_card'].provenance['commute_import_id'], result['commute_import'].id)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        review = self.client.post(
            f"/api/decision-cards/{result['decision_card'].id}/review/",
            {'review_note': 'Synthetic Pasadena Proof v1 administrative review.'},
            format='json',
        )
        self.assertEqual(review.status_code, status.HTTP_200_OK)
        self.assertEqual(review.data['status'], 'reviewed')

        dashboard = self.client.get(f'/api/institutions/{institution.id}/dashboard/')
        export = self.client.get(f'/api/institutions/{institution.id}/commuter-records.csv')
        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        self.assertEqual(export.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard.data['summary']['commuter_records'], 31)
        self.assertEqual(dashboard.data['summary']['valid_commuter_records'], 28)
        self.assertEqual(dashboard.data['summary']['decision_cards'], 1)
        self.assertEqual(dashboard.data['latest_decision_card']['status'], 'reviewed')
        self.assertFalse(dashboard.data['guardrails']['live_transportation'])
        self.assertFalse(dashboard.data['guardrails']['rule2202_is_certification'])

        exported_rows = list(csv.DictReader(io.StringIO(export.content.decode('utf-8'))))
        self.assertEqual(len(exported_rows), 31)
        self.assertEqual(sum(row['validation_status'] == 'valid' for row in exported_rows), 28)
        self.assertEqual(sum(row['validation_status'] == 'invalid' for row in exported_rows), 3)

        print('PASADENA_PROOF_V1_EVIDENCE ' + json.dumps({
            'institution': institution.name,
            'site': site.name,
            'cohort': cohort.name,
            'source_rows': result['commute_import'].total_rows,
            'canonical_records': result['commute_import'].records.count(),
            'valid_records': result['commute_import'].valid_rows,
            'invalid_source_rows': result['commute_import'].invalid_rows,
            'rejected_duplicate_rows': len(result['commute_import'].validation_summary['rejected_rows']),
            'engine_scores': len(result['scores']),
            'rule2202_status': result['rule2202_run'].status,
            'decision_card_status': review.data['status'],
            'dashboard_status_code': dashboard.status_code,
            'csv_export_status_code': export.status_code,
            'exported_records': len(exported_rows),
            'file_sha256': result['commute_import'].file_sha256,
            'live_transportation': False,
            'rule2202_is_certification': False,
        }, sort_keys=True))
