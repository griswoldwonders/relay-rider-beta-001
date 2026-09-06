import os

from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ChargingHub, Corridor, GreenRouteCredit, Institution, Membership, RedemptionRequest, RelayZone
from .security_boundary import assert_dev_boundary_safe

ALLOW_ANY = ['rest_framework.permissions.AllowAny']
IS_AUTHENTICATED = ['rest_framework.permissions.IsAuthenticated']


class DevBoundaryGuardTests(SimpleTestCase):
    def test_localhost_with_debug_and_allow_any_passes(self):
        assert_dev_boundary_safe(True, ALLOW_ANY, ['127.0.0.1', 'localhost'])

    def test_empty_allowed_hosts_passes(self):
        assert_dev_boundary_safe(True, ALLOW_ANY, [])

    def test_public_host_with_debug_true_fails(self):
        with self.assertRaises(ImproperlyConfigured):
            assert_dev_boundary_safe(True, IS_AUTHENTICATED, ['localhost', 'app.example.com'])

    def test_public_host_with_allow_any_fails_even_if_debug_false(self):
        with self.assertRaises(ImproperlyConfigured):
            assert_dev_boundary_safe(False, ALLOW_ANY, ['app.example.com'])

    def test_public_host_is_safe_once_debug_false_and_allow_any_removed(self):
        assert_dev_boundary_safe(False, IS_AUTHENTICATED, ['app.example.com'])


class TenancyRBACTestCase(APITestCase):
    def setUp(self):
        self.institution_a = Institution.objects.create(name='Institution A', slug='institution-a')
        self.institution_b = Institution.objects.create(name='Institution B', slug='institution-b')

        self.user_a = User.objects.create_user(username='staff-a', password='pw')
        Membership.objects.create(user=self.user_a, institution=self.institution_a, role='institution_admin')

        self.user_b = User.objects.create_user(username='staff-b', password='pw')
        Membership.objects.create(user=self.user_b, institution=self.institution_b, role='program_staff')

        self.viewer_a = User.objects.create_user(username='viewer-a', password='pw')
        Membership.objects.create(user=self.viewer_a, institution=self.institution_a, role='viewer')

        self.platform_admin = User.objects.create_user(username='platform-admin', password='pw')
        Membership.objects.create(user=self.platform_admin, institution=self.institution_a, role='platform_admin')

        self.credit_a = GreenRouteCredit.objects.create(
            institution=self.institution_a,
            note='credit for A',
            amount_units='10.00',
            unit_label='Green Route Credits',
            status='issued',
        )
        self.credit_b = GreenRouteCredit.objects.create(
            institution=self.institution_b,
            note='credit for B',
            amount_units='10.00',
            unit_label='Green Route Credits',
            status='issued',
        )

        self.charging_hub = ChargingHub.objects.create(name='Hub', network='Net', city='City', status='active')
        self.redemption_a = RedemptionRequest.objects.create(
            institution=self.institution_a,
            credit=self.credit_a,
            charging_hub=self.charging_hub,
            requested_units='1.00',
            unit_label='Green Route Credits',
            status='requested',
        )
        self.redemption_b = RedemptionRequest.objects.create(
            institution=self.institution_b,
            credit=self.credit_b,
            charging_hub=self.charging_hub,
            requested_units='1.00',
            unit_label='Green Route Credits',
            status='requested',
        )


class GreenRouteCreditTenancyTests(TenancyRBACTestCase):
    def test_same_tenant_list_returns_only_own_institution_rows(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/green-route-credits/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({row['id'] for row in response.data}, {self.credit_a.id})

    def test_same_tenant_retrieve_allowed(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(f'/api/green-route-credits/{self.credit_a.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cross_tenant_retrieve_denied(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(f'/api/green-route-credits/{self.credit_b.id}/')
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_cross_tenant_list_excludes_other_institution_rows(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/green-route-credits/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row['id'] for row in response.data}
        self.assertNotIn(self.credit_a.id, ids)
        self.assertIn(self.credit_b.id, ids)

    def test_platform_admin_sees_every_institution(self):
        self.client.force_authenticate(user=self.platform_admin)
        response = self.client.get('/api/green-route-credits/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({row['id'] for row in response.data}, {self.credit_a.id, self.credit_b.id})

    def test_platform_admin_can_retrieve_any_institution_row(self):
        self.client.force_authenticate(user=self.platform_admin)
        response = self.client.get(f'/api/green-route-credits/{self.credit_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_list_rejected(self):
        response = self.client.get('/api/green-route-credits/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_unauthenticated_retrieve_rejected(self):
        response = self.client.get(f'/api/green-route-credits/{self.credit_a.id}/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_api_exposes_explicit_credit_units_separate_from_impact_estimates(self):
        self.credit_a.estimated_miles_reduced = '99.00'
        self.credit_a.save(update_fields=['estimated_miles_reduced'])
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(f'/api/green-route-credits/{self.credit_a.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['amount_units'], '10.00')
        self.assertEqual(response.data['estimated_miles_reduced'], '99.00')
        self.assertEqual(response.data['unit_label'], 'Green Route Credits')
        self.assertEqual(response.data['status'], 'issued')


class RedemptionRequestTenancyTests(TenancyRBACTestCase):
    def test_same_tenant_review_follows_canonical_state_machine(self):
        self.client.force_authenticate(user=self.user_a)
        started = self.client.patch(
            f'/api/redemption-requests/{self.redemption_a.id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertEqual(started.status_code, status.HTTP_200_OK)

        completed = self.client.patch(
            f'/api/redemption-requests/{self.redemption_a.id}/',
            {'status': 'fulfilled', 'review_note': 'Approved for pilot review.'},
            format='json',
        )
        self.assertEqual(completed.status_code, status.HTTP_200_OK)
        self.redemption_a.refresh_from_db()
        self.assertEqual(self.redemption_a.status, 'fulfilled')
        self.assertEqual(self.redemption_a.reviewed_by, self.user_a.username)
        self.assertIsNotNone(self.redemption_a.reviewed_at)

    def test_requested_cannot_skip_directly_to_fulfilled(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.patch(
            f'/api/redemption-requests/{self.redemption_a.id}/',
            {'status': 'fulfilled'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.redemption_a.refresh_from_db()
        self.assertEqual(self.redemption_a.status, 'requested')

    def test_cross_tenant_review_update_denied(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.patch(
            f'/api/redemption-requests/{self.redemption_b.id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
        self.redemption_b.refresh_from_db()
        self.assertEqual(self.redemption_b.status, 'requested')

    def test_viewer_role_cannot_discover_or_review_update(self):
        self.client.force_authenticate(user=self.viewer_a)
        response = self.client.patch(
            f'/api/redemption-requests/{self.redemption_a.id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_platform_admin_can_review_any_institution(self):
        self.client.force_authenticate(user=self.platform_admin)
        response = self.client.patch(
            f'/api/redemption-requests/{self.redemption_b.id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_update_rejected(self):
        response = self.client.patch(
            f'/api/redemption-requests/{self.redemption_a.id}/',
            {'status': 'under-review'},
            format='json',
        )
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_same_tenant_create_assigns_caller_institution_and_canonical_unit(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/redemption-requests/', {
            'credit': self.credit_a.id,
            'charging_hub': self.charging_hub.id,
            'requested_units': '2.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = RedemptionRequest.objects.get(id=response.data['id'])
        self.assertEqual(created.institution_id, self.institution_a.id)
        self.assertEqual(created.unit_label, self.credit_a.unit_label)
        self.assertEqual(created.status, 'requested')

    def test_create_rejects_cross_tenant_credit_reference(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/redemption-requests/', {
            'credit': self.credit_b.id,
            'charging_hub': self.charging_hub.id,
            'requested_units': '2.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            RedemptionRequest.objects.filter(
                institution=self.institution_a,
                credit=self.credit_b,
            ).exists()
        )

    def test_create_uses_credit_institution_for_multi_membership_staff_user(self):
        Membership.objects.create(user=self.user_a, institution=self.institution_b, role='program_staff')
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/redemption-requests/', {
            'credit': self.credit_b.id,
            'charging_hub': self.charging_hub.id,
            'requested_units': '2.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = RedemptionRequest.objects.get(id=response.data['id'])
        self.assertEqual(created.institution_id, self.institution_b.id)

    def test_create_rejects_request_above_credit_amount(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/redemption-requests/', {
            'credit': self.credit_a.id,
            'charging_hub': self.charging_hub.id,
            'requested_units': '11.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PublicReferenceDataStaysPublicTests(TenancyRBACTestCase):
    def test_relay_zone_list_is_public(self):
        RelayZone.objects.create(name='Zone 1')
        response = self.client.get('/api/relay-zones/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_corridor_list_is_public(self):
        Corridor.objects.create(name='Corridor 1')
        response = self.client.get('/api/corridors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_charging_hub_list_is_public(self):
        response = self.client.get('/api/charging-hubs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_profile_create_requires_authentication(self):
        response = self.client.post('/api/profiles/', {'name': 'Anon Signup', 'email': 'anon@example.com'})
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class DjangoAdminAuthTests(TestCase):
    def test_unauthenticated_request_redirects_to_login_not_data(self):
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertTrue(response['Location'].startswith('/admin/login/'))

    def test_login_page_does_not_leak_admin_content(self):
        response = self.client.get('/admin/', follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'Log in')
        self.assertNotContains(response, 'Site administration')

    def test_authenticated_non_staff_user_still_denied(self):
        User.objects.create_user(username='commuter', password='pw')
        self.client.login(username='commuter', password='pw')
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertTrue(response['Location'].startswith('/admin/login/'))

    def test_staff_user_can_reach_admin_index(self):
        User.objects.create_user(username='staffer', password='pw', is_staff=True)
        self.client.login(username='staffer', password='pw')
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'Site administration')


class EnsureAdminCommandTests(TestCase):
    def test_missing_env_vars_raises_without_creating_a_user(self):
        with self.assertRaises(CommandError):
            call_command('ensure_admin')
        self.assertFalse(User.objects.exists())

    def test_creates_superuser_from_env(self):
        env = {
            'DJANGO_SUPERUSER_USERNAME': 'pilot-admin',
            'DJANGO_SUPERUSER_EMAIL': 'pilot-admin@example.com',
            'DJANGO_SUPERUSER_PASSWORD': 'not-a-real-password',
        }
        old = {key: os.environ.get(key) for key in env}
        os.environ.update(env)
        try:
            call_command('ensure_admin')
        finally:
            for key, value in old.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

        user = User.objects.get(username='pilot-admin')
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)

    def test_existing_user_is_left_unchanged(self):
        User.objects.create_superuser(username='pilot-admin', email='a@example.com', password='original')
        env = {
            'DJANGO_SUPERUSER_USERNAME': 'pilot-admin',
            'DJANGO_SUPERUSER_EMAIL': 'pilot-admin@example.com',
            'DJANGO_SUPERUSER_PASSWORD': 'a-different-password',
        }
        old = {key: os.environ.get(key) for key in env}
        os.environ.update(env)
        try:
            call_command('ensure_admin')
        finally:
            for key, value in old.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

        self.assertEqual(User.objects.filter(username='pilot-admin').count(), 1)
        user = User.objects.get(username='pilot-admin')
        self.assertTrue(user.check_password('original'))