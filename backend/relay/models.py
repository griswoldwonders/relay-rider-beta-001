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
