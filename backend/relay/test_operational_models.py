from django.core.exceptions import ValidationError
from django.test import TestCase

from .models import Cohort, Institution, Site


class InstitutionalHierarchyTests(TestCase):
    def test_cohort_rejects_cross_institution_site(self):
        a = Institution.objects.create(name="A", slug="a", status="active")
        b = Institution.objects.create(name="B", slug="b", status="active")
        site = Site.objects.create(institution=a, name="Main", slug="main")
        cohort = Cohort(institution=b, site=site, name="Staff", slug="staff")

        with self.assertRaises(ValidationError):
            cohort.full_clean()
