from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from .security_boundary import assert_dev_boundary_safe

ALLOW_ANY = ['rest_framework.permissions.AllowAny']
IS_AUTHENTICATED = ['rest_framework.permissions.IsAuthenticated']


class DevBoundaryGuardTests(SimpleTestCase):
    def test_localhost_with_debug_and_allow_any_passes(self):
        # Matches current local-dev settings.py exactly -- must keep working.
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
        # The intended fix path before a real deployment.
        assert_dev_boundary_safe(False, IS_AUTHENTICATED, ['app.example.com'])
