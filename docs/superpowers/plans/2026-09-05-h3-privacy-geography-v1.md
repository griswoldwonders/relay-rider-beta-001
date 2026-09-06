# H3 Privacy Geography v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a service-only H3 privacy-geography layer that converts explicitly authorized synthetic/reported/imported coordinates into tenant-scoped, threshold-suppressed corridor aggregates without changing `CommuterRecord`, Core Engine scoring, Rule 2202, routing, UI, or Charging Intelligence.

**Architecture:** Implement one focused Django/Python service module that resolves canonical `Institution → Site → Cohort` scope, validates geography authorization/provenance and coordinate bounds, derives restricted H3 cells, aggregates by `origin_h3_cell → destination_h3_cell`, and suppresses groups below the publishable threshold. Keep all precise coordinates transient and all individual H3 cells restricted to backend-internal service values; expose no new HTTP endpoint in v1.

**Tech Stack:** Python 3.12, Django 5.x, `h3==4.5.0`, Django `TestCase`, existing GitHub Actions CI/security workflows.

**Spec:** `docs/superpowers/specs/2026-09-05-h3-privacy-geography-v1-design.md`

## Global Constraints

- H3 dependency: exactly `h3==4.5.0`.
- Research-beta H3 resolution default: `7`.
- Research-beta minimum publishable participant count default: `5`.
- Transformation version: `h3-privacy-geography-v1`.
- Accepted provenance labels: `synthetic`, `reported`, `imported`; reject `modeled` in v1.
- Every observation requires `geography_authorized = true`.
- No raw latitude/longitude persistence, return values, logs, audit payloads, model fields, or source-payload scraping.
- Individual H3 cells are restricted derived geography and must not appear in existing participant/admin outputs.
- No new API endpoint or arbitrary interactive H3 query surface.
- No `CommuterRecord` model changes and no H3 migration.
- No changes to `origin_zone` / `destination_zone` semantics.
- No changes to Core Engine factors, weights, explanation behavior, or engine version.
- No changes to Rule 2202 calculations or status semantics.
- No routing, detour, map, Access Point, Green Wallet, Charging Intelligence, payment, or match-activation work.
- H3 implementation may not merge ahead of the canonical Operational Research Beta v1 RC2 identity/review hardening gate.
- Until required GitHub status contexts are enforced, record exact-SHA manual CI/security verification before merge and exact-SHA push verification after merge.

---

## File Structure

The implementation should touch only these runtime/test files unless RC2 reconciliation changes an exact line location:

- Create `backend/relay/services/privacy_geography.py` — canonical scope resolution, privacy-safe validation, H3 transformation, corridor aggregation, suppression, restricted audit summary.
- Create `backend/relay/test_privacy_geography.py` — focused RED→GREEN service contract and leakage/non-regression tests.
- Modify `backend/config/settings.py` — add `RELAY_H3_RESOLUTION` and `RELAY_H3_MIN_PUBLISHABLE_COUNT` defaults.
- Modify `backend/requirements.txt` — add `h3==4.5.0`.

Do **not** modify `backend/relay/models.py`, any Django migration, `backend/relay/services/core_engine.py`, `backend/relay/services/exports.py`, frontend source files, routing code, or Charging Intelligence files for H3 v1.

The service interface locked by this plan is:

```python
class PrivacyGeographyError(ValueError): ...

@dataclass(frozen=True)
class PrivacyGeographyScope:
    institution: Institution
    site: Site | None = None
    cohort: Cohort | None = None

@dataclass(frozen=True)
class GeographyObservation:
    record_id: str
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    geography_authorized: bool
    provenance_label: str
    institution_id: int | None = None
    site_id: int | None = None
    cohort_id: int | None = None

@dataclass(frozen=True)
class PrivacyGeographyRecord:
    record_id: str
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    origin_h3_cell: str
    destination_h3_cell: str
    h3_resolution: int
    transformation_version: str
    provenance_label: str

@dataclass(frozen=True)
class CorridorAggregate:
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    origin_h3_cell: str
    destination_h3_cell: str
    participant_count: int
    h3_resolution: int
    suppression_threshold: int
    transformation_version: str

@dataclass(frozen=True)
class PrivacyGeographyAuditSummary:
    transformation_version: str
    h3_resolution: int
    suppression_threshold: int
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    provenance_labels: tuple[str, ...]
    total_observations: int
    valid_observations: int
    publishable_corridor_count: int
    suppressed_corridor_group_count: int
    suppressed_contributing_observation_count: int

@dataclass(frozen=True)
class PrivacyGeographyResult:
    publishable_corridors: tuple[CorridorAggregate, ...]
    audit_summary: PrivacyGeographyAuditSummary


def resolve_privacy_geography_scope(
    *,
    institution: Institution,
    site: Site | None = None,
    cohort: Cohort | None = None,
) -> PrivacyGeographyScope: ...


def transform_observations(
    *,
    scope: PrivacyGeographyScope,
    observations: Iterable[GeographyObservation],
    resolution: int | None = None,
) -> tuple[PrivacyGeographyRecord, ...]: ...


def aggregate_corridors(
    *,
    scope: PrivacyGeographyScope,
    observations: Iterable[GeographyObservation],
    resolution: int | None = None,
    minimum_publishable_count: int | None = None,
) -> PrivacyGeographyResult: ...
```

The implementation must return deterministic tuple ordering: sort restricted records by `record_id` and publishable corridor aggregates by `(origin_h3_cell, destination_h3_cell)`.

---

### Task 0: RC2 Preflight and Implementation Branch Gate

**Files:**
- Read only: `backend/relay/models.py`
- Read only: `backend/relay/permissions.py`
- Read only: `.github/workflows/ci.yml`
- Read only: `.github/workflows/operational-hardening.yml` when present on authoritative `main`

**Interfaces:**
- Consumes: authoritative `main` after PR #63 or its canonical successor is green and merged/superseded.
- Produces: clean H3 implementation branch based on the authoritative RC2 `main` SHA.

- [ ] **Step 1: Verify the RC2 gate is resolved before creating the H3 implementation branch**

Check PR #63 (or its canonical successor). At plan authoring time PR #63 is still draft/open and its latest recorded standard CI has a failing Django backend-test job, so this step must not be treated as already satisfied.

Required state before H3 implementation begins:

```text
RC2 identity/review hardening = merged into main and green
OR
RC2 PR = explicitly superseded and equivalent controls demonstrably exist on main
```

Expected: no unresolved red RC2 backend suite.

- [ ] **Step 2: Record the authoritative base SHA**

Run:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git rev-parse HEAD
```

Record the SHA in the H3 PR body under `Base SHA`.

- [ ] **Step 3: Create an isolated implementation worktree/branch from that SHA**

Run via the required worktree skill at execution time, using branch name:

```text
feat/h3-privacy-geography-v1
```

Expected: the branch is based exactly on the recorded authoritative RC2 `main` SHA.

- [ ] **Step 4: Run the current baseline suites before adding H3 tests**

Run:

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Then from repository root:

```bash
npm run check
npm test
npm run build
```

Expected: PASS. If the inherited baseline is red, stop and repair/reconcile the baseline separately; do not hide an RC2 failure inside the H3 PR.

- [ ] **Step 5: Commit nothing for this task**

This is a release/branch precondition, not a code change.

---

### Task 1: Write the RED H3 Privacy Contract Tests

**Files:**
- Create: `backend/relay/test_privacy_geography.py`

**Interfaces:**
- Consumes: Django models `Institution`, `Site`, `Cohort` and the future service interfaces listed in the File Structure section.
- Produces: failing tests that define canonical scope, authorization/provenance, coordinate safety, deterministic H3 transformation, duplicate handling, aggregation, suppression, and output-leakage behavior.

- [ ] **Step 1: Create the focused test module with deterministic synthetic fixtures**

Create `backend/relay/test_privacy_geography.py` beginning with:

```python
from dataclasses import asdict
from math import inf, nan

from django.test import TestCase, override_settings

from relay.models import Cohort, Institution, Site
from relay.services.exports import commuter_records_csv, dashboard_payload
from relay.services.privacy_geography import (
    TRANSFORMATION_VERSION,
    CorridorAggregate,
    GeographyObservation,
    PrivacyGeographyError,
    PrivacyGeographyRecord,
    aggregate_corridors,
    resolve_privacy_geography_scope,
    transform_observations,
)


ORIGIN = (34.1500, -118.1400)
DESTINATION = (34.1400, -118.1300)
ALT_ORIGIN = (34.1800, -118.1700)
ALT_DESTINATION = (34.1700, -118.1600)


def make_observation(record_id, *, origin=ORIGIN, destination=DESTINATION, **overrides):
    values = {
        'record_id': record_id,
        'origin_lat': origin[0],
        'origin_lng': origin[1],
        'destination_lat': destination[0],
        'destination_lng': destination[1],
        'geography_authorized': True,
        'provenance_label': 'synthetic',
    }
    values.update(overrides)
    return GeographyObservation(**values)


class PrivacyGeographyTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(
            name='Synthetic Institution',
            slug='synthetic-institution',
            status='active',
        )
        self.site = Site.objects.create(
            institution=self.institution,
            name='Synthetic Site',
            slug='synthetic-site',
            site_type='campus',
        )
        self.cohort = Cohort.objects.create(
            institution=self.institution,
            site=self.site,
            name='Synthetic Cohort',
            slug='synthetic-cohort',
        )
        self.scope = resolve_privacy_geography_scope(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
        )
```

- [ ] **Step 2: Add canonical-scope failure tests**

Add tests equivalent to:

```python
def test_scope_rejects_site_from_another_institution(self):
    other = Institution.objects.create(name='Other', slug='other')
    other_site = Site.objects.create(institution=other, name='Other Site', slug='other-site')
    with self.assertRaisesMessage(PrivacyGeographyError, 'site scope mismatch'):
        resolve_privacy_geography_scope(
            institution=self.institution,
            site=other_site,
        )


def test_scope_rejects_cohort_from_another_institution(self):
    other = Institution.objects.create(name='Other 2', slug='other-2')
    other_site = Site.objects.create(institution=other, name='Other Site 2', slug='other-site-2')
    other_cohort = Cohort.objects.create(
        institution=other,
        site=other_site,
        name='Other Cohort',
        slug='other-cohort',
    )
    with self.assertRaisesMessage(PrivacyGeographyError, 'cohort scope mismatch'):
        resolve_privacy_geography_scope(
            institution=self.institution,
            site=self.site,
            cohort=other_cohort,
        )
```

Also add a same-institution/different-site cohort mismatch test and a cohort-without-site test. Both must fail closed.

- [ ] **Step 3: Add authorization/provenance and coordinate-safety tests**

Add tests asserting:

```python
def test_geography_authorization_is_required(self):
    observation = make_observation('R1', geography_authorized=False)
    with self.assertRaisesMessage(PrivacyGeographyError, 'geography authorization required'):
        transform_observations(scope=self.scope, observations=[observation])


def test_modeled_provenance_is_rejected(self):
    observation = make_observation('R1', provenance_label='modeled')
    with self.assertRaisesMessage(PrivacyGeographyError, 'unsupported geography provenance'):
        transform_observations(scope=self.scope, observations=[observation])
```

For each invalid coordinate category, assert both that the call fails and that the exception text does not contain the coordinate representation. Cover latitude > 90, latitude < -90, longitude > 180, longitude < -180, `nan`, `inf`, and `-inf`.

- [ ] **Step 4: Add deterministic transformation and restricted-record tests**

Add:

```python
@override_settings(RELAY_H3_RESOLUTION=7)
def test_same_coordinates_produce_same_cells(self):
    first = transform_observations(
        scope=self.scope,
        observations=[make_observation('R1')],
    )[0]
    second = transform_observations(
        scope=self.scope,
        observations=[make_observation('R1')],
    )[0]
    self.assertEqual(first.origin_h3_cell, second.origin_h3_cell)
    self.assertEqual(first.destination_h3_cell, second.destination_h3_cell)
    self.assertEqual(first.h3_resolution, 7)
    self.assertEqual(first.transformation_version, TRANSFORMATION_VERSION)


def test_restricted_record_contains_no_raw_coordinates(self):
    record = transform_observations(
        scope=self.scope,
        observations=[make_observation('R1')],
    )[0]
    keys = set(asdict(record))
    self.assertFalse({'origin_lat', 'origin_lng', 'destination_lat', 'destination_lng'} & keys)
```

Add an `@override_settings(RELAY_H3_RESOLUTION=6)` assertion showing the recorded resolution changes to 6.

- [ ] **Step 5: Add declared-scope mismatch and duplicate-ID tests**

Assert that an observation declaring a different `institution_id`, `site_id`, or `cohort_id` fails the entire request. Assert that two observations with the same `record_id` raise exactly `duplicate observation identifier` and produce no aggregate result.

- [ ] **Step 6: Add threshold and cross-tenant aggregation tests**

Add:

```python
@override_settings(RELAY_H3_MIN_PUBLISHABLE_COUNT=5)
def test_five_observations_publish_one_corridor(self):
    result = aggregate_corridors(
        scope=self.scope,
        observations=[make_observation(f'R{i}') for i in range(5)],
    )
    self.assertEqual(len(result.publishable_corridors), 1)
    self.assertEqual(result.publishable_corridors[0].participant_count, 5)
    self.assertEqual(result.audit_summary.suppressed_corridor_group_count, 0)


@override_settings(RELAY_H3_MIN_PUBLISHABLE_COUNT=5)
def test_four_observations_are_suppressed(self):
    result = aggregate_corridors(
        scope=self.scope,
        observations=[make_observation(f'R{i}') for i in range(4)],
    )
    self.assertEqual(result.publishable_corridors, ())
    self.assertEqual(result.audit_summary.suppressed_corridor_group_count, 1)
    self.assertEqual(result.audit_summary.suppressed_contributing_observation_count, 4)
```

Add a two-publishable-corridor test using `ALT_ORIGIN`/`ALT_DESTINATION`, and a separate second-institution test proving identical H3 cells never combine counts across tenant scopes.

- [ ] **Step 7: Add suppression-leakage tests**

Assert the restricted audit summary has no fields containing cell identifiers:

```python
def test_audit_summary_never_contains_suppressed_cells(self):
    result = aggregate_corridors(
        scope=self.scope,
        observations=[make_observation(f'R{i}') for i in range(4)],
    )
    keys = set(asdict(result.audit_summary))
    self.assertNotIn('origin_h3_cell', keys)
    self.assertNotIn('destination_h3_cell', keys)
```

Also assert `publishable_corridors` contains no participant/external identifiers or provenance objects beyond the aggregate fields defined by `CorridorAggregate`.

- [ ] **Step 8: Add non-regression assertions for existing data/output contracts**

Do not fabricate a new H3 API. Instead add reflection-level assertions:

```python
def test_commuter_record_schema_does_not_gain_h3_fields(self):
    from relay.models import CommuterRecord
    field_names = {field.name for field in CommuterRecord._meta.get_fields()}
    self.assertNotIn('origin_h3', field_names)
    self.assertNotIn('destination_h3', field_names)
    self.assertNotIn('origin_h3_cell', field_names)
    self.assertNotIn('destination_h3_cell', field_names)
```

The existing Core Engine regression remains owned by `backend/relay/test_vertical_slice.py`; do not duplicate its scoring logic in this file.

- [ ] **Step 9: Run the RED test and capture the expected failure**

Run:

```bash
cd backend
python manage.py test relay.test_privacy_geography -v 2
```

Expected: FAIL because `relay.services.privacy_geography` does not exist yet.

- [ ] **Step 10: Commit the RED tests**

```bash
git add backend/relay/test_privacy_geography.py
git commit -m "test: define H3 privacy geography contract"
```

---

### Task 2: Add H3 Dependency, Settings, Canonical Scope, and Transformation

**Files:**
- Create: `backend/relay/services/privacy_geography.py`
- Modify: `backend/config/settings.py`
- Modify: `backend/requirements.txt`
- Test: `backend/relay/test_privacy_geography.py`

**Interfaces:**
- Consumes: canonical `Institution`, `Site`, `Cohort`; `h3.latlng_to_cell`; Django settings.
- Produces: `PrivacyGeographyError`, `PrivacyGeographyScope`, `GeographyObservation`, `PrivacyGeographyRecord`, `resolve_privacy_geography_scope`, `transform_observations`.

- [ ] **Step 1: Pin H3 and add configuration defaults**

Append to `backend/requirements.txt`:

```text
h3==4.5.0
```

Add to `backend/config/settings.py` after the existing general settings:

```python
RELAY_H3_RESOLUTION = int(os.environ.get('RELAY_H3_RESOLUTION', '7'))
RELAY_H3_MIN_PUBLISHABLE_COUNT = int(
    os.environ.get('RELAY_H3_MIN_PUBLISHABLE_COUNT', '5')
)
```

- [ ] **Step 2: Install dependencies in the implementation worktree**

Run:

```bash
cd backend
python -m pip install -r requirements.txt
```

Expected: `h3==4.5.0` installs successfully under Python 3.12.

- [ ] **Step 3: Create the service types and constants**

Create `backend/relay/services/privacy_geography.py` with:

```python
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from math import isfinite

import h3
from django.conf import settings

from relay.models import Cohort, Institution, Site


TRANSFORMATION_VERSION = 'h3-privacy-geography-v1'
ALLOWED_PROVENANCE_LABELS = frozenset({'synthetic', 'reported', 'imported'})


class PrivacyGeographyError(ValueError):
    pass


@dataclass(frozen=True)
class PrivacyGeographyScope:
    institution: Institution
    site: Site | None = None
    cohort: Cohort | None = None


@dataclass(frozen=True)
class GeographyObservation:
    record_id: str
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    geography_authorized: bool
    provenance_label: str
    institution_id: int | None = None
    site_id: int | None = None
    cohort_id: int | None = None


@dataclass(frozen=True)
class PrivacyGeographyRecord:
    record_id: str
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    origin_h3_cell: str
    destination_h3_cell: str
    h3_resolution: int
    transformation_version: str
    provenance_label: str
```

Do not add logging of observation payloads.

- [ ] **Step 4: Implement canonical scope validation**

Implement exactly:

```python
def resolve_privacy_geography_scope(
    *,
    institution: Institution,
    site: Site | None = None,
    cohort: Cohort | None = None,
) -> PrivacyGeographyScope:
    if institution.pk is None:
        raise PrivacyGeographyError('invalid privacy geography scope')
    if site is not None and site.institution_id != institution.id:
        raise PrivacyGeographyError('site scope mismatch')
    if cohort is not None:
        if site is None:
            raise PrivacyGeographyError('invalid privacy geography scope')
        if cohort.institution_id != institution.id:
            raise PrivacyGeographyError('cohort scope mismatch')
        if cohort.site_id != site.id:
            raise PrivacyGeographyError('cohort scope mismatch')
    return PrivacyGeographyScope(
        institution=institution,
        site=site,
        cohort=cohort,
    )
```

The transformation path must accept only this resolved scope object.

- [ ] **Step 5: Implement privacy-safe validation helpers**

Add helpers:

```python
def _effective_resolution(resolution: int | None) -> int:
    value = settings.RELAY_H3_RESOLUTION if resolution is None else resolution
    if not isinstance(value, int) or not 0 <= value <= 15:
        raise PrivacyGeographyError('invalid H3 resolution')
    return value


def _validate_coordinate(value, *, axis: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise PrivacyGeographyError(f'invalid {axis}') from exc
    if not isfinite(number):
        raise PrivacyGeographyError(f'invalid {axis}')
    if axis == 'latitude' and not -90 <= number <= 90:
        raise PrivacyGeographyError('invalid latitude')
    if axis == 'longitude' and not -180 <= number <= 180:
        raise PrivacyGeographyError('invalid longitude')
    return number
```

Error strings must not include coordinate values.

- [ ] **Step 6: Implement authorization, provenance, scope-assertion, and duplicate checks**

Add a private validator that checks, in this order:

```text
non-empty record_id
geography_authorized is exactly True
provenance_label in ALLOWED_PROVENANCE_LABELS
declared institution_id matches scope.institution.id when present
declared site_id matches scope.site.id when present
declared cohort_id matches scope.cohort.id when present
record_id not already seen in this request
```

Use these exact failure messages:

```text
invalid observation identifier
geography authorization required
unsupported geography provenance
institution scope mismatch
site scope mismatch
cohort scope mismatch
duplicate observation identifier
```

- [ ] **Step 7: Implement H3 conversion without leaking inputs**

Implement:

```python
def transform_observations(
    *,
    scope: PrivacyGeographyScope,
    observations: Iterable[GeographyObservation],
    resolution: int | None = None,
) -> tuple[PrivacyGeographyRecord, ...]:
    if not isinstance(scope, PrivacyGeographyScope):
        raise PrivacyGeographyError('invalid privacy geography scope')

    h3_resolution = _effective_resolution(resolution)
    seen_ids: set[str] = set()
    transformed: list[PrivacyGeographyRecord] = []

    for observation in observations:
        _validate_observation_scope_and_authorization(
            scope=scope,
            observation=observation,
            seen_ids=seen_ids,
        )
        origin_lat = _validate_coordinate(observation.origin_lat, axis='latitude')
        origin_lng = _validate_coordinate(observation.origin_lng, axis='longitude')
        destination_lat = _validate_coordinate(observation.destination_lat, axis='latitude')
        destination_lng = _validate_coordinate(observation.destination_lng, axis='longitude')

        try:
            origin_cell = h3.latlng_to_cell(origin_lat, origin_lng, h3_resolution)
            destination_cell = h3.latlng_to_cell(destination_lat, destination_lng, h3_resolution)
        except Exception as exc:
            raise PrivacyGeographyError('H3 transformation failed') from exc

        transformed.append(
            PrivacyGeographyRecord(
                record_id=observation.record_id,
                institution_id=scope.institution.id,
                site_id=scope.site.id if scope.site else None,
                cohort_id=scope.cohort.id if scope.cohort else None,
                origin_h3_cell=origin_cell,
                destination_h3_cell=destination_cell,
                h3_resolution=h3_resolution,
                transformation_version=TRANSFORMATION_VERSION,
                provenance_label=observation.provenance_label,
            )
        )

    return tuple(sorted(transformed, key=lambda item: item.record_id))
```

Do not use `repr(observation)` in exceptions or logs.

- [ ] **Step 8: Run the focused tests and verify the transformation subset turns GREEN**

Run:

```bash
cd backend
python manage.py test relay.test_privacy_geography -v 2
```

Expected: scope, authorization/provenance, coordinate, deterministic transformation, and duplicate tests PASS; aggregation tests may still fail because `aggregate_corridors` is not yet implemented.

- [ ] **Step 9: Commit the transformation layer**

```bash
git add backend/requirements.txt backend/config/settings.py backend/relay/services/privacy_geography.py backend/relay/test_privacy_geography.py
git commit -m "feat: add H3 privacy geography transformation"
```

---

### Task 3: Add Threshold-Suppressed Corridor Aggregation

**Files:**
- Modify: `backend/relay/services/privacy_geography.py`
- Test: `backend/relay/test_privacy_geography.py`

**Interfaces:**
- Consumes: `PrivacyGeographyScope`, `GeographyObservation`, `transform_observations`.
- Produces: `CorridorAggregate`, `PrivacyGeographyAuditSummary`, `PrivacyGeographyResult`, `aggregate_corridors`.

- [ ] **Step 1: Add aggregate/result dataclasses**

Add:

```python
@dataclass(frozen=True)
class CorridorAggregate:
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    origin_h3_cell: str
    destination_h3_cell: str
    participant_count: int
    h3_resolution: int
    suppression_threshold: int
    transformation_version: str


@dataclass(frozen=True)
class PrivacyGeographyAuditSummary:
    transformation_version: str
    h3_resolution: int
    suppression_threshold: int
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    provenance_labels: tuple[str, ...]
    total_observations: int
    valid_observations: int
    publishable_corridor_count: int
    suppressed_corridor_group_count: int
    suppressed_contributing_observation_count: int


@dataclass(frozen=True)
class PrivacyGeographyResult:
    publishable_corridors: tuple[CorridorAggregate, ...]
    audit_summary: PrivacyGeographyAuditSummary
```

- [ ] **Step 2: Implement threshold validation**

Add:

```python
def _effective_minimum_publishable_count(value: int | None) -> int:
    threshold = (
        settings.RELAY_H3_MIN_PUBLISHABLE_COUNT
        if value is None
        else value
    )
    if not isinstance(threshold, int) or threshold < 1:
        raise PrivacyGeographyError('invalid suppression threshold')
    return threshold
```

The default remains 5. Do not silently coerce an invalid threshold.

- [ ] **Step 3: Implement aggregation from restricted records**

Implement:

```python
def aggregate_corridors(
    *,
    scope: PrivacyGeographyScope,
    observations: Iterable[GeographyObservation],
    resolution: int | None = None,
    minimum_publishable_count: int | None = None,
) -> PrivacyGeographyResult:
    observation_tuple = tuple(observations)
    restricted_records = transform_observations(
        scope=scope,
        observations=observation_tuple,
        resolution=resolution,
    )
    threshold = _effective_minimum_publishable_count(minimum_publishable_count)
    h3_resolution = _effective_resolution(resolution)

    corridor_counts = Counter(
        (record.origin_h3_cell, record.destination_h3_cell)
        for record in restricted_records
    )

    publishable: list[CorridorAggregate] = []
    suppressed_groups = 0
    suppressed_contributors = 0

    for (origin_cell, destination_cell), count in sorted(corridor_counts.items()):
        if count < threshold:
            suppressed_groups += 1
            suppressed_contributors += count
            continue
        publishable.append(
            CorridorAggregate(
                institution_id=scope.institution.id,
                site_id=scope.site.id if scope.site else None,
                cohort_id=scope.cohort.id if scope.cohort else None,
                origin_h3_cell=origin_cell,
                destination_h3_cell=destination_cell,
                participant_count=count,
                h3_resolution=h3_resolution,
                suppression_threshold=threshold,
                transformation_version=TRANSFORMATION_VERSION,
            )
        )

    provenance_labels = tuple(sorted({record.provenance_label for record in restricted_records}))
    audit_summary = PrivacyGeographyAuditSummary(
        transformation_version=TRANSFORMATION_VERSION,
        h3_resolution=h3_resolution,
        suppression_threshold=threshold,
        institution_id=scope.institution.id,
        site_id=scope.site.id if scope.site else None,
        cohort_id=scope.cohort.id if scope.cohort else None,
        provenance_labels=provenance_labels,
        total_observations=len(observation_tuple),
        valid_observations=len(restricted_records),
        publishable_corridor_count=len(publishable),
        suppressed_corridor_group_count=suppressed_groups,
        suppressed_contributing_observation_count=suppressed_contributors,
    )
    return PrivacyGeographyResult(
        publishable_corridors=tuple(publishable),
        audit_summary=audit_summary,
    )
```

The only returned cell identifiers are those belonging to publishable corridors meeting the threshold.

- [ ] **Step 4: Run all H3 privacy-geography tests**

Run:

```bash
cd backend
python manage.py test relay.test_privacy_geography -v 2
```

Expected: PASS.

- [ ] **Step 5: Confirm no model change was introduced**

Run:

```bash
python manage.py makemigrations --check --dry-run
```

Expected: `No changes detected`.

- [ ] **Step 6: Commit aggregation/suppression**

```bash
git add backend/relay/services/privacy_geography.py backend/relay/test_privacy_geography.py
git commit -m "feat: aggregate privacy-safe H3 corridors"
```

---

### Task 4: Prove Existing Relay Rider Contracts Did Not Change

**Files:**
- Test: `backend/relay/test_privacy_geography.py`
- Read only: `backend/relay/test_vertical_slice.py`
- Read only: `backend/relay/services/core_engine.py`
- Read only: `backend/relay/services/exports.py`
- Read only: `backend/relay/models.py`

**Interfaces:**
- Consumes: completed H3 service.
- Produces: explicit non-regression proof that existing canonical persistence, scoring, exports, and Rule 2202 remain unchanged.

- [ ] **Step 1: Add an export leakage test using existing model fixtures**

Extend `PrivacyGeographyTests.setUp` only if necessary to create a minimal `DataSource`/`CommuteImport`/`CommuterRecord` fixture using existing model requirements. Then assert that existing `commuter_records_csv()` output does not contain an H3 cell produced by the service.

The assertion shape must be:

```python
derived = transform_observations(
    scope=self.scope,
    observations=[make_observation('R1')],
)[0]
export_text = commuter_records_csv(self.institution)
self.assertNotIn(derived.origin_h3_cell, export_text)
self.assertNotIn(derived.destination_h3_cell, export_text)
```

Do not modify `exports.py` to make the test pass; the expected result is that the existing export remains unchanged.

- [ ] **Step 2: Add a dashboard leakage test**

Call `dashboard_payload(self.institution)` and assert its serialized representation contains neither derived H3 cell. Again, do not add H3 fields to the dashboard.

- [ ] **Step 3: Re-run the existing Core Engine regression**

Run:

```bash
cd backend
python manage.py test relay.test_vertical_slice.VerticalSliceTestCase.test_core_engine_score_is_explainable_and_non_regulatory -v 2
```

Expected: PASS with the existing R1 score semantics unchanged, including total score `100` and `drive_alone` factor `35`.

- [ ] **Step 4: Run the full backend suite**

Run:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Expected: PASS.

- [ ] **Step 5: Run the frontend non-regression suite**

From repository root:

```bash
npm run check
npm test
npm run build
```

Expected: PASS. No frontend file should need modification.

- [ ] **Step 6: Commit any final test-only non-regression additions**

```bash
git add backend/relay/test_privacy_geography.py
git commit -m "test: prove H3 layer does not alter existing outputs"
```

---

### Task 5: PR, CI, RC2 Reconciliation, and Exact-SHA Release Proof

**Files:**
- Modify only if authoritative RC2 migration sequencing changed: `.github/workflows/ci.yml`
- Otherwise runtime diff should remain limited to the four H3 files listed in File Structure.

**Interfaces:**
- Consumes: completed H3 branch, authoritative RC2 `main`, all repository CI/security jobs.
- Produces: one reviewable H3 PR with RED→GREEN evidence and an exact-SHA post-merge proof.

- [ ] **Step 1: Rebase/update onto the latest authoritative `main` immediately before opening or refreshing the PR**

Run:

```bash
git fetch origin
git rebase origin/main
```

If RC2 introduced migration `0007` or later, do not create an H3 migration. Only update CI migration commands if the authoritative `main` workflow itself requires reconciliation, and keep that change mechanically equivalent to current `main` rather than inventing a new migration sequence.

- [ ] **Step 2: Re-run focused and full local verification after the rebase**

Run:

```bash
cd backend
python manage.py test relay.test_privacy_geography -v 2
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
cd ..
npm run check
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 3: Open the H3 implementation PR targeting `main`**

Use title:

```text
H3 v1: privacy-aware corridor geography foundation
```

PR body must state all of the following facts explicitly:

```text
- Base SHA: <authoritative RC2 main SHA>
- H3 dependency: h3==4.5.0
- No CommuterRecord/model migration
- No raw-coordinate persistence/logging/output
- Individual H3 cells are restricted derived geography
- Publishable corridor threshold default is n >= 5
- No H3 HTTP endpoint
- No Core Engine scoring change
- No Rule 2202 change
- No routing/UI/Charging Intelligence change
- RED evidence: focused test failed before service existed
- GREEN evidence: focused and full suites passed after implementation
```

- [ ] **Step 4: Wait for all PR CI/security jobs and inspect each conclusion**

Required jobs:

```text
Frontend checks, tests, and build
Django tests and migration validation
Canonical PostgreSQL + Rule 2202 vertical slice
Application security checks
dependency-review
CodeQL
Operational hardening gate, if authoritative main includes it for PRs
```

Expected: every applicable required job `completed / success` on the exact H3 PR head SHA.

- [ ] **Step 5: Record the manual merge checklist while required-status enforcement remains off**

Add a PR comment containing:

```text
H3 pre-merge verification
Head SHA: <exact SHA>
RC2 gate: merged/superseded and green on main
H3 focused tests: PASS
Full Django suite: PASS
Django check: PASS
makemigrations --check --dry-run: PASS / no model changes
Migration rollback/reapply gate: PASS on authoritative graph
PostgreSQL + Rule 2202 vertical slice: PASS
Frontend typecheck/tests/build: PASS
Application security: PASS
Dependency review: PASS
CodeQL: PASS
Operational hardening gate: PASS when applicable
```

Do not merge if any line is not proven.

- [ ] **Step 6: Review the final changed-file list before merge**

Expected normal runtime/test diff:

```text
backend/config/settings.py
backend/requirements.txt
backend/relay/services/privacy_geography.py
backend/relay/test_privacy_geography.py
```

If additional runtime files appear, stop and justify each against the approved spec before merge. `backend/relay/models.py`, migrations, Core Engine, exports, frontend, routing, and Charging Intelligence should not be part of the normal H3 diff.

- [ ] **Step 7: Merge only after all gates are green**

Use the repository-supported merge method and expected head SHA protection.

Record the resulting merged `main` SHA.

- [ ] **Step 8: Verify push-triggered `main` CI/security on the exact merged SHA**

Required post-merge proof:

```text
CI: completed / success
Security checks: completed / success
Operational hardening gate: success when push-triggered/applicable
```

Do not call H3 v1 complete until the exact merged SHA passes these checks.

- [ ] **Step 9: Final completion report**

Report:

```text
Merged SHA
H3 dependency/version
H3 resolution default
Suppression threshold default
Changed files
Focused H3 test result
Full backend result
PostgreSQL + Rule 2202 result
Frontend result
Security result
No-migration proof
RC2 sequencing proof
Remaining future work: persisted H3 fields/output promotion require a separate design
```

Do not claim anonymity, guaranteed privacy, route matching, routing, or live corridor activation.

---

## Plan Self-Review Result

- **Spec coverage:** All four audit controls are represented: canonical Django scope authority (Tasks 1–2), machine-enforced authorization/provenance (Tasks 1–2), restricted H3/suppression/differencing-safe output boundary (Tasks 1–4), and RC2/CI merge governance (Tasks 0 and 5).
- **Persistence/scoring guardrails:** Explicit no-model/no-migration and Core Engine/Rule 2202 non-regression gates are included.
- **Privacy leakage coverage:** Raw coordinate error leakage, individual H3 output leakage, suppressed-cell leakage, duplicate double-counting, and cross-tenant mixing are all tested.
- **Placeholder scan:** No `TBD`, `TODO`, or unspecified implementation steps remain.
- **Type consistency:** Function names and dataclass fields are consistent across tasks and match the locked service interface in File Structure.
