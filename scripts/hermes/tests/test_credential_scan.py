"""Exercise the real quiet Git scan with synthetic, never valid credentials."""
import base64
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCANNER = Path(__file__).parents[2] / "scan_credentials.py"
WORKFLOW = Path(__file__).parents[3] / ".github/workflows/security.yml"


class CredentialScanTests(unittest.TestCase):
    def test_scan_recognizes_credentials_without_disclosure(self):
        self.assertTrue(SCANNER.is_file(), "shared quiet credential scanner required")
        def encoded(value):
            return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")
        fixtures = [
            "ghp" + "_" + "a" * 36,
            "github" + "_pat_" + "a" * 82,
            "sb" + "_secret_" + "a" * 32,
            encoded({"alg": "HS256", "typ": "JWT"}) + "." +
            encoded({"role": "service_role", "iss": "supabase"}) + "." + "a" * 43,
            *["xox" + kind + "-" + "1234567890-1234567890-" + "a" * 24
              for kind in ("b", "p", "a", "r", "s")],
            "sk" + "-" + "a" * 24,
            "pat" + "a" * 24,
            "AK" + "IA" + "A" * 16,
            "-----" + "BEGIN PRIVATE KEY" + "-----",
        ]
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(["git", "init", "--quiet", directory], check=True, capture_output=True)
            source = Path(directory) / "fixture.txt"
            source.write_text("safe text", encoding="utf-8")
            subprocess.run(["git", "add", "fixture.txt"], cwd=directory, check=True, capture_output=True)
            def scan():
                return subprocess.run([sys.executable, str(SCANNER)], cwd=directory,
                                      capture_output=True, text=True, timeout=10)
            self.assertEqual(scan().returncode, 0)
            for index, fixture in enumerate(fixtures):
                with self.subTest(family=index):
                    source.write_text(fixture, encoding="utf-8")
                    result = scan()
                    self.assertEqual(result.returncode, 1, "credential family not detected")
                    self.assertNotIn(fixture, result.stdout + result.stderr)
                    self.assertNotIn("fixture.txt", result.stdout + result.stderr)
            source.unlink()
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, str(SCANNER)], cwd=directory,
                                    capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 2, "Git failure must not pass")

    def test_security_workflow_uses_shared_quiet_scanner(self):
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("python scripts/scan_credentials.py", workflow)
        self.assertNotIn("git grep -n", workflow)


if __name__ == "__main__":
    unittest.main()
