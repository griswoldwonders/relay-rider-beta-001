from django.db import models

class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class Profile(TimestampedModel):
    name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    role = models.CharField(max_length=80, blank=True)
    home_zone = models.CharField(max_length=120, blank=True)
    destination_zone = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return self.name or self.email or f'Profile {self.pk}'

class RouteSignal(TimestampedModel):
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    origin_zone = models.CharField(max_length=120, blank=True)
    destination_zone = models.CharField(max_length=120, blank=True)
    departure_window = models.CharField(max_length=120, blank=True)
    proposed_contribution = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=80, default='draft')

    def __str__(self):
        return f'{self.origin_zone} → {self.destination_zone}'.strip(' →') or f'Route signal {self.pk}'

class EVParticipantSignal(TimestampedModel):
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    vehicle_type = models.CharField(max_length=80, blank=True)
    corridor = models.CharField(max_length=120, blank=True)
    seats_available = models.PositiveIntegerField(default=0)
    max_detour_minutes = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=80, default='draft')

    def __str__(self):
        return self.corridor or f'EV participant signal {self.pk}'

class RelayZone(TimestampedModel):
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Corridor(TimestampedModel):
    name = models.CharField(max_length=120)
    origin_zone = models.CharField(max_length=120, blank=True)
    destination_zone = models.CharField(max_length=120, blank=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class GreenRouteCredit(TimestampedModel):
    profile = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL)
    corridor = models.ForeignKey(Corridor, null=True, blank=True, on_delete=models.SET_NULL)
    estimated_miles_reduced = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    estimated_co2_lbs_reduced = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    note = models.TextField(blank=True)

    def __str__(self):
        return f'Green route credit {self.pk}'

class ChargingHub(TimestampedModel):
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
