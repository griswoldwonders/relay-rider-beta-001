from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.test import TestCase

from .models import Cohort, DataSource, Institution, Membership, Program, Site
from .vertical_slice import (
    build_decision_card,
    dashboard_output,
    export_decision_card,
    import_commute_csv,
    run_core_engine,
    run_rule2202,
)


CSV_TEXT = """participant_ref,origin_zone,destination_zone,commute_mode,days_per_week,arrival_time,departure_time,vehicle_type,ev_hybrid
A1,Eagle Rock,Pasadena,drive_alone,5,08:00,17:00,gasoline,false
A2,Eagle Rock,Pasadena,zev,5,08:10,17:10,bev,true
A3,Glendale,Pasadena,transit,4,08:20,17:20,,false
BAD,,Pasadena,drive_alone,9,not-a-time,17:00,gasoline,maybe
"""


class CanonicalVerticalSliceTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='staff-a', password='pw')
        self.other_user = User.objects.create_user(username='staff-b', password='pw')
        self.institution = Institution.objects.create(name='Institution A', slug='institution-a', status='active')
        self.other_institution = Institution.objects.create(name='Institution B', slug='institution-b', status='active')
        Membership.objects.create(user=self.user, institution=self.institution, role='institution_admin')
        Membership.objects.create(user=self.other_user, institution=self.other_institution, role='institution_admin')
        self.program = Program.objects.create(institution=self.institution, name='Program A', slug='program-a')
        self.site = Site.objects.create(program=self.program, name='Pasadena Site', slug='pasadena-site')
        self.cohort = Cohort.objects.create(site=self.site, name='Weekday', slug='weekday')
        self.source = DataSource.objects.create(
            institution=self.institution,
            site=self.site,
            name='CSV source',
            provenance_note='Synthetic test data.',
        )

    def test_end_to_end_vertical_slice_preserves_provenance_and_caveats(self):
        batch = import_commute_csv(
            actor=self.user,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            filename='commuters.csv',
            csv_text=CSV_TEXT,
        )
        self.assertEqual(batch.row_count, 4)
        self.assertEqual(batch.valid_row_count, 3)
        self.assertEqual(batch.invalid_row_count, 1)
        self.assertEqual(batch.source_records.count(), 4)
        self.assertTrue(batch.source_records.filter(is_valid=False, validation_issues__isnull=False).exists())

        analysis = run_core_engine(actor=self.user, import_batch=batch)
        self.assertEqual(analysis.status, 'completed')
        self.assertEqual(analysis.input_snapshot['import_sha256'], batch.sha256)
        self.assertEqual(analysis.corridor_scores.count(), 2)
        top = analysis.corridor_scores.order_by('-compatibility_score').first()
        self.assertEqual(top.origin_zone, 'Eagle Rock')
        self.assertIn('weights', top.score_explanation)

        rule_run = run_rule2202(actor=self.user, analysis_run=analysis, execution_mode='reference_simulation')
        self.assertFalse(rule_run.deployment_verified)
        self.assertEqual(rule_run.status, 'completed')
        self.assertTrue(rule_run.results.filter(metric='avr').exists())

        card = build_decision_card(actor=self.user, analysis_run=analysis)
        self.assertEqual(card.status, 'draft')
        self.assertFalse(card.findings['rule2202']['deployment_verified'])
        self.assertTrue(any('reference simulation' in caveat.lower() for caveat in card.caveats))

        dashboard = dashboard_output(card)
        self.assertEqual(dashboard['institution'], 'Institution A')
        self.assertEqual(len(dashboard['corridors']), 2)

        json_export = export_decision_card(actor=self.user, decision_card=card, format='json')
        csv_export = export_decision_card(actor=self.user, decision_card=card, format='csv')
        self.assertTrue(json_export.sha256)
        self.assertIn('origin_zone,destination_zone', csv_export.content)

    def test_cross_institution_staff_cannot_import_or_export(self):
        with self.assertRaises(PermissionDenied):
            import_commute_csv(
                actor=self.other_user,
                site=self.site,
                cohort=self.cohort,
                data_source=self.source,
                filename='commuters.csv',
                csv_text=CSV_TEXT,
            )

    def test_database_rule2202_mode_fails_closed_without_verified_deployment_flag(self):
        batch = import_commute_csv(
            actor=self.user,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            filename='commuters.csv',
            csv_text=CSV_TEXT,
        )
        analysis = run_core_engine(actor=self.user, import_batch=batch)
        with self.assertRaises(RuntimeError):
            run_rule2202(actor=self.user, analysis_run=analysis, execution_mode='database_functions')
