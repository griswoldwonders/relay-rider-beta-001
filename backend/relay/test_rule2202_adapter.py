from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from .analysis_engine import run_core_analysis
from .import_service import ingest_commuter_csv
from .models import Cohort, Institution, Site
from .rule2202_adapter import get_rule2202_readiness, run_rule2202


CSV = b"participant_key,origin_zone,destination_zone,current_mode,vehicle_classification\np-1,Eagle Rock,PCC,drive_alone,gasoline\n"


class Rule2202ReadinessTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name="Synthetic Institution", slug="synthetic", status="active")
        self.site = Site.objects.create(institution=self.institution, name="Main", slug="main")
        self.cohort = Cohort.objects.create(institution=self.institution, site=self.site, name="Staff", slug="staff")
        self.admin = get_user_model().objects.create_user(username="institution-admin")
        batch = ingest_commuter_csv(
            file_obj=BytesIO(CSV),
            filename="commute.csv",
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            uploaded_by=self.admin,
        )
        self.analysis_run = run_core_analysis(batch=batch, requested_by=self.admin)

    @override_settings(RELAY_RULE2202_STATE="unverified")
    def test_unverified_state_blocks_execution(self):
        readiness = get_rule2202_readiness()
        self.assertEqual(readiness.state, "unverified")
        self.assertFalse(readiness.can_execute)

    @override_settings(RELAY_RULE2202_STATE="unverified")
    @patch("relay.rule2202_adapter._execute_verified_rule2202")
    def test_unverified_rule2202_creates_unavailable_run_without_calling_database(self, execute):
        run = run_rule2202(analysis_run=self.analysis_run, requested_by=self.admin)
        self.assertEqual(run.status, "unavailable")
        self.assertEqual(run.readiness_state, "unverified")
        self.assertFalse(run.executed)
        execute.assert_not_called()

    @override_settings(RELAY_RULE2202_STATE="verified")
    @patch("relay.rule2202_adapter._execute_verified_rule2202")
    def test_verified_state_persists_calculation_outputs_without_compliance_claim(self, execute):
        execute.return_value = {"avr": "1.42", "calculation_only": True}
        run = run_rule2202(analysis_run=self.analysis_run, requested_by=self.admin)
        self.assertEqual(run.status, "completed")
        self.assertTrue(run.executed)
        self.assertEqual(run.output_manifest["avr"], "1.42")
        self.assertNotIn("compliant", run.output_manifest)
        execute.assert_called_once()
        inputs = execute.call_args.args[0]
        self.assertEqual(inputs["analysis_reproducibility_fingerprint"], self.analysis_run.reproducibility_fingerprint)
