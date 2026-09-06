from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from relay.models import (
    AssessmentAuditEvent,
    Cohort,
    CommuteImport,
    DataSource,
    DecisionCard,
    GreenRouteCredit,
    Institution,
    Membership,
    Profile,
    Rule2202CalculationRun,
    Site,
    ChargingHub,
)


class OperationalBetaHardeningTests(APITestCase):
    def setUp(self):
        self.inst = Institution.objects.create(name='Pasadena RC2', slug='pasadena-rc2', status='active')
        self.other_inst = Institution.objects.create(name='Glendale RC2', slug='glendale-rc2', status='active')

        self.admin = User.objects.create_user(username='pasadena-admin-rc2', password='pw')
        self.participant = User.objects.create_user(username='pasadena-participant-rc2', password='pw')
        self.participant_two = User.objects.create_user(username='pasadena-participant-two-rc2', password='pw')
        self.outsider = User.objects.create_user(username='glendale-participant-rc2', password='pw')

        Membership.objects.create(user=self.admin, institution=self.inst, role='institution_admin')
        Membership.objects.create(user=self.participant, institution=self.inst, role='participant')
        Membership.objects.create(user=self.participant_two, institution=self.inst, role='participant')
        Membership.objects.create(user=self.outsider, institution=self.other_inst, role='participant')

        self.admin_token = Token.objects.create(user=self.admin)
        self.participant_token = Token.objects.create(user=self.participant)
        self.participant_two_token = Token.objects.create(user=self.participant_two)
        self.outsider_token = Token.objects.create(user=self.outsider)

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_admin_explicitly_binds_unowned_profile_once_and_audits_it(self):
        profile = Profile.objects.create(
            institution=self.inst,
            name='Unowned Pasadena Participant',
            email='unowned@example.test',
            role='participant',
        )
        self.auth(self.admin_token)
        response = self.client.post(
            f'/api/profiles/{profile.id}/bind-user/',
            {'user': self.participant.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.user_id, self.participant.id)
        self.assertTrue(AssessmentAuditEvent.objects.filter(
            institution=self.inst,
            actor=self.admin,
            action='profile_owner_bound',
            entity_type='Profile',
            entity_id=str(profile.id),
        ).exists())

        second = self.client.post(
            f'/api/profiles/{profile.id}/bind-user/',
            {'user': self.participant_two.id},
            format='json',
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        profile.refresh_from_db()
        self.assertEqual(profile.user_id, self.participant.id)

    def test_profile_binding_requires_same_institution_participant_membership(self):
        profile = Profile.objects.create(institution=self.inst, name='Pasadena Unowned')
        self.auth(self.admin_token)
        response = self.client.post(
            f'/api/profiles/{profile.id}/bind-user/',
            {'user': self.outsider.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        profile.refresh_from_db()
        self.assertIsNone(profile.user_id)

    def test_participant_wallet_is_profile_owned_not_tenant_wide(self):
        mine = Profile.objects.create(institution=self.inst, name='Mine')
        theirs = Profile.objects.create(institution=self.inst, name='Theirs')
        self.auth(self.admin_token)
        self.assertEqual(self.client.post(
            f'/api/profiles/{mine.id}/bind-user/', {'user': self.participant.id}, format='json'
        ).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.post(
            f'/api/profiles/{theirs.id}/bind-user/', {'user': self.participant_two.id}, format='json'
        ).status_code, status.HTTP_200_OK)

        mine_credit = GreenRouteCredit.objects.create(
            institution=self.inst, profile=mine, amount_units='10.00', status='issued'
        )
        GreenRouteCredit.objects.create(
            institution=self.inst, profile=theirs, amount_units='10.00', status='issued'
        )

        self.auth(self.participant_token)
        response = self.client.get('/api/green-route-credits/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row['id'] for row in response.data], [mine_credit.id])

    def test_unowned_profile_credit_is_not_visible_to_participant(self):
        unowned = Profile.objects.create(institution=self.inst, name='Legacy Unowned')
        GreenRouteCredit.objects.create(
            institution=self.inst, profile=unowned, amount_units='8.00', status='issued'
        )
        self.auth(self.participant_token)
        response = self.client.get('/api/green-route-credits/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_participant_cannot_forge_same_tenant_profile_on_redemption(self):
        mine = Profile.objects.create(institution=self.inst, name='Mine')
        theirs = Profile.objects.create(institution=self.inst, name='Theirs')
        self.auth(self.admin_token)
        self.client.post(f'/api/profiles/{mine.id}/bind-user/', {'user': self.participant.id}, format='json')
        self.client.post(f'/api/profiles/{theirs.id}/bind-user/', {'user': self.participant_two.id}, format='json')
        mine_credit = GreenRouteCredit.objects.create(
            institution=self.inst, profile=mine, amount_units='10.00', status='issued'
        )
        their_credit = GreenRouteCredit.objects.create(
            institution=self.inst, profile=theirs, amount_units='10.00', status='issued'
        )
        hub = ChargingHub.objects.create(
            institution=self.inst,
            name='Pasadena Program Hub',
            network='Institution-operated',
            city='Pasadena',
            stalls=2,
            connector_types=['J1772'],
            status='active',
            evidence_label='synthetic',
        )

        self.auth(self.participant_token)
        forged = self.client.post('/api/redemption-requests/', {
            'credit': their_credit.id,
            'profile': theirs.id,
            'charging_hub': hub.id,
            'requested_units': '1.00',
            'idempotency_key': 'forged-same-tenant',
        }, format='json')
        self.assertIn(forged.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))

        own = self.client.post('/api/redemption-requests/', {
            'credit': mine_credit.id,
            'profile': mine.id,
            'charging_hub': hub.id,
            'requested_units': '1.00',
            'idempotency_key': 'owned-request',
        }, format='json')
        self.assertEqual(own.status_code, status.HTTP_201_CREATED)

    def test_decision_card_review_is_staff_only_audited_and_irreversible(self):
        site = Site.objects.create(institution=self.inst, name='Pasadena Campus', slug='pasadena-campus')
        cohort = Cohort.objects.create(institution=self.inst, site=site, name='RC2 Cohort', slug='rc2-cohort')
        source = DataSource.objects.create(
            institution=self.inst,
            site=site,
            name='Synthetic RC2',
            source_type='synthetic',
            provenance_label='synthetic',
        )
        commute_import = CommuteImport.objects.create(
            institution=self.inst,
            site=site,
            cohort=cohort,
            data_source=source,
            imported_by=self.admin,
            file_name='rc2.csv',
            file_sha256='0' * 64,
            status='completed',
            total_rows=1,
            valid_rows=1,
            invalid_rows=0,
        )
        rule_run = Rule2202CalculationRun.objects.create(
            institution=self.inst,
            site=site,
            cohort=cohort,
            commute_import=commute_import,
            initiated_by=self.admin,
            status='completed',
        )
        card = DecisionCard.objects.create(
            institution=self.inst,
            site=site,
            cohort=cohort,
            commute_import=commute_import,
            rule2202_run=rule_run,
            status='ready_for_review',
            title='Pasadena RC2 Decision Card',
            finding='Synthetic finding',
            recommended_action='Administrative review required.',
        )

        self.auth(self.participant_token)
        denied = self.client.post(
            f'/api/decision-cards/{card.id}/review/',
            {'review_note': 'Participant must not review.'},
            format='json',
        )
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

        self.auth(self.admin_token)
        reviewed = self.client.post(
            f'/api/decision-cards/{card.id}/review/',
            {'review_note': 'Synthetic administrative review complete.'},
            format='json',
        )
        self.assertEqual(reviewed.status_code, status.HTTP_200_OK)
        card.refresh_from_db()
        self.assertEqual(card.status, 'reviewed')
        self.assertEqual(card.reviewed_by_id, self.admin.id)
        self.assertIsNotNone(card.reviewed_at)
        self.assertEqual(card.review_note, 'Synthetic administrative review complete.')
        self.assertTrue(AssessmentAuditEvent.objects.filter(
            institution=self.inst,
            actor=self.admin,
            action='decision_card_reviewed',
            entity_type='DecisionCard',
            entity_id=str(card.id),
        ).exists())

        repeated = self.client.post(
            f'/api/decision-cards/{card.id}/review/',
            {'review_note': 'Second review is forbidden.'},
            format='json',
        )
        self.assertEqual(repeated.status_code, status.HTTP_400_BAD_REQUEST)
