"""Behavior tests for the local-only release preflight runner."""

from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest
from unittest.mock import patch


SCRIPT_PATH = pathlib.Path(__file__).parents[1] / "release_preflight.py"
SPEC = importlib.util.spec_from_file_location("release_preflight", SCRIPT_PATH)
release_preflight = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = release_preflight
SPEC.loader.exec_module(release_preflight)


class ReleasePreflightTests(unittest.TestCase):
    def test_rejects_main_branch(self):
        with patch.object(release_preflight, "run_command", return_value=(0, "main\n")):
            outcome = release_preflight.check_non_main_branch()

        self.assertFalse(outcome.passed)
        self.assertIn("main", outcome.detail)

    def test_accepts_feature_branch(self):
        with patch.object(release_preflight, "run_command", return_value=(0, "hermes/release-preflight\n")):
            outcome = release_preflight.check_non_main_branch()

        self.assertTrue(outcome.passed)

    def test_requires_healthy_relay_rider_hook(self):
        with patch.object(
            release_preflight,
            "run_command",
            return_value=(
                0,
                "All shell hooks look healthy.\n"
                "- matcher: terminal|write_file|patch|read_file|search_files\n"
                "  command: python " + str(release_preflight.TRUSTED_HOOK_PATH).replace("\\", "/") + "\n"
                "  timeout: 5\n"
                "  fail_closed: true\n",
            ),
        ):
            outcome = release_preflight.check_hermes_hook()

        self.assertTrue(outcome.passed)

    def test_rejects_missing_or_non_fail_closed_hook(self):
        with patch.object(
            release_preflight,
            "run_command",
            return_value=(0, "All shell hooks look healthy.\nrelay-rider-policy.py\nfail_closed: false\n"),
        ):
            outcome = release_preflight.check_hermes_hook()

        self.assertFalse(outcome.passed)

    def test_credential_scan_passes_only_when_git_grep_finds_nothing(self):
        with patch.object(release_preflight, "run_command", return_value=(1, "")):
            outcome = release_preflight.check_tracked_credentials()

        self.assertTrue(outcome.passed)

    def test_credential_scan_reports_matches_without_echoing_them(self):
        with patch.object(release_preflight, "run_command", return_value=(0, "secret-file:1: match")):
            outcome = release_preflight.check_tracked_credentials()

        self.assertFalse(outcome.passed)
        self.assertNotIn("secret-file:1: match", outcome.detail)

    def test_rejects_relay_hook_when_fail_closed_belongs_to_another_registration(self):
        config = (
            "- matcher: terminal\n"
            "  command: python relay-rider-policy.py\n"
            "  timeout: 5\n"
            "  fail_closed: false\n"
            "- matcher: terminal\n"
            "  command: python another-policy.py\n"
            "  timeout: 5\n"
            "  fail_closed: true\n"
        )
        with patch.object(release_preflight, "run_command", side_effect=[(0, "All shell hooks look healthy."), (0, config)]):
            outcome = release_preflight.check_hermes_hook()

        self.assertFalse(outcome.passed)

    def test_rejects_hook_with_policy_filename_but_wrong_command_or_matcher(self):
        wrong_command = (
            "- matcher: terminal|write_file|patch|read_file|search_files\n"
            "  command: echo relay-rider-policy.py\n"
            "  timeout: 5\n"
            "  fail_closed: true\n"
        )
        wrong_matcher = (
            "- matcher: unrelated_tool\n"
            "  command: python C:/agent-hooks/relay-rider-policy.py\n"
            "  timeout: 5\n"
            "  fail_closed: true\n"
        )
        wrong_path = (
            "- matcher: terminal|write_file|patch|read_file|search_files\n"
            "  command: python C:/untrusted/agent-hooks/relay-rider-policy.py\n"
            "  timeout: 5\n"
            "  fail_closed: true\n"
        )
        for config in (wrong_command, wrong_matcher, wrong_path):
            with self.subTest(config=config), patch.object(
                release_preflight, "run_command", side_effect=[(0, "All shell hooks look healthy."), (0, config)]
            ):
                outcome = release_preflight.check_hermes_hook()
            self.assertFalse(outcome.passed)

    def test_migration_graph_uses_offline_loader_without_manage_migrate(self):
        with patch.object(release_preflight, "run_command", return_value=(0, "")) as runner:
            outcome = release_preflight.check_migration_graph()

        self.assertTrue(outcome.passed)
        command = runner.call_args.args[0]
        self.assertEqual(command[0], release_preflight.sys.executable)
        self.assertEqual(command[1], "-c")
        self.assertIn("MigrationLoader(None", command[2])
        self.assertNotIn("manage.py", command)
        self.assertNotIn(" migrate", command[2])

    def test_main_branch_short_circuits_before_application_commands(self):
        main_result = release_preflight.CheckResult("branch is not main", False, "current branch is main")
        with patch.object(release_preflight, "check_non_main_branch", return_value=main_result), patch.object(
            release_preflight, "check_tracked_credentials"
        ) as credentials:
            results = release_preflight.run_preflight()

        self.assertEqual(results, [main_result])
        credentials.assert_not_called()

    def test_command_not_found_is_reported_as_failed_check(self):
        with patch.object(release_preflight.subprocess, "run", side_effect=FileNotFoundError):
            outcome = release_preflight.check_frontend_type_check()

        self.assertFalse(outcome.passed)
        self.assertIn("failed", outcome.detail)

    def test_default_checks_are_local_only_and_include_required_gates(self):
        names = [check.name for check in release_preflight.default_checks()]

        self.assertEqual(
            names,
            [
                "branch is not main",
                "tracked credential scan",
                "Hermes policy hook",
                "Django migration graph",
                "frontend type check",
                "frontend test suite",
                "frontend production build",
            ],
        )


if __name__ == "__main__":
    unittest.main()
