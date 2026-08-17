from rest_framework import serializers

from .models import (
    CorridorData,
    EVParticipantSignal,
    GreenRouteCredit,
    RelayZone,
    RouteSignal,
    UserProfile,
)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = "__all__"


class RouteSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteSignal
        fields = "__all__"
        read_only_fields = ["created_at"]


class EVParticipantSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = EVParticipantSignal
        fields = "__all__"
        read_only_fields = ["created_at"]


class RelayZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelayZone
        fields = "__all__"


class CorridorDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = CorridorData
        fields = "__all__"


class GreenRouteCreditSerializer(serializers.ModelSerializer):
    class Meta:
        model = GreenRouteCredit
        fields = "__all__"
