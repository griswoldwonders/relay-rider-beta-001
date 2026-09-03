"""Pure(ish) matching + settlement adapter: normalized OCPI Session/CDR
-> Green Wallet redemption match -> append-only ledger entry.

This module is the "clearly defined Python adapter" required by the
integration plan (see docs/OCPI_GREEN_WALLET_REPO_INTEGRATION.md and
docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md). It ports the
matching precedence and idempotency behavior already implemented in
JavaScript in src/lib/ocpi/sessionCdr.js to this Django/Python
connector boundary, backed by real database transactions and
constraints instead of an in-memory store.

Matching precedence (see "Matching precedence" table in
docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md):
  1. authorization_reference -- exact match to one redemption, same provider
  2. session_id -- via an already-linked OcpiSession for the same provider
  3. cdr_token.uid -- exact match to one redemption, same provider
  4. none of the above -> needs_review; never guess, never auto-debit.

Never double-debit: every settlement path runs inside
transaction.atomic() with select_for_update() on the matched
RedemptionRequest row, and the database also enforces a partial
unique constraint (one DEBIT per CDR) as a backstop. See
relay/ocpi/models.py:WalletLedgerEntry.
"""

from __future__ import annotations

import dataclasses
import time
from decimal import Decimal
from typing import Optional

from django.db import IntegrityError, OperationalError, transaction

from relay.models import RedemptionRequest

from .models import OcpiCdr, OcpiProvider, OcpiSession, WalletLedgerEntry

REVIEW_REASONS = {
    'unknown_provider': 'unknown or inactive OCPI provider',
    'no_match': 'no unambiguous redemption match by authorization_reference, session_id, or token UID',
    'provider_mismatch': 'matched redemption belongs to a different provider/tenant scope',
    'denied_redemption': 'matched redemption was denied and is not eligible for settlement',
    'already_settled': "matched redemption already has a settled DEBIT ledger entry",
    'insufficient_units': "CDR energy exceeds the redemption's remaining approved units",
    'reversal_unknown_original': 'credit_reference_id does not reference a known CDR for this provider',
    'reversal_unsettled_original': 'original CDR was never matched/settled; nothing to reverse',
}

_CONTENTION_RETRIES = 3
_CONTENTION_BACKOFF_SECONDS = 0.05


@dataclasses.dataclass
class SessionIngestResult:
    status: str  # 'created' | 'updated' | 'rejected' | 'stale'
    record: Optional[OcpiSession]
    reason: str = ''


@dataclasses.dataclass
class CdrIngestResult:
    status: str  # 'settled' | 'needs_review' | 'duplicate'
    cdr: Optional[OcpiCdr]
    ledger_entry: Optional[WalletLedgerEntry] = None
    reason: str = ''


def get_active_provider(partner_id: str) -> Optional[OcpiProvider]:
    return OcpiProvider.objects.filter(partner_id=partner_id, status='active').first()


# ---------------------------------------------------------------------------
# Session ingestion
# ---------------------------------------------------------------------------

def ingest_session(data: dict) -> SessionIngestResult:
    provider = get_active_provider(data['partner_id'])
    if provider is None:
        return SessionIngestResult(status='rejected', record=None, reason=REVIEW_REASONS['unknown_provider'])

    with transaction.atomic():
        existing = (
            OcpiSession.objects.select_for_update()
            .filter(
                provider=provider,
                country_code=data['country_code'],
                party_id=data['party_id'],
                external_session_id=data['id'],
            )
            .first()
        )
        if existing is not None:
            if existing.status == 'COMPLETED':
                return SessionIngestResult(
                    status='rejected',
                    record=existing,
                    reason='session already COMPLETED; the final state is immutable and cannot be reopened',
                )
            if data['last_updated'] <= existing.last_updated:
                return SessionIngestResult(
                    status='stale',
                    record=existing,
                    reason='stale last_updated; a newer or equal update was already applied',
                )
            existing.location_id = data.get('location_id', existing.location_id)
            existing.evse_uid = data.get('evse_uid', existing.evse_uid)
            existing.connector_id = data.get('connector_id', existing.connector_id)
            existing.currency = data.get('currency', existing.currency)
            existing.status = data.get('status', existing.status)
            existing.kwh = data.get('kwh', existing.kwh)
            existing.start_date_time = data.get('start_date_time', existing.start_date_time)
            existing.end_date_time = data.get('end_date_time', existing.end_date_time)
            existing.last_updated = data['last_updated']
            existing.token_uid = data.get('cdr_token', {}).get('uid', existing.token_uid)
            existing.authorization_reference = data.get('authorization_reference', existing.authorization_reference)
            existing.raw_payload = data
            existing.save()
            return SessionIngestResult(status='updated', record=existing)

        session = OcpiSession.objects.create(
            provider=provider,
            country_code=data['country_code'],
            party_id=data['party_id'],
            external_session_id=data['id'],
            location_id=data.get('location_id', ''),
            evse_uid=data.get('evse_uid', ''),
            connector_id=data.get('connector_id', ''),
            token_uid=data.get('cdr_token', {}).get('uid', ''),
            authorization_reference=data.get('authorization_reference', ''),
            status=data.get('status', 'PENDING'),
            kwh=data.get('kwh', 0),
            currency=data.get('currency', ''),
            start_date_time=data.get('start_date_time'),
            end_date_time=data.get('end_date_time'),
            last_updated=data['last_updated'],
            raw_payload=data,
        )
        return SessionIngestResult(status='created', record=session)


# ---------------------------------------------------------------------------
# CDR ingestion, matching, and settlement
# ---------------------------------------------------------------------------

def _find_redemption_by_authorization_reference(reference, provider) -> Optional[RedemptionRequest]:
    if not reference:
        return None
    matches = list(RedemptionRequest.objects.filter(authorization_reference=reference, ocpi_provider=provider))
    return matches[0] if len(matches) == 1 else None


def _find_redemption_by_token_uid(token_uid, provider) -> Optional[RedemptionRequest]:
    if not token_uid:
        return None
    matches = list(RedemptionRequest.objects.filter(token_uid=token_uid, ocpi_provider=provider))
    return matches[0] if len(matches) == 1 else None


def _find_redemption_by_session(cdr_data, provider) -> Optional[RedemptionRequest]:
    session_id = cdr_data.get('session_id')
    if not session_id:
        return None
    session = OcpiSession.objects.filter(
        provider=provider,
        country_code=cdr_data['country_code'],
        party_id=cdr_data['party_id'],
        external_session_id=session_id,
    ).first()
    if session is None:
        return None
    if session.authorization_reference:
        found = _find_redemption_by_authorization_reference(session.authorization_reference, provider)
        if found is not None:
            return found
    if session.token_uid:
        return _find_redemption_by_token_uid(session.token_uid, provider)
    return None


def match_redemption_for_cdr(cdr_data: dict, provider: OcpiProvider):
    """Pure matching precedence (no writes): authorization_reference,
    then session_id, then cdr_token.uid, each scoped to `provider` so a
    token/reference belonging to a different tenant is never matched.
    Returns (redemption_or_None, reason_code_or_None).
    """
    by_auth = _find_redemption_by_authorization_reference(cdr_data.get('authorization_reference'), provider)
    if by_auth is not None:
        return by_auth, None
    by_session = _find_redemption_by_session(cdr_data, provider)
    if by_session is not None:
        return by_session, None
    by_token = _find_redemption_by_token_uid(cdr_data.get('cdr_token', {}).get('uid'), provider)
    if by_token is not None:
        return by_token, None
    return None, 'no_match'


def ingest_cdr(data: dict) -> CdrIngestResult:
    provider = get_active_provider(data['partner_id'])
    if provider is None:
        return CdrIngestResult(status='needs_review', cdr=None, reason=REVIEW_REASONS['unknown_provider'])

    last_error = None
    for _ in range(_CONTENTION_RETRIES):
        try:
            with transaction.atomic():
                return _ingest_cdr_locked(data, provider)
        except IntegrityError:
            existing = OcpiCdr.objects.filter(provider=provider, cdr_id=data['id']).first()
            if existing is not None:
                return CdrIngestResult(
                    status='duplicate',
                    cdr=existing,
                    reason='duplicate CDR delivery for (provider, cdr_id); returning the original result',
                )
            last_error = IntegrityError
            continue
        except OperationalError:
            # SQLite lock contention when simulating concurrent delivery
            # in tests; brief backoff then retry, per the belt-and-
            # suspenders concurrency contract documented on
            # WalletLedgerEntry.
            last_error = OperationalError
            time.sleep(_CONTENTION_BACKOFF_SECONDS)
            continue

    existing = OcpiCdr.objects.filter(provider=provider, cdr_id=data['id']).first()
    if existing is not None:
        return CdrIngestResult(status='duplicate', cdr=existing, reason='resolved after contention retry')
    raise last_error or RuntimeError('ingest_cdr failed after contention retries with no persisted result')


def _ingest_cdr_locked(data: dict, provider: OcpiProvider) -> CdrIngestResult:
    existing = OcpiCdr.objects.select_for_update().filter(provider=provider, cdr_id=data['id']).first()
    if existing is not None:
        return CdrIngestResult(
            status='duplicate',
            cdr=existing,
            reason='duplicate CDR delivery for (provider, cdr_id); returning the original result',
        )

    if data.get('credit'):
        return _ingest_reversal_cdr(data, provider)

    redemption, reason_code = match_redemption_for_cdr(data, provider)
    review_reason = REVIEW_REASONS.get(reason_code, '') if reason_code else ''
    matched_redemption = None
    settleable = False

    if redemption is not None:
        # Re-fetch under lock: this is the "never double-debit" guard --
        # concurrent CDR deliveries that match the same redemption
        # serialize here for the duration of this transaction.
        redemption = RedemptionRequest.objects.select_for_update().get(pk=redemption.pk)
        if redemption.ocpi_provider_id != provider.id:
            review_reason = REVIEW_REASONS['provider_mismatch']
        elif redemption.status == 'denied':
            review_reason = REVIEW_REASONS['denied_redemption']
        elif WalletLedgerEntry.objects.filter(redemption_request=redemption, entry_type='DEBIT').exists():
            review_reason = REVIEW_REASONS['already_settled']
        elif Decimal(str(data['total_energy'])) > redemption.requested_units:
            review_reason = REVIEW_REASONS['insufficient_units']
        else:
            settleable = True
            matched_redemption = redemption

    session = None
    if data.get('session_id'):
        session = OcpiSession.objects.filter(
            provider=provider,
            country_code=data['country_code'],
            party_id=data['party_id'],
            external_session_id=data['session_id'],
        ).first()

    cdr = OcpiCdr.objects.create(
        provider=provider,
        session=session,
        country_code=data['country_code'],
        party_id=data['party_id'],
        cdr_id=data['id'],
        external_session_id=data.get('session_id', ''),
        token_uid=data.get('cdr_token', {}).get('uid', ''),
        authorization_reference=data.get('authorization_reference', ''),
        start_date_time=data['start_date_time'],
        end_date_time=data['end_date_time'],
        total_energy_kwh=data['total_energy'],
        total_time_seconds=data['total_time'],
        currency=data['total_cost']['currency'],
        total_cost_excl_vat=data['total_cost']['excl_vat'],
        total_cost_incl_vat=data['total_cost'].get('incl_vat'),
        is_credit=False,
        raw_payload=data,
        match_status='needs_review',
        matched_redemption=None,
        review_reason=review_reason,
    )

    if not settleable:
        return CdrIngestResult(status='needs_review', cdr=cdr, reason=review_reason)

    try:
        ledger_entry = WalletLedgerEntry.objects.create(
            provider=provider,
            redemption_request=matched_redemption,
            cdr=cdr,
            entry_type='DEBIT',
            units=Decimal(str(data['total_energy'])),
            unit_label=matched_redemption.unit_label,
            note=f'OCPI CDR {cdr.cdr_id} settlement',
        )
    except IntegrityError:
        # The DB constraint is the final backstop: a concurrent request
        # already created the DEBIT for this CDR. Treat this as settled
        # (not an error) and surface the entry that actually won.
        ledger_entry = WalletLedgerEntry.objects.filter(cdr=cdr, entry_type='DEBIT').first()

    cdr.match_status = 'settled'
    cdr.matched_redemption = matched_redemption
    cdr.save(update_fields=['match_status', 'matched_redemption', 'updated_at'])

    return CdrIngestResult(status='settled', cdr=cdr, ledger_entry=ledger_entry)


def _ingest_reversal_cdr(data: dict, provider: OcpiProvider) -> CdrIngestResult:
    """A credit CDR (data['credit'] is true) reverses a previously
    settled CDR. This always creates a brand-new OcpiCdr row (its own
    cdr_id) and, if eligible, a brand-new REVERSAL WalletLedgerEntry --
    it never edits the original CDR or the original DEBIT entry.

    Note (documented limitation, not exercised by the required test
    suite): if a provider sends more than one distinct credit CDR
    referencing the same original, each is treated as its own
    settlement event since OCPI permits multiple credit CDRs. A
    program-level "total reversed must not exceed original" policy
    would be a reconciliation-job concern, not this adapter's.
    """
    original = (
        OcpiCdr.objects.select_for_update()
        .filter(provider=provider, cdr_id=data.get('credit_reference_id'))
        .first()
    )
    matched_redemption = None
    review_reason = ''
    settleable = False

    if original is None:
        review_reason = REVIEW_REASONS['reversal_unknown_original']
    elif original.matched_redemption_id is None or original.match_status != 'settled':
        review_reason = REVIEW_REASONS['reversal_unsettled_original']
    else:
        matched_redemption = original.matched_redemption
        settleable = True

    cdr = OcpiCdr.objects.create(
        provider=provider,
        session=None,
        country_code=data['country_code'],
        party_id=data['party_id'],
        cdr_id=data['id'],
        external_session_id=data.get('session_id', ''),
        token_uid=data.get('cdr_token', {}).get('uid', ''),
        authorization_reference=data.get('authorization_reference', ''),
        start_date_time=data['start_date_time'],
        end_date_time=data['end_date_time'],
        total_energy_kwh=data['total_energy'],
        total_time_seconds=data['total_time'],
        currency=data['total_cost']['currency'],
        total_cost_excl_vat=data['total_cost']['excl_vat'],
        total_cost_incl_vat=data['total_cost'].get('incl_vat'),
        is_credit=True,
        credit_reference_id=data.get('credit_reference_id', ''),
        raw_payload=data,
        match_status='needs_review',
        matched_redemption=matched_redemption,
        review_reason=review_reason,
    )

    if not settleable:
        return CdrIngestResult(status='needs_review', cdr=cdr, reason=review_reason)

    ledger_entry = WalletLedgerEntry.objects.create(
        provider=provider,
        redemption_request=matched_redemption,
        cdr=cdr,
        entry_type='REVERSAL',
        units=Decimal(str(data['total_energy'])),
        unit_label=matched_redemption.unit_label,
        note=f'Reversal of OCPI CDR {original.cdr_id}',
    )
    cdr.match_status = 'settled'
    cdr.save(update_fields=['match_status', 'updated_at'])
    return CdrIngestResult(status='settled', cdr=cdr, ledger_entry=ledger_entry)
