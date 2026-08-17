import uuid

from django.db import models


class AppRole(models.TextChoices):
    COMMUTER = "commuter", "Commuter"
    ROUTE_PARTICIPANT = "route_participant", "Route participant"
    REVIEWER = "reviewer", "Reviewer"
    ADMIN = "admin", "Admin"


class ReviewStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    PENDING_VERIFICATION = "pending_verification", "Pending verification"
    PILOT_REVIEW = "pilot_review", "Pilot review"
    APPROVED_FOR_DEMO = "approved_for_demo", "Approved for demo"
    NOT_ACTIVATED = "not_activated", "Not activated"
    REJECTED = "rejected", "Rejected"


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class UserProfile(UUIDModel):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=AppRole.choices, default=AppRole.COMMUTER)
    adult_confirmed = models.BooleanField(default=False)
    research_consent_given = models.BooleanField(default=False)
    preferred_corridor = models.CharField(max_length=255, blank=True)
    preferred_relay_zone_type = models.CharField(max_length=255, blank=True)
    ev_hybrid_preference = models.CharField(max_length=255, blank=True)
    privacy_preference = models.CharField(max_length=255, blank=True)
    notification_preference = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class RouteSignal(UUIDModel):
    ROUTE_TYPE_CHOICES = [
        ("recurring", "Recurring"),
        ("occasional", "Occasional"),
        ("event", "Event"),
        ("medical", "Medical"),
        ("campus", "Campus"),
        ("other", "Other"),
    ]
    STUDENT_TRANSIT_PASS_CHOICES = [
        ("yes", "Yes"),
        ("no", "No"),
        ("not-sure", "Not sure"),
    ]
    EV_PREFERENCE_CHOICES = [
        ("ev-only", "EV only"),
        ("hybrid-ev", "Hybrid or EV"),
        ("any", "Any"),
    ]
    ROUTE_FIT_CHOICES = [
        ("high", "High"),
        ("moderate", "Moderate"),
        ("low", "Low"),
    ]

    owner = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name="route_signals", null=True, blank=True
    )
    corridor = models.CharField(max_length=255)
    starting_area = models.CharField(max_length=255)
    destination_area = models.CharField(max_length=255)
    campus_affiliation = models.CharField(max_length=255)
    days_of_week = models.JSONField(default=list, blank=True)
    time_window = models.CharField(max_length=255)
    route_type = models.CharField(max_length=32, choices=ROUTE_TYPE_CHOICES)
    relay_zone_type = models.JSONField(default=list, blank=True)
    transit_options = models.JSONField(default=list, blank=True)
    student_transit_pass = models.CharField(max_length=16, choices=STUDENT_TRANSIT_PASS_CHOICES)
    incentive_interests = models.JSONField(default=list, blank=True)
    ev_preference = models.CharField(max_length=16, choices=EV_PREFERENCE_CHOICES)
    max_walking_distance = models.CharField(max_length=255)
    privacy_preference = models.CharField(max_length=255)
    status = models.CharField(max_length=32, choices=ReviewStatus.choices, default=ReviewStatus.DRAFT)
    route_fit = models.CharField(max_length=16, choices=ROUTE_FIT_CHOICES, blank=True)
    green_route_credit = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    # Modeled research signals (nested "modeled" object on the frontend type)
    overlap_potential = models.CharField(max_length=16, blank=True)
    time_compatibility = models.CharField(max_length=16, blank=True)
    relay_zone_fit = models.CharField(max_length=16, blank=True)
    ev_hybrid_supply = models.CharField(max_length=16, blank=True)
    parking_pressure = models.CharField(max_length=16, blank=True)
    pilot_readiness = models.CharField(max_length=32, blank=True)

    def __str__(self):
        return f"{self.corridor}: {self.starting_area} -> {self.destination_area}"


class EVParticipantSignal(UUIDModel):
    VEHICLE_TYPE_CHOICES = [
        ("ev", "EV"),
        ("phev", "PHEV"),
        ("hybrid", "Hybrid"),
        ("other", "Other"),
    ]
    STATUS_CHOICES = [
        ("submitted", "Submitted"),
        ("in-review", "In review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    owner = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name="ev_participant_signals", null=True, blank=True
    )
    vehicle_type = models.CharField(max_length=16, choices=VEHICLE_TYPE_CHOICES)
    vehicle_make = models.CharField(max_length=255)
    vehicle_model = models.CharField(max_length=255)
    vehicle_year = models.CharField(max_length=4)
    starting_area = models.CharField(max_length=255)
    destination_area = models.CharField(max_length=255)
    travel_days = models.JSONField(default=list, blank=True)
    time_window = models.CharField(max_length=255)
    max_detour = models.CharField(max_length=255)
    relay_zone_types = models.JSONField(default=list, blank=True)
    feedback_call_willing = models.BooleanField(default=False)
    reviews_accepted = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="submitted")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.vehicle_make} {self.vehicle_model} ({self.starting_area} -> {self.destination_area})"


class RelayZone(UUIDModel):
    REVIEW_STATUS_CHOICES = [
        ("candidate", "Candidate"),
        ("needs-partner", "Needs partner"),
        ("needs-safety", "Needs safety"),
        ("needs-property", "Needs property"),
        ("needs-legal", "Needs legal"),
        ("not-approved", "Not approved"),
    ]

    name = models.CharField(max_length=255)
    type = models.CharField(max_length=255)
    corridor = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    review_status = models.CharField(max_length=32, choices=REVIEW_STATUS_CHOICES, default="candidate")
    suggested_by_count = models.PositiveIntegerField(default=0)
    partner_review_needed = models.BooleanField(default=False)
    safety_review_needed = models.BooleanField(default=False)
    property_review_needed = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.name


class CorridorData(UUIDModel):
    PARKING_PRESSURE_CHOICES = [
        ("low", "Low"),
        ("medium-high", "Medium-high"),
        ("high", "High"),
    ]
    PILOT_READINESS_CHOICES = [
        ("research", "Research"),
        ("partner-review", "Partner review"),
        ("needs-legal", "Needs legal"),
        ("future", "Future"),
    ]

    name = models.CharField(max_length=255, unique=True)
    route_signals = models.PositiveIntegerField(default=0)
    ev_participants = models.PositiveIntegerField(default=0)
    relay_zones = models.PositiveIntegerField(default=0)
    parking_pressure = models.CharField(max_length=16, choices=PARKING_PRESSURE_CHOICES)
    pilot_readiness = models.CharField(max_length=32, choices=PILOT_READINESS_CHOICES)

    def __str__(self):
        return self.name


class GreenRouteCredit(UUIDModel):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("redeemed", "Redeemed"),
        ("expired", "Expired"),
    ]

    owner = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="green_route_credits")
    activity = models.CharField(max_length=255)
    amount = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    date = models.DateField()

    def __str__(self):
        return f"{self.activity}: {self.amount} ({self.status})"
