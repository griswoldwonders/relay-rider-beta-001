#!/usr/bin/env python3
"""Install the reviewed Relay Rider policy hook outside an agent worktree.

This script only copies the versioned policy and prints the targeted Hermes config
command. It intentionally does not auto-approve a hook or replace unrelated
pre-tool hooks.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil


SOURCE_POLICY = Path(__file__).with_name("relay_rider_policy.py")
DEFAULT_DESTINATION = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "hermes" / "agent-hooks" / "relay-rider-policy.py"
MATCHER = "terminal|write_file|patch|read_file|search_files"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--destination",
        type=Path,
        default=DEFAULT_DESTINATION,
        help="Operator-controlled destination outside a development worktree.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    destination = args.destination.expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE_POLICY, destination)

    hook = {
        "matcher": MATCHER,
        "command": f'python "{destination}"',
        "timeout": 5,
        "fail_closed": True,
    }
    print(f"Installed reviewed Relay Rider policy hook at: {destination}")
    print("Review and merge this hook entry with existing hooks.pre_tool_call entries:")
    print(f"hermes config set hooks.pre_tool_call '{json.dumps([hook], separators=(',', ':'))}'")
    print("Then approve this reviewed hook once in an interactive Hermes session and run: hermes hooks doctor")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
