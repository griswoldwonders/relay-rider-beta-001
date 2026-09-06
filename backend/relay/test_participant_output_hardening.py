from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from relay.models import Institution, Membership


class ParticipantInstitutionalOutputHardeningTests(APITestCase):
    def setUp(self):
        self.institution = Institution.objects.create(
            name='Pasadena Participant Output Boundary',
            slug='pasadena-participant-output-boundary',
            status='active',
        )
        self.participant = User.objects.create_user(username='participant-output-boundary', password='pw')
        Membership.objects.create(
            user=self.participant,
            institution=self.institution,
            role='participant',
        )
        self.token = Token.objects.create(user=self.participant)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def test_participant_cannot_read_institution_dashboard(self):
        response = self.client.get(f'/api/institutions/{self.institution.id}/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_participant_cannot_export_institution_commuter_records(self):
        response = self.client.get(f'/api/institutions/{self.institution.id}/commuter-records.csv')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
