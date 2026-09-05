from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class OperationalBetaMigrationDataPreservationTests(TransactionTestCase):
    migrate_from = ('relay', '0006_institutional_vertical_slice')
    migrate_to = ('relay', '0007_operational_beta_hardening')

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_legacy_unowned_profile_survives_forward_backward_reapply(self):
        old_apps = self.migrate(self.migrate_from)
        Institution = old_apps.get_model('relay', 'Institution')
        Profile = old_apps.get_model('relay', 'Profile')
        institution = Institution.objects.create(
            name='Legacy Pasadena Institution',
            slug='legacy-pasadena-institution',
            status='active',
        )
        profile = Profile.objects.create(
            institution_id=institution.id,
            name='Legacy Unowned Participant',
            email='legacy-unowned@example.test',
            role='participant',
        )
        profile_id = profile.id

        new_apps = self.migrate(self.migrate_to)
        HardenedProfile = new_apps.get_model('relay', 'Profile')
        hardened = HardenedProfile.objects.get(pk=profile_id)
        self.assertEqual(hardened.name, 'Legacy Unowned Participant')
        self.assertIsNone(hardened.user_id)

        rolled_back_apps = self.migrate(self.migrate_from)
        RolledBackProfile = rolled_back_apps.get_model('relay', 'Profile')
        rolled_back = RolledBackProfile.objects.get(pk=profile_id)
        self.assertEqual(rolled_back.email, 'legacy-unowned@example.test')

        reapplied_apps = self.migrate(self.migrate_to)
        ReappliedProfile = reapplied_apps.get_model('relay', 'Profile')
        reapplied = ReappliedProfile.objects.get(pk=profile_id)
        self.assertEqual(reapplied.name, 'Legacy Unowned Participant')
        self.assertIsNone(reapplied.user_id)
