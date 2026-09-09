# Canonical Evidence Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-side, tenant-safe, idempotent projection from canonical Django commuter records into the existing Supabase evidence tables, then restrict the AQMD browser path so Relay Rider-originated evidence is not independently authored there.

**Architecture:** Django `relay_app` remains the system of record. A dedicated binding model maps canonical integer institution/site/cohort identities to legacy public UUID identities. A projection service validates evidence readiness, pseudonymizes participant identity, and performs parameterized PostgreSQL upserts into `public.evidence_commute_observations` while preserving provenance and refusing locked targets. AQMD direct writes remain available only for external institutional evidence imports.

**Tech Stack:** Django 5, Django REST Framework, PostgreSQL 17, psycopg, Supabase/PostgREST public evidence schema, TypeScript/Vite/Vitest for AQMD client.

**Spec:** `docs/superpowers/specs/2026-09-09-canonical-evidence-projection-design.md`

## Global Constraints

- `relay_app.*` is canonical for Relay Rider application records.
- `public.evidence_*` is a downstream analytical/compliance projection.
- Do not change Rule 2202 formulas.
- Do not fabricate observation dates or distances.
- Do not expose precise home locations or raw external participant IDs in the evidence participant key.
- Do not apply production DDL from this feature branch.
- All evidence writes must be parameterized and tenant-checked.
- Existing prototype/import behavior must remain backward compatible when new optional fields are absent.

---

### Task 1: Add evidence-ready canonical fields and identity binding

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/migrations/0008_evidence_projection_contract.py`
- Test: `backend/relay/test_evidence_projection.py`

**Interfaces:**
- Produces: `CommuterRecord.observation_date`, `CommuterRecord.one_way_miles`, `EvidenceProjectionBinding`.

- [ ] **Step 1: Write failing model tests**

Add tests that create a same-tenant binding and reject cross-tenant Site/Cohort combinations during `full_clean()`. Add a test that persists `observation_date` and `one_way_miles` without changing existing required fields.

- [ ] **Step 2: Run tests and verify RED**

Run: `python manage.py test relay.test_evidence_projection.EvidenceProjectionModelTests -v 2`
Expected: FAIL because `EvidenceProjectionBinding`, `observation_date`, and `one_way_miles` do not exist.

- [ ] **Step 3: Implement minimal model and migration**

Add nullable evidence-ready fields and the binding model. `EvidenceProjectionBinding.clean()` must require Site and Cohort to belong to the binding Institution and require Cohort to belong to the binding Site.

- [ ] **Step 4: Run tests and verify GREEN**

Run the same test target; expect PASS.

### Task 2: Add pure normalization and privacy contract

**Files:**
- Create: `backend/relay/services/evidence_projection.py`
- Test: `backend/relay/test_evidence_projection.py`

**Interfaces:**
- Produces: `ProjectionIssue`, `ProjectionResult`, `normalize_record_for_evidence(record, participant_key_secret)`.

- [ ] **Step 1: Write failing normalization tests**

Cover: deterministic HMAC participant key; no raw external ID in participant key; drive-alone mapping; carpool occupancy; EV/hybrid/ICE mapping; parking difficulty mapping; generalized origin zone retention; missing observation date; missing motor-vehicle distance; unsupported mode.

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because the service module/functions do not exist.

- [ ] **Step 3: Implement the pure normalization layer**

Use HMAC-SHA256 with `institution_id:external_id`; normalize into the public evidence vocabulary; return structured blocking issues rather than inventing values.

- [ ] **Step 4: Run tests and verify GREEN**

Expected: PASS.

### Task 3: Add PostgreSQL projector with provenance and idempotency

**Files:**
- Modify: `backend/relay/services/evidence_projection.py`
- Test: `backend/relay/test_evidence_projection.py`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `project_commute_import_to_evidence(commute_import, actor=None, baseline_id=None, observation_period_id=None, participant_key_secret=None)`.

- [ ] **Step 1: Write failing PostgreSQL integration tests**

In the PostgreSQL-only test class, create isolated public evidence fixture tables matching the required columns. Verify insert, re-run update/no duplicate, provenance keys, locked-baseline refusal, and no write for cross-tenant/missing binding.

- [ ] **Step 2: Run PostgreSQL integration job and verify RED**

Expected: FAIL because the projector does not exist.

- [ ] **Step 3: Implement projector**

Require PostgreSQL, resolve one active binding, validate optional baseline/period UUIDs belong to the same mapped organization/site and are unlocked, then insert or update by `original_payload->>'relay_projection_key'`. Never update locked evidence. Create an audit event summarizing counts and issues.

- [ ] **Step 4: Run full backend suites**

Run: `python manage.py test -v 2` on SQLite plus the existing PostgreSQL integration job. Expect all tests green.

### Task 4: Extend canonical CSV import with optional evidence fields

**Files:**
- Modify: `backend/relay/services/commute_schema.py`
- Modify: `backend/relay/services/ingestion.py` if needed by the schema adapter
- Test: `backend/relay/test_evidence_projection.py`
- Test: `backend/relay/test_vertical_slice.py`

**Interfaces:**
- Consumes: optional CSV columns `observation_date`, `one_way_miles`.
- Produces: populated nullable canonical fields when supplied.

- [ ] **Step 1: Write failing CSV tests**

Verify valid ISO date and non-negative decimal distance persist. Verify missing optional columns preserve existing imports. Verify invalid date/negative distance become validation errors and are not silently coerced into compliance-ready values.

- [ ] **Step 2: Verify RED**

Expected: FAIL because import schema does not map the new fields.

- [ ] **Step 3: Implement minimal schema changes**

Make both columns optional and preserve backward compatibility.

- [ ] **Step 4: Verify GREEN and existing vertical-slice regression tests**

Expected: all prior vertical-slice tests remain green.

### Task 5: Add synthetic end-to-end proof command

**Files:**
- Create: `backend/relay/management/commands/project_fictional_evidence.py`
- Test: `backend/relay/test_evidence_projection.py`
- Modify: `docs/INSTITUTIONAL_VERTICAL_SLICE.md`

**Interfaces:**
- Produces: a non-production command that imports a dated/distance-complete synthetic record set, projects evidence, prints inserted/updated/blocked counts, and does not claim certification.

- [ ] **Step 1: Write failing command test**

Verify output includes canonical import ID, projection counts, projector version, and `calculation_output_only_not_certification`/research-beta guardrail language.

- [ ] **Step 2: Verify RED**

Expected: FAIL because command does not exist.

- [ ] **Step 3: Implement command and documentation**

Require explicit UUID binding arguments or pre-existing binding. Do not create production/public organization identities implicitly.

- [ ] **Step 4: Verify GREEN**

Expected: command test and backend suite pass.

### Task 6: Restrict AQMD browser authoring to external evidence imports

**Files in `griswoldwonders/aqmd-module-tool`:**
- Modify: `src/evidenceApi.ts`
- Modify: `src/PccEvidenceWorkbench.tsx`
- Create or modify: relevant Vitest test file for evidence API behavior
- Add: `docs/RELAY_RIDER_EVIDENCE_BOUNDARY.md`

**Interfaces:**
- Rename browser write API to `insertExternalCommuteObservations`.
- External imports attach provenance marker `original_payload.source_system = 'external_institutional_import'` if not already present.
- Browser code must reject a row whose provenance claims `source_system='relay_rider'`.

- [ ] **Step 1: Write failing client tests**

Verify external rows can be prepared for insert and Relay Rider-originated rows are rejected before network execution.

- [ ] **Step 2: Verify RED in AQMD CI**

Expected: FAIL until the boundary helper is implemented.

- [ ] **Step 3: Implement minimal AQMD boundary**

Rename the function and update the workbench call site. Add explicit documentation that Relay Rider-originated records are server-projected and browser-read-only.

- [ ] **Step 4: Run AQMD test/build suites**

Run: `npm test -- --run` and `npm run build`; expect both pass.

### Task 7: Pull-request verification and deployment gate

**Files:**
- Modify PR descriptions only; no production schema changes.

- [ ] **Step 1: Open draft PRs for both repos**

Document the identity mismatch discovered in live Supabase (`relay_app` exists but currently has no Django tables; public evidence identities are UUID-based).

- [ ] **Step 2: Wait for CI and inspect every failing job**

Do not merge with failing backend, PostgreSQL, frontend, security, or build jobs.

- [ ] **Step 3: Review diffs for scope and security**

Confirm no service-role secrets, database passwords, raw participant IDs, or production write workflows were added.

- [ ] **Step 4: Stop before production migration**

Production deployment remains a separate explicit approval: apply existing Django migrations to `relay_app`, configure synthetic identity bindings, then run the synthetic Pasadena proof before any real institutional data.
