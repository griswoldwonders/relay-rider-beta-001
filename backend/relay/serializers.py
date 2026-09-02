from rest_framework import serializers
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Profile, RedemptionRequest, RelayZone, RouteSignal

# `institution` is read-only on every serializer below: it must be assigned
# server-side (from the caller's membership, see views.py perform_create)
# rather than trusted from client input, since these serializers otherwise
# use fields = '__all__'.

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'
        read_only_fields = ('institution',)

class RouteSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteSignal
        fields = '__all__'
        read_only_fields = ('institution',)

class EVParticipantSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = EVParticipantSignal
        fields = '__all__'
        read_only_fields = ('institution',)

class RelayZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelayZone
        fields = '__all__'
        read_only_fields = ('institution',)

class CorridorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Corridor
        fields = '__all__'
        read_only_fields = ('institution',)

class GreenRouteCreditSerializer(serializers.ModelSerializer):
    class Meta:
        model = GreenRouteCredit
        fields = '__all__'
        read_only_fields = ('institution',)

class ChargingHubSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChargingHub
        fields = '__all__'
        read_only_fields = ('institution',)

class RedemptionRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RedemptionRequest
        fields = '__all__'
        read_only_fields = ('institution', 'requested_at', 'reviewed_at', 'reviewed_by')
