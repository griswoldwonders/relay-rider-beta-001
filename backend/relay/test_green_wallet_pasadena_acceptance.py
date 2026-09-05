import json

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ChargingHub, GreenRouteCredit, Institution, Membership, Profile, RedemptionRequest


class PasadenaGreenWalletAcceptanceTest(APITestCase):
    """Synthetic end-to-end Green Wallet proof against the merged main baseline."""

    def setUp(self):
        self.pasadena = Institution.objects.create(
            name='Pasadena Mobility Research Institute',
            slug='pasadena-mobility-research-institute',
            status='active',
        )
        self.other = Institution.objects.create(
            name='Glendale Synthetic Institute',
            slug='glendale-synthetic-institute',
            status='active',
        )

        self.admin = User.objects.create_user(username='pasadena-admin', password='synthetic')
        self.viewer = User.objects.create_user(username='pasadena-viewer', password='synthetic')
        self.outsider = User.objects.create_user(username='glendale-viewer', password='synthetic')
        Membership.objects.create(user=self.admin, institution=self.pasadena, role='institution_admin')
        Membership.objects.create(user=self.viewer, institution=self.pasadena, role='viewer')
        Membership.objects.create(user=self.outsider, institution=self.other, role='viewer')

        self.participant = Profile.objects.create(
            institution=self.pasadena,
            name='Synthetic Pasadena Commuter',
            email='synthetic.commuter@example.test',
            role='participant',
            home_zone='Eagle Rock (approximate zone)',
            destination_zone='Pasadena (approximate zone)',
        )
        self.other_participant = Profile.objects.create(
            institution=self.other,
            name='Synthetic Glendale Commuter',
            email='synthetic.glendale@example.test',
        )

        self.hub = ChargingHub.objects.create(
            institution=self.pasadena,
            name='Synthetic Pasadena Program Charging Hub',
            network='Institution-operated',
            city='Pasadena',
            stalls=4,
            connector_types=['J1772'],
            status='active',
            evidence_label='synthetic',
        )
        self.credit = GreenRouteCredit.objects.create(
            institution=self.pasadena,
            profile=self.participant,
            amount_units='12.00',
            unit_label='Green Route Credits',
            status='issued',
            estimated_miles_reduced='4.50',
            estimated_co2_lbs_reduced='0.00',
            note='Synthetic Pasadena Green Wallet acceptance credit',
        )
        self.denial_credit = GreenRouteCredit.objects.create(
            institution=self.pasadena,
            profile=self.participant,
            amount_units='5.00',
            unit_label='Green Route Credits',
            status='issued',
            note='Synthetic denial-path credit',
        )
        self.other_credit = GreenRouteCredit.objects.create(
            institution=self.other,
            profile=self.other_participant,
            amount_units='9.00',
            unit_label='Green Route Credits',
            status='issued',
        )

    def emit(self, label, payload):
        print(f'ACCEPTANCE_EVIDENCE {label} {json.dumps(payload, default=str, sort_keys=True)}')

    def test_pasadena_green_wallet_full_proof_chain(self):
        # Institution -> Membership -> Participant/Profile -> explicit credit -> participant wallet API.
        self.client.force_authenticate(user=self.viewer)
        credits = self.client.get('/api/green-route-credits/')
        self.assertEqual(credits.status_code, status.HTTP_200_OK)
        credit_row = next(row for row in credits.data if row['id'] == self.credit.id)
        self.assertEqual(credit_row['profile'], self.participant.id)
        self.assertEqual(credit_row['amount_units'], '12.00')
        self.assertEqual(credit_row['unit_label'], 'Green Route Credits')
        self.assertEqual(credit_row['status'], 'issued')
        self.assertEqual(credit_row['estimated_miles_reduced'], '4.50')
        self.emit('wallet_credit_payload', credit_row)

        # Participant submits a governed request. Viewer participation is allowed; review is not.
        created = self.client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'profile': self.participant.id,
            'charging_hub': self.hub.id,
            'requested_units': '7.00',
            'idempotency_key': 'pasadena-acceptance-001',
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data['status'], 'requested')
        self.assertEqual(created.data['institution'], self.pasadena.id)
        self.assertEqual(created.data['profile'], self.participant.id)
        request_id = created.data['id']
        self.emit('redemption_requested_payload', created.data)

        # Viewer cannot conduct administrative review.
        viewer_review = self.client.patch(
            f'/api/redemption-requests/{request_id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertEqual(viewer_review.status_code, status.HTTP_403_FORBIDDEN)
        self.emit('viewer_review_denial', {'status_code': viewer_review.status_code})

        # Institution admin advances the canonical state machine.
        self.client.force_authenticate(user=self.admin)
        under_review = self.client.patch(
            f'/api/redemption-requests/{request_id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertEqual(under_review.status_code, status.HTTP_200_OK)
        self.assertEqual(under_review.data['status'], 'under-review')
        self.emit('redemption_under_review_payload', under_review.data)

        fulfilled = self.client.patch(
            f'/api/redemption-requests/{request_id}/',
            {
                'status': 'fulfilled',
                'review_note': 'Synthetic acceptance-test fulfillment; no payment or charging-network settlement.',
                'fulfillment_method': 'manual_program_action',
            },
            format='json',
        )
        self.assertEqual(fulfilled.status_code, status.HTTP_200_OK)
        self.assertEqual(fulfilled.data['status'], 'fulfilled')
        self.assertEqual(fulfilled.data['fulfillment_method'], 'manual_program_action')
        self.emit('redemption_fulfilled_payload', fulfilled.data)

        # The wallet credit remains issuance history; the fulfilled request makes its units unavailable.
        self.credit.refresh_from_db()
        self.assertEqual(self.credit.status, 'issued')
        requests = self.client.get('/api/redemption-requests/')
        self.assertEqual(requests.status_code, status.HTTP_200_OK)
        fulfilled_row = next(row for row in requests.data if row['id'] == request_id)
        self.assertEqual(fulfilled_row['status'], 'fulfilled')
        self.emit('wallet_post_fulfillment_state', {
            'credit_status': self.credit.status,
            'credit_amount_units': str(self.credit.amount_units),
            'request_status': fulfilled_row['status'],
            'request_units': fulfilled_row['requested_units'],
            'ui_availability_rule': 'non-denied request consumes availability',
        })

        # Overcommit prevention: 7 units are already committed/fulfilled, so 6 more would exceed 12.
        overcommit = self.client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'profile': self.participant.id,
            'charging_hub': self.hub.id,
            'requested_units': '6.00',
            'idempotency_key': 'pasadena-acceptance-overcommit',
        }, format='json')
        self.assertEqual(overcommit.status_code, status.HTTP_400_BAD_REQUEST)
        self.emit('overcommit_denial', {'status_code': overcommit.status_code, 'payload': overcommit.data})

        # Denial path releases held units and permits a later replacement request.
        self.client.force_authenticate(user=self.viewer)
        denied_request = self.client.post('/api/redemption-requests/', {
            'credit': self.denial_credit.id,
            'profile': self.participant.id,
            'charging_hub': self.hub.id,
            'requested_units': '5.00',
            'idempotency_key': 'pasadena-denial-001',
        }, format='json')
        self.assertEqual(denied_request.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.admin)
        denied_id = denied_request.data['id']
        self.assertEqual(self.client.patch(
            f'/api/redemption-requests/{denied_id}/', {'status': 'under-review'}, format='json'
        ).status_code, status.HTTP_200_OK)
        denied = self.client.patch(
            f'/api/redemption-requests/{denied_id}/',
            {'status': 'denied', 'review_note': 'Synthetic denial for acceptance coverage.'},
            format='json',
        )
        self.assertEqual(denied.status_code, status.HTTP_200_OK)
        self.assertEqual(denied.data['status'], 'denied')

        self.client.force_authenticate(user=self.viewer)
        replacement = self.client.post('/api/redemption-requests/', {
            'credit': self.denial_credit.id,
            'profile': self.participant.id,
            'charging_hub': self.hub.id,
            'requested_units': '5.00',
            'idempotency_key': 'pasadena-denial-replacement',
        }, format='json')
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED)
        self.emit('denial_release_and_replacement', {
            'denied_status': denied.data['status'],
            'replacement_status': replacement.data['status'],
            'replacement_units': replacement.data['requested_units'],
        })

        # Cross-tenant isolation on both read and create paths.
        self.client.force_authenticate(user=self.outsider)
        cross_read = self.client.get(f'/api/green-route-credits/{self.credit.id}/')
        self.assertIn(cross_read.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
        cross_create = self.client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'profile': self.participant.id,
            'charging_hub': self.hub.id,
            'requested_units': '1.00',
        }, format='json')
        self.assertEqual(cross_create.status_code, status.HTTP_400_BAD_REQUEST)
        self.emit('cross_tenant_denials', {
            'credit_read_status_code': cross_read.status_code,
            'redemption_create_status_code': cross_create.status_code,
        })

        self.assertEqual(
            RedemptionRequest.objects.filter(institution=self.pasadena, credit=self.credit).count(),
            1,
        )
