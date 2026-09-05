from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import NoReverseMatch, reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    ChargingHub,
    GreenRouteCredit,
    Institution,
    Membership,
    ProgramBenefitPolicy,
    RedemptionRequest,
    WalletLedgerEntry,
)
from .views import RedemptionRequestViewSet


class ProgramBenefitPolicyTenancyTests(APITestCase):
    def setUp(self):
        self.institution_a = Institution.objects.create(name='Institution A', slug='policy-institution-a')
        self.institution_b = Institution.objects.create(name='Institution B', slug='policy-institution-b')
        self.user_a = User.objects.create_user(username='policy-staff-a', password='pw')
        Membership.objects.create(user=self.user_a, institution=self.institution_a, role='institution_admin')

        self.policy_a = ProgramBenefitPolicy.objects.create(
            institution=self.institution_a,
            unit_label='Green Route Credits',
        )
        self.policy_b = ProgramBenefitPolicy.objects.create(
            institution=self.institution_b,
            unit_label='Green Route Credits',
        )

    def test_policy_defaults_are_conservative_and_nullable(self):
        self.assertEqual(self.policy_a.version, 1)
        self.assertEqual(self.policy_a.status, 'draft')
        self.assertIsNone(self.policy_a.max_units_per_participant)
        self.assertIsNone(self.policy_a.max_units_program_wide)
        self.assertIsNone(self.policy_a.expiry_days)
        self.assertEqual(self.policy_a.founder_approval_reference, '')

    def test_same_tenant_list_returns_only_own_institution_policy(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/program-benefit-policies/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row['id'] for row in response.data}
        self.assertIn(self.policy_a.id, ids)
        self.assertNotIn(self.policy_b.id, ids)

    def test_unauthenticated_list_rejected(self):
        response = self.client.get('/api/program-benefit-policies/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class WalletLedgerEntryImmutabilityTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name='Institution A', slug='ledger-institution-a')
        self.credit = GreenRouteCredit.objects.create(
            institution=self.institution,
            amount_units='10.00',
            unit_label='Green Route Credits',
        )

    def test_no_public_crud_route_is_registered_for_ledger_entries(self):
        with self.assertRaises(NoReverseMatch):
            reverse('walletledgerentry-list')

    def test_guessed_ledger_endpoint_path_is_not_routed(self):
        response = self.client.get('/api/wallet-ledger-entries/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_entry_type_must_be_one_of_the_supported_values(self):
        entry = WalletLedgerEntry.objects.create(
            credit=self.credit,
            institution=self.institution,
            entry_type='HOLD',
            quantity_delta='2.00',
            reason='Redemption request submitted',
            correlation_id='corr-1',
        )
        self.assertEqual(entry.entry_type, 'HOLD')
        self.assertIn(('ADJUSTMENT', 'Adjustment'), WalletLedgerEntry.ENTRY_TYPE_CHOICES)

    def test_persisted_entry_cannot_be_updated(self):
        entry = WalletLedgerEntry.objects.create(
            credit=self.credit,
            institution=self.institution,
            entry_type='HOLD',
            quantity_delta='2.00',
            reason='Original reason',
            correlation_id='corr-immutable-update',
        )
        entry.reason = 'Tampered reason'
        entry.quantity_delta = '999.00'
        with self.assertRaises(ValueError):
            entry.save()
        entry.refresh_from_db()
        self.assertEqual(entry.reason, 'Original reason')
        self.assertEqual(str(entry.quantity_delta), '2.00')

    def test_persisted_entry_cannot_be_updated_via_queryset_update(self):
        entry = WalletLedgerEntry.objects.create(
            credit=self.credit,
            institution=self.institution,
            entry_type='HOLD',
            quantity_delta='2.00',
            reason='Original reason',
            correlation_id='corr-immutable-queryset-update',
        )
        with self.assertRaises(ValueError):
            WalletLedgerEntry.objects.filter(pk=entry.pk).update(reason='Tampered via queryset')
        entry.refresh_from_db()
        self.assertEqual(entry.reason, 'Original reason')

    def test_persisted_entry_cannot_be_deleted(self):
        entry = WalletLedgerEntry.objects.create(
            credit=self.credit,
            institution=self.institution,
            entry_type='HOLD',
            quantity_delta='2.00',
            reason='Original reason',
            correlation_id='corr-immutable-delete',
        )
        with self.assertRaises(ValueError):
            entry.delete()
        self.assertTrue(WalletLedgerEntry.objects.filter(pk=entry.pk).exists())

    def test_persisted_entry_cannot_be_deleted_via_queryset_delete(self):
        entry = WalletLedgerEntry.objects.create(
            credit=self.credit,
            institution=self.institution,
            entry_type='HOLD',
            quantity_delta='2.00',
            reason='Original reason',
            correlation_id='corr-immutable-queryset-delete',
        )
        with self.assertRaises(ValueError):
            WalletLedgerEntry.objects.filter(pk=entry.pk).delete()
        self.assertTrue(WalletLedgerEntry.objects.filter(pk=entry.pk).exists())


class RedemptionRequestLedgerIntegrationTests(APITestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name='Institution A', slug='ledger-flow-institution-a')
        self.admin = User.objects.create_user(username='ledger-admin', password='pw')
        Membership.objects.create(user=self.admin, institution=self.institution, role='institution_admin')
        self.credit = GreenRouteCredit.objects.create(
            institution=self.institution,
            amount_units='10.00',
            unit_label='Green Route Credits',
        )
        self.active_hub = ChargingHub.objects.create(
            name='Active Hub', network='Network', city='Pasadena', status='active',
        )
        self.candidate_hub = ChargingHub.objects.create(
            name='Candidate Hub', network='Network', city='Pasadena', status='candidate',
        )
        self.shared_active_hub = ChargingHub.objects.create(
            name='Shared Active Hub', network='Network', city='Pasadena', status='active', institution=None,
        )
        self.client.force_authenticate(user=self.admin)

    def test_creating_redemption_request_records_a_hold_ledger_entry(self):
        response = self.client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'charging_hub': self.active_hub.id,
            'requested_units': '2.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        request_id = response.data['id']
        holds = WalletLedgerEntry.objects.filter(
            redemption_request_id=request_id, entry_type='HOLD',
        )
        self.assertEqual(holds.count(), 1)
        self.assertEqual(str(holds.first().quantity_delta), '2.00')

    def test_repeated_post_with_same_idempotency_key_does_not_double_hold(self):
        payload = {
            'credit': self.credit.id,
            'charging_hub': self.active_hub.id,
            'requested_units': '2.00',
            'idempotency_key': 'idem-key-1',
        }
        first = self.client.post('/api/redemption-requests/', payload, format='json')
        second = self.client.post('/api/redemption-requests/', payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(RedemptionRequest.objects.filter(credit=self.credit).count(), 1)
        self.assertEqual(
            WalletLedgerEntry.objects.filter(entry_type='HOLD', credit=self.credit).count(), 1,
        )

    def test_only_active_hub_is_selectable_for_a_new_redemption_request(self):
        response = self.client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'charging_hub': self.candidate_hub.id,
            'requested_units': '2.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('charging_hub', response.data)
        self.assertEqual(RedemptionRequest.objects.count(), 0)
        self.assertEqual(WalletLedgerEntry.objects.count(), 0)

    def test_shared_active_hub_with_no_institution_remains_selectable(self):
        response = self.client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'charging_hub': self.shared_active_hub.id,
            'requested_units': '2.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_denial_records_a_release_ledger_entry(self):
        created = self.client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'charging_hub': self.active_hub.id,
            'requested_units': '2.00',
        }, format='json')
        request_id = created.data['id']
        self.client.patch(f'/api/redemption-requests/{request_id}/', {'status': 'under-review'}, format='json')
        response = self.client.patch(f'/api/redemption-requests/{request_id}/', {'status': 'denied'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        releases = WalletLedgerEntry.objects.filter(redemption_request_id=request_id, entry_type='RELEASE')
        self.assertEqual(releases.count(), 1)

    def test_fulfillment_records_a_debit_ledger_entry(self):
        created = self.client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'charging_hub': self.active_hub.id,
            'requested_units': '2.00',
        }, format='json')
        request_id = created.data['id']
        self.client.patch(f'/api/redemption-requests/{request_id}/', {'status': 'under-review'}, format='json')
        response = self.client.patch(
            f'/api/redemption-requests/{request_id}/',
            {'status': 'fulfilled', 'fulfillment_method': 'manual_program_action', 'review_note': 'Manually fulfilled for research-beta pilot.'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        debits = WalletLedgerEntry.objects.filter(redemption_request_id=request_id, entry_type='DEBIT')
        self.assertEqual(debits.count(), 1)

    def test_fulfillment_method_field_documents_it_is_not_a_charge_session_claim(self):
        field = RedemptionRequest._meta.get_field('fulfillment_method')
        help_text = field.help_text.lower()
        self.assertIn('not', help_text)
        self.assertIn('charge session', help_text)


class RedemptionRequestConcurrentIdempotencyTests(APITestCase):
    """Exercises the true race window deterministically, not just the pre-query fast path.

    Real thread/DB-lock races against Django's in-memory sqlite test database
    are not a portable way to prove this: sqlite serializes writers, so
    concurrent threads reliably produce `database table is locked` errors
    that are an artifact of the test transport, not of the idempotency logic
    under test. Instead, this simulates the exact race window directly: a
    "winning" request (as if committed by a concurrent caller) is inserted
    first, then the fast-path existence check
    (`RedemptionRequestViewSet._find_existing_redemption_request`) is forced
    to miss it exactly once via mocking -- reproducing the moment where our
    request's fast-path check ran before the concurrent writer committed.
    The real code path then has to fall through to the insert, hit the
    database's unique constraint, catch the resulting IntegrityError, and
    recover by returning the winner's row. This proves the constraint +
    IntegrityError handling actually prevents a duplicate HOLD, rather than
    only proving the pre-query check works when it gets lucky.
    """

    def setUp(self):
        self.institution = Institution.objects.create(name='Institution A', slug='race-institution-a')
        self.admin = User.objects.create_user(username='race-admin', password='pw')
        Membership.objects.create(user=self.admin, institution=self.institution, role='institution_admin')
        self.credit = GreenRouteCredit.objects.create(
            institution=self.institution,
            amount_units='10.00',
            unit_label='Green Route Credits',
        )
        self.active_hub = ChargingHub.objects.create(
            name='Active Hub', network='Network', city='Pasadena', status='active',
        )
        self.client.force_authenticate(user=self.admin)

    def test_fast_path_miss_still_recovers_via_the_unique_constraint_and_integrity_error_handling(self):
        winning_request = RedemptionRequest.objects.create(
            institution=self.institution,
            credit=self.credit,
            charging_hub=self.active_hub,
            requested_units='2.00',
            unit_label=self.credit.unit_label,
            status='requested',
            idempotency_key='race-idem-key',
        )
        WalletLedgerEntry.objects.create(
            credit=self.credit,
            institution=self.institution,
            redemption_request=winning_request,
            entry_type='HOLD',
            quantity_delta='2.00',
            reason='Simulated concurrent winner already committed.',
            correlation_id='race-idem-key',
        )

        payload = {
            'credit': self.credit.id,
            'charging_hub': self.active_hub.id,
            'requested_units': '2.00',
            'idempotency_key': 'race-idem-key',
        }

        real_lookup = RedemptionRequestViewSet._find_existing_redemption_request
        call_count = {'n': 0}

        def lookup_that_misses_once(self, credit_id, idempotency_key):
            call_count['n'] += 1
            if call_count['n'] == 1:
                return None
            return real_lookup(self, credit_id, idempotency_key)

        with patch.object(RedemptionRequestViewSet, '_find_existing_redemption_request', lookup_that_misses_once):
            response = self.client.post('/api/redemption-requests/', payload, format='json')

        self.assertEqual(call_count['n'], 2, 'expected exactly one fast-path miss and one post-IntegrityError recovery lookup')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['id'], winning_request.id)
        self.assertEqual(RedemptionRequest.objects.filter(credit=self.credit).count(), 1)
        self.assertEqual(
            WalletLedgerEntry.objects.filter(entry_type='HOLD', credit=self.credit).count(), 1,
        )

    def test_direct_model_insert_with_duplicate_idempotency_key_violates_unique_constraint(self):
        RedemptionRequest.objects.create(
            institution=self.institution,
            credit=self.credit,
            charging_hub=self.active_hub,
            requested_units='2.00',
            unit_label=self.credit.unit_label,
            status='requested',
            idempotency_key='duplicate-key',
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                RedemptionRequest.objects.create(
                    institution=self.institution,
                    credit=self.credit,
                    charging_hub=self.active_hub,
                    requested_units='2.00',
                    unit_label=self.credit.unit_label,
                    status='requested',
                    idempotency_key='duplicate-key',
                )
        self.assertEqual(
            RedemptionRequest.objects.filter(credit=self.credit, idempotency_key='duplicate-key').count(), 1,
        )
