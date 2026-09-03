"""DRF endpoint tests for OcpiSessionIngestView / OcpiCdrIngestView.

Exercises the actual HTTP boundary (permission classes, serializer
validation, and the envelope response shape) via APIClient rather than
calling relay/ocpi/adapter.py functions directly -- see
relay/ocpi/tests/test_adapter.py for adapter-level coverage.
"""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import OcpiCdr, OcpiSession, WalletLedgerEntry
from .factories import cdr_payload, make_provider, make_redemption, session_payload

User = get_user_model()


class OcpiIngestPermissionTests(APITestCase):
    """Unauthenticated and non-admin callers must never reach the adapter."""

    def setUp(self):
        self.session_url = reverse('ocpi-session-ingest')
        self.cdr_url = reverse('ocpi-cdr-ingest')

    def test_unauthenticated_session_request_is_rejected(self):
        response = self.client.post(self.session_url, session_payload(), format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertEqual(OcpiSession.objects.count(), 0)

    def test_unauthenticated_cdr_request_is_rejected(self):
        response = self.client.post(self.cdr_url, cdr_payload(), format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertEqual(OcpiCdr.objects.count(), 0)

    def test_authenticated_non_admin_participant_is_forbidden(self):
        participant = User.objects.create_user(username='participant', password='pw', is_staff=False)
        self.client.force_authenticate(user=participant)

        session_response = self.client.post(self.session_url, session_payload(), format='json')
        cdr_response = self.client.post(self.cdr_url, cdr_payload(), format='json')

        self.assertEqual(session_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(cdr_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(OcpiSession.objects.count(), 0)
        self.assertEqual(OcpiCdr.objects.count(), 0)


class OcpiSessionIngestViewTests(APITestCase):
    def setUp(self):
        self.url = reverse('ocpi-session-ingest')
        self.admin = User.objects.create_user(username='admin', password='pw', is_staff=True)
        self.client.force_authenticate(user=self.admin)
        make_provider()

    def test_admin_with_valid_payload_gets_200_and_matches_adapter_result(self):
        response = self.client.post(self.url, session_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body['status_code'], 1000)
        stored = OcpiSession.objects.get(external_session_id='SESSION-001')
        self.assertEqual(body['data']['id'], stored.external_session_id)
        self.assertEqual(body['data']['status'], stored.status)
        self.assertEqual(body['data']['ingestion_status'], 'created')

    def test_malformed_payload_returns_400_with_no_side_effects(self):
        payload = session_payload()
        del payload['kwh']
        payload['country_code'] = 'usa'  # wrong shape: lowercase, wrong length

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        body = response.json()
        self.assertEqual(body['status_code'], 2000)
        self.assertEqual(OcpiSession.objects.count(), 0)

    def test_wrong_type_field_returns_400(self):
        payload = session_payload()
        payload['cdr_token'] = 'not-an-object'

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(OcpiSession.objects.count(), 0)


class OcpiCdrIngestViewTests(APITestCase):
    def setUp(self):
        self.url = reverse('ocpi-cdr-ingest')
        self.admin = User.objects.create_user(username='admin2', password='pw', is_staff=True)
        self.client.force_authenticate(user=self.admin)
        self.provider = make_provider()

    def test_admin_with_valid_matched_payload_settles_and_matches_adapter_result(self):
        make_redemption(provider=self.provider, token_uid='TOKEN-UID-001', authorization_reference='AUTHREF-001')

        response = self.client.post(self.url, cdr_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body['status_code'], 1000)
        self.assertEqual(body['data']['status'], 'SETTLED')
        self.assertEqual(body['data']['matched'], True)
        self.assertEqual(body['data']['cdr_id'], 'CDR-001')
        self.assertEqual(WalletLedgerEntry.objects.filter(entry_type='DEBIT').count(), 1)

    def test_malformed_payload_missing_required_field_returns_400(self):
        payload = cdr_payload()
        del payload['total_cost']

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        body = response.json()
        self.assertEqual(body['status_code'], 2000)
        self.assertEqual(OcpiCdr.objects.count(), 0)
        self.assertEqual(WalletLedgerEntry.objects.count(), 0)

    def test_wrong_type_field_returns_400_with_no_side_effects(self):
        payload = cdr_payload()
        payload['total_energy'] = 'not-a-number'

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(OcpiCdr.objects.count(), 0)

    def test_duplicate_delivery_returns_original_result(self):
        make_redemption(provider=self.provider, token_uid='TOKEN-UID-001', authorization_reference='AUTHREF-001')
        first = self.client.post(self.url, cdr_payload(), format='json')
        second = self.client.post(self.url, cdr_payload(), format='json')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.json()['data']['status'], 'DUPLICATE')
        self.assertEqual(WalletLedgerEntry.objects.filter(entry_type='DEBIT').count(), 1)
