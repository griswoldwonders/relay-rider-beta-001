"""Adapter-level tests (relay/ocpi/adapter.py). Covers required test
scenarios 1, 2, 4 (session half), 5, 7, 8, 9, 13, and 14 from the
implementation plan.
"""

from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from django.utils import timezone

from .. import adapter
from ..models import OcpiCdr, OcpiSession, WalletLedgerEntry
from .factories import cdr_payload, make_provider, make_redemption, session_payload


class HappyPathSettlementTests(TestCase):
    """Test 1: valid Session + CDR ingestion happy path -> correct
    WalletLedgerEntry."""

    def test_matched_cdr_creates_single_debit_ledger_entry(self):
        provider = make_provider()
        redemption = make_redemption(provider=provider, token_uid='TOKEN-UID-001', authorization_reference='AUTHREF-001')

        session_result = adapter.ingest_session(session_payload())
        self.assertEqual(session_result.status, 'created')

        cdr_result = adapter.ingest_cdr(cdr_payload())

        self.assertEqual(cdr_result.status, 'settled')
        self.assertIsNotNone(cdr_result.ledger_entry)
        self.assertEqual(cdr_result.ledger_entry.entry_type, 'DEBIT')
        self.assertEqual(cdr_result.ledger_entry.units, Decimal('5.000'))
        self.assertEqual(cdr_result.ledger_entry.redemption_request_id, redemption.pk)
        self.assertEqual(WalletLedgerEntry.objects.filter(redemption_request=redemption).count(), 1)
        self.assertEqual(OcpiCdr.objects.get(cdr_id='CDR-001').match_status, 'settled')


class ProviderTenantMismatchTests(TestCase):
    """Test 2: provider/tenant mismatch -> needs_review, no settlement."""

    def test_token_belonging_to_other_provider_is_not_matched(self):
        provider_a = make_provider(partner_id='PARTNER-A')
        provider_b = make_provider(partner_id='PARTNER-B', party_id='XYZ')
        # Redemption is scoped to provider B, but the CDR arrives under provider A.
        make_redemption(provider=provider_b, token_uid='TOKEN-UID-001', authorization_reference='AUTHREF-001')

        result = adapter.ingest_cdr(cdr_payload(partner_id='PARTNER-A'))

        self.assertEqual(result.status, 'needs_review')
        self.assertEqual(WalletLedgerEntry.objects.count(), 0)
        self.assertEqual(result.cdr.match_status, 'needs_review')
        self.assertIn('no unambiguous redemption match', result.reason)
        self.assertIsNotNone(provider_a)


class StaleAndCompletedSessionTests(TestCase):
    """Test 4 (session half): stale update to an already-COMPLETED
    session -> rejected; a genuinely stale (out-of-order) update is
    also rejected rather than silently applied."""

    def test_update_to_completed_session_is_rejected(self):
        provider = make_provider()
        adapter.ingest_session(session_payload(status='COMPLETED'))

        result = adapter.ingest_session(session_payload(kwh=Decimal('99.000')))

        self.assertEqual(result.status, 'rejected')
        self.assertIn('COMPLETED', result.reason)
        stored = OcpiSession.objects.get(provider=provider, external_session_id='SESSION-001')
        self.assertEqual(stored.kwh, Decimal('1.500'))  # untouched

    def test_stale_last_updated_is_ignored(self):
        make_provider()
        now = timezone.now()
        adapter.ingest_session(session_payload(last_updated=now, kwh=Decimal('3.000')))

        stale_result = adapter.ingest_session(
            session_payload(last_updated=now - timedelta(minutes=5), kwh=Decimal('999.000'))
        )

        self.assertEqual(stale_result.status, 'stale')
        stored = OcpiSession.objects.get(external_session_id='SESSION-001')
        self.assertEqual(stored.kwh, Decimal('3.000'))


class DuplicateCdrDeliveryTests(TestCase):
    """Test 5: duplicate CDR delivery (same provider+cdr_id twice) ->
    second delivery is a no-op returning the original result; the
    wallet is never double-debited."""

    def test_second_delivery_is_idempotent(self):
        provider = make_provider()
        make_redemption(provider=provider, token_uid='TOKEN-UID-001', authorization_reference='AUTHREF-001')

        first = adapter.ingest_cdr(cdr_payload())
        second = adapter.ingest_cdr(cdr_payload())

        self.assertEqual(first.status, 'settled')
        self.assertEqual(second.status, 'duplicate')
        self.assertEqual(second.cdr.pk, first.cdr.pk)
        self.assertEqual(WalletLedgerEntry.objects.filter(entry_type='DEBIT').count(), 1)
        self.assertEqual(OcpiCdr.objects.filter(cdr_id='CDR-001').count(), 1)


class UnmatchedTokenTests(TestCase):
    """Test 7: unmatched authorization references/token UIDs ->
    needs_review."""

    def test_unknown_token_and_authorization_reference_routes_to_review(self):
        make_provider()
        # No RedemptionRequest exists anywhere for this token/authref.
        result = adapter.ingest_cdr(cdr_payload(authorization_reference='', session_id=''))

        self.assertEqual(result.status, 'needs_review')
        self.assertEqual(WalletLedgerEntry.objects.count(), 0)
        self.assertIn('no unambiguous redemption match', result.reason)


class ReversalTests(TestCase):
    """Test 8: CDR reversal -> creates new WalletLedgerEntry; original
    CDR/ledger entries are untouched."""

    def test_reversal_creates_new_entry_without_mutating_original(self):
        provider = make_provider()
        make_redemption(provider=provider, token_uid='TOKEN-UID-001', authorization_reference='AUTHREF-001')

        original_result = adapter.ingest_cdr(cdr_payload())
        self.assertEqual(original_result.status, 'settled')
        original_cdr_id = original_result.cdr.pk
        original_energy = original_result.cdr.total_energy_kwh
        original_ledger_id = original_result.ledger_entry.pk

        reversal_result = adapter.ingest_cdr(
            cdr_payload(id='CDR-001-REV', credit=True, credit_reference_id='CDR-001', total_energy=Decimal('5.000'))
        )

        self.assertEqual(reversal_result.status, 'settled')
        self.assertEqual(reversal_result.ledger_entry.entry_type, 'REVERSAL')
        self.assertNotEqual(reversal_result.cdr.pk, original_cdr_id)
        self.assertNotEqual(reversal_result.ledger_entry.pk, original_ledger_id)

        # Original CDR row and its ledger entry are completely untouched.
        original_cdr = OcpiCdr.objects.get(pk=original_cdr_id)
        self.assertEqual(original_cdr.total_energy_kwh, original_energy)
        self.assertEqual(original_cdr.match_status, 'settled')
        original_ledger = WalletLedgerEntry.objects.get(pk=original_ledger_id)
        self.assertEqual(original_ledger.entry_type, 'DEBIT')

        self.assertEqual(WalletLedgerEntry.objects.count(), 2)
        self.assertEqual(OcpiCdr.objects.count(), 2)

    def test_reversal_of_unsettled_original_routes_to_review(self):
        provider = make_provider()
        # No matching redemption -> original never settles.
        original_result = adapter.ingest_cdr(cdr_payload(authorization_reference='', session_id=''))
        self.assertEqual(original_result.status, 'needs_review')

        reversal_result = adapter.ingest_cdr(
            cdr_payload(id='CDR-001-REV', credit=True, credit_reference_id='CDR-001')
        )
        self.assertEqual(reversal_result.status, 'needs_review')
        self.assertEqual(WalletLedgerEntry.objects.count(), 0)
        self.assertIsNotNone(provider)


class InsufficientUnitsTests(TestCase):
    """Test 9: insufficient remaining program units -> rejected/review,
    not partially settled."""

    def test_cdr_energy_exceeding_requested_units_is_not_partially_settled(self):
        provider = make_provider()
        make_redemption(
            provider=provider,
            token_uid='TOKEN-UID-001',
            authorization_reference='AUTHREF-001',
            requested_units='2.000',
        )

        result = adapter.ingest_cdr(cdr_payload(total_energy=Decimal('5.000')))

        self.assertEqual(result.status, 'needs_review')
        self.assertIn('exceeds', result.reason)
        self.assertEqual(WalletLedgerEntry.objects.count(), 0)


class CrossTenantIsolationTests(TestCase):
    """Test 13: cross-tenant data access -- a request scoped to
    provider/tenant A must never see or affect provider/tenant B's
    records."""

    def test_provider_a_cdr_cannot_match_or_mutate_provider_b_redemption(self):
        provider_a = make_provider(partner_id='PARTNER-A')
        provider_b = make_provider(partner_id='PARTNER-B', party_id='XYZ')
        redemption_b = make_redemption(
            provider=provider_b, token_uid='SHARED-TOKEN', authorization_reference='SHARED-AUTHREF'
        )

        result = adapter.ingest_cdr(
            cdr_payload(
                partner_id='PARTNER-A',
                authorization_reference='SHARED-AUTHREF',
                cdr_token={'uid': 'SHARED-TOKEN', 'type': 'APP_USER', 'contract_id': 'SHARED-TOKEN'},
            )
        )

        self.assertEqual(result.status, 'needs_review')
        self.assertEqual(WalletLedgerEntry.objects.filter(redemption_request=redemption_b).count(), 0)
        redemption_b.refresh_from_db()
        self.assertEqual(redemption_b.status, 'requested')  # untouched
        self.assertIsNotNone(provider_a)

    def test_provider_b_cdr_with_same_token_settles_independently(self):
        provider_a = make_provider(partner_id='PARTNER-A')
        provider_b = make_provider(partner_id='PARTNER-B', party_id='XYZ')
        make_redemption(provider=provider_a, token_uid='SHARED-TOKEN', authorization_reference='SHARED-AUTHREF-A')
        redemption_b = make_redemption(
            provider=provider_b, token_uid='SHARED-TOKEN', authorization_reference='SHARED-AUTHREF-B'
        )

        result = adapter.ingest_cdr(
            cdr_payload(
                partner_id='PARTNER-B',
                country_code='US',
                party_id='XYZ',
                authorization_reference='SHARED-AUTHREF-B',
                cdr_token={'uid': 'SHARED-TOKEN', 'type': 'APP_USER', 'contract_id': 'SHARED-TOKEN'},
                session_id='',
            )
        )

        self.assertEqual(result.status, 'settled')
        self.assertEqual(result.ledger_entry.redemption_request_id, redemption_b.pk)


class ForcedMidTransactionFailureTests(TestCase):
    """Test 14: DB rollback when settlement fails halfway (forced via
    monkeypatch) -> no partial WalletLedgerEntry/CDR state committed."""

    def test_forced_failure_after_cdr_create_rolls_back_everything(self):
        provider = make_provider()
        make_redemption(provider=provider, token_uid='TOKEN-UID-001', authorization_reference='AUTHREF-001')

        with mock.patch.object(
            adapter.WalletLedgerEntry.objects, 'create', side_effect=RuntimeError('simulated mid-transaction failure')
        ):
            with self.assertRaises(RuntimeError):
                adapter.ingest_cdr(cdr_payload())

        self.assertEqual(OcpiCdr.objects.count(), 0)
        self.assertEqual(WalletLedgerEntry.objects.count(), 0)
