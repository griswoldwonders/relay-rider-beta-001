from rest_framework import viewsets
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Profile, RedemptionRequest, RelayZone, RouteSignal
from .serializers import ChargingHubSerializer, CorridorSerializer, EVParticipantSignalSerializer, GreenRouteCreditSerializer, ProfileSerializer, RedemptionRequestSerializer, RelayZoneSerializer, RouteSignalSerializer

class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all().order_by('-created_at')
    serializer_class = ProfileSerializer

class RouteSignalViewSet(viewsets.ModelViewSet):
    queryset = RouteSignal.objects.all().order_by('-created_at')
    serializer_class = RouteSignalSerializer

class EVParticipantSignalViewSet(viewsets.ModelViewSet):
    queryset = EVParticipantSignal.objects.all().order_by('-created_at')
    serializer_class = EVParticipantSignalSerializer

class RelayZoneViewSet(viewsets.ModelViewSet):
    queryset = RelayZone.objects.all().order_by('name')
    serializer_class = RelayZoneSerializer

class CorridorViewSet(viewsets.ModelViewSet):
    queryset = Corridor.objects.all().order_by('name')
    serializer_class = CorridorSerializer

class GreenRouteCreditViewSet(viewsets.ModelViewSet):
    queryset = GreenRouteCredit.objects.all().order_by('-created_at')
    serializer_class = GreenRouteCreditSerializer

class ChargingHubViewSet(viewsets.ModelViewSet):
    queryset = ChargingHub.objects.all().order_by('name')
    serializer_class = ChargingHubSerializer

class RedemptionRequestViewSet(viewsets.ModelViewSet):
    queryset = RedemptionRequest.objects.select_related('credit', 'charging_hub', 'profile').all().order_by('-requested_at')
    serializer_class = RedemptionRequestSerializer
