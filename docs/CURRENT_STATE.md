# Relay Rider Current State

## Operational institutional workflow

The current development target is one production-shaped synthetic institutional workflow, not feature completeness.

### Canonical persistence

Django/Postgres is the canonical application persistence owner for the institutional workflow. Existing Django `Institution` and `Membership` tenancy/RBAC models are reused. Site, Cohort, import/provenance, canonical commuter, analysis-run, Decision Card, and report entities will be added to the Django domain rather than duplicated in Supabase.

### Supabase and Rule 2202

The Supabase migration track is gated because the intended remote project has applied migration history that is not fully represented in the current local checkout. New Supabase schema changes are frozen for this workflow until that discrepancy is reconciled and independently verified.

Rule 2202 calculation SQL exists in the repository, but it must not be described as deployed. Application readiness is explicit:

- `unverified` — default; migration history is not reconciled and Rule 2202 execution is blocked.
- `verified` — authoritative migration history has been reconciled and independently checked; execution may be enabled.
- `disabled` — Rule 2202 execution is intentionally disabled.

This branch does not repair or mutate remote migration history.

### Product boundary

This workflow is limited to institutional TDM assessment using synthetic data: CSV intake, validation/provenance, canonical commuter records, deterministic Core Relay Rider analysis, optional gated Rule 2202 calculations, evidence-linked Decision Cards, and report export.

It does not activate live rides, dispatch, payments, incentives, messaging, regulatory submissions, or production participant-data mutations.
