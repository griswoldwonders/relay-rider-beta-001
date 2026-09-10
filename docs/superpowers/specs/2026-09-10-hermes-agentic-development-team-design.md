# Hermes Agentic Development Team Design

## Goal

Allow Hermes to autonomously create, modify, commit, and push isolated GitHub development branches for Relay Rider while preserving founder control over `main`, production deployment, production database changes, credentials, and merges.

The first release is an engineering-assistance system, not an autonomous production operator. Hermes may do substantial implementation work without asking for approval on each ordinary code edit, but every change must remain attributable, reviewable, testable, and reversible.

## Current Repository Constraints

Relay Rider already has the controls this design should build around rather than replace:

- Pull requests and pushes to `main` run the primary CI workflow.
- CI runs frontend checks/tests/build, Django tests and migration checks, and the canonical PostgreSQL/Rule 2202 vertical slice.
- Security checks run on pull requests to `main` and include dependency review, application security checks, credential-pattern scanning, and CodeQL.
- The Netlify production workflow only publishes on a push to `main`.
- `CODEOWNERS` assigns the founder as owner for the repository and specifically protects `.github/`, security-sensitive paths, package manifests, and other operational files.
- The GitHub rulesets API currently reports no repository rulesets. Branch-protection details were not readable through the installed GitHub integration, so this design does not assume protection exists outside the repository files.

## Architecture

Use one parent Hermes engineering-lead session with delegated leaf workers. The parent owns decomposition, branch orchestration, integration review, and status reporting. Workers receive narrow assignments and never become approvers of their own work.

```text
Founder
  |
  v
Hermes Engineering Lead
  |-- Backend/Data worker
  |-- Frontend worker
  |-- TDM/Rule 2202 worker
  |-- Security worker
  |-- QA worker
  `-- Review worker

Each coding worker -> isolated git worktree/branch -> commits -> push -> PR
Security/QA/Review -> independent verification
Founder -> merge/deploy authority
```

Hermes native delegation should remain shallow in phase 1. The parent may spawn leaf workers; leaf workers may not recursively spawn more workers. Parallel coding workers must use worktree isolation.

## Git and Worktree Policy

### Allowed without founder approval

Hermes may:

- fetch from `origin`;
- create a new isolated worktree;
- create branches under `hermes/` or `hermes-subagent/`;
- edit files inside its assigned worktree;
- run formatters, linters, tests, builds, and local validation commands;
- commit changes to its branch;
- push its own non-protected branch to `origin`;
- update that same branch with additional non-force-push commits;
- create or update a pull request targeting `main`;
- read CI, review, and test results;
- stop and report a blocker.

### Always blocked

Hermes must not:

- commit directly to `main`;
- push directly to `main`;
- force-push any branch;
- delete remote branches automatically;
- merge pull requests;
- change GitHub repository administration, branch protection, rulesets, secrets, deploy keys, or collaborators;
- bypass or disable CI/security checks;
- use `git reset --hard`, destructive `git clean`, or history rewriting as a recovery shortcut;
- expose, print, commit, or move credentials into the repository.

### Founder-approval paths

Edits to these paths may be prepared on a Hermes branch but must be explicitly called out for founder review before merge:

- `.github/**`
- `SECURITY.md`
- `docs/SECURITY_ARCHITECTURE.md`
- `backend/**/migrations/**`
- `supabase/**`
- `netlify.toml`
- package lockfiles or dependency manifests when dependencies change
- authentication, authorization, tenant-isolation, or credential-handling code

Hermes may implement such changes on its branch. The restriction is on merge/production activation, not on branch experimentation.

## Production Boundary

`main` is the production boundary for the existing frontend deployment workflow. Therefore autonomous branch writing is safe only if Hermes cannot push or merge to `main`.

The following remain founder-only actions:

- merge to `main`;
- approve a production GitHub environment deployment;
- production Netlify deploy outside the existing `main` workflow;
- production Supabase/PostgreSQL schema changes;
- production data writes, resets, destructive SQL, or credential rotation;
- changes to CI/CD secrets or environment variables.

A worker encountering a required production action must stop and return an approval request containing the branch, commit SHA, exact action, reason, tests completed, rollback path, and known risk.

## Hermes Runtime Configuration

The initial Hermes profile should use:

```yaml
worktree: true
worktree_sync: true

approvals:
  mode: smart
  denial_breaker_threshold: 3
  deny:
    - "*git push*--force*"
    - "*git push*-f*"
    - "*git push*origin main*"
    - "*git push*refs/heads/main*"
    - "*git reset --hard*"
    - "*git clean -fd*"
    - "*netlify*deploy*--prod*"
    - "*vercel*--prod*"
    - "*supabase*db push*"
    - "*supabase*db reset*"

delegation:
  worktree_isolation: true
  max_spawn_depth: 1
  orchestrator_enabled: true
```

`approvals.mode` must not be set to `off` for Relay Rider development. Smart approval is intended to remove routine prompts while retaining escalation for dangerous terminal operations.

## Fail-Closed Git Policy Hook

A Hermes shell `pre_tool_call` hook must enforce the branch boundary independently of prompt instructions. The hook must inspect terminal commands and file-writing tool calls and fail closed on errors.

Configuration shape:

```yaml
hooks:
  pre_tool_call:
    - matcher: "terminal|write_file|patch"
      command: "~/.hermes/agent-hooks/relay-rider-git-policy.py"
      timeout: 5
      fail_closed: true
```

The policy hook must block at minimum:

1. any `git push` whose destination includes `main`;
2. any force-push variant;
3. destructive history-reset or clean commands;
4. production deployment commands;
5. direct writes outside the Relay Rider working tree when the write is initiated by an engineering worker;
6. writes into `.git/` internals;
7. attempts to read or print common secret files solely to obtain credential values.

The hook should return a concise reason so the agent can report the blocked action rather than trying command variations. The Hermes denial circuit breaker remains enabled as a second control.

## Repository Context File

Add a root `.hermes.md` because Hermes gives it higher project-context priority than `AGENTS.md`, `CLAUDE.md`, or editor rules.

It must define:

- Relay Rider as an employer/institution-funded TDM research-beta product;
- no ride-hailing/live-dispatch framing;
- `main` is protected by policy and founder-controlled;
- all autonomous implementation occurs in isolated Hermes branches;
- no production secrets or production data access;
- required verification commands;
- tenant isolation and PostgreSQL `relay_app` constraints;
- Rule 2202 calculations must remain deterministic and must not be described as regulatory certification;
- observed/calculated/modeled evidence must remain distinguishable;
- workers must report failures rather than fabricate passing evidence.

## Worker Roles

### Engineering Lead

The parent Hermes session decomposes the founder request, identifies dependencies, selects workers, and defines acceptance criteria. It does not silently broaden scope.

Before delegation it records:

- objective;
- branch/worktree scope;
- files likely to change;
- prohibited actions;
- tests required;
- security/TDM review requirements;
- definition of done.

It may integrate worker branches only into another non-`main` Hermes branch. It may never merge to `main`.

### Backend/Data Worker

Primary scope: `backend/`, API contracts, Django models/services, PostgreSQL integration, canonical commuter records, import/export logic.

Required checks when relevant:

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Database-affecting work must also be exercised against PostgreSQL before being declared ready.

### Frontend Worker

Primary scope: `src/`, `public/`, UI adapters, accessibility, and participant/admin interfaces.

Required checks:

```bash
npm ci
npm run check
npm test
npm run security:check
npm run build
```

### TDM/Rule 2202 Worker

Reviews commute-domain semantics, field provenance, modeled versus observed claims, Rule 2202 inputs/outputs, corridor-scoring assumptions, and institutional reporting language.

This worker must not silently change formulas, scoring weights, regulatory interpretations, or evidence classifications. Formula or methodology changes require explicit diff notes and independent review.

### Security Worker

Acts independently from the implementer. It focuses on authentication, Membership/RBAC, tenant isolation, object authorization, cross-institution access, profile ownership, secret handling, migrations, and production-boundary violations.

The security worker may add tests and propose fixes on its own branch but cannot approve its own remediation.

### QA Worker

Reproduces acceptance criteria from a clean worktree and runs the narrow test suite first, then repository-level checks appropriate to the change. It records the exact failing/passing commands and does not substitute mocked success for a failing integration.

### Review Worker

Receives the final diff and evidence after implementation and QA. It checks scope drift, architectural consistency, test adequacy, migration safety, security implications, terminology, and rollback readiness. It is read/review oriented and must not be the author of the implementation it approves.

## Branch and PR Lifecycle

For a founder request named `canonical-import-validation`, the expected lifecycle is:

```text
main
  |
  `-- hermes/canonical-import-validation
       |-- implementation commits
       |-- tests
       |-- security/QA findings
       `-- pull request -> main
```

Parallel delegated workers may use `hermes-subagent/<id>` worktrees. Their commits are reviewed by the Engineering Lead and integrated into the parent Hermes branch. The parent branch is the branch exposed in the final PR.

Every PR created by Hermes must include:

- objective and scope;
- files/domains changed;
- tests run with results;
- migrations, if any;
- security/tenant-isolation implications;
- known limitations;
- rollback procedure;
- evidence that no production action was taken;
- founder review items.

## Authentication Strategy

Hermes GitHub credentials must be separate from the founder's general-purpose credentials.

Preferred phase-1 option: a fine-grained GitHub token or dedicated GitHub App credential restricted to `griswoldwonders/relay-rider-beta-001` with only the repository permissions needed to read code, create/update branches, push contents, and create/update pull requests. Do not grant repository administration, organization administration, secrets management, Actions administration, or deployment administration.

The credential must live outside the repository, such as `~/.hermes/.env` or the host's secret manager. It must never be copied through `.worktreeinclude`.

If the GitHub MCP server is used, expose only the GitHub operations required for repository reading, branch/contents changes, commits, pull requests, and status inspection. Do not expose administration or secret-management tools.

## Phone / Remote Console Boundary

The Galaxy S9+ may act as a messaging or browser console, but it is not the trusted execution host and should not store the GitHub write credential. Hermes should run on a maintained Linux development host or isolated development environment. The phone sends founder instructions and receives approval/status messages.

## Verification Gate

A Hermes-created PR is `READY FOR FOUNDER REVIEW` only when all applicable checks are complete. For ordinary full-stack changes the minimum evidence is:

```text
Frontend typecheck       PASS
Frontend tests           PASS
Frontend security check  PASS
Frontend production build PASS
Django system check      PASS
Django migration drift   PASS
Django tests             PASS
PostgreSQL integration   PASS when DB/domain behavior changed
Security review          PASS or findings documented
QA acceptance            PASS
Independent review       PASS or findings documented
```

A failing required check makes the status `BLOCKED`, not partially operational.

## Audit Record

Each autonomous task should leave an auditable record containing:

- request/task ID or short slug;
- parent branch;
- worker branches;
- base SHA;
- final SHA(s);
- commands/tests executed;
- blocked operations;
- review findings;
- pull request URL/number;
- founder approval state.

Do not log token values, database passwords, session cookies, or raw secrets.

## Phase 1 Definition of Done

The foundation is complete when a controlled test request can demonstrate the following end to end:

1. Hermes starts from current remote `main` in an isolated worktree.
2. Hermes creates a non-`main` branch automatically.
3. Hermes changes a harmless repository file.
4. Hermes runs an appropriate test/check.
5. Hermes commits the change.
6. Hermes pushes the feature branch without prompting for ordinary branch work.
7. Hermes creates a PR targeting `main`.
8. A second worker independently reviews the diff.
9. The policy hook blocks an attempted push to `main`.
10. The policy hook blocks a force push and a production deployment command.
11. No production deployment occurs.
12. The founder retains the final merge decision.

The acceptance test must use a harmless documentation-only change first. Only after this proof passes should Hermes be allowed to perform unattended branch modifications to application code.
