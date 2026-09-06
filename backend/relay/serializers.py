from rest_framework import serializers
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Membership, Profile, ProgramBenefitPolicy, RedemptionRequest, RelayZone, RouteSignal


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'
        read_only_fields = ('institution', 'user')


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


class ProgramBenefitPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramBenefitPolicy
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
        validators = []

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
            charging_hub = attrs.get('charging_hub')
            profile = attrs.get('profile')
            requested_units = attrs.get('requested_units')
            unit_label = attrs.get('unit_label') or (credit.unit_label if credit else None)

            if credit:
                request = self.context.get('request')
                user = getattr(request, 'user', None)
                is_authenticated = bool(user and user.is_authenticated)
                is_platform_admin = bool(
                    is_authenticated
                    and Membership.objects.filter(user=user, role='platform_admin').exists()
                )
                is_staff_member = bool(
                    is_authenticated
                    and credit.institution_id is not None
                    and Membership.objects.filter(
                        user=user,
                        institution_id=credit.institution_id,
                        role__in={'institution_admin', 'program_staff'},
                    ).exists()
                )
                is_participant_member = bool(
                    is_authenticated
                    and credit.institution_id is not None
                    and Membership.objects.filter(
                        user=user,
                        institution_id=credit.institution_id,
                        role='participant',
                    ).exists()
                )
                owns_credit_profile = bool(
                    credit.profile_id
                    and credit.profile.user_id == getattr(user, 'id', None)
                )

                if not is_platform_admin and not is_staff_member:
                    if not is_participant_member or not owns_credit_profile:
                        raise serializers.ValidationError(
                            {'credit': 'Participants may only submit credits owned by their authenticated profile.'}
                        )
                    if profile is None or profile.pk != credit.profile_id or profile.user_id != user.id:
                        raise serializers.ValidationError(
                            {'profile': 'Participant profile must be the authenticated user\'s owned profile.'}
                        )

                if credit.status != 'issued':
                    raise serializers.ValidationError(
                        {'credit': 'Only issued Green Route Credits can be submitted for redemption review.'}
                    )
                if unit_label != credit.unit_label:
                    raise serializers.ValidationError(
                        {'unit_label': 'Redemption unit must match the credit unit.'}
                    )
                if requested_units is not None and requested_units <= 0:
                    raise serializers.ValidationError(
                        {'requested_units': 'Requested units must be greater than zero.'}
                    )
                if requested_units is not None and requested_units > credit.amount_units:
                    raise serializers.ValidationError(
                        {'requested_units': 'Requested units cannot exceed the issued credit amount.'}
                    )
                if profile and profile.institution_id != credit.institution_id:
                    raise serializers.ValidationError(
                        {'profile': 'Participant profile must belong to the same institution as the credit.'}
                    )
                if charging_hub and charging_hub.institution_id not in (None, credit.institution_id):
                    raise serializers.ValidationError(
                        {'charging_hub': 'Charging Hub must be shared reference data or belong to the credit institution.'}
                    )
                if charging_hub and charging_hub.status != 'active':
                    raise serializers.ValidationError(
                        {'charging_hub': 'Only active Charging Hub records are selectable for a new redemption request.'}
                    )
        return attrs
