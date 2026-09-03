"""Shared test fixtures for the OCPI connector test suite.

Builds valid Session/CDR payload dicts and provider/redemption model
fixtures used across relay/ocpi/tests/. No real provider credentials,
participant data, or charging-station data -- everything here is
synthetic and clearly test-only.
"""

from decimal import Decimal

from django.utils import timezone

from relay.models import ChargingHub, GreenRouteCredit, RedemptionRequest

from ..models import OcpiProvider


def make_provider(partner_id='PARTNER-A', country_code='US', party_id='ABC', status='active'):
    return OcpiProvider.objects.create(
        partner_id=partner_id,
        display_name=f'Test provider {partner_id}',
        country_code=country_code,
        party_id=party_id,
        status=status,
    )


def make_redemption(provider=None, token_uid='', authorization_reference='', requested_units='10.000', status='requested'):
    hub = ChargingHub.objects.create(name='Test Hub', network='TestNet', city='Austin', stalls=4)
    credit = GreenRouteCredit.objects.create()
    return RedemptionRequest.objects.create(
        credit=credit,
        charging_hub=hub,
        requested_units=Decimal(requested_units),
        unit_label='kWh-equivalent',
        status=status,
        ocpi_provider=provider,
        token_uid=token_uid,
        authorization_reference=authorization_reference,
    )


def session_payload(**overrides):
    payload = {
        'partner_id': 'PARTNER-A',
        'country_code': 'US',
        'party_id': 'ABC',
        'id': 'SESSION-001',
        'start_date_time': timezone.now(),
        'end_date_time': None,
        'kwh': Decimal('1.500'),
        'cdr_token': {'uid': 'TOKEN-UID-001', 'type': 'APP_USER', 'contract_id': 'TOKEN-UID-001'},
        'auth_method': 'WHITELIST',
        'authorization_reference': 'AUTHREF-001',
        'location_id': 'LOC-1',
        'evse_uid': 'EVSE-1',
        'connector_id': '1',
        'currency': 'USD',
        'status': 'ACTIVE',
        'last_updated': timezone.now(),
    }
    payload.update(overrides)
    return payload


def cdr_payload(**overrides):
    now = timezone.now()
    payload = {
        'partner_id': 'PARTNER-A',
        'country_code': 'US',
        'party_id': 'ABC',
        'id': 'CDR-001',
        'session_id': 'SESSION-001',
        'start_date_time': now,
        'end_date_time': now,
        'cdr_token': {'uid': 'TOKEN-UID-001', 'type': 'APP_USER', 'contract_id': 'TOKEN-UID-001'},
        'auth_method': 'WHITELIST',
        'authorization_reference': 'AUTHREF-001',
        'cdr_location': {
            'id': 'LOC-1',
            'name': 'Test Hub',
            'address': '100 Main St',
            'city': 'Austin',
            'postal_code': '78701',
            'country': 'USA',
            'evse_uid': 'EVSE-1',
            'connector_id': '1',
        },
        'total_energy': Decimal('5.000'),
        'total_time': Decimal('1800.00'),
        'total_cost': {'excl_vat': Decimal('2.00'), 'incl_vat': Decimal('2.16'), 'currency': 'USD'},
        'credit': False,
        'credit_reference_id': '',
    }
    payload.update(overrides)
    return payload
