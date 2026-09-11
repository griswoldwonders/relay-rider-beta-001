#!/usr/bin/env python3
"""Fail-closed pre-tool policy for Relay Rider Hermes development sessions.

The Hermes shell-hook protocol sends one JSON object on stdin and treats exit code
2 as a blocked pre_tool_call. This program emits a machine-readable block reason
and never runs the requested operation itself.
"""

from __future__ import annotations

import json
import ntpath
import posixpath
import re
import sys
from typing import Any, Iterable

BLOCK_EXIT_CODE = 2
_PATCH_TARGET = re.compile(r"^\*\*\* (?:Update|Add|Delete) File: (.+)$", re.MULTILINE)
_GIT_PUSH = re.compile(r"\bgit\b(?:(?![;&|\n]).)*?\bpush\b(?P<tail>[^;&|\n]*)", re.IGNORECASE)
_GIT_RESET_HARD = re.compile(r"\bgit\b(?:(?![;&|\n]).)*?\breset\b(?:(?![;&|\n]).)*?--hard\b", re.IGNORECASE)
_GIT_CLEAN_FORCE = re.compile(r"\bgit\b(?:(?![;&|\n]).)*?\bclean\b(?:(?![;&|\n]).)*?(?:--force\b|-[-a-z]*f[-a-z]*)", re.IGNORECASE)
_APPROVED_PUSH = re.compile(
    r"^\s*(?:--\S+\s+)*origin\s+(?:\S+:)?(?:hermes|hermes-subagent)/[A-Za-z0-9][A-Za-z0-9._/-]*\s*$",
    re.IGNORECASE,
)


def block(message: str) -> int:
    print(json.dumps({"action": "block", "message": message}))
    return BLOCK_EXIT_CODE


def command_from(tool_input: Any) -> str:
    if not isinstance(tool_input, dict):
        return ""
    command = tool_input.get("command")
    return command if isinstance(command, str) else ""


def is_windows_path(value: str) -> bool:
    return bool(re.match(r"^[A-Za-z]:[\\/]", value)) or "\\" in value


def canonical_path(value: str, cwd: str) -> tuple[str, bool]:
    """Lexically normalize a path without resolving attacker-controlled symlinks.

    The hook receives both Windows and POSIX-like paths in tests and remote backends.
    Returning an explicit path flavor prevents Windows case aliases and `..` traversal
    from bypassing containment checks.
    """
    windows = is_windows_path(value) or is_windows_path(cwd)
    module = ntpath if windows else posixpath
    candidate = value if module.isabs(value) else module.join(cwd, value)
    return module.normcase(module.normpath(candidate)), windows


def path_is_within(path: str, root: str, windows: bool) -> bool:
    module = ntpath if windows else posixpath
    try:
        return module.commonpath([path, root]) == root
    except ValueError:
        return False


def contains_git_internal_path(value: str) -> bool:
    return bool(re.search(r"(?:^|[\s/\\])\.git(?:$|[\s/\\])", value, re.IGNORECASE))


def push_block_reason(command: str) -> str | None:
    for match in _GIT_PUSH.finditer(command):
        tail = match.group("tail")
        if re.search(r"(?:--force(?:-with-lease)?\b|-f\b|--mirror\b|\+[^\s]+)", tail, re.IGNORECASE):
            return "Relay Rider policy blocks force pushes and force refspecs."
        if re.search(r"--delete\b", tail, re.IGNORECASE):
            return "Relay Rider policy blocks remote branch delete operations."
        if re.search(r"(?:^|[:/])main(?:$|\s)", tail, re.IGNORECASE):
            return "Relay Rider policy blocks pushes to main; use an explicit development branch."
        if not _APPROVED_PUSH.fullmatch(tail):
            return "Relay Rider policy permits pushes only to an explicit origin hermes/ or hermes-subagent/ development branch."
    return None


def terminal_block_reason(command: str) -> str | None:
    if not command.strip():
        return "Relay Rider policy cannot validate an empty terminal command."
    lowered = command.lower()

    if re.search(r"\bgit\s+-C\s+(?:\.\.[/\\]|[A-Za-z]:[/\\]|[/\\])", command, re.IGNORECASE):
        return "Relay Rider policy blocks terminal commands that escape the assigned worktree."
    if re.search(r"[<>]\s*[\"']?\.\.[/\\]", command):
        return "Relay Rider policy blocks terminal commands that write outside the assigned worktree."
    if contains_git_internal_path(command):
        return "Relay Rider policy blocks terminal access to .git internals."
    if re.search(r"\bgit\s+merge\b", lowered):
        return "Relay Rider policy blocks git merges; founder approval is required."
    if re.search(r"\bgh\s+pr\s+merge\b", lowered):
        return "Relay Rider policy blocks pull-request merges; founder approval is required."
    if _GIT_RESET_HARD.search(command) or _GIT_CLEAN_FORCE.search(command):
        return "Relay Rider policy blocks destructive git recovery commands."
    if reason := push_block_reason(command):
        return reason

    production_deploy = (
        r"\bnetlify(?:-cli)?\b[^\n]*\bdeploy\b[^\n]*\s--prod\b",
        r"\bvercel\b[^\n]*(?:\s--prod\b|\sproduction\b)",
        r"\bgh\s+workflow\s+run\s+.*production-postgres",
    )
    if any(re.search(pattern, lowered, re.IGNORECASE) for pattern in production_deploy):
        return "Relay Rider policy blocks production deployment commands. Founder approval is required."

    for supabase_command in re.finditer(r"\bsupabase\s+db\s+(?:push|reset)\b(?P<args>[^;&|\n]*)", lowered):
        if "--local" not in supabase_command.group("args").split():
            return "Relay Rider policy blocks production database mutation commands. Founder approval is required."
    if re.search(r"\b(?:python(?:3)?\s+manage\.py\s+migrate|psql)\b[^\n]*(?:production|prod)", lowered):
        return "Relay Rider policy blocks production database mutation commands. Founder approval is required."

    secret_reads = (
        r"\b(?:cat|type|more|less|head|tail|get-content)\b[^\n]*(?:\.env\b|auth\.json\b|credentials?\b|\.pem\b|id_rsa\b)",
        r"\bprintenv\b",
        r"\benv\b(?!\s+-i)",
    )
    if any(re.search(pattern, lowered, re.IGNORECASE) for pattern in secret_reads):
        return "Relay Rider policy blocks commands intended to read or print credential material."
    return None


def file_targets(tool_input: dict[str, Any]) -> Iterable[str]:
    path = tool_input.get("path")
    if isinstance(path, str) and path.strip():
        yield path
    patch = tool_input.get("patch")
    if isinstance(patch, str):
        yield from (target.strip() for target in _PATCH_TARGET.findall(patch))


def is_secret_path(path: str) -> bool:
    name = path.replace("\\", "/").rsplit("/", 1)[-1].lower()
    return name.startswith(".env") or name in {"auth.json", "credentials", "credentials.json", "id_rsa"} or name.endswith(".pem")


def file_access_block_reason(tool_input: Any, cwd: str, *, writing: bool) -> str | None:
    if not isinstance(tool_input, dict):
        return "Relay Rider policy cannot validate a file-write request."
    file_glob = tool_input.get("file_glob")
    if not writing and isinstance(file_glob, str) and is_secret_path(file_glob):
        return "Relay Rider policy blocks searches for credential material."
    targets = list(file_targets(tool_input))
    if not targets:
        return "Relay Rider policy cannot validate file-write targets."

    root, root_windows = canonical_path(cwd, cwd)
    for raw_path in targets:
        path, path_windows = canonical_path(raw_path, cwd)
        if not writing and is_secret_path(path):
            return "Relay Rider policy blocks reads of credential material."
        if path_windows != root_windows:
            return "Relay Rider policy blocks writes outside the assigned worktree."
        if contains_git_internal_path(path):
            return "Relay Rider policy blocks writes to .git internals."
        if not path_is_within(path, root, root_windows):
            return "Relay Rider policy blocks writes outside the assigned worktree."
    return None


def evaluate(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return "Relay Rider policy received an invalid hook payload."
    if payload.get("hook_event_name") != "pre_tool_call":
        return "Relay Rider policy only accepts pre_tool_call payloads."

    tool_name = payload.get("tool_name")
    tool_input = payload.get("tool_input")
    cwd = payload.get("cwd")
    if not isinstance(cwd, str) or not cwd.strip():
        return "Relay Rider policy cannot validate a request without a working directory."

    if tool_name == "terminal":
        return terminal_block_reason(command_from(tool_input))
    if tool_name in {"write_file", "patch"}:
        return file_access_block_reason(tool_input, cwd, writing=True)
    if tool_name in {"read_file", "search_files"}:
        return file_access_block_reason(tool_input, cwd, writing=False)
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        reason = evaluate(payload)
        return block(reason) if reason else 0
    except Exception:
        # Hermes treats an exit-2 policy response as a block even if the hook's
        # own runtime cannot complete its validation. Never leak exception data.
        return block("Relay Rider policy validation failed closed.")


if __name__ == "__main__":
    raise SystemExit(main())
