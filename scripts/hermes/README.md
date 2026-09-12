# Hermes policy hook

`relay_rider_policy.py` implements the Relay Rider fail-closed `pre_tool_call` policy described in `docs/development/hermes-agentic-development.md`.

`install_relay_rider_policy.py` copies the reviewed policy to an operator-controlled path outside an agent worktree and prints the hook configuration entry. It does not auto-approve or overwrite existing hook registrations.

Run the behavior suite from the repository root:

```bash
python -m unittest discover -s scripts/hermes/tests -v
```

## Installed policy integrity / release-preflight integration

The installer publishes `relay-rider-policy.sha256` next to
`relay-rider-policy.py` (custom destinations use the same stem). The sidecar is
an ASCII lowercase SHA-256 digest plus newline, computed over the installed
file's bytes. Existing installations must be reinstalled by the operator to
publish this metadata, then reviewed/re-approved as required by Hermes.

This base branch has no full release-preflight runner. The minimal matching
integrity gate is available now:

```bash
python scripts/hermes/check_policy_integrity.py --policy "<trusted installed policy path>"
python scripts/scan_credentials.py
```

Integration dependency: the full release-preflight runner must resolve the exact
operator-controlled installed path from its validated fail-closed hook entry,
call `check_policy_integrity(Path(...))` (or the CLI above), and abort before any
application commands if it returns false/nonzero. Do not hash the repository
copy instead, execute the installed file to check it, generate a new digest during
preflight, or silently accept old installations without metadata. Missing,
unreadable, malformed, and mismatched metadata/policy all fail closed. The
checker requires an explicit path to avoid guessing a different Hermes profile.

The policy and sidecar must both be operator-controlled outside writable agent
worktrees. A digest detects content drift, not authenticity: an actor able to
replace both files can defeat this check. This gate does not validate hook
registration or replace hook doctor, the full preflight, branch protections,
independent review, or founder approval. No host hook is installed by tests.

## Quiet tracked-file credential scan

Security CI and local preflight share `scripts/scan_credentials.py`. Run it from
the repository root. It checks tracked working-tree files (including binary
files) using quiet Git grep and discards stdout/stderr from Git. Exit codes:
`0` clean, `1` potential credential, `2` scan failure/timeout. It never prints
matched content or filenames. Untracked files and Git history are not scanned.

Coverage includes GitHub classic/fine-grained PATs, Supabase secret keys and
legacy JWT service-role keys, Slack xox token families, and the previous
OpenAI-style/Airtable/AWS/private-key patterns. JWT-shaped values are deliberately
flagged conservatively, including public/anon JWTs; this is a heuristic, not a
complete secret detector. Tests construct synthetic fixtures at runtime to avoid
committing credential-shaped literals.

The program accepts one Hermes shell-hook JSON payload on standard input. A policy violation returns exit code `2` and a JSON block response; allowed operations return exit code `0` with no output.
