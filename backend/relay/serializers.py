from rest_framework import serializers
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Profile, RedemptionRequest, RelayZone, RouteSignal

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
    ALLOWED_TRANSITIONS = {
        'requested': {'under-review'},
        'under-review': {'fulfilled', 'denied'},
        'fulfilled': set(),
        'denied': set(),
    }

    class Meta:
        model = RedemptionRequest
        fields = '__all__'
        read_only_fields = ('institution', 'requested_at', 'reviewed_at', 'reviewed_by')

    def validate_status(self, value):
        if not self.instance:
            if value != 'requested':
                raise serializers.ValidationError('New redemption requests must start in requested status.')
            return value

        current = self.instance.status
        if value == current:
            return value
        if value not in self.ALLOWED_TRANSITIONS.get(current, set()):
            raise serializers.ValidationError(f'Invalid redemption transition: {current} -> {value}.')
        return value

    def validate(self, attrs):
        if self.instance is None:
            credit = attrs.get('credit')
            requested_units = attrs.get('requested_units')
            unit_label = attrs.get('unit_label') or (credit.unit_label if credit else None)
            if credit and unit_label != credit.unit_label:
                raise serializers.ValidationError({'unit_label': 'Redemption unit must match the credit unit.'})
            if credit and requested_units is not None and requested_units > credit.amount_units:
                raise serializers.ValidationError({'requested_units': 'Requested units cannot exceed the issued credit amount.'})
        return attrs
