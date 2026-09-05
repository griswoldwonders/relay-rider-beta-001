# Relay Rider Institutional Vertical Slice

## Canonical persistence decision

**Django ORM models are the canonical Relay Rider application domain and persistence contract.** PostgreSQL is the canonical deployment database. Supabase may host that PostgreSQL database, but it is not a second application-domain model.

For the linked Supabase project, the explicit schema boundary is:

```text
PostgreSQL
├── relay_app   Django-owned canonical application tables
└── public      legacy Supabase/PostgREST objects + deterministic Rule 2202 functions
```

Legacy Supabase domain tables in `public` are frozen for this vertical slice and require a separate reviewed consolidation/decommission decision. New Django domain models are not recreated as Supabase application tables.

The local-only `202607270001_security_foundation.sql` blueprint was never part of the authoritative remote migration history. It has been moved to `supabase/archive/` rather than left in the active migration path.

## Django migration sequence

The release-candidate graph is linear and preserves the already-merged Green Wallet work:

```text
0001_initial
→ 0002_green_wallet_redemption
→ 0003_institution_charginghub_institution_and_more
→ 0004_green_wallet_contract
→ 0005_green_wallet_ledger_and_policy
→ 0006_institutional_vertical_slice
```

`0006_institutional_vertical_slice` depends on `0005_green_wallet_ledger_and_policy`. CI must prove forward application through `0006`, rollback from `0006` to `0005`, reapplication of `0006`, and no missing migrations before promotion.

## Vertical-slice data flow

```text
Authenticated Django user
  -> Membership
  -> Institution
  -> Site
  -> Cohort
  -> DataSource (provenance)
  -> CommuteImport (SHA-256 + validation summary)
  -> CommuterRecord[] (canonical normalized rows + source payload)
  -> EngineScore[] (versioned, explainable intervention-opportunity signal)
  -> Rule2202CalculationRun
       -> PostgreSQL vehicle_trip_weight(...)
       -> PostgreSQL calculate_avr(...)
  -> DecisionCard (evidence + provenance + guardrails)
  -> Institution dashboard JSON
  -> Tenant-scoped commuter-record CSV export
  -> AssessmentAuditEvent[]
```

## Rule 2202 calculation layer

Django does not reimplement the current Rule 2202 formulas. It calls the PostgreSQL functions deployed by:

```text
supabase/migrations/20260902053135_rule2202_calculation_functions.sql
```

The linked Supabase project has those deterministic functions deployed and queried successfully for expected values. A second migration:

```text
20260902053627_harden_rule2202_function_access.sql
```

fixes the function search paths and removes direct `public`, `anon`, and `authenticated` execution. These calculation outputs support an institutional TDM assessment workflow; they are not regulatory certification or compliance approval.

On non-PostgreSQL development databases the run remains blocked instead of substituting a second formula implementation.

## Canonical PostgreSQL schema

The linked Supabase project contains a dedicated `relay_app` schema created by:

```text
20260902053756_create_relay_app_schema.sql
```

Public API roles do not receive access to that schema. `backend/config/settings.py` supports:

```text
DATABASE_URL=postgresql://...
DJANGO_DB_SCHEMA=relay_app
```

The Django connection search path becomes `relay_app,public`: Django-owned tables are isolated in `relay_app`, while server-side code can still invoke the Rule 2202 calculation functions in `public`.

## Fictional institution fixture

`backend/relay/fixtures/fictional_pasadena_commute.csv` contains synthetic data only. The management command:

```bash
cd backend
python manage.py run_fictional_vertical_slice
```

creates/reuses:

- `Fictional Pasadena Mobility Demo`
- `Pasadena Campus Demo`
- `Fall Demo Cohort`
- an `institution_admin` membership
- a synthetic DataSource

It imports, validates, scores, runs the Rule 2202 calculation when PostgreSQL functions are available, and creates a Decision Card.

## PostgreSQL integration proof

GitHub CI provisions PostgreSQL 17 and performs the backend-first architecture path:

1. creates `relay_app`;
2. applies Django migrations to that schema;
3. installs/verifies the canonical Rule 2202 SQL functions;
4. runs the fictional institutional vertical slice;
5. asserts `Rule 2202 status=completed`;
6. verifies `relay_app.relay_institution` exists;
7. verifies `public.relay_institution` does not exist.

This demonstrates the Django/PostgreSQL pipeline without introducing another application-domain schema into `public`.

## Canonical CSV fields in this slice

Required:

- `external_id`
- `origin_zone`
- `destination_zone`
- `commute_days` (pipe-separated)
- `arrival_window`
- `departure_window`
- `current_mode`
- `consent_confirmed`

Optional/normalized:

- `schedule_flex_minutes`
- `occupants`
- `vehicle_fuel_type`
- `parking_difficulty`
- `ev_interest`
- `access_point_willing`

Invalid rows are retained with validation errors and source row numbers so data-quality failures remain auditable.

## Core Engine score

`institutional-opportunity-v1` is a deliberately narrow **institutional intervention-opportunity signal**, not a commuter match guarantee, regulatory score, safety score, or route activation decision. It exposes factors for drive-alone status, gasoline/ICE status, reported parking difficulty, Access Point willingness, and schedule flexibility.

## Institutional output endpoints

Authenticated institution members can read:

- `GET /api/institutions/<institution_id>/dashboard/`
- `GET /api/institutions/<institution_id>/commuter-records.csv`

Both endpoints enforce same-institution membership; `platform_admin` retains the existing cross-tenant bypass.

## Supabase migration-history reconciliation

The linked production database had historical migration versions that were absent from the repository. The production `supabase_migrations.schema_migrations` registry was treated as authoritative. The active local migration directory now has a matching version/name entry for the historical remote versions and the new Rule 2202/schema migrations.

Important limitation: most of the older recovered versions are explicit **history anchors**, not full replayable SQL bodies. Their exact authoritative statements remain stored in the linked project's migration registry. Version tracking is reconciled; full historical source reconstruction is a separate provenance/reproducibility task.

## Production connection status

The linked Supabase project currently has:

- Rule 2202 calculation functions deployed and verified;
- Rule 2202 function-access hardening applied;
- the dedicated `relay_app` schema created and isolated from public API roles.

The live `relay_app` schema does **not yet contain Django application tables**. Applying the Django migrations there requires a production PostgreSQL `DATABASE_URL` to be injected through a secure backend secret channel. This repository must not contain or log that credential.

## Remaining gates before Operational Research Beta v1

1. Fresh CI on the current-main-synced institutional branch: frontend, Django, migration, PostgreSQL, Rule 2202, RBAC, cross-tenant, dependency, and CodeQL checks.
2. Merge the institutional slice only if those checks are green.
3. Pin the resulting main SHA as the Operational Research Beta v1 release candidate.
4. Re-run the synthetic Pasadena institutional proof from Institution through Decision Card and dashboard/export.
5. Execute a two-authenticated-user participant/admin acceptance run. Tenant isolation alone is not sufficient evidence of participant identity ownership.
6. Keep Charging Intelligence, OCPI, payment/settlement, routing expansion, and unrelated feature work outside this release gate.
