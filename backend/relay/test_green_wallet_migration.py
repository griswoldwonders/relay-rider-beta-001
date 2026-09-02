from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class GreenWalletMigration0004Tests(TransactionTestCase):
    migrate_from = [('relay', '0003_institution_charginghub_institution_and_more')]
    migrate_to = [('relay', '0004_green_wallet_contract')]

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps

        Institution = old_apps.get_model('relay', 'Institution')
        GreenRouteCredit = old_apps.get_model('relay', 'GreenRouteCredit')
        ChargingHub = old_apps.get_model('relay', 'ChargingHub')
        RedemptionRequest = old_apps.get_model('relay', 'RedemptionRequest')

        institution = Institution.objects.create(name='Legacy Institution', slug='legacy-institution')
        credit = GreenRouteCredit.objects.create(
            institution=institution,
            estimated_miles_reduced='4.00',
            estimated_co2_lbs_reduced='2.00',
            note='Legacy research-beta credit',
        )
        hub = ChargingHub.objects.create(
            institution=institution,
            name='Legacy Hub',
            network='Institution-operated',
            city='Pasadena',
            status='Candidate',
            evidence_label='Modeled',
        )
        request = RedemptionRequest.objects.create(
            institution=institution,
            credit=credit,
            charging_hub=hub,
            requested_units='2.00',
            unit_label='Green Route Credits',
            status='approved',
        )
        self.credit_id = credit.id
        self.hub_id = hub.id
        self.request_id = request.id

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        self.apps = executor.loader.project_state(self.migrate_to).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_forward_migration_adds_canonical_credit_defaults(self):
        GreenRouteCredit = self.apps.get_model('relay', 'GreenRouteCredit')
        credit = GreenRouteCredit.objects.get(id=self.credit_id)
        self.assertEqual(str(credit.amount_units), '0.00')
        self.assertEqual(credit.unit_label, 'Green Route Credits')
        self.assertEqual(credit.status, 'issued')
        self.assertEqual(str(credit.estimated_miles_reduced), '4.00')

    def test_forward_migration_normalizes_known_legacy_machine_values(self):
        ChargingHub = self.apps.get_model('relay', 'ChargingHub')
        RedemptionRequest = self.apps.get_model('relay', 'RedemptionRequest')
        hub = ChargingHub.objects.get(id=self.hub_id)
        request = RedemptionRequest.objects.get(id=self.request_id)
        self.assertEqual(hub.status, 'candidate')
        self.assertEqual(hub.evidence_label, 'modeled')
        self.assertEqual(request.status, 'fulfilled')
