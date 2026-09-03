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

    institution = models.ForeignKey(Institution, null=True, blank=True, on_delete=models.SET_NULL, related_name='redemption_requests')
    credit = models.ForeignKey(GreenRouteCredit, on_delete=models.PROTECT, related_name='redemption_requests')
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    charging_hub = models.ForeignKey(ChargingHub, on_delete=models.PROTECT, related_name='redemption_requests')
    requested_units = models.DecimalField(max_digits=10, decimal_places=2)
    unit_label = models.CharField(max_length=80, default='Green Route Credits')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='requested')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.CharField(max_length=160, blank=True)
    review_note = models.TextField(blank=True)

    # --- OCPI connector fields (additive; see backend/relay/ocpi/) ---
    # These identify which OCPI provider/tenant this redemption is scoped
    # to and the opaque correlation handles used to match an inbound CDR
    # to exactly one redemption (see
    # docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md, "Linking
    # Sessions and CDRs to wallet redemptions"). They are blank/null by
    # default so existing rows and the existing frontend flow are
    # unaffected; only OCPI-authorized redemptions ever populate them.
    ocpi_provider = models.ForeignKey(
        'relay.OcpiProvider', null=True, blank=True, on_delete=models.SET_NULL, related_name='redemption_requests'
    )
    authorization_reference = models.CharField(max_length=36, blank=True)
    token_uid = models.CharField(max_length=36, blank=True)

    def __str__(self):
        return f'Redemption request {self.pk}'


# Imported here (rather than at the top of the file) so the 'relay' app's
# models module -- which Django's app registry loads as a whole -- also
# registers the OCPI connector models defined in relay/ocpi/models.py.
# Those models use Django's "app_label.ModelName" string form for their
# foreign keys back into this file (e.g. 'relay.RedemptionRequest'), so
# there is no circular Python import: relay/ocpi/models.py never imports
# from this module.
from .ocpi.models import OcpiProvider, OcpiSession, OcpiCdr, WalletLedgerEntry  # noqa: E402,F401
