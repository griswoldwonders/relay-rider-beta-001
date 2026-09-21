from django.test import TestCase

from relay.models import Institution, Site
from relay.services.privacy_geography import (
    GeographyObservation,
    PrivacyGeographyError,
    PrivacyGeographyScope,
    transform_observations,
)


class PrivacyGeographyScopeBoundaryTests(TestCase):
    def test_transform_revalidates_cross_tenant_scope_relationships(self):
        institution = Institution.objects.create(
            name='Scope Institution',
            slug='scope-institution',
            status='active',
        )
        other = Institution.objects.create(
            name='Other Scope Institution',
            slug='other-scope-institution',
            status='active',
        )
        other_site = Site.objects.create(
            institution=other,
            name='Other Scope Site',
            slug='other-scope-site',
        )
        forged_scope = PrivacyGeographyScope(
            institution=institution,
            site=other_site,
        )
        observation = GeographyObservation(
            record_id='R1',
            origin_lat=34.15,
            origin_lng=-118.14,
            destination_lat=34.14,
            destination_lng=-118.13,
            geography_authorized=True,
            provenance_label='synthetic',
        )

        with self.assertRaisesMessage(PrivacyGeographyError, 'site scope mismatch'):
            transform_observations(
                scope=forged_scope,
                observations=[observation],
            )
