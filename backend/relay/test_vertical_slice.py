from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from relay.models import Cohort, DataSource, Institution, Membership, Site
from relay.services import ingestion
from relay.services.core_engine import score_commuter_record
from relay.services.exports import dashboard_payload
from relay.services.ingestion import import_commute_csv
from relay.services.vertical_slice import run_vertical_slice


CSV_CONTENT = """external_id,origin_zone,destination_zone,commute_days,arrival_window,departure_window,schedule_flex_minutes,current_mode,occupants,vehicle_fuel_type,parking_difficulty,ev_interest,access_point_willing,consent_confirmed
R1,Eagle Rock,Pasadena Campus,Mon|Tue|Wed,07:30-08:00,16:30-17:00,20,drive_alone,,gasoline,high,yes,yes,yes
R2,Glendale,Pasadena Campus,Mon|Wed,08:00-08:30,17:00-17:30,10,carpool,2,hybrid,medium,no,yes,yes
"""

INVALID_CSV_CONTENT = """external_id,origin_zone,destination_zone,commute_days,arrival_window,departure_window,schedule_flex_minutes,current_mode,occupants,vehicle_fuel_type,parking_difficulty,ev_interest,access_point_willing,consent_confirmed,extra_note
BAD1,,Pasadena Campus,,07:30-08:00,16:30-17:00,-5,carpool,1,gasoline,high,maybe,no,maybe,retain this raw field
"""

MISSING_HEADER_CSV = """external_id,origin_zone,destination_zone,commute_days,arrival_window,departure_window,current_mode
R1,Eagle Rock,Pasadena Campus,Mon,07:30-08:00,16:30-17:00,drive_alone
"""


class FakeRule2202Calculator:
    def vehicle_trip_weight(self, mode, occupants=None):
        if mode == 'drive_alone':
            return Decimal('1')
        if mode == 'carpool':
            return Decimal('1') / Decimal(str(occupants))
        return Decimal('0')

    def calculate_avr(self, employees, vehicle_trips):
        return (Decimal(str(employees)) / Decimal(str(vehicle_trips))).quantize(Decimal('0.01'))


class VerticalSliceTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='inst-admin', password='pw')
        self.institution = Institution.objects.create(name='Fictional Institution', slug='fictional-institution', status='active')
        Membership.objects.create(user=self.user, institution=self.institution, role='institution_admin')
        self.site = Site.objects.create(institution=self.institution, name='Demo Campus', slug='demo-campus', site_type='campus')
        self.cohort = Cohort.objects.create(institution=self.institution, site=self.site, name='Demo Cohort', slug='demo-cohort')
        self.source = DataSource.objects.create(
            institution=self.institution,
            site=self.site,
            name='Synthetic CSV',
            source_type='synthetic',
            provenance_label='synthetic',
        )

    def _import(self, content=CSV_CONTENT, file_name='demo.csv'):
        return import_commute_csv(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            actor=self.user,
            file_name=file_name,
            content=content,
        )

    def test_import_validation_exposes_canonical_schema_contract(self):
        self.assertTrue(hasattr(ingestion, 'COMMUTE_IMPORT_SCHEMA'))
        self.assertEqual(ingestion.COMMUTE_IMPORT_SCHEMA.name, 'relay_rider_commute_import_v1')

    def test_csv_import_persists_provenance_and_canonical_records(self):
        commute_import = self._import()
        self.assertEqual(commute_import.total_rows, 2)
        self.assertEqual(commute_import.valid_rows, 2)
        self.assertEqual(commute_import.invalid_rows, 0)
        self.assertEqual(commute_import.records.count(), 2)
        self.assertEqual(len(commute_import.file_sha256), 64)
        self.assertEqual(commute_import.validation_summary['provenance_label'], 'synthetic')

    def test_pandera_validation_retains_invalid_row_errors_and_raw_payload(self):
        commute_import = self._import(INVALID_CSV_CONTENT, file_name='invalid.csv')
        self.assertEqual(commute_import.total_rows, 1)
        self.assertEqual(commute_import.valid_rows, 0)
        self.assertEqual(commute_import.invalid_rows, 1)
        self.assertEqual(commute_import.status, 'completed')

        record = commute_import.records.get(external_id='BAD1')
        self.assertEqual(record.validation_status, 'invalid')
        self.assertIn('origin_zone is required', record.validation_errors)
        self.assertIn('commute_days is required', record.validation_errors)
        self.assertIn('schedule_flex_minutes must be non-negative', record.validation_errors)
        self.assertIn('ev_interest must be yes/no or true/false', record.validation_errors)
        self.assertIn('consent_confirmed must be yes/no or true/false', record.validation_errors)
        self.assertIn('carpool occupants must be between 2 and 6', record.validation_errors)
        self.assertEqual(record.schedule_flex_minutes, 0)
        self.assertEqual(record.occupants, 1)
        self.assertFalse(record.ev_interest)
        self.assertFalse(record.consent_confirmed)
        self.assertEqual(record.source_row_number, 2)
        self.assertEqual(record.source_payload['extra_note'], 'retain this raw field')

    def test_missing_required_header_still_fails_before_import_persistence(self):
        with self.assertRaisesMessage(ValueError, 'missing required CSV columns: consent_confirmed'):
            self._import(MISSING_HEADER_CSV, file_name='missing-header.csv')
        self.assertFalse(self.institution.commute_imports.filter(file_name='missing-header.csv').exists())

    def test_import_rejects_cross_tenant_hierarchy(self):
        other = Institution.objects.create(name='Other', slug='other')
        other_site = Site.objects.create(institution=other, name='Other Site', slug='other-site')
        with self.assertRaises(ValueError):
            import_commute_csv(
                institution=self.institution,
                site=other_site,
                cohort=self.cohort,
                data_source=self.source,
                actor=self.user,
                file_name='demo.csv',
                content=CSV_CONTENT,
            )

    def test_core_engine_score_is_explainable_and_non_regulatory(self):
        commute_import = self._import()
        record = commute_import.records.get(external_id='R1')
        self.assertEqual(record.origin_zone, 'Eagle Rock')
        self.assertEqual(record.destination_zone, 'Pasadena Campus')
        self.assertEqual(record.commute_days, ['Mon', 'Tue', 'Wed'])
        self.assertEqual(record.schedule_flex_minutes, 20)
        self.assertEqual(record.current_mode, 'drive_alone')
        self.assertEqual(record.vehicle_fuel_type, 'gasoline')
        self.assertEqual(record.parking_difficulty, 'high')
        self.assertTrue(record.ev_interest)
        self.assertTrue(record.access_point_willing)
        self.assertTrue(record.consent_confirmed)

        score, factors, explanation = score_commuter_record(record)
        self.assertEqual(score, 100)
        self.assertEqual(factors['drive_alone'], 35)
        self.assertIn('gasoline/ICE', explanation)

    def test_end_to_end_vertical_slice_records_rule2202_and_decision_card(self):
        result = run_vertical_slice(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            actor=self.user,
            file_name='demo.csv',
            csv_content=CSV_CONTENT,
            rule2202_calculator=FakeRule2202Calculator(),
        )
        self.assertEqual(len(result['scores']), 2)
        self.assertEqual(result['rule2202_run'].status, 'completed')
        self.assertEqual(result['rule2202_run'].result_snapshot['avr'], '1.33')
        self.assertEqual(result['decision_card'].status, 'ready_for_review')
        self.assertIn('Calculated AVR', [item['label'] for item in result['decision_card'].evidence])
        self.assertGreaterEqual(self.institution.assessment_audit_events.count(), 4)

        payload = dashboard_payload(self.institution)
        self.assertEqual(payload['summary']['commuter_records'], 2)
        self.assertEqual(payload['latest_decision_card']['rule2202_status'], 'completed')
        self.assertFalse(payload['guardrails']['rule2202_is_certification'])

    def test_default_local_sqlite_path_blocks_rule2202_instead_of_faking_it(self):
        result = run_vertical_slice(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            actor=self.user,
            file_name='demo.csv',
            csv_content=CSV_CONTENT,
        )
        self.assertEqual(result['rule2202_run'].status, 'blocked')
        self.assertIn('PostgreSQL', result['rule2202_run'].blocked_reason)
        self.assertEqual(result['decision_card'].status, 'draft')


class InstitutionalOutputTenancyTests(APITestCase):
    def setUp(self):
        self.inst_a = Institution.objects.create(name='A', slug='a')
        self.inst_b = Institution.objects.create(name='B', slug='b')
        self.user_a = User.objects.create_user(username='a-user', password='pw')
        self.user_b = User.objects.create_user(username='b-user', password='pw')
        Membership.objects.create(user=self.user_a, institution=self.inst_a, role='viewer')
        Membership.objects.create(user=self.user_b, institution=self.inst_b, role='viewer')

    def test_dashboard_requires_same_tenant_membership(self):
        self.client.force_authenticate(self.user_a)
        own = self.client.get(f'/api/institutions/{self.inst_a.id}/dashboard/')
        other = self.client.get(f'/api/institutions/{self.inst_b.id}/dashboard/')
        self.assertEqual(own.status_code, status.HTTP_200_OK)
        self.assertEqual(other.status_code, status.HTTP_403_FORBIDDEN)

    def test_csv_export_requires_same_tenant_membership(self):
        self.client.force_authenticate(self.user_a)
        own = self.client.get(f'/api/institutions/{self.inst_a.id}/commuter-records.csv')
        other = self.client.get(f'/api/institutions/{self.inst_b.id}/commuter-records.csv')
        self.assertEqual(own.status_code, status.HTTP_200_OK)
        self.assertEqual(own['Content-Type'], 'text/csv; charset=utf-8')
        self.assertEqual(other.status_code, status.HTTP_403_FORBIDDEN)
