# Hermes policy hook

`relay_rider_policy.py` implements the Relay Rider fail-closed `pre_tool_call` policy described in `docs/development/hermes-agentic-development.md`.

`install_relay_rider_policy.py` copies the reviewed policy to an operator-controlled path outside an agent worktree and prints the hook configuration entry. It does not auto-approve or overwrite existing hook registrations.

Run the behavior suite from the repository root:

```bash
python -m unittest scripts.hermes.tests.test_relay_rider_policy -v
```

The program accepts one Hermes shell-hook JSON payload on standard input. A policy violation returns exit code `2` and a JSON block response; allowed operations return exit code `0` with no output.
