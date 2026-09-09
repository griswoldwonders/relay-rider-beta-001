# Canonical Evidence Projection Design

## Status

Approved implementation direction from the Relay Rider Supabase integration review on 2026-09-09.

## Problem

Relay Rider currently has two persistence domains in the same Supabase PostgreSQL project:

- Django owns the canonical application domain and is configured for the `relay_app` schema.
- The AQMD/evidence workbench uses the legacy `public.evidence_*` and `public.rule2202_*` analytical/compliance domain through Supabase REST.

The live Supabase project contains the `relay_app` schema but, as of the design review, no Django tables have been deployed into it. The public evidence tables use UUID organization/site/cohort identifiers while Django models use integer primary keys. Therefore a direct implicit sync would be unsafe and would create ambiguous identity semantics.

## Goal

Create a controlled, server-side, idempotent projection from canonical Django commuter records into the existing evidence layer without making the AQMD browser client a second source of truth for Relay Rider-originated commuter data.

## Non-goals

- Do not merge the two repos.
- Do not make AQMD the canonical commuter database.
- Do not change Rule 2202 formulas.
- Do not certify or imply regulatory approval of calculations.
- Do not apply production DDL from this feature branch.
- Do not fabricate observation dates or commute distances that are absent from canonical records.
- Do not expose precise home locations.

## Architecture

Canonical flow:

`Relay Rider client -> Django API/domain -> relay_app.* -> Evidence projection service -> public.evidence_commute_observations -> AQMD workbench`

`relay_app.*` remains authoritative for Relay Rider application records. `public.evidence_*` remains a governed analytical/compliance projection. The AQMD browser may continue to import external employer CSV evidence, but Relay Rider-originated evidence must be written by the server-side projector.

## Identity bridge

Because the existing public evidence domain uses UUID foreign keys and Django uses integer primary keys, the canonical app stores an explicit `EvidenceProjectionBinding` rather than guessing or matching entities by name.

A binding contains:

- canonical `Institution`
- canonical `Site`
- optional canonical `Cohort`
- `organization_uuid` for `public.organizations`
- `site_uuid` for `public.organization_sites`
- optional `cohort_uuid` for `public.cohorts`
- optional `source_uuid` for `public.data_sources`
- active flag

The service must reject a binding whose canonical Site/Cohort does not belong to the same Institution.

## Canonical evidence-ready fields

`CommuterRecord` gains optional fields required to make a record compliance-evidence-ready without fabricating values:

- `observation_date` (nullable date)
- `one_way_miles` (nullable decimal)

Existing prototype/import records remain valid with these fields absent. The evidence projector requires `observation_date`; motor-vehicle commute modes additionally require `one_way_miles`.

## Projection contract

The service `project_commute_import_to_evidence(...)`:

1. Requires PostgreSQL.
2. Requires an active, tenant-consistent `EvidenceProjectionBinding`.
3. Considers only canonical records with `validation_status='valid'`.
4. Validates evidence readiness without mutating the source record.
5. Normalizes supported commute modes, EV/hybrid status, parking difficulty, and reported-to-site/remote status.
6. Generates a stable pseudonymous `participant_key` using HMAC-SHA256 over canonical institution ID and record external ID. The HMAC secret comes from `RELAY_EVIDENCE_PARTICIPANT_KEY_SECRET`; there is no production fallback.
7. Writes via parameterized server-side SQL to `public.evidence_commute_observations`.
8. Stores explicit provenance in `original_payload`, including canonical import ID, canonical record ID, source file SHA-256, source row, source provenance label, projector version, and canonical record `updated_at`.
9. Is idempotent. A Relay Rider projection key is derived from canonical record ID plus projector version and is stored in `original_payload->>'relay_projection_key'`; re-running the projection updates the existing unlocked projection rather than inserting a duplicate.
10. Never overwrites a projection attached to a locked evidence baseline or observation period. A locked target causes the record to be rejected and audited.
11. Creates `AssessmentAuditEvent` entries for completed, skipped, blocked, or failed projection activity.

## Evidence validation

Projection is blocked per record when:

- `observation_date` is absent;
- motor-vehicle modes lack `one_way_miles`;
- carpool/vanpool occupancy is invalid;
- mode is unsupported for the evidence vocabulary;
- the identity binding is absent or inconsistent;
- the target evidence period/baseline is locked.

The service returns a structured result with inserted, updated, skipped, and blocked counts plus per-record issues. It does not silently drop invalid records.

## Privacy

The evidence layer receives generalized `origin_zone`, not a precise address. The participant identifier is pseudonymous and must not reuse a raw email, username, or source external ID. `original_payload` stores only the minimum provenance needed to reproduce the projection; it must not copy the full source payload by default.

## AQMD browser boundary

The AQMD module keeps direct Supabase writes only for explicitly external institutional evidence imports. Relay Rider-originated evidence is read-only from the browser perspective and must come through the server-side projection path.

## Security

- No service-role or database password is embedded in browser code.
- The projector runs with the Django server database connection.
- SQL is parameterized.
- Cross-tenant bindings are rejected before any evidence write.
- The AQMD browser retains authenticated RLS/RPC access only to its governed public evidence/compliance domain.
- `relay_app` is not exposed as a browser-write surface.

## Deployment sequence

1. Merge and pass CI on the feature branch.
2. Verify the protected production database secret points at the intended Supabase project.
3. Apply existing Django migrations so `relay_app` is actually populated.
4. Apply this feature's Django migration.
5. Configure canonical-to-public UUID bindings for a fictional/synthetic institution first.
6. Run a synthetic Pasadena end-to-end acceptance test.
7. Only after evidence traceability and tenant isolation pass should real institutional data be projected.

Production migration and synthetic writes require an explicit production-deploy approval separate from this implementation branch.
