from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import TestCase

from .analysis_engine import run_core_analysis
from .import_service import ingest_commuter_csv
from .models import AnalysisMetric, Cohort, Institution, Site


CSV = b"participant_key,origin_zone,destination_zone,current_mode,vehicle_classification,parking_difficulty,ev_hybrid_signal\np-1,Eagle Rock,PCC,drive_alone,gasoline,high,\np-2,Glendale,PCC,carpool,ev,medium,ev\n"


class CoreAnalysisTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name="Synthetic Institution", slug="synthetic", status="active")
        self.site = Site.objects.create(institution=self.institution, name="Main Site", slug="main")
        self.cohort = Cohort.objects.create(institution=self.institution, site=self.site, name="Staff", slug="staff")
        self.admin = get_user_model().objects.create_user(username="institution-admin")
        self.batch = ingest_commuter_csv(
            file_obj=BytesIO(CSV),
            filename="commute.csv",
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            uploaded_by=self.admin,
        )

    def test_same_batch_produces_same_reproducibility_fingerprint(self):
        first = run_core_analysis(batch=self.batch, requested_by=self.admin)
        second = run_core_analysis(batch=self.batch, requested_by=self.admin)
        self.assertEqual(first.reproducibility_fingerprint, second.reproducibility_fingerprint)
        self.assertEqual(first.status, "completed")
        self.assertTrue(AnalysisMetric.objects.filter(analysis_run=first, metric_key="gasoline_sov_count").exists())
        metric = AnalysisMetric.objects.get(analysis_run=first, metric_key="corridor_opportunity")
        self.assertEqual(metric.evidence_class, "modeled")
        self.assertTrue(metric.source_manifest)
