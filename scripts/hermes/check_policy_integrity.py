#!/usr/bin/env python3
"""Local release-preflight gate for operator-installed policy bytes (no execution)."""
import argparse
import hashlib
from pathlib import Path
import re


def check_policy_integrity(policy: Path) -> bool:
    """Fail closed if either file is missing, unreadable, malformed or mismatched."""
    try:
        expected = policy.with_suffix(".sha256").read_text(encoding="ascii").strip()
        return bool(re.fullmatch(r"[0-9a-f]{64}", expected)) and (
            hashlib.sha256(policy.read_bytes()).hexdigest() == expected
        )
    except (OSError, UnicodeError):
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", type=Path, required=True,
                        help="Exact trusted installed policy path from the hook registration.")
    args = parser.parse_args()
    if not check_policy_integrity(args.policy.expanduser()):
        print("FAIL: installed policy integrity verification failed.")
        return 1
    print("PASS: installed policy integrity verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
