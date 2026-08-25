from django.contrib import admin
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Profile, RedemptionRequest, RelayZone, RouteSignal

for model in [Profile, RouteSignal, EVParticipantSignal, RelayZone, Corridor, GreenRouteCredit, ChargingHub, RedemptionRequest]:
    admin.site.register(model)
