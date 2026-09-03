"""OCPI connector models: provider identity, normalized Session/CDR
projections, and the append-only Green Wallet ledger.

These models are additive to the existing Green Wallet persistence
scaffold in relay/models.py -- nothing here renames or removes any
existing field on GreenRouteCredit, ChargingHub, or RedemptionRequest.
This sub-package intentionally lives under relay/ocpi/ rather than as
a separate INSTALLED_APPS entry, to keep one migration history and one
dev-boundary security guard (see relay/apps.py). See
docs/OCPI_GREEN_WALLET_REPO_INTEGRATION.md for the integration
rationale, and docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md
for the credential/session-linking design this module implements.

Research-beta status: nothing in this module is a certified carbon
credit, a payment instrument, or a live/guaranteed charging
authorization. "Settlement" here means posting an internal, capped,
non-monetary program-credit ledger entry after a normalized OCPI CDR
has been matched to an approved redemption. Cross-file foreign keys
use Django's "app_label.ModelName" string form (not a Python import)
specifically to avoid a circular import between this module and
relay/models.py.
"""

from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.db.models import Q


class OcpiTimestamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        app_label = 'relay'


class OcpiProvider(OcpiTimestamped):
    """A roaming/eMSP-CPO partner identity and its tenant scoping keys.

    This is a connector-boundary identity record only. It never stores
    the actual OCPI credentials token, mTLS private key, or Vault
    reference -- see relay/ocpi/secrets.py (SecretProvider) for where
    that lives in a real deployment.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
    ]

    partner_id = models.CharField(max_length=64, unique=True)
    display_name = models.CharField(max_length=160, blank=True)
    country_code = models.CharField(max_length=2)
    party_id = models.CharField(max_length=3)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='active')

    class Meta:
        app_label = 'relay'

    def __str__(self):
        return self.display_name or self.partner_id


class OcpiSession(OcpiTimestamped):
    """Normalized projection of an OCPI Session.

    Mutable while status != COMPLETED. Once COMPLETED it must not be
    further updated by inbound Session events -- see
    relay/ocpi/adapter.py:ingest_session, which enforces this at the
    service layer (rejecting/reviewing stale or post-completion
    updates) rather than at the model layer, because a Session is
    legitimately mutable during its ACTIVE lifetime. The CDR, not the
    Session, is the sealed settlement artifact.
    """

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACTIVE', 'Active'),
        ('RESERVED', 'Reserved'),
        ('COMPLETED', 'Completed'),
        ('INVALID', 'Invalid'),
    ]

    provider = models.ForeignKey('relay.OcpiProvider', on_delete=models.PROTECT, related_name='sessions')
    country_code = models.CharField(max_length=2)
    party_id = models.CharField(max_length=3)
    external_session_id = models.CharField(max_length=36)
    location_id = models.CharField(max_length=36, blank=True)
    evse_uid = models.CharField(max_length=36, blank=True)
    connector_id = models.CharField(max_length=36, blank=True)
    token_uid = models.CharField(max_length=36, blank=True)
    authorization_reference = models.CharField(max_length=36, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='PENDING')
    kwh = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    currency = models.CharField(max_length=3, blank=True)
    start_date_time = models.DateTimeField(null=True, blank=True)
    end_date_time = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField()
    raw_payload = models.JSONField(default=dict, encoder=DjangoJSONEncoder)

    class Meta:
        app_label = 'relay'
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'country_code', 'party_id', 'external_session_id'],
                name='unique_ocpi_session_per_provider',
            )
        ]

    def __str__(self):
        return f'OCPI session {self.external_session_id}'


class OcpiCdr(OcpiTimestamped):
    """Normalized projection of an immutable OCPI CDR (settlement
    artifact). The raw settlement facts captured at creation time
    (energy, cost, dates, tokens, raw_payload) must never be edited by
    application code after creation. Corrections arrive as a brand-new
    credit CDR referencing this one via credit_reference_id, matching
    OCPI 2.3.0 CDR semantics -- never as an edit to this row.

    `match_status`, `matched_redemption`, and `review_reason` are
    Relay Rider's own adapter bookkeeping about this artifact (not
    part of the OCPI-authoritative record) and are the only fields the
    adapter updates post-creation, exactly once, to record the outcome
    of settlement. See relay/ocpi/adapter.py.
    """

    MATCH_STATUS_CHOICES = [
        ('matched', 'Matched'),
        ('needs_review', 'Needs review'),
        ('settled', 'Settled'),
    ]

    provider = models.ForeignKey('relay.OcpiProvider', on_delete=models.PROTECT, related_name='cdrs')
    session = models.ForeignKey(
        'relay.OcpiSession', null=True, blank=True, on_delete=models.SET_NULL, related_name='cdrs'
    )
    country_code = models.CharField(max_length=2)
    party_id = models.CharField(max_length=3)
    cdr_id = models.CharField(max_length=39)
    external_session_id = models.CharField(max_length=36, blank=True)
    token_uid = models.CharField(max_length=36, blank=True)
    authorization_reference = models.CharField(max_length=36, blank=True)
    start_date_time = models.DateTimeField()
    end_date_time = models.DateTimeField()
    total_energy_kwh = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    total_time_seconds = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, blank=True)
    total_cost_excl_vat = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_cost_incl_vat = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_credit = models.BooleanField(default=False)
    credit_reference_id = models.CharField(max_length=39, blank=True)
    raw_payload = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    match_status = models.CharField(max_length=16, choices=MATCH_STATUS_CHOICES, default='needs_review')
    matched_redemption = models.ForeignKey(
        'relay.RedemptionRequest', null=True, blank=True, on_delete=models.SET_NULL, related_name='ocpi_cdrs'
    )
    review_reason = models.CharField(max_length=200, blank=True)

    class Meta:
        app_label = 'relay'
        constraints = [
            models.UniqueConstraint(fields=['provider', 'cdr_id'], name='unique_cdr_per_provider')
        ]

    def __str__(self):
        return f'OCPI CDR {self.cdr_id}'


class WalletLedgerEntry(models.Model):
    """Append-only Green Wallet ledger entry.

    Rows are never updated or deleted by application code. Reversals
    and adjustments are new rows referencing the same redemption
    and/or CDR. `save()` refuses any attempt to modify an existing
    row, so this is enforced at the model layer (unlike OcpiCdr, this
    model genuinely has no legitimate post-create write path).

    Idempotency for the DEBIT case is enforced by a partial unique
    constraint below (one DEBIT per CDR) in addition to the adapter's
    own select_for_update()-guarded check -- belt and suspenders
    against double-settlement on concurrent/duplicate delivery.
    """

    ENTRY_TYPES = [
        ('HOLD', 'Hold'),
        ('DEBIT', 'Debit'),
        ('RELEASE', 'Release'),
        ('REVERSAL', 'Reversal'),
        ('ADJUSTMENT', 'Adjustment'),
    ]

    created_at = models.DateTimeField(auto_now_add=True)
    provider = models.ForeignKey(
        'relay.OcpiProvider', null=True, blank=True, on_delete=models.PROTECT, related_name='ledger_entries'
    )
    redemption_request = models.ForeignKey(
        'relay.RedemptionRequest', null=True, blank=True, on_delete=models.PROTECT, related_name='ledger_entries'
    )
    cdr = models.ForeignKey(
        'relay.OcpiCdr', null=True, blank=True, on_delete=models.PROTECT, related_name='ledger_entries'
    )
    entry_type = models.CharField(max_length=16, choices=ENTRY_TYPES)
    units = models.DecimalField(max_digits=10, decimal_places=3)
    unit_label = models.CharField(max_length=80, default='kWh-equivalent')
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        app_label = 'relay'
        constraints = [
            models.UniqueConstraint(
                fields=['cdr', 'entry_type'],
                condition=Q(entry_type='DEBIT'),
                name='unique_debit_per_cdr',
            )
        ]

    def __str__(self):
        return f'{self.entry_type} {self.units} ({self.unit_label})'

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError('WalletLedgerEntry rows are append-only and must not be modified after creation.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('WalletLedgerEntry rows are append-only and must not be deleted.')
