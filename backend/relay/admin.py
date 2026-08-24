from django.contrib import admin
from .models import Corridor, EVParticipantSignal, GreenRouteCredit, Profile, RelayZone, RouteSignal

for model in [Profile, RouteSignal, EVParticipantSignal, RelayZone, Corridor, GreenRouteCredit]:
    admin.site.register(model)
