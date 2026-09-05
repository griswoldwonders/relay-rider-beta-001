# Pandera Commute Validation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the institutional vertical slice's hand-written commuter CSV validation with a canonical Pandera schema while preserving the existing `CommuterRecord` persistence contract, row provenance, retained validation errors, and Core Engine scoring semantics.

**Architecture:** Keep Django ORM authoritative. CSV parsing and raw source retention stay in `relay.services.ingestion`; a new `relay.services.commute_schema` module owns schema-level validation and normalization. Pandera validates raw row data and returns deterministic row-level errors; ingestion persists exactly the same canonical model fields and downstream scoring remains untouched.

**Tech Stack:** Django 5, Python 3.12, pandas, Pandera 0.33.1.

**Spec:** User-approved scope in project conversation: Pandera only; no H3, routing, scoring changes, new UI, or Charging Intelligence.

## Global Constraints

- Do not change the `CommuterRecord` database fields or create a Django migration.
- Do not change `relay.services.core_engine` scoring weights, factors, version, or explanations.
- Preserve SHA-256 file provenance, `source_row_number`, and raw `source_payload`.
- Preserve invalid-row persistence and `validation_errors` retention.
- Preserve cross-tenant hierarchy checks before import persistence.
- Accept extra CSV columns as before; preserve them only in `source_payload`.
- Keep missing required CSV headers as a pre-persistence `ValueError`.
- No H3, Valhalla, Schemathesis, OSV, Charging Intelligence, or UI work.

---

### Task 1: Establish the canonical schema contract

**Files:**
- Create: `backend/relay/services/commute_schema.py`
- Modify: `backend/requirements.txt`
- Test: `backend/relay/test_vertical_slice.py`

**Interfaces:**
- Produces: `COMMUTE_IMPORT_SCHEMA`, `REQUIRED_COLUMNS`, `validate_and_normalize_rows(rows)`.
- `validate_and_normalize_rows(rows)` returns a list of `(normalized_row, errors)` tuples in input order.

- [ ] **Step 1: Write the failing schema-contract test**

Add a test asserting `relay.services.ingestion.COMMUTE_IMPORT_SCHEMA.name == "relay_rider_commute_import_v1"`.

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `python manage.py test relay.test_vertical_slice.VerticalSliceTestCase.test_import_validation_exposes_canonical_schema_contract`
Expected: FAIL because `COMMUTE_IMPORT_SCHEMA` does not exist.

- [ ] **Step 3: Add Pandera dependency and canonical schema module**

Pin `pandera[pandas]==0.33.1` and define a named Pandera `DataFrameSchema` with required-column, boolean-token, integer/non-negative, and mode/occupancy checks. Keep `strict=False` so extra columns remain accepted.

- [ ] **Step 4: Run targeted test and verify GREEN**

Run the same targeted test.
Expected: PASS.

### Task 2: Preserve legacy row normalization and error retention

**Files:**
- Modify: `backend/relay/services/commute_schema.py`
- Modify: `backend/relay/services/ingestion.py`
- Test: `backend/relay/test_vertical_slice.py`

**Interfaces:**
- Consumes: `validate_and_normalize_rows(rows)` from Task 1.
- Produces: unchanged `CommuterRecord` field values and row-level `validation_errors`.

- [ ] **Step 1: Add failing compatibility tests**

Cover invalid boolean tokens, negative/non-integer schedule flexibility, shared-mode occupancy requirements, carpool/vanpool ranges, and a valid row. Assert invalid rows are persisted instead of dropped and normalized values match the prior behavior.

- [ ] **Step 2: Run compatibility tests and verify RED**

Run: `python manage.py test relay.test_vertical_slice.VerticalSliceTestCase`
Expected: one or more new compatibility tests fail before ingestion delegates to Pandera.

- [ ] **Step 3: Replace `_validate_row` with schema delegation**

Materialize `csv.DictReader` rows once, pass them to `validate_and_normalize_rows`, and persist each returned normalized row plus errors with the original raw row as `source_payload`.

- [ ] **Step 4: Verify compatibility tests GREEN**

Run the same test case and confirm all tests pass.

### Task 3: Prove downstream semantics are unchanged

**Files:**
- Modify: `backend/relay/test_vertical_slice.py`

**Interfaces:**
- Consumes: unchanged `score_commuter_record(record)` and vertical slice flow.
- Produces: regression evidence that Pandera does not alter scoring or output semantics.

- [ ] **Step 1: Add regression assertions**

For the existing R1 fixture, assert persisted normalized fields and the existing score of 100 with `drive_alone == 35` remain unchanged.

- [ ] **Step 2: Run full backend suite**

Run: `python manage.py test`
Expected: PASS.

- [ ] **Step 3: Verify migrations are unchanged**

Run: `python manage.py makemigrations --check --dry-run`
Expected: `No changes detected`.

- [ ] **Step 4: Run Django system checks**

Run: `python manage.py check`
Expected: no issues.

### Task 4: Review the final diff

**Files:**
- Review only.

**Interfaces:**
- Produces: final PR limited to Pandera validation and its tests/CI evidence.

- [ ] **Step 1: Confirm no model or migration changes**
- [ ] **Step 2: Confirm `core_engine.py` is byte-for-byte unchanged**
- [ ] **Step 3: Confirm no H3/routing/UI/Charging Intelligence files changed**
- [ ] **Step 4: Record test results and known branch dependency on the institutional vertical-slice reconciliation**
