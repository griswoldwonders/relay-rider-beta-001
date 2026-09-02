# Relay Rider Architecture Decisions

## ADR-001: Canonical persistence for the operational institutional workflow

**Status:** Accepted for `feat/operational-institutional-workflow`

**Decision:** Django/Postgres is the canonical application persistence layer for the production-shaped institutional workflow: Institution → Site → Cohort → commuter import/provenance → canonical commuter records → Core Relay Rider analysis → optional Rule 2202 calculation run → Decision Card → report artifact.

The existing `supabase/migrations` directory is not a second application-domain authority for this workflow. This slice must not create duplicate Institution, Site, Cohort, import, canonical commuter, analysis, Decision Card, or report tables in Supabase.

**Rule 2202 migration gate:** Supabase-backed Rule 2202 execution is unavailable unless the environment explicitly reports readiness state `verified`. The default state is `unverified`. `disabled` means the operator intentionally disabled Rule 2202 execution. Only `verified` permits execution.

**Known blocker:** the intended Supabase project's remote migration history contains applied migrations that are absent from the current local checkout. Until that history is authoritatively reconciled and independently verified, new Supabase DDL is frozen for this slice and Relay Rider must not claim Rule 2202 is deployed.

**Non-action:** this implementation does not repair, rewrite, mark, push, or otherwise mutate Supabase migration history or production data.

**Rationale:** one canonical persistence owner prevents dual-authority drift while allowing the ordinary institutional TDM assessment workflow to become operational independently of the unresolved Rule 2202 migration track.
