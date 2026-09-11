# Local-only release preflight

Run this from a non-`main` Relay Rider development worktree after installing locked frontend dependencies:

```bash
npm ci
python scripts/release_preflight.py
```

The preflight stops before application tooling if any safety prerequisite fails. It verifies:

- the checked-out branch is not `main`;
- tracked files do not match the repository's configured credential-pattern scan;
- the installed Relay Rider Hermes policy hook is healthy and the specific registration is fail-closed;
- the Django migration graph is internally consistent using `MigrationLoader(None)` with `DATABASE_URL` cleared before settings load;
- frontend type checking, tests, and the production build succeed.

It intentionally does not deploy, push, read credentials, connect to a production database, apply migrations, or execute a database write. It is a local readiness check, not a production-release authorization or sandbox for project build tooling.
