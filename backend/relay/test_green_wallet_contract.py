from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ChargingHub, GreenRouteCredit, Institution, Membership, RedemptionRequest


class GreenWalletModelContractTests(TestCase):
    def test_credit_has_explicit_program_units_separate_from_impact_metrics(self):
        credit = GreenRouteCredit.objects.create(
            amount_units='12.50',
            unit_label='Green Route Credits',
            estimated_miles_reduced='4.00',
        )
        self.assertEqual(str(credit.amount_units), '12.50')
        self.assertEqual(credit.unit_label, 'Green Route Credits')
        self.assertNotEqual(credit.amount_units, credit.estimated_miles_reduced)

    def test_charging_hub_uses_canonical_machine_values(self):
        hub = ChargingHub.objects.create(name='Hub', network='Network', city='Pasadena')
        self.assertEqual(hub.status, 'candidate')
        self.assertEqual(hub.evidence_label, 'modeled')
        self.assertIn(('candidate', 'Candidate'), ChargingHub.STATUS_CHOICES)
        self.assertIn(('modeled', 'Modeled'), ChargingHub.EVIDENCE_LABEL_CHOICES)


class RedemptionStateMachineTests(APITestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name='Institution A', slug='institution-a')
        self.admin = User.objects.create_user(username='admin', password='pw')
        Membership.objects.create(user=self.admin, institution=self.institution, role='institution_admin')
        self.credit = GreenRouteCredit.objects.create(
            institution=self.institution,
            amount_units='10.00',
            unit_label='Green Route Credits',
        )
        self.hub = ChargingHub.objects.create(name='Hub', network='Network', city='Pasadena')
        self.request = RedemptionRequest.objects.create(
            institution=self.institution,
            credit=self.credit,
            charging_hub=self.hub,
            requested_units='2.00',
            unit_label='Green Route Credits',
        )
        self.client.force_authenticate(user=self.admin)

    def test_requested_can_move_to_under_review(self):
        response = self.client.patch(
            f'/api/redemption-requests/{self.request.id}/',
            {'status': 'under-review'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, 'under-review')
        self.assertIsNotNone(self.request.reviewed_at)
        self.assertEqual(self.request.reviewed_by, self.admin.get_username())

    def test_under_review_can_move_to_fulfilled(self):
        self.request.status = 'under-review'
        self.request.save(update_fields=['status'])
        response = self.client.patch(
            f'/api/redemption-requests/{self.request.id}/',
            {'status': 'fulfilled', 'review_note': 'Approved for research-beta fulfillment.'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, 'fulfilled')

    def test_requested_cannot_skip_directly_to_fulfilled(self):
        response = self.client.patch(
            f'/api/redemption-requests/{self.request.id}/',
            {'status': 'fulfilled'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, 'requested')

    def test_arbitrary_status_is_rejected(self):
        response = self.client.patch(
            f'/api/redemption-requests/{self.request.id}/',
            {'status': 'approved'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_cannot_set_reviewer_metadata(self):
        response = self.client.patch(
            f'/api/redemption-requests/{self.request.id}/',
            {
                'status': 'under-review',
                'reviewed_by': 'spoofed-admin',
                'reviewed_at': '2020-01-01T00:00:00Z',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.request.refresh_from_db()
        self.assertEqual(self.request.reviewed_by, self.admin.get_username())
        self.assertNotEqual(self.request.reviewed_at.year, 2020)


class ParticipantWalletProjectionTests(APITestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name='Institution A', slug='institution-a')
        self.user = User.objects.create_user(username='member', password='pw')
        Membership.objects.create(user=self.user, institution=self.institution, role='viewer')
        self.credit = GreenRouteCredit.objects.create(
            institution=self.institution,
            amount_units='7.00',
            unit_label='Green Route Credits',
            note='Research-beta participation',
        )
        self.client.force_authenticate(user=self.user)

    def test_credit_api_exposes_explicit_units_not_inferred_miles(self):
        response = self.client.get('/api/green-route-credits/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data[0]
        self.assertEqual(row['amount_units'], '7.00')
        self.assertEqual(row['unit_label'], 'Green Route Credits')
        self.assertEqual(row['status'], 'issued')
