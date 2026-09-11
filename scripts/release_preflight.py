#!/usr/bin/env python3
"""Run local-only Relay Rider release readiness checks.

This runner intentionally has no deployment, database-mutation, remote-push, or
credential-reading operation. It checks the current worktree and local tooling.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import re
import subprocess
import sys
from typing import Callable, Sequence


ROOT = Path(__file__).resolve().parents[1]
HERMES_HOME = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
TRUSTED_HOOK_PATH = HERMES_HOME / "agent-hooks" / "relay-rider-policy.py"
NPM_COMMAND = "npm.cmd" if sys.platform == "win32" else "npm"
CREDENTIAL_PATTERN = (
    r"(sk-[A-Za-z0-9_-]{20,}|pat[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|"
    r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)"
)


@dataclass(frozen=True)
class CheckResult:
    name: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class Check:
    name: str
    execute: Callable[[], CheckResult]


def run_command(command: Sequence[str], *, environment: dict[str, str] | None = None) -> tuple[int, str]:
    """Run a local command without a shell and return status plus combined output."""
    try:
        completed = subprocess.run(
            list(command),
            cwd=ROOT,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=300,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return 124, "command timed out"
    except OSError as error:
        return 127, str(error)
    return completed.returncode, completed.stdout


def _command_check(name: str, command: Sequence[str]) -> CheckResult:
    returncode, _ = run_command(command)
    return CheckResult(name, returncode == 0, "passed" if returncode == 0 else "command failed; inspect local output")


def check_non_main_branch() -> CheckResult:
    returncode, output = run_command(("git", "branch", "--show-current"))
    branch = output.strip()
    if returncode != 0 or not branch:
        return CheckResult("branch is not main", False, "could not determine the current branch")
    if branch == "main":
        return CheckResult("branch is not main", False, "current branch is main")
    return CheckResult("branch is not main", True, f"current branch is {branch}")


def check_tracked_credentials() -> CheckResult:
    returncode, _ = run_command(("git", "grep", "-q", "-I", "-E", CREDENTIAL_PATTERN))
    if returncode == 1:
        return CheckResult("tracked credential scan", True, "no configured credential patterns found")
    if returncode == 0:
        return CheckResult("tracked credential scan", False, "configured credential pattern found; inspect git grep locally")
    return CheckResult("tracked credential scan", False, "credential scan could not run")


def check_hermes_hook() -> CheckResult:
    doctor_status, doctor_output = run_command(("hermes", "hooks", "doctor"))
    config_status, config_output = run_command(("hermes", "config", "get", "hooks.pre_tool_call"))
    healthy = doctor_status == 0 and "All shell hooks look healthy." in doctor_output
    required_tools = {"terminal", "write_file", "patch", "read_file", "search_files"}
    registrations = re.split(r"(?m)(?=^- matcher:)", config_output)
    configured = False
    for registration in registrations:
        command = re.search(r"(?m)^  command:\s*(.+)$", registration)
        matcher = re.search(r"(?m)^- matcher:\s*(.+)$", registration)
        fail_closed = re.search(r"(?m)^  fail_closed: true\s*$", registration)
        if not (command and matcher and fail_closed):
            continue
        policy_command = re.fullmatch(
            r"(?:python|python3)\s+['\"]?(.+relay-rider-policy\.py)['\"]?",
            command.group(1).strip(),
            flags=re.IGNORECASE,
        )
        configured_path = (
            Path(policy_command.group(1)).resolve()
            if policy_command
            else None
        )
        matcher_tools = set(matcher.group(1).strip().split("|"))
        if policy_command and configured_path == TRUSTED_HOOK_PATH.resolve() and required_tools <= matcher_tools:
            configured = True
            break
    return CheckResult(
        "Hermes policy hook",
        healthy and config_status == 0 and configured,
        "healthy and fail-closed" if healthy and configured else "required fail-closed Relay Rider hook is not healthy/configured",
    )


def check_migration_graph() -> CheckResult:
    loader = (
        "import os, sys; "
        "os.environ['DATABASE_URL'] = ''; "
        "os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'; "
        "sys.path.insert(0, 'backend'); "
        "import django; django.setup(); "
        "from django.db.migrations.loader import MigrationLoader; "
        "MigrationLoader(None, ignore_no_migrations=True).graph.validate_consistency()"
    )
    environment = dict(os.environ)
    environment["DATABASE_URL"] = ""
    environment["DJANGO_SETTINGS_MODULE"] = "config.settings"
    returncode, _ = run_command((sys.executable, "-c", loader), environment=environment)
    return CheckResult("Django migration graph", returncode == 0, "passed" if returncode == 0 else "command failed; rerun python scripts/release_preflight.py")


def check_frontend_type_check() -> CheckResult:
    return _command_check("frontend type check", (NPM_COMMAND, "run", "check"))


def check_frontend_test_suite() -> CheckResult:
    return _command_check("frontend test suite", (NPM_COMMAND, "test"))


def check_frontend_production_build() -> CheckResult:
    return _command_check("frontend production build", (NPM_COMMAND, "run", "build"))


def default_checks() -> list[Check]:
    return [
        Check("branch is not main", check_non_main_branch),
        Check("tracked credential scan", check_tracked_credentials),
        Check("Hermes policy hook", check_hermes_hook),
        Check("Django migration graph", check_migration_graph),
        Check("frontend type check", check_frontend_type_check),
        Check("frontend test suite", check_frontend_test_suite),
        Check("frontend production build", check_frontend_production_build),
    ]


def run_preflight() -> list[CheckResult]:
    safety = []
    for check in (check_non_main_branch, check_tracked_credentials, check_hermes_hook):
        result = check()
        safety.append(result)
        if not result.passed:
            return safety
    return safety + [
        check_migration_graph(),
        check_frontend_type_check(),
        check_frontend_test_suite(),
        check_frontend_production_build(),
    ]


def main() -> int:
    print("Relay Rider local-only release preflight")
    print("No deployment, remote push, credential read, production connection, or database write is performed.\n")
    results = run_preflight()
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"{status:4}  {result.name}: {result.detail}")
    failures = sum(not result.passed for result in results)
    print(f"\n{len(results) - failures}/{len(results)} checks passed")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
