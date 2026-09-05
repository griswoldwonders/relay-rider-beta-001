import json
from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from relay.models import (
    ChargingHub,
    Cohort,
    DataSource,
    GreenRouteCredit,
    Institution,
    Membership,
    Profile,
    Site,
)
from relay.services.vertical_slice import run_vertical_slice


CSV_CONTENT = """external_id,origin_zone,destination_zone,commute_days,arrival_window,departure_window,schedule_flex_minutes,current_mode,occupants,vehicle_fuel_type,parking_difficulty,ev_interest,access_point_willing,consent_confirmed
P1,Eagle Rock,Pasadena Campus,Mon|Tue|Wed,07:30-08:00,16:30-17:00,20,drive_alone,,gasoline,high,yes,yes,yes
P2,Glendale,Pasadena Campus,Mon|Wed,08:00-08:30,17:00-17:30,10,carpool,2,hybrid,medium,no,yes,yes
"""


class FakeRule2202Calculator:
    """Deterministic SQLite boundary for API acceptance; PostgreSQL CI verifies real SQL separately."""

    def vehicle_trip_weight(self, mode, occupants=None):
        if mode == 'drive_alone':
            return Decimal('1')
        if mode == 'carpool':
            return Decimal('1') / Decimal(str(occupants))
        return Decimal('0')

    def calculate_avr(self, employees, vehicle_trips):
        return (Decimal(str(employees)) / Decimal(str(vehicle_trips))).quantize(Decimal('0.01'))


class OperationalResearchBetaRC2Acceptance(APITestCase):
    def emit(self, label, payload):
        print(f'OPERATIONAL_RC2_EVIDENCE {label} {json.dumps(payload, default=str, sort_keys=True)}')

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_pasadena_two_user_owned_profile_reviewed_decision_card_proof(self):
        institution = Institution.objects.create(
            name='Fictional Pasadena Operational Beta v1',
            slug='fictional-pasadena-operational-beta-v1',
            status='active',
        )
        site = Site.objects.create(
            institution=institution,
            name='Pasadena Campus Operational Beta',
            slug='pasadena-campus-operational-beta',
            site_type='campus',
        )
        cohort = Cohort.objects.create(
            institution=institution,
            site=site,
            name='Operational Beta Cohort',
            slug='operational-beta-cohort',
        )
        source = DataSource.objects.create(
            institution=institution,
            site=site,
            name='Synthetic Operational Beta CSV',
            source_type='synthetic',
            provenance_label='synthetic',
        )

        admin = User.objects.create_user(username='pasadena-operational-admin', password='synthetic')
        participant = User.objects.create_user(username='pasadena-operational-participant', password='synthetic')
        Membership.objects.create(user=admin, institution=institution, role='institution_admin')
        Membership.objects.create(user=participant, institution=institution, role='participant')
        admin_token = Token.objects.create(user=admin)
        participant_token = Token.objects.create(user=participant)

        profile = Profile.objects.create(
            institution=institution,
            name='Synthetic Pasadena Participant',
            email='pasadena-operational@example.test',
            role='participant',
            home_zone='Eagle Rock (approximate zone)',
            destination_zone='Pasadena (approximate zone)',
        )

        # Explicit administrative ownership binding; no email inference.
        self.auth(admin_token)
        bound = self.client.post(
            f'/api/profiles/{profile.id}/bind-user/',
            {'user': participant.id},
            format='json',
        )
        self.assertEqual(bound.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.user_id, participant.id)

        hub = ChargingHub.objects.create(
            institution=institution,
            name='Synthetic Pasadena Program Hub',
            network='Institution-operated',
            city='Pasadena',
            stalls=2,
            connector_types=['J1772'],
            status='active',
            evidence_label='synthetic',
        )
        credit = GreenRouteCredit.objects.create(
            institution=institution,
            profile=profile,
            amount_units='10.00',
            unit_label='Green Route Credits',
            status='issued',
            note='Synthetic operational acceptance credit',
        )

        # Participant uses an actual DRF token and sees only the owned wallet row.
        self.auth(participant_token)
        wallet = self.client.get('/api/green-route-credits/')
        self.assertEqual(wallet.status_code, status.HTTP_200_OK)
        self.assertEqual([row['id'] for row in wallet.data], [credit.id])
        redemption = self.client.post('/api/redemption-requests/', {
            'credit': credit.id,
            'profile': profile.id,
            'charging_hub': hub.id,
            'requested_units': '2.00',
            'idempotency_key': 'operational-rc2-owned-profile',
        }, format='json')
        self.assertEqual(redemption.status_code, status.HTTP_201_CREATED)
        participant_review = self.client.patch(
            f"/api/redemption-requests/{redemption.data['id']}/",
            {'status': 'under-review'},
            format='json',
        )
        self.assertEqual(participant_review.status_code, status.HTTP_403_FORBIDDEN)

        # Canonical institutional proof chain creates records, scores, Rule 2202 boundary, and Decision Card.
        result = run_vertical_slice(
            institution=institution,
            site=site,
            cohort=cohort,
            data_source=source,
            actor=admin,
            file_name='pasadena-operational-beta.csv',
            csv_content=CSV_CONTENT,
            rule2202_calculator=FakeRule2202Calculator(),
        )
        self.assertEqual(result['commute_import'].valid_rows, 2)
        self.assertEqual(len(result['scores']), 2)
        self.assertEqual(result['rule2202_run'].status, 'completed')
        self.assertEqual(result['decision_card'].status, 'ready_for_review')

        # Admin uses its own token to perform the persisted, audited review transition.
        self.auth(admin_token)
        review = self.client.post(
            f"/api/decision-cards/{result['decision_card'].id}/review/",
            {'review_note': 'Synthetic Operational Research Beta v1 administrative review.'},
            format='json',
        )
        self.assertEqual(review.status_code, status.HTTP_200_OK)
        self.assertEqual(review.data['status'], 'reviewed')

        dashboard = self.client.get(f'/api/institutions/{institution.id}/dashboard/')
        export = self.client.get(f'/api/institutions/{institution.id}/commuter-records.csv')
        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        self.assertEqual(export.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard.data['latest_decision_card']['status'], 'reviewed')
        self.assertEqual(dashboard.data['summary']['valid_commuter_records'], 2)

        self.emit('full_proof_chain', {
            'institution': institution.name,
            'site': site.name,
            'cohort': cohort.name,
            'profile_owner_bound': profile.user_id == participant.id,
            'authentication_transport': 'DRF TokenAuthentication',
            'participant_wallet_status': wallet.status_code,
            'participant_redemption_status': redemption.data['status'],
            'participant_review_denial_status': participant_review.status_code,
            'valid_records': result['commute_import'].valid_rows,
            'engine_scores': len(result['scores']),
            'rule2202_acceptance_boundary': result['rule2202_run'].status,
            'decision_card_status': review.data['status'],
            'dashboard_status_code': dashboard.status_code,
            'csv_export_status_code': export.status_code,
            'live_transportation': False,
            'rule2202_is_certification': False,
        })
