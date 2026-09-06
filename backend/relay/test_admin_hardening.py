from django.contrib import admin
from django.test import SimpleTestCase

from relay.models import Profile


class ProfileAdminHardeningTests(SimpleTestCase):
    def test_profile_owner_is_read_only_in_django_admin(self):
        profile_admin = admin.site._registry[Profile]
        self.assertIn('user', profile_admin.get_readonly_fields(request=None))
