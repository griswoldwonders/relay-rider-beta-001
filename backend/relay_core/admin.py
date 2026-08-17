from django.contrib import admin

from .models import (
    CorridorData,
    EVParticipantSignal,
    GreenRouteCredit,
    RelayZone,
    RouteSignal,
    UserProfile,
)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "role", "research_consent_given")
    list_filter = ("role", "research_consent_given")
    search_fields = ("name", "email")


@admin.register(RouteSignal)
class RouteSignalAdmin(admin.ModelAdmin):
    list_display = ("corridor", "starting_area", "destination_area", "status", "created_at")
    list_filter = ("status", "route_type", "ev_preference", "corridor")
    search_fields = ("corridor", "starting_area", "destination_area", "campus_affiliation")


@admin.register(EVParticipantSignal)
class EVParticipantSignalAdmin(admin.ModelAdmin):
    list_display = ("vehicle_make", "vehicle_model", "vehicle_type", "status", "created_at")
    list_filter = ("status", "vehicle_type")
    search_fields = ("vehicle_make", "vehicle_model", "starting_area", "destination_area")


@admin.register(RelayZone)
class RelayZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "corridor", "review_status", "suggested_by_count")
    list_filter = ("review_status", "corridor")
    search_fields = ("name", "address")


@admin.register(CorridorData)
class CorridorDataAdmin(admin.ModelAdmin):
    list_display = ("name", "route_signals", "ev_participants", "relay_zones", "parking_pressure", "pilot_readiness")


@admin.register(GreenRouteCredit)
class GreenRouteCreditAdmin(admin.ModelAdmin):
    list_display = ("owner", "activity", "amount", "status", "date")
    list_filter = ("status",)
