# Relay Rider Hermes Agentic Development Foundation

## Purpose

This repository supports autonomous development only on isolated development branches. `main`, production deployment, production database mutation, and credentials remain founder-controlled.

The repository policy is intentionally defense in depth:

1. `.hermes.md` provides project context and required evidence.
2. `scripts/hermes/relay_rider_policy.py` is a fail-closed Hermes `pre_tool_call` policy hook.
3. GitHub workflows and CODEOWNERS provide repository review and CI controls.
4. The founder retains merge and production authority.

The hook is versioned with this repository. Its behavior tests are in `scripts/hermes/tests/test_relay_rider_policy.py`.

## Runtime support verified

Hermes Agent v0.21.1 supports shell-hook configuration under `hooks.pre_tool_call`. The hook receives JSON on standard input with these relevant fields:

```json
{
  "hook_event_name": "pre_tool_call",
  "tool_name": "terminal",
  "tool_input": {"command": "git push origin hermes/example"},
  "cwd": "C:/path/to/relay-rider-worktree"
}
```

A hook response of `{"action":"block","message":"..."}` with exit code `2` blocks the tool call. `fail_closed: true` blocks hook spawn errors, timeouts, and invalid hook output. The policy program also catches unexpected runtime exceptions and returns a valid exit-2 block response. The hook matcher is a full regular expression; use `terminal|write_file|patch|read_file|search_files`.

The initial design proposed `worktree`, `worktree_sync`, `delegation.worktree_isolation`, and `delegation.orchestrator_enabled` configuration keys. They were not asserted as installed runtime configuration because runtime inspection did not confirm those keys. Use explicit `git worktree add` and Hermes `--worktree` instead.

## One-time local installation

Run the installer from a trusted Relay Rider worktree after reviewing its branch contents. It copies the reviewed policy to an operator-controlled location outside the worktree and prints a hook entry. Do not run an agent from the copied hook directory.

```bash
python scripts/hermes/install_relay_rider_policy.py
```

Then, with an operator reviewing the current configuration, merge the printed hook entry with existing `hooks.pre_tool_call` entries rather than replacing them. Keep these settings enabled:

```bash
hermes config set approvals.mode smart
hermes config set security.redact_secrets true
hermes config set hooks_auto_accept false
```

Approve the copied hook once from an interactive Hermes session and run `hermes hooks doctor`. Do not use `HERMES_ACCEPT_HOOKS=1` in unattended automation: it approves every newly registered hook for that invocation. Restart Hermes after installation so a newly started agent session registers the copied hook.

## Policy behavior

The policy blocks:

- `git push` unless it names an explicit `origin` `hermes/` or `hermes-subagent/` destination, including pushes to `main` or `refs/heads/main`;
- all force-push variants, force refspecs, and mirror pushes;
- `git reset --hard` and destructive or dry-run `git clean` variants;
- pull-request merge commands;
- Netlify/Vercel production deploy commands and dispatch of the production PostgreSQL workflow;
- Supabase database push/reset except explicitly local commands, and clearly production-targeted Django/psql mutation commands;
- commands intended to print common credential files or process environments;
- reads of credential-like files and file searches outside the current worktree; and
- `write_file` and `patch` calls outside the assigned worktree, including traversal, Windows path-flavor changes, `.git` internals, and V4A patch targets.

It permits ordinary non-force pushes to development branches and writes inside the worktree. It does not replace GitHub branch protection, CI, CODEOWNERS, or founder review.

## Validation

Run the policy behavior suite:

```bash
python -m unittest scripts.hermes.tests.test_relay_rider_policy -v
```

Run a runtime hook test after installation with a synthetic payload. `hermes hooks test` merges this file into callback kwargs, so a terminal command fixture uses `args`, not the hook wire field `tool_input`:

```json
{"args":{"command":"git push origin HEAD:main"}}
```

Run it from the Relay Rider worktree. This only invokes the hook; it does not execute the synthetic command:

```bash
hermes hooks test pre_tool_call --for-tool terminal --payload-file C:/ABSOLUTE/PATH/TO/payload.json
```

The planned harmless end-to-end proof creates an isolated `hermes/` branch, changes documentation, validates it, commits, pushes that branch only, and prepares a PR for founder review. The blocked-action cases are tested through the hook using synthetic payloads.

## Roles and review sequence

Implementer → applicable Security review → QA validation → independent code review → Engineering Lead integration review → founder approval for merge.

Workers receive narrow scopes and never approve their own implementation. Security review is required for authorization, institution membership, participant data, Supabase/PostgreSQL, migrations, administrative functions, credentials, or tenant-isolation changes. Test cross-institution and status-transition adversarial cases where applicable.
