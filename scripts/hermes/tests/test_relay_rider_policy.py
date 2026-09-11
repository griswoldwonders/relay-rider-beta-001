"""Behavioral tests for the Relay Rider Hermes pre-tool policy hook."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


POLICY_PATH = Path(__file__).parents[1] / "relay_rider_policy.py"
INSTALLER_PATH = Path(__file__).parents[1] / "install_relay_rider_policy.py"


def run_policy(*, tool_name: str, tool_input: dict, cwd: str = "/workspace/relay-rider") -> subprocess.CompletedProcess[str]:
    payload = {
        "hook_event_name": "pre_tool_call",
        "tool_name": tool_name,
        "tool_input": tool_input,
        "session_id": "test-session",
        "cwd": cwd,
        "extra": {},
    }
    return subprocess.run(
        [sys.executable, str(POLICY_PATH)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )


def block_message(result: subprocess.CompletedProcess[str]) -> str:
    assert result.returncode == 2, result.stderr
    response = json.loads(result.stdout)
    assert response["action"] == "block"
    return response["message"]


class RelayRiderPolicyTests(unittest.TestCase):
    def test_allows_non_force_push_to_hermes_branch(self) -> None:
        result = run_policy(
            tool_name="terminal",
            tool_input={"command": "git push origin hermes/example"},
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")

    def test_blocks_push_to_main(self) -> None:
        result = run_policy(
            tool_name="terminal",
            tool_input={"command": "git push origin HEAD:main"},
        )

        self.assertIn("main", block_message(result))

    def test_blocks_force_push_variants_and_refspecs(self) -> None:
        for command in (
            "git push --force origin hermes/example",
            "git push --for origin HEAD:hermes/example",
            "git push -f origin hermes/example",
            "git push origin +HEAD:hermes/example",
            "git push --mirror origin",
        ):
            with self.subTest(command=command):
                result = run_policy(tool_name="terminal", tool_input={"command": command})
                self.assertTrue(block_message(result))

    def test_blocks_git_push_without_an_explicit_approved_destination(self) -> None:
        for command in ("git push", "git -C . push origin HEAD:main"):
            with self.subTest(command=command):
                result = run_policy(tool_name="terminal", tool_input={"command": command})
                self.assertTrue(block_message(result))

    def test_blocks_git_c_even_for_a_development_push(self) -> None:
        result = run_policy(
            tool_name="terminal",
            tool_input={"command": "git -C . push origin HEAD:hermes/example"},
        )

        self.assertIn("git -c", block_message(result).lower())

    def test_blocks_destructive_git_recovery_in_any_option_order(self) -> None:
        for command in ("git reset --hard HEAD", "git reset HEAD --hard", "git clean -fd", "git clean -nfd"):
            with self.subTest(command=command):
                result = run_policy(tool_name="terminal", tool_input={"command": command})
                self.assertIn("destructive git", block_message(result).lower())

    def test_blocks_remote_branch_deletion_and_git_merge(self) -> None:
        for command in ("git push --delete origin hermes/example", "git merge origin/main"):
            with self.subTest(command=command):
                result = run_policy(tool_name="terminal", tool_input={"command": command})
                self.assertIn("merge" if "merge" in command else "delete", block_message(result).lower())

    def test_blocks_terminal_worktree_escape_and_malformed_command(self) -> None:
        for command in (
            "printf x > ../outside.txt",
            "printf x > C:/outside.txt",
            "git -C ../other push origin hermes/example",
            'git -C "../other" push origin hermes/example',
            "git -C . merge origin/main",
            None,
        ):
            with self.subTest(command=command):
                result = run_policy(tool_name="terminal", tool_input={"command": command})
                message = block_message(result).lower()
                self.assertIn("validate", message) if command is None else self.assertTrue(message)

    def test_blocks_production_deployment(self) -> None:
        result = run_policy(
            tool_name="terminal",
            tool_input={"command": "npx netlify-cli deploy --prod --dir=dist"},
        )

        self.assertIn("production deployment", block_message(result).lower())

    def test_blocks_production_database_mutation(self) -> None:
        for command in (
            "supabase db push --project-ref production-project",
            "supabase db push; printf -- --local",
        ):
            with self.subTest(command=command):
                result = run_policy(tool_name="terminal", tool_input={"command": command})
                self.assertIn("production database", block_message(result).lower())

    def test_blocks_secret_reading_commands(self) -> None:
        for command in ("cat ~/.hermes/.env", "Get-Content auth.json", "printenv"):
            with self.subTest(command=command):
                result = run_policy(tool_name="terminal", tool_input={"command": command})
                self.assertIn("credential", block_message(result).lower())

    def test_blocks_terminal_writes_to_git_internals(self) -> None:
        result = run_policy(
            tool_name="terminal",
            tool_input={"command": "printf x > .GIT/config"},
        )

        self.assertTrue(block_message(result))

    def test_blocks_founder_only_merge_command(self) -> None:
        result = run_policy(tool_name="terminal", tool_input={"command": "gh pr merge 123 --squash"})

        self.assertIn("merge", block_message(result).lower())

    def test_blocks_policy_hook_source_write(self) -> None:
        result = run_policy(
            tool_name="write_file",
            tool_input={"path": "/workspace/relay-rider/scripts/hermes/relay_rider_policy.py", "content": "pass"},
        )

        self.assertIn("policy hook", block_message(result).lower())

    def test_blocks_writes_to_git_internals(self) -> None:
        result = run_policy(
            tool_name="write_file",
            tool_input={"path": "/workspace/relay-rider/.git/config", "content": "x"},
        )

        self.assertIn(".git", block_message(result).lower())

    def test_blocks_writes_outside_worktree(self) -> None:
        for path in ("/tmp/other-repository/file.txt", "../outside.txt", "C:/outside/file.txt"):
            with self.subTest(path=path):
                result = run_policy(tool_name="write_file", tool_input={"path": path, "content": "x"})
                self.assertIn("worktree", block_message(result).lower())

    def test_blocks_patch_targets_outside_worktree(self) -> None:
        result = run_policy(
            tool_name="patch",
            tool_input={"patch": "*** Begin Patch\n*** Update File: ../outside.txt\n+x\n*** End Patch"},
        )

        self.assertIn("worktree", block_message(result).lower())

    def test_allows_patch_targets_inside_worktree(self) -> None:
        result = run_policy(
            tool_name="patch",
            tool_input={"patch": "*** Begin Patch\n*** Update File: docs/proof.md\n+x\n*** End Patch"},
        )

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_blocks_read_file_of_secret_material(self) -> None:
        for path in ("/workspace/relay-rider/.env", "/workspace/relay-rider/.env.production"):
            with self.subTest(path=path):
                result = run_policy(tool_name="read_file", tool_input={"path": path})
                self.assertIn("credential", block_message(result).lower())

    def test_blocks_secret_file_glob_search(self) -> None:
        result = run_policy(
            tool_name="search_files",
            tool_input={"path": ".", "pattern": ".", "file_glob": "*env*"},
        )

        self.assertIn("credential", block_message(result).lower())

    def test_blocks_search_outside_the_worktree(self) -> None:
        result = run_policy(
            tool_name="search_files",
            tool_input={"path": "../outside", "pattern": ".", "target": "content"},
        )

        self.assertIn("worktree", block_message(result).lower())

    def test_allows_read_file_inside_worktree(self) -> None:
        result = run_policy(
            tool_name="read_file",
            tool_input={"path": "/workspace/relay-rider/docs/proof.md"},
        )

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_allows_write_inside_worktree(self) -> None:
        result = run_policy(
            tool_name="write_file",
            tool_input={"path": "/workspace/relay-rider/docs/proof.md", "content": "safe"},
        )

        self.assertEqual(result.returncode, 0, result.stderr)
    def test_installer_copies_policy_outside_worktree_and_prints_config(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            destination = Path(temp_dir) / "agent-hooks" / "relay-rider-policy.py"
            result = subprocess.run(
                [sys.executable, str(INSTALLER_PATH), "--destination", str(destination)],
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(destination.read_text(encoding="utf-8"), POLICY_PATH.read_text(encoding="utf-8"))
            self.assertIn("hooks.pre_tool_call", result.stdout)
            self.assertIn(str(destination), result.stdout)


if __name__ == "__main__":
    unittest.main()
