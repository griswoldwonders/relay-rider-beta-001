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
    ROLE_CHOICES = [
        ('platform_admin', 'Platform admin'),
        ('institution_admin', 'Institution admin'),
        ('program_staff', 'Program staff'),
        ('viewer', 'Viewer'),
        ('participant', 'Participant'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default='viewer')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'institution'], name='unique_user_institution_membership'),
        ]

    def __str__(self):
        return f'{self.user} @ {self.institution} ({self.role})'


class Site(TimestampedModel):
    """Institution-owned worksite/campus used as the assessment boundary."""
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='sites')
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    site_type = models.CharField(max_length=64, default='worksite')
    city = models.CharField(max_length=120, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['institution', 'slug'], name='unique_site_slug_per_institution'),
        ]

    def __str__(self):
        return f'{self.institution}: {self.name}'


class Cohort(TimestampedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='cohorts')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='cohorts')
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    cohort_type = models.CharField(max_length=64, default='participant_group')
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['site', 'slug'], name='unique_cohort_slug_per_site'),
        ]

    def __str__(self):
        return f'{self.site}: {self.name}'


class DataSource(TimestampedModel):
    SOURCE_TYPES = [
        ('csv', 'CSV import'),
        ('survey', 'Survey'),
        ('api', 'API'),
        ('manual', 'Manual entry'),
        ('synthetic', 'Synthetic fixture'),
    ]
    PROVENANCE_LABELS = [
        ('imported', 'Imported'),
        ('reported', 'Reported'),
        ('synthetic', 'Synthetic'),
        ('modeled', 'Modeled'),
    ]
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='data_sources')
    site = models.ForeignKey(Site, null=True, blank=True, on_delete=models.CASCADE, related_name='data_sources')
    name = models.CharField(max_length=160)
    source_type = models.CharField(max_length=32, choices=SOURCE_TYPES)
    provenance_label = models.CharField(max_length=32, choices=PROVENANCE_LABELS)
    source_reference = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.name


class CommuteImport(TimestampedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('validated', 'Validated'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='commute_imports')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='commute_imports')
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='commute_imports')
    data_source = models.ForeignKey(DataSource, on_delete=models.PROTECT, related_name='commute_imports')
    imported_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='commute_imports')
    file_name = models.CharField(max_length=255)
    file_sha256 = models.CharField(max_length=64)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='pending')
    total_rows = models.PositiveIntegerField(default=0)
    valid_rows = models.PositiveIntegerField(default=0)
    invalid_rows = models.PositiveIntegerField(default=0)
    validation_summary = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f'{self.file_name} ({self.status})'


class CommuterRecord(TimestampedModel):
    VALIDATION_CHOICES = [('valid', 'Valid'), ('invalid', 'Invalid')]
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='commuter_records')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='commuter_records')
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='commuter_records')
    commute_import = models.ForeignKey(CommuteImport, on_delete=models.CASCADE, related_name='records')
    external_id = models.CharField(max_length=120)
    origin_zone = models.CharField(max_length=120)
    destination_zone = models.CharField(max_length=120)
    commute_days = models.JSONField(default=list)
    arrival_window = models.CharField(max_length=80)
    departure_window = models.CharField(max_length=80)
    schedule_flex_minutes = models.PositiveIntegerField(default=0)
    current_mode = models.CharField(max_length=64)
    occupants = models.PositiveIntegerField(null=True, blank=True)
    vehicle_fuel_type = models.CharField(max_length=64, blank=True)
    parking_difficulty = models.CharField(max_length=32, blank=True)
    ev_interest = models.BooleanField(default=False)
    access_point_willing = models.BooleanField(default=False)
    consent_confirmed = models.BooleanField(default=False)
    validation_status = models.CharField(max_length=16, choices=VALIDATION_CHOICES, default='valid')
    validation_errors = models.JSONField(default=list, blank=True)
    source_row_number = models.PositiveIntegerField()
    source_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['commute_import', 'external_id'], name='unique_external_id_per_import'),
        ]

    def __str__(self):
        return f'{self.external_id}: {self.origin_zone} → {self.destination_zone}'


class EngineScore(TimestampedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='engine_scores')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='engine_scores')
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='engine_scores')
    commuter_record = models.OneToOneField(CommuterRecord, on_delete=models.CASCADE, related_name='engine_score')
    score_type = models.CharField(max_length=80, default='intervention_opportunity')
    score = models.PositiveSmallIntegerField()
    factors = models.JSONField(default=dict)
    explanation = models.TextField()
    engine_version = models.CharField(max_length=64)

    def __str__(self):
        return f'{self.score_type}: {self.score}'


class Rule2202CalculationRun(TimestampedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('blocked', 'Blocked'),
        ('failed', 'Failed'),
    ]
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='rule2202_runs')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='rule2202_runs')
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='rule2202_runs')
    commute_import = models.ForeignKey(CommuteImport, on_delete=models.PROTECT, related_name='rule2202_runs')
    initiated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='rule2202_runs')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='pending')
    calculation_version = models.CharField(max_length=80, default='rule2202-sql-202609020001')
    input_snapshot = models.JSONField(default=dict)
    result_snapshot = models.JSONField(default=dict)
    validation_snapshot = models.JSONField(default=dict)
    blocked_reason = models.TextField(blank=True)

    def __str__(self):
        return f'Rule 2202 run {self.pk} ({self.status})'


class DecisionCard(TimestampedModel):
    STATUS_CHOICES = [('draft', 'Draft'), ('ready_for_review', 'Ready for review'), ('reviewed', 'Reviewed')]
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='decision_cards')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='decision_cards')
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='decision_cards')
    commute_import = models.ForeignKey(CommuteImport, on_delete=models.PROTECT, related_name='decision_cards')
    rule2202_run = models.ForeignKey(Rule2202CalculationRun, null=True, blank=True, on_delete=models.SET_NULL, related_name='decision_cards')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='draft')
    title = models.CharField(max_length=200)
    finding = models.TextField()
    evidence = models.JSONField(default=list)
    interpretation = models.TextField(blank=True)
    recommended_action = models.TextField()
    owner_label = models.CharField(max_length=160, blank=True)
    provenance = models.JSONField(default=dict)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_decision_cards',
    )
    review_note = models.TextField(blank=True)

    def __str__(self):
        return self.title


class AssessmentAuditEvent(models.Model):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='assessment_audit_events')
    site = models.ForeignKey(Site, null=True, blank=True, on_delete=models.SET_NULL, related_name='assessment_audit_events')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='assessment_audit_events')
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=80)
    entity_id = models.CharField(max_length=80, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['occurred_at', 'id']

    def __str__(self):
        return f'{self.action} {self.entity_type}:{self.entity_id}'


class Profile(TimestampedModel):
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='profiles')
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='relay_profile',
    )
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
    amount_units = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit_label = models.CharField(max_length=80, default='Green Route Credits')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='issued')
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
    def update(self, **kwargs):
        raise ValueError('WalletLedgerEntry is immutable and cannot be updated after creation.')

    def delete(self):
        raise ValueError('WalletLedgerEntry is immutable and cannot be deleted.')


class WalletLedgerEntry(TimestampedModel):
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