# Relay Rider Operational Institutional Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one production-shaped synthetic institutional workflow in which an authenticated institutional administrator imports a commuter CSV and receives a reproducible, evidence-linked Decision Card and report without developer intervention.

**Architecture:** Django/Postgres owns canonical application persistence for Institution → Site → Cohort → import/provenance → canonical commuter records → Core Relay Rider analysis → Decision Card → report. Supabase remains isolated behind a Rule 2202 readiness adapter until migration history is reconciled; no duplicate institutional domain model is created there.

**Tech Stack:** Django, Django REST Framework, PostgreSQL-compatible Django models, Python standard-library CSV/hash/json utilities, existing React 19 + TypeScript frontend, Vitest, Django test framework.

**Spec:** `docs/superpowers/specs/2026-09-01-operational-institutional-workflow-design.md`

## Global Constraints

- Development branch only: `feat/operational-institutional-workflow`.
- Do not mutate production participant data or production Supabase schema/history.
- Do not create duplicate Institution/Site/Cohort/import/analysis domain tables in Supabase.
- Do not claim Rule 2202 is deployed while migration state is unverified.
- No live rides, dispatch, payments, incentives, messaging, regulatory submissions, or transportation activation.
- Use approximate origin/destination zones; precise residential addresses are not required by this workflow.
- Every important metric must retain evidence class, source/provenance, method/version, privacy treatment, caveat, and partner-facing wording.
- All new tenant-scoped records must have non-null institutional ownership and cross-tenant tests.
- TDD is required for each implementation task.

---

## Planned File Structure

### Backend domain and services
- `backend/relay/models.py` — add Site, Cohort, ImportBatch, ImportRow, CanonicalCommuterRecord, AnalysisRun, AnalysisMetric, Rule2202Run, DecisionCard, ReportArtifact.
- `backend/relay/migrations/0003_operational_institutional_workflow.py` — additive Django migration for the new canonical workflow models.
- `backend/relay/import_schema.py` — CSV schema version and deterministic field normalization/validation definitions.
- `backend/relay/import_service.py` — streaming CSV ingestion, SHA-256 digest, row validation, provenance creation, canonicalization.
- `backend/relay/analysis_engine.py` — pure deterministic Core Relay Rider analysis functions and fingerprinting.
- `backend/relay/rule2202_adapter.py` — readiness-state abstraction and guarded Rule 2202 invocation boundary; no migration repair.
- `backend/relay/decision_cards.py` — deterministic Decision Card construction from persisted analysis metrics.
- `backend/relay/reporting.py` — deterministic report manifest/JSON export and artifact hashing.
- `backend/relay/serializers.py` — serializers for hierarchy, import, runs, Decision Cards, exports.
- `backend/relay/views.py` — tenant-scoped API endpoints/actions for operational workflow.
- `backend/relay/permissions.py` — reusable institution-admin permission helpers for new workflow endpoints.
- `backend/relay/urls.py` or existing API router location — register endpoints if routing is not already centralized in `backend/config/urls.py`.

### Backend tests
- Split new tests into focused modules under `backend/relay/tests/` if conversion from the current monolithic `backend/relay/tests.py` is safe; otherwise append focused `TestCase` classes to `tests.py` without unrelated refactoring.
- `backend/relay/tests/test_operational_models.py`
- `backend/relay/tests/test_import_service.py`
- `backend/relay/tests/test_analysis_engine.py`
- `backend/relay/tests/test_rule2202_adapter.py`
- `backend/relay/tests/test_decision_cards.py`
- `backend/relay/tests/test_reporting.py`
- `backend/relay/tests/test_operational_api.py`

### Frontend
- `src/lib/institutionalApi.ts` — typed API client for hierarchy, import, runs, Decision Card, export.
- `src/screens/InstitutionalAssessmentScreen.tsx` — minimum admin workflow screen.
- Existing app/router file — register authenticated admin route without exposing participant marketplace behavior.
- `src/lib/institutionalApi.test.ts` and/or screen-focused Vitest tests using existing project test conventions.

### Documentation
- `docs/CURRENT_STATE.md` — identify Django/Postgres as canonical workflow persistence owner and Supabase Rule 2202 state as gated/unverified until reconciliation evidence exists.
- `docs/DECISIONS.md` — architecture decision record for persistence ownership.
- `docs/DEPLOYMENT.md` — add development/staging readiness checks and explicit Supabase migration gate.
- `docs/OPERATIONAL_INSTITUTIONAL_WORKFLOW.md` — operator-facing synthetic workflow instructions and CSV contract.

---

### Task 1: Lock Canonical Persistence and Migration-State Gate

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `docs/CURRENT_STATE.md`
- Modify: `docs/DEPLOYMENT.md`
- Create: `backend/relay/rule2202_adapter.py`
- Test: `backend/relay/tests/test_rule2202_adapter.py` or equivalent class in `backend/relay/tests.py`

**Interfaces:**
- Produces: `Rule2202Readiness(state: str, reason: str)` and `get_rule2202_readiness() -> Rule2202Readiness`.
- Contract: state is one of `unverified`, `verified`, `disabled`; only `verified` allows execution.

- [ ] **Step 1: Write the failing readiness-gate test**

```python
from django.test import SimpleTestCase, override_settings
from relay.rule2202_adapter import get_rule2202_readiness

class Rule2202ReadinessTests(SimpleTestCase):
    @override_settings(RELAY_RULE2202_STATE="unverified")
    def test_unverified_state_blocks_execution(self):
        readiness = get_rule2202_readiness()
        self.assertEqual(readiness.state, "unverified")
        self.assertFalse(readiness.can_execute)
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_rule2202_adapter.Rule2202ReadinessTests -v 2`

Expected: import/module failure because `rule2202_adapter.py` does not exist.

- [ ] **Step 3: Implement the minimal readiness object**

```python
from dataclasses import dataclass
from django.conf import settings

_ALLOWED = {"unverified", "verified", "disabled"}

@dataclass(frozen=True)
class Rule2202Readiness:
    state: str
    reason: str

    @property
    def can_execute(self) -> bool:
        return self.state == "verified"


def get_rule2202_readiness() -> Rule2202Readiness:
    state = getattr(settings, "RELAY_RULE2202_STATE", "unverified")
    if state not in _ALLOWED:
        state = "unverified"
    reason = {
        "unverified": "Supabase migration history has not been reconciled and verified.",
        "verified": "Migration history is explicitly marked verified for this environment.",
        "disabled": "Rule 2202 execution is intentionally disabled for this environment.",
    }[state]
    return Rule2202Readiness(state=state, reason=reason)
```

- [ ] **Step 4: Run focused test and full backend baseline**

Run: `cd backend && python manage.py test -v 1`

Expected: all existing and new backend tests pass.

- [ ] **Step 5: Record the architecture decision in docs**

Add exact statements: Django/Postgres is canonical application persistence for this workflow; Supabase schema changes are frozen for this slice; Rule 2202 remains unavailable unless readiness is `verified`; this work does not repair migration history.

- [ ] **Step 6: Commit**

```bash
git add docs/DECISIONS.md docs/CURRENT_STATE.md docs/DEPLOYMENT.md backend/relay/rule2202_adapter.py backend/relay/tests/
git commit -m "docs: lock canonical persistence and Rule 2202 gate"
```

---

### Task 2: Add Institution → Site → Cohort Canonical Hierarchy

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/migrations/0003_operational_institutional_workflow.py`
- Test: `backend/relay/tests/test_operational_models.py`

**Interfaces:**
- Produces: `Site(institution, name, slug, status)` and `Cohort(institution, site, name, slug, status)`.
- Invariant: `Cohort.institution_id == Cohort.site.institution_id`.

- [ ] **Step 1: Write model invariant tests**

```python
from django.core.exceptions import ValidationError
from django.test import TestCase
from relay.models import Institution, Site, Cohort

class InstitutionalHierarchyTests(TestCase):
    def test_cohort_rejects_cross_institution_site(self):
        a = Institution.objects.create(name="A", slug="a", status="active")
        b = Institution.objects.create(name="B", slug="b", status="active")
        site = Site.objects.create(institution=a, name="Main", slug="main")
        cohort = Cohort(institution=b, site=site, name="Staff", slug="staff")
        with self.assertRaises(ValidationError):
            cohort.full_clean()
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_operational_models.InstitutionalHierarchyTests -v 2`

Expected: import failure for `Site`/`Cohort`.

- [ ] **Step 3: Implement Site and Cohort with non-null ownership**

Use `ForeignKey(Institution, on_delete=CASCADE)` for both; `Cohort` also has `ForeignKey(Site, on_delete=CASCADE)`. Add `clean()` to reject institution/site mismatch and unique constraints on `(institution, slug)` and `(site, slug)`.

- [ ] **Step 4: Generate and inspect migration**

Run: `cd backend && python manage.py makemigrations relay`

Expected: one additive migration containing only new hierarchy/workflow schema changes; no destructive operation on existing models.

- [ ] **Step 5: Run migration checks and tests**

Run: `cd backend && python manage.py migrate --plan`

Run: `cd backend && python manage.py test relay.tests.test_operational_models -v 2`

Expected: migration plan is additive; focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/relay/models.py backend/relay/migrations/ backend/relay/tests/
git commit -m "feat: add institutional site and cohort hierarchy"
```

---

### Task 3: Add Import Provenance and Canonical Commuter Models

**Files:**
- Modify: `backend/relay/models.py`
- Modify generated workflow migration if still uncommitted, otherwise create next additive migration
- Test: `backend/relay/tests/test_operational_models.py`

**Interfaces:**
- Produces: `ImportBatch`, `ImportRow`, `CanonicalCommuterRecord`.
- `CanonicalCommuterRecord.source_row` is one-to-one or uniquely constrained so one accepted import row cannot silently create multiple canonical records.

- [ ] **Step 1: Write tests for immutability-oriented linkage and rejected-row guard**

```python
def test_canonical_record_requires_accepted_source_row(self):
    row = self.make_import_row(validation_status="rejected")
    record = CanonicalCommuterRecord(
        institution=row.institution,
        site=row.site,
        cohort=row.cohort,
        source_row=row,
        participant_key="p-001",
        origin_zone="Eagle Rock",
        destination_zone="PCC",
    )
    with self.assertRaises(ValidationError):
        record.full_clean()
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_operational_models -v 2`

- [ ] **Step 3: Implement models**

Required `ImportBatch` fields: institution, site, cohort, uploaded_by, original_filename, file_sha256, schema_version, status, total_rows, accepted_rows, rejected_rows, created_at/updated_at.

Required `ImportRow` fields: institution, site, cohort, batch, row_number, raw_payload JSON, normalized_payload JSON, validation_status, error_codes JSON list, warning_codes JSON list.

Required `CanonicalCommuterRecord` fields: institution, site, cohort, source_row, participant_key, origin_zone, destination_zone, commute_days JSON list, arrival_window_start/end, departure_window_start/end, flexibility_minutes, current_mode, vehicle_classification, commute_distance_miles, commute_time_minutes, parking_difficulty, ev_hybrid_signal, canonicalization_version.

Add `clean()` checks for institution/site/cohort consistency and accepted-row requirement.

- [ ] **Step 4: Run model tests and migration plan**

Run: `cd backend && python manage.py test relay.tests.test_operational_models -v 2`

Run: `cd backend && python manage.py migrate --plan`

- [ ] **Step 5: Commit**

```bash
git add backend/relay/models.py backend/relay/migrations/ backend/relay/tests/
git commit -m "feat: add commuter import provenance models"
```

---

### Task 4: Build Deterministic CSV Validation and Canonicalization

**Files:**
- Create: `backend/relay/import_schema.py`
- Create: `backend/relay/import_service.py`
- Test: `backend/relay/tests/test_import_service.py`

**Interfaces:**
- Produces: `ingest_commuter_csv(*, file_obj, filename, institution, site, cohort, uploaded_by) -> ImportBatch`.
- Produces deterministic error codes such as `missing_participant_key`, `invalid_time_window`, `duplicate_participant_key`, `invalid_distance`, `mode_vehicle_conflict`.

- [ ] **Step 1: Write RED tests for digest, duplicate detection, rejection, and canonicalization**

```python
from io import BytesIO

CSV = b"participant_key,origin_zone,destination_zone,current_mode,vehicle_classification\np-1,Eagle Rock,PCC,drive_alone,gasoline\np-1,Glendale,PCC,drive_alone,gasoline\n"

def test_duplicate_participant_key_rejects_second_row(self):
    batch = ingest_commuter_csv(
        file_obj=BytesIO(CSV), filename="commute.csv",
        institution=self.institution, site=self.site, cohort=self.cohort,
        uploaded_by=self.admin,
    )
    self.assertEqual(batch.total_rows, 2)
    self.assertEqual(batch.accepted_rows, 1)
    self.assertEqual(batch.rejected_rows, 1)
    self.assertEqual(CanonicalCommuterRecord.objects.filter(import_batch=batch).count(), 1)
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_import_service -v 2`

- [ ] **Step 3: Implement schema normalization**

Define `SCHEMA_VERSION = "commuter-v1"`, required headers, normalized mode/vehicle enums, ISO-like `HH:MM` parsing, integer flexibility, decimal distance, and approximate-zone text normalization. Do not geocode residential addresses.

- [ ] **Step 4: Implement ingestion transaction**

Algorithm:
1. read file bytes once;
2. compute SHA-256;
3. decode UTF-8 with explicit failure code;
4. create `ImportBatch(status="processing")`;
5. parse rows with `csv.DictReader`;
6. normalize and validate deterministically;
7. persist every `ImportRow` with raw/normalized payload and errors;
8. create canonical record only for accepted rows;
9. finalize counts and `status` as `completed` or `completed_with_errors`.

Use `transaction.atomic()` so infrastructure failures do not leave a falsely completed batch.

- [ ] **Step 5: Add reproducibility test**

Run the same CSV twice and assert `file_sha256` matches while the two batches remain distinct evidence records.

- [ ] **Step 6: Run service and full backend tests**

Run: `cd backend && python manage.py test relay.tests.test_import_service -v 2`

Run: `cd backend && python manage.py test -v 1`

- [ ] **Step 7: Commit**

```bash
git add backend/relay/import_schema.py backend/relay/import_service.py backend/relay/tests/
git commit -m "feat: add deterministic commuter CSV ingestion"
```

---

### Task 5: Build Durable Core Relay Rider Analysis Runs

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/analysis_engine.py`
- Test: `backend/relay/tests/test_analysis_engine.py`

**Interfaces:**
- Produces: `run_core_analysis(*, batch: ImportBatch, requested_by) -> AnalysisRun`.
- Produces persisted `AnalysisMetric` rows and deterministic `reproducibility_fingerprint`.

- [ ] **Step 1: Write RED determinism test**

```python
def test_same_dataset_and_versions_produce_same_fingerprint(self):
    first = run_core_analysis(batch=self.batch, requested_by=self.admin)
    second = run_core_analysis(batch=self.batch, requested_by=self.admin)
    self.assertEqual(first.reproducibility_fingerprint, second.reproducibility_fingerprint)
    self.assertEqual(
        list(first.metrics.order_by("metric_key").values_list("metric_key", "value_json")),
        list(second.metrics.order_by("metric_key").values_list("metric_key", "value_json")),
    )
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_analysis_engine -v 2`

- [ ] **Step 3: Implement run models**

`AnalysisRun`: institution, site, cohort, import_batch, requested_by, status, engine_version (`core-v1`), configuration_version (`default-v1`), code_version string, dataset_fingerprint, reproducibility_fingerprint, started_at, completed_at, error_code/error_detail.

`AnalysisMetric`: analysis_run, institution, metric_key, evidence_class, value_json, unit, source_refs JSON, method_id, confidence, privacy_treatment, caveat, partner_wording.

- [ ] **Step 4: Implement pure metric calculations**

Required initial metrics:
- `record_count_accepted` observed;
- `record_count_rejected` observed;
- `mode_distribution` calculated;
- `gasoline_sov_count` calculated;
- `origin_zone_concentration` calculated;
- `schedule_cluster_counts` calculated;
- `parking_pressure_signal` modeled when based on self-reported difficulty;
- `ev_hybrid_signal_count` calculated;
- `corridor_opportunity` modeled.

Sort dictionary keys and record sets before hashing/serialization so output order cannot change fingerprints.

- [ ] **Step 5: Implement failure-state persistence**

Wrap execution so unexpected calculation errors set `AnalysisRun.status="failed"` and preserve source/canonical records unchanged.

- [ ] **Step 6: Run focused and full backend tests**

Run: `cd backend && python manage.py test relay.tests.test_analysis_engine -v 2`

Run: `cd backend && python manage.py test -v 1`

- [ ] **Step 7: Commit**

```bash
git add backend/relay/models.py backend/relay/migrations/ backend/relay/analysis_engine.py backend/relay/tests/
git commit -m "feat: add durable Core Relay Rider analysis runs"
```

---

### Task 6: Add Governed Optional Rule 2202 Run Lifecycle

**Files:**
- Modify: `backend/relay/models.py`
- Modify: `backend/relay/rule2202_adapter.py`
- Test: `backend/relay/tests/test_rule2202_adapter.py`

**Interfaces:**
- Produces: `run_rule2202(*, analysis_run, requested_by) -> Rule2202Run`.
- Must raise/record an unavailable state when `get_rule2202_readiness().can_execute` is false.

- [ ] **Step 1: Write RED gate test**

```python
@override_settings(RELAY_RULE2202_STATE="unverified")
def test_unverified_rule2202_creates_unavailable_run_without_calling_database(self):
    run = run_rule2202(analysis_run=self.analysis_run, requested_by=self.admin)
    self.assertEqual(run.status, "unavailable")
    self.assertEqual(run.readiness_state, "unverified")
    self.assertFalse(run.executed)
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_rule2202_adapter -v 2`

- [ ] **Step 3: Implement `Rule2202Run` and guarded adapter**

Fields: institution, analysis_run, requested_by, readiness_state, function_set_version, status, executed bool, input_manifest JSON, output_manifest JSON, exclusion_manifest JSON, started_at, completed_at, error_code/error_detail.

For this slice, `verified` execution must be behind a small adapter function such as `_execute_verified_rule2202(inputs)` so it can be mocked in tests. Do not add migration-repair code and do not push Supabase migrations.

- [ ] **Step 4: Add verified-state adapter contract test using a mock**

Assert the adapter receives only derived calculation inputs and that results are persisted as calculation outputs with caveats, not compliance status.

- [ ] **Step 5: Run tests**

Run: `cd backend && python manage.py test relay.tests.test_rule2202_adapter -v 2`

- [ ] **Step 6: Commit**

```bash
git add backend/relay/models.py backend/relay/migrations/ backend/relay/rule2202_adapter.py backend/relay/tests/
git commit -m "feat: add governed Rule 2202 run lifecycle"
```

---

### Task 7: Persist Evidence-Linked Decision Cards

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/decision_cards.py`
- Test: `backend/relay/tests/test_decision_cards.py`

**Interfaces:**
- Produces: `generate_decision_card(*, analysis_run, requested_by) -> DecisionCard`.

- [ ] **Step 1: Write RED evidence-link test**

```python
def test_decision_card_links_findings_to_metrics_and_preserves_evidence_classes(self):
    card = generate_decision_card(analysis_run=self.analysis_run, requested_by=self.admin)
    self.assertEqual(card.analysis_run_id, self.analysis_run.id)
    self.assertTrue(card.evidence_manifest)
    self.assertIn("modeled", {item["evidence_class"] for item in card.evidence_manifest})
    self.assertEqual(card.reproducibility_fingerprint, self.analysis_run.reproducibility_fingerprint)
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_decision_cards -v 2`

- [ ] **Step 3: Implement DecisionCard model**

Fields: institution, site, cohort, analysis_run, generated_by, decision_question, headline, evidence_summary JSON, findings JSON, recommended_action, caveats JSON, evidence_manifest JSON, generation_version (`decision-card-v1`), reproducibility_fingerprint, generated_at.

- [ ] **Step 4: Implement deterministic generator**

Use persisted metrics only. Do not recompute hidden metrics inside the card generator. Suppress unsupported claims and label observed/calculated/modeled findings verbatim from `AnalysisMetric.evidence_class`.

- [ ] **Step 5: Run tests and commit**

Run: `cd backend && python manage.py test relay.tests.test_decision_cards -v 2`

```bash
git add backend/relay/models.py backend/relay/migrations/ backend/relay/decision_cards.py backend/relay/tests/
git commit -m "feat: add evidence-linked Decision Cards"
```

---

### Task 8: Add Deterministic Report Export

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/reporting.py`
- Test: `backend/relay/tests/test_reporting.py`

**Interfaces:**
- Produces: `build_report_payload(decision_card) -> bytes`.
- Produces: `create_report_artifact(*, decision_card, requested_by) -> ReportArtifact`.

- [ ] **Step 1: Write RED byte-determinism test**

```python
def test_report_payload_is_byte_deterministic(self):
    first = build_report_payload(self.card)
    second = build_report_payload(self.card)
    self.assertEqual(first, second)
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_reporting -v 2`

- [ ] **Step 3: Implement canonical JSON report first**

Serialize with `json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")`. Include institution/site/cohort identifiers, source batch hash, analysis fingerprint, metrics with evidence metadata, Rule 2202 state/results when present, Decision Card, generation version, and source manifest.

- [ ] **Step 4: Implement ReportArtifact model**

Fields: institution, analysis_run, decision_card, generated_by, format (`json` initially), generation_version (`report-v1`), artifact_sha256, byte_length, source_manifest JSON, generated_at. Store artifact bytes using the project-approved storage mechanism only if one already exists; otherwise return bytes through the API and persist metadata/hash in this slice.

- [ ] **Step 5: Verify digest and evidence manifest tests**

Assert SHA-256 of returned bytes equals persisted `artifact_sha256` and all Decision Card evidence references appear in the report manifest.

- [ ] **Step 6: Commit**

```bash
git add backend/relay/models.py backend/relay/migrations/ backend/relay/reporting.py backend/relay/tests/
git commit -m "feat: add deterministic institutional report export"
```

---

### Task 9: Expose Tenant-Scoped Institutional Admin API

**Files:**
- Modify: `backend/relay/permissions.py`
- Modify: `backend/relay/serializers.py`
- Modify: `backend/relay/views.py`
- Modify API routing file
- Test: `backend/relay/tests/test_operational_api.py`

**Interfaces:**
- Endpoints/actions:
  - `GET/POST /api/sites/`
  - `GET/POST /api/cohorts/`
  - `POST /api/import-batches/upload/`
  - `GET /api/import-batches/{id}/`
  - `POST /api/analysis-runs/`
  - `POST /api/analysis-runs/{id}/rule2202/`
  - `POST /api/analysis-runs/{id}/decision-card/`
  - `GET /api/decision-cards/{id}/`
  - `GET /api/decision-cards/{id}/export/`

- [ ] **Step 1: Write two-institution isolation tests before endpoints**

```python
def test_institution_admin_cannot_read_other_institution_import_batch(self):
    self.client.force_authenticate(self.admin_a)
    response = self.client.get(f"/api/import-batches/{self.batch_b.pk}/")
    self.assertIn(response.status_code, (403, 404))
```

Also test POST attempts that supply another institution/site/cohort ID are denied and do not create records.

- [ ] **Step 2: Run and confirm RED**

Run: `cd backend && python manage.py test relay.tests.test_operational_api -v 2`

- [ ] **Step 3: Implement shared institution-admin resolver**

Resolve authorized institution IDs from `Membership`; do not trust client-supplied institution IDs without membership validation. Ensure object querysets are tenant-filtered before object lookup.

- [ ] **Step 4: Implement serializers and endpoints**

Upload endpoint accepts multipart CSV and site/cohort IDs, invokes `ingest_commuter_csv`, and returns batch validation summary. Analysis endpoint invokes `run_core_analysis`. Decision Card and export endpoints invoke their deterministic service functions.

- [ ] **Step 5: Test platform-admin behavior separately**

Platform admin may cross tenant only through the existing explicit role semantics; institution admins may not.

- [ ] **Step 6: Run all backend tests**

Run: `cd backend && python manage.py test -v 1`

Expected: zero failures.

- [ ] **Step 7: Commit**

```bash
git add backend/relay/permissions.py backend/relay/serializers.py backend/relay/views.py backend/relay/tests/ backend/config/urls.py
git commit -m "feat: expose tenant-scoped institutional assessment API"
```

---

### Task 10: Add Synthetic Dataset and End-to-End Acceptance Test

**Files:**
- Create: `backend/relay/fixtures/synthetic_institutional_commute_v1.csv`
- Create: `backend/relay/tests/test_operational_acceptance.py`
- Create: `docs/OPERATIONAL_INSTITUTIONAL_WORKFLOW.md`

**Interfaces:**
- Produces one canonical synthetic test path that exercises import → validation → canonical records → analysis → Decision Card → report.

- [ ] **Step 1: Create synthetic CSV with deliberate edge cases**

Include at least 12 rows containing:
- valid gasoline SOV records from two approximate origin zones;
- valid EV/hybrid record(s);
- parking-difficulty variation;
- schedule clusters;
- one duplicate participant key;
- one invalid time window;
- no real names, addresses, emails, phone numbers, or participant identifiers.

- [ ] **Step 2: Write RED acceptance test**

```python
def test_admin_can_complete_operational_workflow_without_shell_or_db_intervention(self):
    batch = self.upload_fixture()
    self.assertGreater(batch.accepted_rows, 0)
    analysis = run_core_analysis(batch=batch, requested_by=self.admin)
    self.assertEqual(analysis.status, "completed")
    card = generate_decision_card(analysis_run=analysis, requested_by=self.admin)
    artifact = create_report_artifact(decision_card=card, requested_by=self.admin)
    self.assertEqual(card.reproducibility_fingerprint, analysis.reproducibility_fingerprint)
    self.assertEqual(len(artifact.artifact_sha256), 64)
```

- [ ] **Step 3: Add second-run reproducibility assertion**

Run the same fixture through a second ImportBatch and assert source SHA matches and substantive metric payload/fingerprint matches when versions/configuration are identical.

- [ ] **Step 4: Document operator workflow and CSV contract**

Document exact headers, accepted mode/vehicle values, time format, evidence labels, validation error codes, Rule 2202 unavailable behavior, and report contents.

- [ ] **Step 5: Run full backend suite**

Run: `cd backend && python manage.py test -v 1`

- [ ] **Step 6: Commit**

```bash
git add backend/relay/fixtures/ backend/relay/tests/ docs/OPERATIONAL_INSTITUTIONAL_WORKFLOW.md
git commit -m "test: prove synthetic institutional workflow end to end"
```

---

### Task 11: Add Minimum Institutional Administrator UI

**Files:**
- Create: `src/lib/institutionalApi.ts`
- Create: `src/screens/InstitutionalAssessmentScreen.tsx`
- Modify: existing router/app navigation file after inspection
- Test: `src/lib/institutionalApi.test.ts` and existing screen test convention

**Interfaces:**
- Consumes the Task 9 API only.
- Produces one admin workflow: context → upload → validation → analysis → Decision Card → export.

- [ ] **Step 1: Write API-client contract tests**

Test multipart upload, analysis run creation, Decision Card retrieval, export response handling, and typed Rule 2202 readiness state.

- [ ] **Step 2: Run Vitest and confirm RED**

Run: `npm test -- --run src/lib/institutionalApi.test.ts`

- [ ] **Step 3: Implement typed API client**

Define types matching backend response schemas exactly. Do not add local synthetic results or fallback Decision Cards.

- [ ] **Step 4: Implement minimal screen**

Screen states: loading context, ready, uploading, validation result, analyzing, completed, failed. Display rejected-row counts and validation codes; show evidence-class badges/labels in the Decision Card; show Rule 2202 as unavailable when gate is not verified; expose report export only after a persisted Decision Card exists.

- [ ] **Step 5: Remove/disable any UI control that implies unsupported functionality**

No ride activation, payment, incentive, message, regulatory-submit, or live-match action appears in this admin workflow.

- [ ] **Step 6: Run frontend verification**

Run: `npm test -- --run`

Run: `npm run check`

Run: `npm run build`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/institutionalApi.ts src/lib/institutionalApi.test.ts src/screens/InstitutionalAssessmentScreen.tsx src/
git commit -m "feat: add minimum institutional assessment UI"
```

---

### Task 12: Deployment Safety Review and Blocker Report

**Files:**
- Modify: `docs/CURRENT_STATE.md`
- Modify: `docs/DEPLOYMENT.md`
- Create: `docs/OPERATIONAL_WORKFLOW_BLOCKERS.md`

**Interfaces:**
- Produces explicit deploy/no-deploy decision with evidence.

- [ ] **Step 1: Run backend verification fresh**

Run: `cd backend && python manage.py check`

Run: `cd backend && python manage.py makemigrations --check --dry-run`

Run: `cd backend && python manage.py test -v 1`

- [ ] **Step 2: Run frontend verification fresh**

Run: `npm test -- --run`

Run: `npm run check`

Run: `npm run build`

- [ ] **Step 3: Verify migration safety**

Inspect Django migration plan and confirm no destructive operation on existing production-shaped tables. Do **not** execute `supabase db push`, `supabase migration repair`, or remote DDL.

- [ ] **Step 4: Execute acceptance workflow in development/staging only**

Use the synthetic fixture through the API/UI path, not direct ORM manipulation, and verify an admin can obtain a Decision Card and report without shell/database steps.

- [ ] **Step 5: Execute cross-tenant negative scenarios**

Attempt read, upload-context substitution, run creation, Decision Card fetch, and report export using Institution B IDs while authenticated only to Institution A. Every attempt must be denied without protected data disclosure.

- [ ] **Step 6: Write blocker report**

Classify every remaining blocker as `release-blocking`, `Rule2202-only`, or `post-MVP`. At minimum, retain the Supabase 30-migration discrepancy as `Rule2202-only` unless authoritative reconciliation evidence has been produced. Do not silently downgrade it.

- [ ] **Step 7: Commit verification documentation only after fresh evidence**

```bash
git add docs/CURRENT_STATE.md docs/DEPLOYMENT.md docs/OPERATIONAL_WORKFLOW_BLOCKERS.md
git commit -m "docs: record operational workflow verification and blockers"
```

---

## Final Acceptance Checklist

- [ ] Django/Postgres is documented and implemented as canonical workflow persistence.
- [ ] Supabase migration history remains untouched by this work.
- [ ] Institution → Site → Cohort exists with tenant-consistency invariants.
- [ ] Authenticated institution-admin membership is enforced.
- [ ] CSV import produces immutable batch/row provenance and SHA-256 source identity.
- [ ] Rejected rows never become canonical commuter records.
- [ ] Core Relay Rider analysis is durable, versioned, deterministic, and auditable.
- [ ] Rule 2202 is optional and gated; unavailable state does not block ordinary analysis.
- [ ] Decision Card is persisted and evidence-linked.
- [ ] Report bytes are deterministic for the same persisted card/version and carry an artifact digest.
- [ ] Two-institution negative tests demonstrate tenant isolation.
- [ ] Synthetic acceptance workflow runs without developer shell/database intervention.
- [ ] No live rides, payments, incentives, messaging, regulatory submission, or production-data mutation is introduced.
- [ ] Remaining blockers are explicitly documented before any deployment claim.
