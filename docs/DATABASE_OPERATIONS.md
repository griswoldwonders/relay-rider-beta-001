# Django database operations

Relay Rider uses SQLite only for local disposable development. Staging and production should use a managed PostgreSQL instance with automated backups, restricted credentials, TLS, and a tested restore procedure.

## Required production environment

The Django settings read a PostgreSQL connection string from `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/relay_rider
DATABASE_SSL_REQUIRE=true
DATABASE_CONN_MAX_AGE=60
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=replace-with-a-secret-manager-value
DJANGO_ALLOWED_HOSTS=api.example.org
CORS_ALLOWED_ORIGINS=https://app.example.org
CSRF_TRUSTED_ORIGINS=https://app.example.org
```

The application also supports component variables for hosts that do not provide a connection URL:

```bash
POSTGRES_DB=relay_rider
POSTGRES_USER=relay_rider_app
POSTGRES_PASSWORD=replace-with-a-secret-manager-value
POSTGRES_HOST=postgres.example.org
POSTGRES_PORT=5432
```

Use a database user dedicated to the application. Keep owner, migration, and administrative roles separate where the hosting provider permits it. Never commit these values or expose them through `VITE_*` variables.

## Initial managed database setup

Create a PostgreSQL 16 or newer database in the selected managed provider, enable automated backups and point-in-time recovery where available, and restrict inbound access to the API service. Record the database endpoint, database name, application username, and TLS requirements in the hosting secret manager. Configure a separate read-only support role for diagnostics and do not use the provider master account in Django.

Deploy the API with the environment above and run:

```bash
python manage.py showmigrations
python manage.py migrate --noinput
python manage.py check --deploy
python manage.py makemigrations --check --dry-run
```

The repository’s migration history currently includes the initial Relay schema and the Green Wallet redemption migration. No new schema migration is required for the environment switch itself; the existing migrations are applied to the new PostgreSQL database.

## CI database

The GitHub Actions backend job starts a disposable PostgreSQL 16 service container and runs migrations, Django checks, the API test suite, and migration-drift validation against it. This catches PostgreSQL-specific SQL and type issues before a release. The CI database is destroyed after the job and contains no production data.

## Safe migration release pattern

Use expand-and-contract changes. First add new nullable or additive columns and deploy code that can operate with both old and new schema states. Backfill in a controlled job, verify counts and constraints, then deploy code that requires the new representation. Remove obsolete columns only in a later release after rollback of the application is no longer expected to need them.

Run migrations as a release step before routing traffic to code that requires them. For destructive or long-running changes, test against a recent staging backup, measure lock duration, and schedule the production operation during a controlled maintenance window.

## Backup and restore requirements

At minimum, retain automated daily backups and verify that backups are encrypted and access-controlled. Before pilot launch, perform a restore drill into an isolated database and record the achieved recovery point objective and recovery time objective. After restore, run `python manage.py check`, the API test suite, row-count reconciliation for profiles and redemption requests, and health/readiness probes.

Do not treat Airtable as a database backup. PostgreSQL is authoritative; Airtable is an operational mirror and must be reconciled after a restore using the bulk-sync and reconciliation procedures.

## Health probes

The API exposes:

| Endpoint | Purpose | Expected response |
|---|---|---|
| `/healthz/` | Process liveness; does not require the database | HTTP 200 with `{"status":"ok"}` |
| `/readyz/` | Database readiness | HTTP 200 with `{"status":"ready"}` or HTTP 503 with `{"status":"not_ready"}` |

Use these endpoints from the hosting provider’s health checks and deployment smoke tests. Do not include connection strings or exception details in responses.

## Operational commands

```bash
# Inspect migration state
python manage.py showmigrations

# Apply migrations
python manage.py migrate --noinput

# Refuse deployment if model changes lack migrations
python manage.py makemigrations --check --dry-run

# Run API tests
python manage.py test relay

# Check production configuration
python manage.py check --deploy

# Verify probes
curl -fsS https://api.example.org/healthz/
curl -fsS https://api.example.org/readyz/
```
