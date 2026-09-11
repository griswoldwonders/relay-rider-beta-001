# Hermes policy hook

`relay_rider_policy.py` implements the Relay Rider fail-closed `pre_tool_call` policy described in `docs/development/hermes-agentic-development.md`.

Run its behavior suite from the repository root:

```bash
python -m unittest scripts.hermes.tests.test_relay_rider_policy -v
```

The program accepts one Hermes shell-hook JSON payload on standard input. A policy violation returns exit code `2` and a JSON block response; allowed operations return exit code `0` with no output.
