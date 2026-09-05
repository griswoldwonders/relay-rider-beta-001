import json
from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from .models import (
    ChargingHub,
    Cohort,
    DataSource,
    GreenRouteCredit,
    Institution,
    Membership,
    Profile,
    Site,
)
from .services.vertical_slice import run_vertical_slice


CSV_CONTENT = """external_id,origin_zone,destination_zone,commute_days,arrival_window,departure_window,schedule_flex_minutes,current_mode,occupants,vehicle_fuel_type,parking_difficulty,ev_interest,access_point_willing,consent_confirmed
P1,Eagle Rock,Pasadena Campus,Mon|Tue|Wed,07:30-08:00,16:30-17:00,20,drive_alone,,gasoline,high,yes,yes,yes
P2,Glendale,Pasadena Campus,Mon|Wed,08:00-08:30,17:00-17:30,10,carpool,2,hybrid,medium,no,yes,yes
"""


class FakeRule2202Calculator:
    def vehicle_trip_weight(self, mode, occupants=None):
        if mode == 'drive_alone':
            return Decimal('1')
        if mode == 'carpool':
            return Decimal('1') / Decimal(str(occupants))
        return Decimal('0')

    def calculate_avr(self, employees, vehicle_trips):
        return (Decimal(str(employees)) / Decimal(str(vehicle_trips))).quantize(Decimal('0.01'))


class OperationalResearchBetaRC1Acceptance(APITestCase):
    """Acceptance-only proof for RC1; no product behavior is added by this file."""

    def setUp(self):
        self.institution = Institution.objects.create(
            name='Fictional Pasadena Operational RC',
            slug='fictional-pasadena-operational-rc',
            status='active',
        )
        self.participant_user = User.objects.create_user(
            username='pasadena-participant-rc', password='synthetic-participant-password'
        )
        self.admin_user = User.objects.create_user(
            username='pasadena-admin-rc', password='synthetic-admin-password'
        )
        Membership.objects.create(
            user=self.participant_user,
            institution=self.institution,
            role='viewer',
        )
        Membership.objects.create(
            user=self.admin_user,
            institution=self.institution,
            role='institution_admin',
        )
        self.participant_token = Token.objects.create(user=self.participant_user)
        self.admin_token = Token.objects.create(user=self.admin_user)

        self.participant_profile = Profile.objects.create(
            institution=self.institution,
            name='Synthetic Pasadena Participant',
            email='participant-rc@example.test',
            role='participant',
            home_zone='Eagle Rock (approximate zone)',
            destination_zone='Pasadena (approximate zone)',
        )
        self.hub = ChargingHub.objects.create(
            institution=self.institution,
            name='Synthetic Pasadena RC Charging Hub',
            network='Institution-operated',
            city='Pasadena',
            stalls=2,
            connector_types=['J1772'],
            status='active',
            evidence_label='synthetic',
        )
        self.credit = GreenRouteCredit.objects.create(
            institution=self.institution,
            profile=self.participant_profile,
            amount_units='8.00',
            unit_label='Green Route Credits',
            status='issued',
            note='Synthetic RC acceptance credit',
        )

        self.site = Site.objects.create(
            institution=self.institution,
            name='Pasadena Campus RC',
            slug='pasadena-campus-rc',
            site_type='campus',
            city='Pasadena',
        )
        self.cohort = Cohort.objects.create(
            institution=self.institution,
            site=self.site,
            name='Operational RC Cohort',
            slug='operational-rc-cohort',
        )
        self.source = DataSource.objects.create(
            institution=self.institution,
            site=self.site,
            name='Synthetic Operational RC CSV',
            source_type='synthetic',
            provenance_label='synthetic',
        )

    def client_for_token(self, token):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        return client

    def emit(self, label, payload):
        print(f'OPERATIONAL_RC_EVIDENCE {label} {json.dumps(payload, default=str, sort_keys=True)}')

    def test_two_token_authenticated_users_exercise_participant_admin_boundary(self):
        participant_client = self.client_for_token(self.participant_token)
        admin_client = self.client_for_token(self.admin_token)

        wallet = participant_client.get('/api/green-route-credits/')
        self.assertEqual(wallet.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row['id'] == self.credit.id for row in wallet.data))

        created = participant_client.post('/api/redemption-requests/', {
            'credit': self.credit.id,
            'profile': self.participant_profile.id,
            'charging_hub': self.hub.id,
            'requested_units': '4.00',
            'idempotency_key': 'operational-rc-two-user-001',
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        request_id = created.data['id']

        participant_review = participant_client.patch(
            f'/api/redemption-requests/{request_id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertEqual(participant_review.status_code, status.HTTP_403_FORBIDDEN)

        admin_review = admin_client.patch(
            f'/api/redemption-requests/{request_id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertEqual(admin_review.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_review.data['status'], 'under-review')
        self.assertEqual(admin_review.data['reviewed_by'], self.admin_user.username)

        fulfilled = admin_client.patch(
            f'/api/redemption-requests/{request_id}/',
            {
                'status': 'fulfilled',
                'fulfillment_method': 'manual_program_action',
                'review_note': 'Synthetic RC acceptance decision; no charging-network settlement.',
            },
            format='json',
        )
        self.assertEqual(fulfilled.status_code, status.HTTP_200_OK)
        self.assertEqual(fulfilled.data['status'], 'fulfilled')

        self.emit('two_token_authenticated_users', {
            'participant_username': self.participant_user.username,
            'participant_wallet_status': wallet.status_code,
            'participant_request_status': created.data['status'],
            'participant_review_denial_status': participant_review.status_code,
            'admin_username': self.admin_user.username,
            'admin_review_status': admin_review.data['status'],
            'admin_final_status': fulfilled.data['status'],
            'authentication_transport': 'DRF TokenAuthentication',
        })

    def test_admin_token_reads_final_pasadena_institutional_outputs(self):
        result = run_vertical_slice(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
            data_source=self.source,
            actor=self.admin_user,
            file_name='operational-rc.csv',
            csv_content=CSV_CONTENT,
            rule2202_calculator=FakeRule2202Calculator(),
        )
        self.assertEqual(result['commute_import'].valid_rows, 2)
        self.assertEqual(result['rule2202_run'].status, 'completed')
        self.assertEqual(result['decision_card'].status, 'ready_for_review')

        admin_client = self.client_for_token(self.admin_token)
        dashboard = admin_client.get(f'/api/institutions/{self.institution.id}/dashboard/')
        export = admin_client.get(f'/api/institutions/{self.institution.id}/commuter-records.csv')
        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        self.assertEqual(export.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard.data['summary']['commuter_records'], 2)
        self.assertEqual(dashboard.data['latest_decision_card']['id'], result['decision_card'].id)
        self.assertEqual(dashboard.data['latest_decision_card']['rule2202_status'], 'completed')

        self.emit('institutional_pasadena_proof', {
            'institution': self.institution.name,
            'site': self.site.name,
            'cohort': self.cohort.name,
            'valid_records': result['commute_import'].valid_rows,
            'engine_scores': len(result['scores']),
            'rule2202_status': result['rule2202_run'].status,
            'dashboard_status_code': dashboard.status_code,
            'csv_export_status_code': export.status_code,
            'decision_card_id': result['decision_card'].id,
            'decision_card_status': result['decision_card'].status,
            'admin_inspection_exercised': True,
            'persisted_decision_card_review_transition': False,
        })
