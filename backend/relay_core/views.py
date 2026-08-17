from rest_framework import viewsets

from .models import (
    CorridorData,
    EVParticipantSignal,
    GreenRouteCredit,
    RelayZone,
    RouteSignal,
    UserProfile,
)
from .serializers import (
    CorridorDataSerializer,
    EVParticipantSignalSerializer,
    GreenRouteCreditSerializer,
    RelayZoneSerializer,
    RouteSignalSerializer,
    UserProfileSerializer,
)


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer


class RouteSignalViewSet(viewsets.ModelViewSet):
    queryset = RouteSignal.objects.all().order_by("-created_at")
    serializer_class = RouteSignalSerializer


class EVParticipantSignalViewSet(viewsets.ModelViewSet):
    queryset = EVParticipantSignal.objects.all().order_by("-created_at")
    serializer_class = EVParticipantSignalSerializer


class RelayZoneViewSet(viewsets.ModelViewSet):
    queryset = RelayZone.objects.all()
    serializer_class = RelayZoneSerializer


class CorridorDataViewSet(viewsets.ModelViewSet):
    queryset = CorridorData.objects.all()
    serializer_class = CorridorDataSerializer


class GreenRouteCreditViewSet(viewsets.ModelViewSet):
    queryset = GreenRouteCredit.objects.all().order_by("-date")
    serializer_class = GreenRouteCreditSerializer
