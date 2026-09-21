from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from relay.models import (
    Cohort,
    CommuteImport,
    DataSource,
    DecisionCard,
    Institution,
    Membership,
    Profile,
    Rule2202CalculationRun,
    Site,
)


class AdminObjectExistenceHardeningTests(APITestCase):
    def setUp(self):
        self.inst_a = Institution.objects.create(name='Pasadena A', slug='pasadena-a', status='active')
        self.inst_b = Institution.objects.create(name='Pasadena B', slug='pasadena-b', status='active')

        self.admin_a = User.objects.create_user(username='admin-a-existence', password='pw')
        self.admin_b = User.objects.create_user(username='admin-b-existence', password='pw')
        self.participant_a = User.objects.create_user(username='participant-a-existence', password='pw')
        self.participant_b = User.objects.create_user(username='participant-b-existence', password='pw')
        Membership.objects.create(user=self.admin_a, institution=self.inst_a, role='institution_admin')
        Membership.objects.create(user=self.admin_b, institution=self.inst_b, role='institution_admin')
        Membership.objects.create(user=self.participant_a, institution=self.inst_a, role='participant')
        Membership.objects.create(user=self.participant_b, institution=self.inst_b, role='participant')

        self.admin_a_token = Token.objects.create(user=self.admin_a)
        self.participant_a_token = Token.objects.create(user=self.participant_a)

        self.profile_b = Profile.objects.create(
            institution=self.inst_b,
            name='Hidden B Profile',
            role='participant',
        )

        self.site_a = Site.objects.create(institution=self.inst_a, name='A Site', slug='a-site')
        self.cohort_a = Cohort.objects.create(institution=self.inst_a, site=self.site_a, name='A Cohort', slug='a-cohort')
        self.source_a = DataSource.objects.create(
            institution=self.inst_a,
            site=self.site_a,
            name='A Source',
            source_type='synthetic',
            provenance_label='synthetic',
        )
        self.import_a = CommuteImport.objects.create(
            institution=self.inst_a,
            site=self.site_a,
            cohort=self.cohort_a,
            data_source=self.source_a,
            imported_by=self.admin_a,
            file_name='a.csv',
            file_sha256='1' * 64,
            status='completed',
        )
        self.rule_a = Rule2202CalculationRun.objects.create(
            institution=self.inst_a,
            site=self.site_a,
            cohort=self.cohort_a,
            commute_import=self.import_a,
            initiated_by=self.admin_a,
            status='completed',
        )
        self.card_a = DecisionCard.objects.create(
            institution=self.inst_a,
            site=self.site_a,
            cohort=self.cohort_a,
            commute_import=self.import_a,
            rule2202_run=self.rule_a,
            status='ready_for_review',
            title='A Card',
            finding='Synthetic',
            recommended_action='Review',
        )

        self.site_b = Site.objects.create(institution=self.inst_b, name='B Site', slug='b-site')
        self.cohort_b = Cohort.objects.create(institution=self.inst_b, site=self.site_b, name='B Cohort', slug='b-cohort')
        self.source_b = DataSource.objects.create(
            institution=self.inst_b,
            site=self.site_b,
            name='B Source',
            source_type='synthetic',
            provenance_label='synthetic',
        )
        self.import_b = CommuteImport.objects.create(
            institution=self.inst_b,
            site=self.site_b,
            cohort=self.cohort_b,
            data_source=self.source_b,
            imported_by=self.admin_b,
            file_name='b.csv',
            file_sha256='2' * 64,
            status='completed',
        )
        self.rule_b = Rule2202CalculationRun.objects.create(
            institution=self.inst_b,
            site=self.site_b,
            cohort=self.cohort_b,
            commute_import=self.import_b,
            initiated_by=self.admin_b,
            status='completed',
        )
        self.card_b = DecisionCard.objects.create(
            institution=self.inst_b,
            site=self.site_b,
            cohort=self.cohort_b,
            commute_import=self.import_b,
            rule2202_run=self.rule_b,
            status='ready_for_review',
            title='B Card',
            finding='Synthetic',
            recommended_action='Review',
        )

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_cross_tenant_profile_binding_does_not_reveal_profile_existence(self):
        self.auth(self.admin_a_token)
        response = self.client.post(
            f'/api/profiles/{self.profile_b.id}/bind-user/',
            {'user': self.participant_b.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.profile_b.refresh_from_db()
        self.assertIsNone(self.profile_b.user_id)

    def test_participant_cannot_probe_decision_card_review_endpoint(self):
        self.auth(self.participant_a_token)
        response = self.client.post(
            f'/api/decision-cards/{self.card_a.id}/review/',
            {'review_note': 'Must remain hidden.'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.card_a.refresh_from_db()
        self.assertEqual(self.card_a.status, 'ready_for_review')

    def test_cross_tenant_admin_cannot_probe_decision_card_existence(self):
        self.auth(self.admin_a_token)
        response = self.client.post(
            f'/api/decision-cards/{self.card_b.id}/review/',
            {'review_note': 'Must remain hidden.'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.card_b.refresh_from_db()
        self.assertEqual(self.card_b.status, 'ready_for_review')
