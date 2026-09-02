from django.contrib import admin
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Institution, Membership, Profile, RedemptionRequest, RelayZone, RouteSignal

for model in [Institution, Membership, Profile, RouteSignal, EVParticipantSignal, RelayZone, Corridor, GreenRouteCredit, ChargingHub, RedemptionRequest]:
    admin.site.register(model)
