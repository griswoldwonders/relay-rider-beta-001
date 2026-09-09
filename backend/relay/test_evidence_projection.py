from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase

from relay.models import (
    Cohort,
    CommuteImport,
    CommuterRecord,
    DataSource,
    EvidenceProjectionBinding,
    Institution,
    Site,
)
from relay.services.evidence_projection import (
    EvidenceProjectionUnavailable,
    normalize_record_for_evidence,
    project_commute_import_to_evidence,
)


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
            organization_uuid='11111111-1111-4111-8111-111111111111',
            site_uuid='22222222-2222-4222-8222-222222222222',
            cohort_uuid='33333333-3333-4333-8333-333333333333',
        )
        binding.full_clean()

    def test_binding_rejects_cross_tenant_site(self):
        other = Institution.objects.create(name='Other', slug='other')
        other_site = Site.objects.create(institution=other, name='Other Site', slug='other-site')
        binding = EvidenceProjectionBinding(
            institution=self.institution,
            site=other_site,
            organization_uuid='11111111-1111-4111-8111-111111111111',
            site_uuid='22222222-2222-4222-8222-222222222222',
        )
        with self.assertRaises(ValidationError):
            binding.full_clean()

    def test_binding_rejects_cross_site_cohort(self):
        second_site = Site.objects.create(institution=self.institution, name='Second', slug='second')
        binding = EvidenceProjectionBinding(
            institution=self.institution,
            site=second_site,
            cohort=self.cohort,
            organization_uuid='11111111-1111-4111-8111-111111111111',
            site_uuid='22222222-2222-4222-8222-222222222222',
            cohort_uuid='33333333-3333-4333-8333-333333333333',
        )
        with self.assertRaises(ValidationError):
            binding.full_clean()


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
        self.assertEqual(row['original_payload']['source_system'], 'relay_rider')
        self.assertEqual(row['original_payload']['canonical_record_id'], record.id)
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
            organization_uuid='11111111-1111-4111-8111-111111111111',
            site_uuid='22222222-2222-4222-8222-222222222222',
            cohort_uuid='33333333-3333-4333-8333-333333333333',
        )
        with self.assertRaises(EvidenceProjectionUnavailable):
            project_commute_import_to_evidence(
                self.commute_import,
                actor=self.user,
                participant_key_secret='test-secret',
            )
