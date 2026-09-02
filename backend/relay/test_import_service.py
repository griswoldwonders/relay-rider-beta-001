from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import TestCase

from .import_service import ingest_commuter_csv
from .models import CanonicalCommuterRecord, Cohort, Institution, Site


CSV = b"participant_key,origin_zone,destination_zone,current_mode,vehicle_classification\np-1,Eagle Rock,PCC,drive_alone,gasoline\np-1,Glendale,PCC,drive_alone,gasoline\n"


class CommuterCsvIngestionTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name="Synthetic Institution", slug="synthetic", status="active")
        self.site = Site.objects.create(institution=self.institution, name="Main Site", slug="main")
        self.cohort = Cohort.objects.create(
            institution=self.institution,
            site=self.site,
            name="Staff",
            slug="staff",
        )
        self.admin = get_user_model().objects.create_user(username="institution-admin")

    def ingest(self):
        return ingest_commuter_csv(
            file_obj=BytesIO(CSV),
            filename="commute.csv",
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            uploaded_by=self.admin,
        )

    def test_duplicate_participant_key_rejects_second_row(self):
        batch = self.ingest()
        self.assertEqual(batch.total_rows, 2)
        self.assertEqual(batch.accepted_rows, 1)
        self.assertEqual(batch.rejected_rows, 1)
        self.assertEqual(
            CanonicalCommuterRecord.objects.filter(source_row__batch=batch).count(),
            1,
        )
        rejected = batch.rows.get(row_number=2)
        self.assertEqual(rejected.validation_status, "rejected")
        self.assertIn("duplicate_participant_key", rejected.error_codes)

    def test_same_csv_has_same_source_hash_but_distinct_batches(self):
        first = self.ingest()
        second = self.ingest()
        self.assertNotEqual(first.pk, second.pk)
        self.assertEqual(first.file_sha256, second.file_sha256)
