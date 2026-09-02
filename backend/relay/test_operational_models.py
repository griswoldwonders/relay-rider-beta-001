from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from .models import (
    CanonicalCommuterRecord,
    Cohort,
    ImportBatch,
    ImportRow,
    Institution,
    Site,
)


class InstitutionalHierarchyTests(TestCase):
    def test_cohort_rejects_cross_institution_site(self):
        a = Institution.objects.create(name="A", slug="a", status="active")
        b = Institution.objects.create(name="B", slug="b", status="active")
        site = Site.objects.create(institution=a, name="Main", slug="main")
        cohort = Cohort(institution=b, site=site, name="Staff", slug="staff")

        with self.assertRaises(ValidationError):
            cohort.full_clean()


class CommuterProvenanceModelTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name="Synthetic Institution", slug="synthetic", status="active")
        self.site = Site.objects.create(institution=self.institution, name="Main Site", slug="main")
        self.cohort = Cohort.objects.create(
            institution=self.institution,
            site=self.site,
            name="Staff",
            slug="staff",
        )
        self.user = get_user_model().objects.create_user(username="institution-admin")

    def make_import_row(self, *, validation_status):
        batch = ImportBatch.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            uploaded_by=self.user,
            original_filename="commute.csv",
            file_sha256="0" * 64,
            schema_version="1.0",
            status="validated",
            total_rows=1,
            accepted_rows=0,
            rejected_rows=1,
        )
        return ImportRow.objects.create(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            batch=batch,
            row_number=1,
            raw_payload={"participant_key": "p-001"},
            normalized_payload={"participant_key": "p-001"},
            validation_status=validation_status,
            error_codes=["missing_origin_zone"] if validation_status == "rejected" else [],
            warning_codes=[],
        )

    def test_canonical_record_requires_accepted_source_row(self):
        row = self.make_import_row(validation_status="rejected")
        record = CanonicalCommuterRecord(
            institution=row.institution,
            site=row.site,
            cohort=row.cohort,
            source_row=row,
            participant_key="p-001",
            origin_zone="Eagle Rock",
            destination_zone="PCC",
        )

        with self.assertRaises(ValidationError):
            record.full_clean()
