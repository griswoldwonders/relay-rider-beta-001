"""Installed policy integrity gate; uses only disposable local files."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).parents[1]
CHECKER = SCRIPTS / "check_policy_integrity.py"


class PolicyIntegrityTests(unittest.TestCase):
    def test_installed_policy_must_match_metadata(self):
        self.assertTrue(CHECKER.is_file(), "release preflight needs an integrity checker")
        with tempfile.TemporaryDirectory() as directory:
            policy = Path(directory) / "relay-rider-policy.py"
            subprocess.run([sys.executable, str(SCRIPTS / "install_relay_rider_policy.py"),
                            "--destination", str(policy)], check=True, capture_output=True)
            def check():
                return subprocess.run([sys.executable, str(CHECKER), "--policy", str(policy)],
                                      capture_output=True, text=True, timeout=10)
            self.assertEqual(check().returncode, 0)
            policy.write_bytes(policy.read_bytes() + b"\n# changed\n")
            result = check()
            self.assertEqual(result.returncode, 1)
            self.assertIn("integrity", result.stdout.lower())
            self.assertNotIn("# changed", result.stdout + result.stderr)
            for metadata in ("", "not-a-digest", "0" * 64):
                policy.with_suffix(".sha256").write_text(metadata, encoding="ascii")
                self.assertEqual(check().returncode, 1)
            policy.with_suffix(".sha256").unlink()
            self.assertEqual(check().returncode, 1)
            policy.unlink()
            self.assertEqual(check().returncode, 1)


if __name__ == "__main__":
    unittest.main()
