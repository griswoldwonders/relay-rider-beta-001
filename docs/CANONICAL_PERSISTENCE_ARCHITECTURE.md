# Relay Rider Canonical Persistence Architecture

Status: development architecture decision for the research beta. This document does not assert production deployment or regulatory approval.

## Decision

For the current Relay Rider application, **Django ORM models are the canonical application-domain persistence layer** for institutional entities, imported commute evidence, normalized commuter records, analysis runs, Decision Cards, and exports.

PostgreSQL/Supabase remains an infrastructure and deterministic-calculation target, but Relay Rider will **not create a second parallel set of Institution / Program / Site / Cohort / Assessment domain tables in Supabase migrations** while the existing remote/local Supabase migration-history discrepancy is unresolved.

The existing Rule 2202 SQL functions in `supabase/migrations/202609020001_rule2202_calculation_functions.sql` are reused through an adapter boundary. Database execution fails closed unless the deployment has been explicitly reconciled and marked verified. A development-only reference simulation exists so the complete research-beta data flow can be tested without representing the SQL migration as deployed.

## Canonical flow

```text
Institution
  -> Program
  -> Site
  -> Cohort
  -> authenticated Membership
  -> DataSource
  -> ImportBatch
  -> SourceRecord + ValidationIssue
  -> CommuterRecord
  -> AnalysisRun
  -> CorridorScore
  -> Rule2202CalculationRun + Rule2202Result
  -> DecisionCard
  -> dashboard_output()
  -> ReportExport (JSON / CSV)
```

## Evidence separation

Every imported CSV creates an `ImportBatch` with a SHA-256 digest. Every original row is retained as a `SourceRecord.raw_payload`; validation errors are separate `ValidationIssue` rows. Valid rows create canonical `CommuterRecord` records linked one-to-one to their source row.

`AnalysisRun.input_snapshot` stores the import batch ID, its hash, and the canonical record IDs used in the run. The Rule 2202 run separately records its execution mode, calculation version, deployment-verification state, and input record IDs. A Decision Card points back to the AnalysisRun rather than copying untraceable metrics.

## Core Engine scoring

The first vertical slice uses an explicitly labeled **prototype corridor opportunity heuristic**, not a guaranteed match or regulatory metric:

- 50% corridor demand concentration
- 30% gasoline SOV share
- 20% EV/hybrid overlap signal

The score and component values are persisted in `CorridorScore.score_explanation`. This method is versioned as `core-v1-prototype` and is expected to change after methodology review.

## Rule 2202 boundary

Two execution modes exist:

1. `database_functions` — calls the existing PostgreSQL functions. This mode requires `RULE2202_DB_FUNCTIONS_VERIFIED=true` and PostgreSQL. It must remain disabled until Supabase migration history is reconciled and the Rule 2202 migration is applied and verified.
2. `reference_simulation` — development-only arithmetic sufficient to exercise the end-to-end architecture. Outputs are explicitly marked simulation and must not be described as deployed Rule 2202 functionality, regulatory certification, or compliance approval.

The current slice calculates employee count, weighted vehicle trips, and AVR. The other existing SQL functions (ERT, VTEC, off-peak AVR, reduced staffing, inter-pollutant credits, zone targets, survey validation) remain available for later assessment expansion after the persistence and migration boundaries are stable.

## Privacy boundary

The CSV schema accepts general origin/destination zones and does not require exact home addresses. Source records are retained for auditability, so real institutional deployments will require a documented retention/deletion policy and field-level minimization review before real commuter data is accepted.

## Demo command

After applying Django migrations in a development environment:

```bash
python manage.py demo_vertical_slice
```

This creates a fictional Pasadena institution, site and cohort, imports synthetic commute rows, runs the prototype Core Engine, runs Rule 2202 in reference-simulation mode, creates a draft Decision Card, and persists JSON/CSV exports.

To exercise verified PostgreSQL Rule 2202 mode later:

```bash
RULE2202_DB_FUNCTIONS_VERIFIED=true python manage.py demo_vertical_slice --verified-rule2202
```

Do not use that flag until the Supabase migration-history reconciliation has been completed and independently verified.

## Remaining architecture gates

- Reconstruct/reconcile missing Supabase migration history before any new remote DDL push.
- Harden tenant-consistency invariants at the database boundary; model `clean()` methods are not a substitute for database constraints.
- Resolve global platform-administrator representation separately from tenant membership.
- Add a real participant authentication/session lifecycle; current backend auth hardening is not a complete participant identity flow.
- Add occupancy to the canonical commute schema before treating carpool/vanpool Rule 2202 weights as authoritative.
- Extend Rule 2202 assessment inputs/results only after authoritative test fixtures are added.
- Add parking-pressure and charging-readiness evidence models/runs as separate, versioned analytical modules.
- Add before/after MeasurementPeriod objects so Decision Cards can connect to program outcomes.
- Expose the dashboard contract through an institution-scoped API only after the RBAC regression suite covers the new objects.
