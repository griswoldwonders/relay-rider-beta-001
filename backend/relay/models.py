from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Institution(TimestampedModel):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('pending', 'Pending'),
    ]

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


class Program(TimestampedModel):
    """Institution-sponsored mobility/TDM program boundary."""

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='programs')
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    status = models.CharField(max_length=32, default='draft')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['institution', 'slug'], name='unique_program_slug_per_institution'),
        ]

    def __str__(self):
        return f'{self.institution}: {self.name}'


class Site(TimestampedModel):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='sites')
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    general_location = models.CharField(max_length=200, blank=True)
    timezone = models.CharField(max_length=64, default='America/Los_Angeles')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['program', 'slug'], name='unique_site_slug_per_program'),
        ]

    @property
    def institution_id(self):
        return self.program.institution_id

    def __str__(self):
        return f'{self.program}: {self.name}'


class Cohort(TimestampedModel):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='cohorts')
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    description = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['site', 'slug'], name='unique_cohort_slug_per_site'),
        ]

    @property
    def institution_id(self):
        return self.site.program.institution_id

    def __str__(self):
        return f'{self.site}: {self.name}'


class DataSource(TimestampedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='data_sources')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='data_sources')
    name = models.CharField(max_length=160)
    source_type = models.CharField(max_length=40, default='csv')
    provenance_note = models.TextField(blank=True)

    def clean(self):
        if self.site_id and self.institution_id and self.site.program.institution_id != self.institution_id:
            raise ValidationError('DataSource site must belong to the same institution.')


class ImportBatch(TimestampedModel):
    STATUS_CHOICES = [
        ('received', 'Received'),
        ('validated', 'Validated'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='import_batches')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='import_batches')
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='import_batches')
    data_source = models.ForeignKey(DataSource, on_delete=models.PROTECT, related_name='import_batches')
    filename = models.CharField(max_length=255)
    sha256 = models.CharField(max_length=64)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='received')
    row_count = models.PositiveIntegerField(default=0)
    valid_row_count = models.PositiveIntegerField(default=0)
    invalid_row_count = models.PositiveIntegerField(default=0)

    def clean(self):
        institution_id = self.institution_id
        if self.site_id and self.site.program.institution_id != institution_id:
            raise ValidationError('ImportBatch site must belong to the same institution.')
        if self.cohort_id and self.cohort.site_id != self.site_id:
            raise ValidationError('ImportBatch cohort must belong to the selected site.')
        if self.data_source_id and self.data_source.institution_id != institution_id:
            raise ValidationError('ImportBatch data source must belong to the same institution.')


class SourceRecord(TimestampedModel):
    import_batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='source_records')
    row_number = models.PositiveIntegerField()
    raw_payload = models.JSONField(default=dict)
    normalized_payload = models.JSONField(default=dict)
    is_valid = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['import_batch', 'row_number'], name='unique_source_row_per_batch'),
        ]


class ValidationIssue(TimestampedModel):
    source_record = models.ForeignKey(SourceRecord, on_delete=models.CASCADE, related_name='validation_issues')
    field = models.CharField(max_length=80, blank=True)
    code = models.CharField(max_length=80)
    message = models.TextField()
    severity = models.CharField(max_length=16, default='error')


class CommuterRecord(TimestampedModel):
    """Canonical, institution-scoped commute record derived from source evidence."""

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='commuter_records')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='commuter_records')
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='commuter_records')
    source_record = models.OneToOneField(SourceRecord, on_delete=models.PROTECT, related_name='commuter_record')
    participant_ref = models.CharField(max_length=120, blank=True)
    origin_zone = models.CharField(max_length=120)
    destination_zone = models.CharField(max_length=120)
    commute_mode = models.CharField(max_length=40)
    days_per_week = models.PositiveSmallIntegerField(default=5)
    arrival_time = models.TimeField(null=True, blank=True)
    departure_time = models.TimeField(null=True, blank=True)
    vehicle_type = models.CharField(max_length=40, blank=True)
    ev_hybrid = models.BooleanField(default=False)

    def clean(self):
        if self.site_id and self.site.program.institution_id != self.institution_id:
            raise ValidationError('CommuterRecord site must belong to the same institution.')
        if self.cohort_id and self.cohort.site_id != self.site_id:
            raise ValidationError('CommuterRecord cohort must belong to the selected site.')
        if self.source_record_id and self.source_record.import_batch.institution_id != self.institution_id:
            raise ValidationError('CommuterRecord source record must belong to the same institution.')


class AnalysisRun(TimestampedModel):
    STATUS_CHOICES = [('draft', 'Draft'), ('completed', 'Completed'), ('failed', 'Failed')]

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='analysis_runs')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='analysis_runs')
    cohort = models.ForeignKey(Cohort, on_delete=models.CASCADE, related_name='analysis_runs')
    import_batch = models.ForeignKey(ImportBatch, on_delete=models.PROTECT, related_name='analysis_runs')
    method_version = models.CharField(max_length=80, default='core-v1-prototype')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    input_snapshot = models.JSONField(default=dict)


class CorridorScore(TimestampedModel):
    analysis_run = models.ForeignKey(AnalysisRun, on_delete=models.CASCADE, related_name='corridor_scores')
    origin_zone = models.CharField(max_length=120)
    destination_zone = models.CharField(max_length=120)
    commuter_count = models.PositiveIntegerField(default=0)
    sov_count = models.PositiveIntegerField(default=0)
    ev_hybrid_count = models.PositiveIntegerField(default=0)
    compatibility_score = models.DecimalField(max_digits=5, decimal_places=2)
    score_explanation = models.JSONField(default=dict)


class Rule2202CalculationRun(TimestampedModel):
    STATUS_CHOICES = [('completed', 'Completed'), ('blocked', 'Blocked'), ('failed', 'Failed')]
    EXECUTION_CHOICES = [
        ('database_functions', 'Verified database functions'),
        ('reference_simulation', 'Reference simulation'),
    ]

    analysis_run = models.OneToOneField(AnalysisRun, on_delete=models.CASCADE, related_name='rule2202_run')
    execution_mode = models.CharField(max_length=32, choices=EXECUTION_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    calculation_version = models.CharField(max_length=120, default='rule2202-sql-202609020001')
    deployment_verified = models.BooleanField(default=False)
    source_note = models.TextField(blank=True)
    input_snapshot = models.JSONField(default=dict)


class Rule2202Result(TimestampedModel):
    calculation_run = models.ForeignKey(Rule2202CalculationRun, on_delete=models.CASCADE, related_name='results')
    metric = models.CharField(max_length=80)
    value = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True)
    unit = models.CharField(max_length=40, blank=True)
    explanation = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['calculation_run', 'metric'], name='unique_rule2202_metric_per_run'),
        ]


class DecisionCard(TimestampedModel):
    STATUS_CHOICES = [('draft', 'Draft'), ('reviewed', 'Reviewed'), ('approved', 'Approved')]

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='decision_cards')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='decision_cards')
    analysis_run = models.OneToOneField(AnalysisRun, on_delete=models.PROTECT, related_name='decision_card')
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    summary = models.TextField()
    findings = models.JSONField(default=dict)
    recommended_action = models.TextField()
    caveats = models.JSONField(default=list)


class ReportExport(TimestampedModel):
    FORMAT_CHOICES = [('json', 'JSON'), ('csv', 'CSV')]

    decision_card = models.ForeignKey(DecisionCard, on_delete=models.CASCADE, related_name='exports')
    format = models.CharField(max_length=8, choices=FORMAT_CHOICES)
    filename = models.CharField(max_length=255)
    content = models.TextField()
    sha256 = models.CharField(max_length=64)


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
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='green_route_credits')
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    corridor = models.ForeignKey(Corridor, null=True, blank=True, on_delete=models.SET_NULL)
    estimated_miles_reduced = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    estimated_co2_lbs_reduced = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    note = models.TextField(blank=True)

    def __str__(self):
        return f'Green route credit {self.pk}'


class ChargingHub(TimestampedModel):
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='charging_hubs')
    name = models.CharField(max_length=160)
    network = models.CharField(max_length=120)
    city = models.CharField(max_length=120)
    stalls = models.PositiveIntegerField(default=0)
    connector_types = models.JSONField(default=list)
    status = models.CharField(max_length=32, default='candidate')
    evidence_label = models.CharField(max_length=32, default='modeled')

    def __str__(self):
        return self.name


class RedemptionRequest(TimestampedModel):
    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='redemption_requests')
    credit = models.ForeignKey(GreenRouteCredit, on_delete=models.PROTECT, related_name='redemption_requests')
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    charging_hub = models.ForeignKey(ChargingHub, on_delete=models.PROTECT, related_name='redemption_requests')
    requested_units = models.DecimalField(max_digits=10, decimal_places=2)
    unit_label = models.CharField(max_length=80, default='Green Route Credits')
    status = models.CharField(max_length=32, default='requested')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.CharField(max_length=160, blank=True)
    review_note = models.TextField(blank=True)

    def __str__(self):
        return f'Redemption request {self.pk}'
