# Supabase migration history and canonical persistence boundary

## Canonical persistence decision

Relay Rider application/domain persistence is owned by the Django ORM. The canonical production database is PostgreSQL. In the linked Supabase project, Django-owned tables are intended to live in the dedicated `relay_app` schema; legacy Supabase/PostgREST domain tables remain in `public` until a separate, reviewed decommission/reconciliation change.

Rule 2202 deterministic calculation primitives remain PostgreSQL functions in `public` and are called by the Django service adapter. The Rule 2202 functions are calculation utilities only; they do not constitute regulatory certification or approval.

## Migration discrepancy reconciliation

The linked Supabase project contained historical migrations from `20260721050647` through `20260820030336` that were absent from the repository checkout. The production `supabase_migrations.schema_migrations` registry was treated as the authoritative version/name inventory.

The active local `supabase/migrations` directory now contains a matching version/name entry for every historical remote migration. `20260721050647_relay_rider_core_schema.sql` was recovered with its SQL body from the remote registry. The remaining pre-existing historical versions are currently represented by explicit recovery anchors whose authoritative SQL bodies remain preserved in `supabase_migrations.schema_migrations` on the linked project.

These anchors reconcile migration *version tracking* and prevent the missing remote versions from being mistaken for unapplied local migrations. They are **not** a complete replayable reconstruction of the historical Supabase schema. Do not use the anchor files as a fresh-project rebuild source. Full exact-body archival remains a provenance/reproducibility follow-up.

The local-only `202607270001_security_foundation.sql` never existed in the authoritative remote migration history and conflicted with the newer canonical persistence direction. It has been moved to `supabase/archive/` rather than left in the active migration path.

## Newly applied migrations

The following migrations were applied and then recorded locally with the exact remote versions assigned by Supabase:

- `20260902053135_rule2202_calculation_functions.sql` — deterministic Rule 2202 calculation primitives.
- `20260902053627_harden_rule2202_function_access.sql` — fixed function search paths and removed public/anon/authenticated execution; retained server-side access.
- `20260902053756_create_relay_app_schema.sql` — creates the dedicated canonical Django application schema and removes public API-role access to it.

## Verification performed

The linked Supabase project successfully returned expected deterministic results after deployment, including:

- `calculate_avr(100, 80) = 1.25`
- `vehicle_trip_weight('drive_alone', NULL) = 1`
- `vehicle_trip_weight('carpool', 2) = 0.500000`
- `calculate_ert(10, 2.5, 3) = 22.00`
- `get_avr_zone_target(1) = 1.75`
- a 60% response-rate survey inside the allowed date window validates successfully.

A post-change Supabase security advisor run no longer reports mutable-search-path warnings for the Rule 2202 functions. Other pre-existing advisor findings remain and are outside this migration reconciliation change.

## Django connection contract

`backend/config/settings.py` now accepts a PostgreSQL `DATABASE_URL`. Production should also set:

```text
DJANGO_DB_SCHEMA=relay_app
```

This places Django-owned tables in `relay_app` while keeping the Rule 2202 function schema (`public`) on the connection search path.

Do not commit a Supabase database password or a full production `DATABASE_URL` to Git. The repository does not currently contain a secure deployment-secret channel for the database credential.

## End-to-end proof

CI runs the institutional vertical slice against PostgreSQL 17 using the same Django migrations, the `relay_app` schema boundary, and the canonical Rule 2202 SQL functions. The CI proof asserts that Rule 2202 completes and that Django tables are created in `relay_app`, not duplicated in `public`.

The linked production Supabase project currently has the `relay_app` schema and verified Rule 2202 functions, but Django application tables have **not** been migrated into that production schema from this chat because doing so requires a securely injected production database credential. No database password is placed in source code, Git history, CI logs, or chat output to bypass that control.
