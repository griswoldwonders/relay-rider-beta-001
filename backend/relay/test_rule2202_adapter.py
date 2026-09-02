from django.test import SimpleTestCase, override_settings

from .rule2202_adapter import get_rule2202_readiness


class Rule2202ReadinessTests(SimpleTestCase):
    @override_settings(RELAY_RULE2202_STATE="unverified")
    def test_unverified_state_blocks_execution(self):
        readiness = get_rule2202_readiness()
        self.assertEqual(readiness.state, "unverified")
        self.assertFalse(readiness.can_execute)
