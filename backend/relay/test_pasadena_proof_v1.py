from pathlib import Path

from django.contrib.auth.models import User
from django.test import TestCase

from relay.models import Cohort, DataSource, Institution, Membership, Site
from relay.services.ingestion import import_commute_csv


FIXTURE_PATH = Path(__file__).resolve().parent / 'fixtures' / 'pasadena_proof_v1.csv'


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
