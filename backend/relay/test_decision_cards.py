from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import TestCase

from .analysis_engine import run_core_analysis
from .decision_cards import generate_decision_card
from .import_service import ingest_commuter_csv
from .models import Cohort, Institution, Site


CSV = b"participant_key,origin_zone,destination_zone,current_mode,vehicle_classification,parking_difficulty\np-1,Eagle Rock,PCC,drive_alone,gasoline,high\np-2,Glendale,PCC,carpool,ev,medium\n"


class DecisionCardTests(TestCase):
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

    def test_decision_card_links_findings_to_metrics_and_preserves_evidence_classes(self):
        card = generate_decision_card(analysis_run=self.analysis_run, requested_by=self.admin)
        self.assertEqual(card.analysis_run_id, self.analysis_run.id)
        self.assertTrue(card.evidence_manifest)
        self.assertIn("modeled", {item["evidence_class"] for item in card.evidence_manifest})
        self.assertEqual(card.reproducibility_fingerprint, self.analysis_run.reproducibility_fingerprint)
        self.assertTrue(all("metric_key" in item for item in card.evidence_manifest))
        self.assertNotIn("guaranteed", card.headline.lower())
