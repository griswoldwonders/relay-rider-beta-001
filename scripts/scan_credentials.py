#!/usr/bin/env python3
"""Fail closed on common credential patterns in tracked working-tree files.

Never emit matches, filenames, or Git diagnostics. JWT-shaped values are treated
conservatively as credentials, including legacy Supabase service-role keys.
"""
import subprocess


PATTERN = (
    r"sk-[A-Za-z0-9_-]{20,}|pat[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|"
    r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|"
    r"ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}|"
    r"sb_secret_[A-Za-z0-9_-]{20,}|"
    r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|"
    r"xox[baprs]-[A-Za-z0-9-]{10,}"
)


def main() -> int:
    try:
        result = subprocess.run(
            ["git", "grep", "-q", "-a", "-E", "-e", PATTERN, "--", "."],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, timeout=60, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        print("FAIL: credential scan could not complete.")
        return 2
    if result.returncode == 1:
        print("PASS: no common credential patterns in tracked files.")
        return 0
    if result.returncode == 0:
        print("FAIL: potential credential material found in tracked files (matches suppressed).")
        return 1
    print("FAIL: credential scan could not complete.")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
