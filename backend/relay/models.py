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


class Site(TimestampedModel):
    STATUS_CHOICES = Institution.STATUS_CHOICES

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='sites')
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='active')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['institution', 'slug'], name='unique_site_slug_per_institution'),
        ]

    def __str__(self):
        return f'{self.institution}: {self.name}'


class Cohort(TimestampedModel):
    STATUS_CHOICES = Institution.STATUS_CHOICES

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='cohorts')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='cohorts')
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=160)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='active')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['institution', 'slug'], name='unique_cohort_slug_per_institution'),
            models.UniqueConstraint(fields=['site', 'slug'], name='unique_cohort_slug_per_site'),
        ]

    def clean(self):
        super().clean()
        if self.site_id and self.institution_id and self.site.institution_id != self.institution_id:
            raise ValidationError({'site': 'Site must belong to the same institution as the cohort.'})

    def __str__(self):
        return f'{self.site}: {self.name}'


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


class ImportBatch(TimestampedModel):
    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('validated', 'Validated'),
        ('failed', 'Failed'),
    ]

    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='import_batches')
    site = models.ForeignKey(Site, on_delete=models.PROTECT, related_name='import_batches')
    cohort = models.ForeignKey(Cohort, on_delete=models.PROTECT, related_name='import_batches')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='relay_import_batches')
    original_filename = models.CharField(max_length=255)
    file_sha256 = models.CharField(max_length=64)
    schema_version = models.CharField(max_length=32)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='uploaded')
    total_rows = models.PositiveIntegerField(default=0)
    accepted_rows = models.PositiveIntegerField(default=0)
    rejected_rows = models.PositiveIntegerField(default=0)

    def clean(self):
        super().clean()
        errors = {}
        if self.site_id and self.institution_id and self.site.institution_id != self.institution_id:
            errors['site'] = 'Site must belong to the import institution.'
        if self.cohort_id and self.institution_id and self.cohort.institution_id != self.institution_id:
            errors['cohort'] = 'Cohort must belong to the import institution.'
        if self.cohort_id and self.site_id and self.cohort.site_id != self.site_id:
            errors['cohort'] = 'Cohort must belong to the import site.'
        if errors:
            raise ValidationError(errors)


class ImportRow(TimestampedModel):
    VALIDATION_CHOICES = [
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='import_rows')
    site = models.ForeignKey(Site, on_delete=models.PROTECT, related_name='import_rows')
    cohort = models.ForeignKey(Cohort, on_delete=models.PROTECT, related_name='import_rows')
    batch = models.ForeignKey(ImportBatch, on_delete=models.PROTECT, related_name='rows')
    row_number = models.PositiveIntegerField()
    raw_payload = models.JSONField(default=dict)
    normalized_payload = models.JSONField(default=dict)
    validation_status = models.CharField(max_length=16, choices=VALIDATION_CHOICES)
    error_codes = models.JSONField(default=list)
    warning_codes = models.JSONField(default=list)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['batch', 'row_number'], name='unique_row_number_per_import_batch'),
        ]

    def clean(self):
        super().clean()
        if self.batch_id:
            if self.institution_id != self.batch.institution_id:
                raise ValidationError({'institution': 'Import row institution must match its batch.'})
            if self.site_id != self.batch.site_id:
                raise ValidationError({'site': 'Import row site must match its batch.'})
            if self.cohort_id != self.batch.cohort_id:
                raise ValidationError({'cohort': 'Import row cohort must match its batch.'})


class CanonicalCommuterRecord(TimestampedModel):
    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='canonical_commuters')
    site = models.ForeignKey(Site, on_delete=models.PROTECT, related_name='canonical_commuters')
    cohort = models.ForeignKey(Cohort, on_delete=models.PROTECT, related_name='canonical_commuters')
    source_row = models.OneToOneField(ImportRow, on_delete=models.PROTECT, related_name='canonical_record')
    participant_key = models.CharField(max_length=160)
    origin_zone = models.CharField(max_length=160)
    destination_zone = models.CharField(max_length=160)
    commute_days = models.JSONField(default=list)
    arrival_window_start = models.TimeField(null=True, blank=True)
    arrival_window_end = models.TimeField(null=True, blank=True)
    departure_window_start = models.TimeField(null=True, blank=True)
    departure_window_end = models.TimeField(null=True, blank=True)
    flexibility_minutes = models.PositiveIntegerField(default=0)
    current_mode = models.CharField(max_length=80, blank=True)
    vehicle_classification = models.CharField(max_length=80, blank=True)
    commute_distance_miles = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    commute_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    parking_difficulty = models.CharField(max_length=80, blank=True)
    ev_hybrid_signal = models.CharField(max_length=80, blank=True)
    canonicalization_version = models.CharField(max_length=32, default='1.0')

    def clean(self):
        super().clean()
        if not self.source_row_id:
            return
        errors = {}
        if self.source_row.validation_status != 'accepted':
            errors['source_row'] = 'Canonical records require an accepted import row.'
        if self.institution_id != self.source_row.institution_id:
            errors['institution'] = 'Canonical record institution must match its source row.'
        if self.site_id != self.source_row.site_id:
            errors['site'] = 'Canonical record site must match its source row.'
        if self.cohort_id != self.source_row.cohort_id:
            errors['cohort'] = 'Canonical record cohort must match its source row.'
        if errors:
            raise ValidationError(errors)


class AnalysisRun(TimestampedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='analysis_runs')
    site = models.ForeignKey(Site, on_delete=models.PROTECT, related_name='analysis_runs')
    cohort = models.ForeignKey(Cohort, on_delete=models.PROTECT, related_name='analysis_runs')
    source_batch = models.ForeignKey(ImportBatch, on_delete=models.PROTECT, related_name='analysis_runs')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='relay_analysis_runs')
    engine_version = models.CharField(max_length=64)
    configuration_version = models.CharField(max_length=64)
    code_version = models.CharField(max_length=128)
    canonical_dataset_fingerprint = models.CharField(max_length=64)
    reproducibility_fingerprint = models.CharField(max_length=64)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='pending')
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_code = models.CharField(max_length=160, blank=True)
    error_detail = models.TextField(blank=True)

    def clean(self):
        super().clean()
        if not self.source_batch_id:
            return
        errors = {}
        if self.institution_id != self.source_batch.institution_id:
            errors['institution'] = 'Analysis institution must match its source batch.'
        if self.site_id != self.source_batch.site_id:
            errors['site'] = 'Analysis site must match its source batch.'
        if self.cohort_id != self.source_batch.cohort_id:
            errors['cohort'] = 'Analysis cohort must match its source batch.'
        if errors:
            raise ValidationError(errors)


class AnalysisMetric(TimestampedModel):
    EVIDENCE_CHOICES = [
        ('observed', 'Observed'),
        ('calculated', 'Calculated'),
        ('modeled', 'Modeled'),
    ]

    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='analysis_metrics')
    analysis_run = models.ForeignKey(AnalysisRun, on_delete=models.CASCADE, related_name='metrics')
    metric_key = models.CharField(max_length=160)
    evidence_class = models.CharField(max_length=16, choices=EVIDENCE_CHOICES)
    value = models.JSONField()
    unit = models.CharField(max_length=80, blank=True)
    source_manifest = models.JSONField(default=dict)
    method_identifier = models.CharField(max_length=160)
    confidence = models.CharField(max_length=160, blank=True)
    privacy_treatment = models.CharField(max_length=160)
    caveat = models.TextField(blank=True)
    partner_wording = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['analysis_run', 'metric_key'], name='unique_metric_key_per_analysis_run'),
        ]

    def clean(self):
        super().clean()
        if self.analysis_run_id and self.institution_id != self.analysis_run.institution_id:
            raise ValidationError({'institution': 'Analysis metric institution must match its analysis run.'})


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
