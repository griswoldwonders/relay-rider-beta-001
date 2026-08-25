from rest_framework import serializers
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Profile, RedemptionRequest, RelayZone, RouteSignal

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'

class RouteSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteSignal
        fields = '__all__'

class EVParticipantSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = EVParticipantSignal
        fields = '__all__'

class RelayZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelayZone
        fields = '__all__'

class CorridorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Corridor
        fields = '__all__'

class GreenRouteCreditSerializer(serializers.ModelSerializer):
    class Meta:
        model = GreenRouteCredit
        fields = '__all__'

class ChargingHubSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChargingHub
        fields = '__all__'

class RedemptionRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RedemptionRequest
        fields = '__all__'
        read_only_fields = ('requested_at', 'reviewed_at', 'reviewed_by')
