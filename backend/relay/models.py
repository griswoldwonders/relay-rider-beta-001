from django.conf import settings
from django.db import models

class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Institution(TimestampedModel):
    STATUS_CHOICES = [('active', 'Active'), ('inactive', 'Inactive'), ('pending', 'Pending')]
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160, unique=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='pending')
    contact_name = models.CharField(max_length=160, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)

    def __str__(self):
        return self.name


class Membership(TimestampedModel):
    ROLE_CHOICES = [('platform_admin', 'Platform admin'), ('institution_admin', 'Institution admin'), ('program_staff', 'Program staff'), ('viewer', 'Viewer')]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default='viewer')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'institution'], name='unique_user_institution_membership')]

    def __str__(self):
        return f'{self.user} @ {self.institution} ({self.role})'


class Profile(TimestampedModel):
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='profiles')
    name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    role = models.CharField(max_length=80, blank=True)
    home_zone = models.CharField(max_length=120, blank=True)
    destination_zone = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return self.name or self.email or f'Profile {self.pk}'

class RouteSignal(TimestampedModel):
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='route_signals')
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    origin_zone = models.CharField(max_length=120, blank=True)
    destination_zone = models.CharField(max_length=120, blank=True)
    departure_window = models.CharField(max_length=120, blank=True)
    proposed_contribution = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=80, default='draft')

    def __str__(self):
        return f'{self.origin_zone} → {self.destination_zone}'.strip(' →') or f'Route signal {self.pk}'

class EVParticipantSignal(TimestampedModel):
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='ev_participant_signals')
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    vehicle_type = models.CharField(max_length=80, blank=True)
    corridor = models.CharField(max_length=120, blank=True)
    seats_available = models.PositiveIntegerField(default=0)
    max_detour_minutes = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=80, default='draft')

    def __str__(self):
        return self.corridor or f'EV participant signal {self.pk}'

class RelayZone(TimestampedModel):
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='relay_zones')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Corridor(TimestampedModel):
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='corridors')
    name = models.CharField(max_length=120)
    origin_zone = models.CharField(max_length=120, blank=True)
    destination_zone = models.CharField(max_length=120, blank=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class GreenRouteCredit(TimestampedModel):
    STATUS_CHOICES = [('issued', 'Issued'), ('redeemed', 'Redeemed'), ('expired', 'Expired')]

    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='green_route_credits')
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    corridor = models.ForeignKey(Corridor, null=True, blank=True, on_delete=models.SET_NULL)
    # Canonical program-defined incentive quantity. It is not currency, a fare,
    # a charging reimbursement, or an emissions metric.
    amount_units = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit_label = models.CharField(max_length=80, default='Green Route Credits')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='issued')
    # Impact estimates remain separate evidence fields and must never be used as
    # a proxy for the incentive quantity.
    estimated_miles_reduced = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    estimated_co2_lbs_reduced = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    note = models.TextField(blank=True)

    def __str__(self):
        return f'Green route credit {self.pk}'

class ChargingHub(TimestampedModel):
    STATUS_CHOICES = [('candidate', 'Candidate'), ('verified', 'Verified'), ('active', 'Active')]
    EVIDENCE_LABEL_CHOICES = [('synthetic', 'Synthetic'), ('modeled', 'Modeled'), ('verified', 'Verified')]

    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='charging_hubs')
    name = models.CharField(max_length=160)
    network = models.CharField(max_length=120)
    city = models.CharField(max_length=120)
    stalls = models.PositiveIntegerField(default=0)
    connector_types = models.JSONField(default=list)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='candidate')
    evidence_label = models.CharField(max_length=32, choices=EVIDENCE_LABEL_CHOICES, default='modeled')

    def __str__(self):
        return self.name

class RedemptionRequest(TimestampedModel):
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('under-review', 'Under administrative review'),
        ('fulfilled', 'Fulfilled'),
        ('denied', 'Denied'),
    ]
    FULFILLMENT_METHOD_CHOICES = [
        ('unspecified', 'Unspecified'),
        ('manual_program_action', 'Manual program action'),
    ]

    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='redemption_requests')
    credit = models.ForeignKey(GreenRouteCredit, on_delete=models.PROTECT, related_name='redemption_requests')
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    charging_hub = models.ForeignKey(ChargingHub, on_delete=models.PROTECT, related_name='redemption_requests')
    requested_units = models.DecimalField(max_digits=10, decimal_places=2)
    unit_label = models.CharField(max_length=80, default='Green Route Credits')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='requested')
    fulfillment_method = models.CharField(
        max_length=32,
        choices=FULFILLMENT_METHOD_CHOICES,
        default='unspecified',
        blank=True,
        help_text=(
            'Records how a research-beta fulfillment decision was carried out. '
            "'fulfilled' status is a program fulfillment decision recorded by an "
            'administrator; it is not evidence of an actual charge session and does '
            'not imply automatic settlement with a charging network.'
        ),
    )
    idempotency_key = models.CharField(max_length=160, null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.CharField(max_length=160, blank=True)
    review_note = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['credit', 'idempotency_key'],
                condition=models.Q(idempotency_key__isnull=False),
                name='unique_credit_idempotency_key',
            ),
        ]

    def __str__(self):
        return f'Redemption request {self.pk}'


class ProgramBenefitPolicy(TimestampedModel):
    """Institution-scoped, versioned program-benefit rules.

    Real earning rules, caps, and expiry values require founder/program
    approval. Fields default to conservative null/blank values so this model
    can be migrated in ahead of that decision without inventing values.
    """

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('retired', 'Retired'),
    ]
    EVIDENCE_LABEL_CHOICES = [
        ('synthetic', 'Synthetic'),
        ('modeled', 'Modeled'),
        ('verified', 'Verified'),
    ]

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='benefit_policies')
    version = models.PositiveIntegerField(default=1)
    unit_label = models.CharField(max_length=80, default='Green Route Credits')
    max_units_per_participant = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_units_program_wide = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    expiry_days = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Days after issuance a credit expires. NEEDS_FOUNDER_INPUT until a program default is approved.',
    )
    eligibility_description = models.TextField(
        blank=True,
        help_text='Descriptive-only eligibility notes. NEEDS_FOUNDER_INPUT for a binding eligibility rule.',
    )
    earning_rule_description = models.TextField(
        blank=True,
        help_text='Descriptive-only earning-rule notes. NEEDS_FOUNDER_INPUT for a binding earning rule.',
    )
    effective_start = models.DateField(null=True, blank=True)
    effective_end = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='draft')
    evidence_label = models.CharField(max_length=32, choices=EVIDENCE_LABEL_CHOICES, default='synthetic')
    founder_approval_reference = models.CharField(
        max_length=160, blank=True,
        help_text='Reference to the founder/program approval record for this policy version. NEEDS_FOUNDER_INPUT until approved.',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['institution', 'version'], name='unique_institution_policy_version'),
        ]

    def __str__(self):
        return f'{self.institution} policy v{self.version}'


class ImmutableLedgerQuerySet(models.QuerySet):
    """Blocks bulk update/delete so immutability can't be bypassed via the queryset API."""

    def update(self, **kwargs):
        raise ValueError('WalletLedgerEntry is immutable and cannot be updated after creation.')

    def delete(self):
        raise ValueError('WalletLedgerEntry is immutable and cannot be deleted.')


class WalletLedgerEntry(TimestampedModel):
    """Immutable Green Wallet ledger event.

    Entries are created and never mutated or deleted at the application
    layer; there is no generic CRUD endpoint for this model. This vertical
    slice records events for audit/traceability. It does not compute or
    expose a running balance, and it is not a payment or settlement ledger.
    """

    ENTRY_TYPE_CHOICES = [
        ('ISSUE', 'Issue'),
        ('HOLD', 'Hold'),
        ('RELEASE', 'Release'),
        ('DEBIT', 'Debit'),
        ('REVERSAL', 'Reversal'),
        ('EXPIRE', 'Expire'),
        ('ADJUSTMENT', 'Adjustment'),
    ]

    credit = models.ForeignKey(GreenRouteCredit, on_delete=models.PROTECT, related_name='ledger_entries')
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='wallet_ledger_entries')
    redemption_request = models.ForeignKey(
        RedemptionRequest, null=True, blank=True, on_delete=models.SET_NULL, related_name='ledger_entries',
    )
    entry_type = models.CharField(max_length=16, choices=ENTRY_TYPE_CHOICES)
    quantity_delta = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.CharField(max_length=200, blank=True)
    correlation_id = models.CharField(max_length=160, blank=True, db_index=True)
    actor_reference = models.CharField(max_length=160, blank=True)

    objects = ImmutableLedgerQuerySet.as_manager()

    def __str__(self):
        return f'{self.entry_type} {self.quantity_delta} on credit {self.credit_id}'

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError('WalletLedgerEntry is immutable and cannot be updated after creation.')
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('WalletLedgerEntry is immutable and cannot be deleted.')
