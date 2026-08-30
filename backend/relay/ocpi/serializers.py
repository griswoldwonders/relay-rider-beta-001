"""DRF serializers that validate an inbound normalized OCPI Session or
CDR payload before it reaches relay/ocpi/adapter.py.

These mirror the required-field and shape checks already implemented
in JavaScript in src/lib/ocpi/ocpiValidation.js and
src/lib/ocpi/sessionCdr.js (validateSession / validateCdr), ported to
Python/DRF so the same contract is enforced server-side without
importing Node-only code into Django. A malformed or incomplete
payload is rejected with a 400 and no database state is created --
see relay/ocpi/tests/test_views.py.
"""

from rest_framework import serializers

AUTH_METHOD_CHOICES = ['AUTH_REQUEST', 'COMMAND', 'WHITELIST', 'DEBIT']
SESSION_STATUS_CHOICES = ['PENDING', 'ACTIVE', 'RESERVED', 'COMPLETED', 'INVALID']


class CdrTokenSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=36)
    type = serializers.CharField()
    contract_id = serializers.CharField(max_length=36)


class PriceSerializer(serializers.Serializer):
    excl_vat = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    incl_vat = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True
    )
    currency = serializers.CharField(min_length=3, max_length=3)


class CdrLocationSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    address = serializers.CharField()
    city = serializers.CharField()
    postal_code = serializers.CharField(required=False, allow_blank=True)
    country = serializers.CharField(min_length=3, max_length=3)
    evse_uid = serializers.CharField()
    connector_id = serializers.CharField()


class OcpiSessionIngestSerializer(serializers.Serializer):
    """Validates a normalized Session payload plus the internal
    `partner_id` used for provider/tenant scoping. `partner_id` is not
    part of the OCPI Session object itself -- it is how the internal,
    authenticated caller (an integration worker, never the browser)
    identifies which OcpiProvider this Session belongs to.
    """

    partner_id = serializers.CharField(max_length=64)
    country_code = serializers.RegexField(r'^[A-Z]{2}$')
    party_id = serializers.RegexField(r'^[A-Z0-9]{3}$')
    id = serializers.CharField(max_length=36)
    start_date_time = serializers.DateTimeField()
    end_date_time = serializers.DateTimeField(required=False, allow_null=True)
    kwh = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=0)
    cdr_token = CdrTokenSerializer()
    auth_method = serializers.ChoiceField(choices=AUTH_METHOD_CHOICES)
    authorization_reference = serializers.CharField(max_length=36, required=False, allow_blank=True)
    location_id = serializers.CharField(max_length=36)
    evse_uid = serializers.CharField(max_length=36)
    connector_id = serializers.CharField(max_length=36)
    currency = serializers.CharField(min_length=3, max_length=3)
    status = serializers.ChoiceField(choices=SESSION_STATUS_CHOICES)
    last_updated = serializers.DateTimeField()


class OcpiCdrIngestSerializer(serializers.Serializer):
    """Validates a normalized CDR payload plus the internal
    `partner_id` used for provider/tenant scoping (see
    OcpiSessionIngestSerializer docstring)."""

    partner_id = serializers.CharField(max_length=64)
    country_code = serializers.RegexField(r'^[A-Z]{2}$')
    party_id = serializers.RegexField(r'^[A-Z0-9]{3}$')
    id = serializers.CharField(max_length=39)
    start_date_time = serializers.DateTimeField()
    end_date_time = serializers.DateTimeField()
    session_id = serializers.CharField(max_length=36, required=False, allow_blank=True)
    cdr_token = CdrTokenSerializer()
    auth_method = serializers.ChoiceField(choices=AUTH_METHOD_CHOICES)
    authorization_reference = serializers.CharField(max_length=36, required=False, allow_blank=True)
    cdr_location = CdrLocationSerializer()
    total_energy = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=0)
    total_time = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    total_cost = PriceSerializer()
    credit = serializers.BooleanField(required=False, default=False)
    credit_reference_id = serializers.CharField(max_length=39, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['end_date_time'] < attrs['start_date_time']:
            raise serializers.ValidationError('end_date_time cannot precede start_date_time')
        if attrs.get('credit') and not attrs.get('credit_reference_id'):
            raise serializers.ValidationError('credit_reference_id is required for a credit CDR')
        return attrs
