# H3 Privacy Geography v1 Design

Date: 2026-09-05  
Baseline: `main` at `6d375157f8f99d1e8915711d190de09a7ecdbe96`  
Status: Audit-amended design, ready for founder final approval before implementation planning

## Purpose

Introduce a narrow, reversible privacy-geography layer for Relay Rider institutional corridor analysis without changing persisted commuter records, Core Engine scoring, Rule 2202 behavior, routing, UI, or Charging Intelligence.

The layer converts explicitly authorized latitude/longitude inputs into coarse H3 cells and aggregates those cells into tenant-scoped corridor counts. Sparse outputs are suppressed before they become publishable institutional corridor intelligence.

This is a disclosure-reduction and spatial-abstraction control. H3 cells, H3 resolution 7, and minimum-count suppression do not guarantee anonymity, privacy, or safety.

## Product boundary

Relay Rider remains an employer-funded commuter coordination and TDM platform. This change supports institutional corridor intelligence by reducing reliance on precise location data before downstream analysis.

This design does not create live routing, live dispatch, ride guarantees, nearest-driver matching, fare logic, payment processing, route activation, or a public marketplace.

## Current-state observations

The current canonical `CommuterRecord` persists human-readable `origin_zone` and `destination_zone` strings. Existing institutional CSV export includes those values. The current Django Core Engine does not use location geometry in its score; it scores intervention opportunity using commute mode, vehicle fuel type, parking difficulty, Access Point willingness, and schedule flexibility.

The canonical hierarchy already exists in Django as `Institution → Site → Cohort`, with `Site.institution`, `Cohort.institution`, and `Cohort.site` relationships. The H3 layer must use that hierarchy as its scope authority rather than trusting arbitrary caller-supplied IDs.

Therefore H3 v1 can be introduced as an isolated service boundary without changing the `CommuterRecord` schema or scoring semantics.

## Chosen approach

Use a service-only H3 foundation in Django/Python.

Do not add `origin_h3` or `destination_h3` database fields in v1. Do not repurpose `origin_zone` or `destination_zone` to hold H3 indexes.

A future schema migration may persist derived H3 cells only after the service contract, privacy policy, authorization model, and aggregation behavior are proven stable.

## Dependency

Use the official Python H3 bindings from `uber/h3-py`.

Pin `h3==4.5.0` in `backend/requirements.txt` for this implementation.

No H3 PostgreSQL extension, PostGIS dependency, routing engine, or additional geospatial service is introduced in this phase.

## Privacy policy defaults

The research-beta defaults are:

- H3 resolution: `7`
- Minimum publishable participant count: `5`
- Suppression policy: any corridor aggregate with fewer than 5 contributing records is excluded from publishable aggregate output
- Tenant boundary: aggregation never combines records across institutions
- Site/cohort boundary: the service operates only within an explicitly resolved canonical scope and may not silently broaden scope
- Exact coordinate retention: the H3 service does not persist, return, or log raw latitude/longitude values
- Individual H3 cells: restricted derived geography; not publishable participant/admin output on their own

Implementation settings:

- `RELAY_H3_RESOLUTION = 7`
- `RELAY_H3_MIN_PUBLISHABLE_COUNT = 5`

Both settings are configurable in Django settings, but the research-beta defaults remain locked to the values above unless deliberately changed and reviewed.

Resolution 7 is a product policy choice for the controlled research beta. It must not be described as intrinsically privacy-safe.

## Control 1: Canonical Django scope authority

Tenant and analysis scope must be resolved from canonical Django relationships before any coordinate transformation occurs.

Conceptual scope object:

```text
PrivacyGeographyScope
  institution = canonical Institution instance
  site        = canonical Site instance or null
  cohort      = canonical Cohort instance or null
```

A resolver may accept identifiers from a trusted application caller, but it must load the corresponding canonical Django objects and validate their relationships before returning a scope.

Required invariants:

```text
if site is present:
    site.institution_id == institution.id

if cohort is present:
    cohort.institution_id == institution.id
    cohort.site_id == site.id
```

A cohort-scoped request therefore requires a site scope. A site or cohort relationship mismatch is a hard error.

The transformation/aggregation functions accept only a resolved `PrivacyGeographyScope`; they must not treat raw caller-supplied institution/site/cohort IDs as authoritative scope.

Observation-level declared scope identifiers, if present for provenance consistency, must match the resolved scope. A mismatch fails the entire request rather than filtering the observation.

This service-layer validation complements existing RBAC and object permissions. It does not replace them.

## Control 2: Machine-enforced geography authorization and provenance

The H3 layer accepts only explicitly authorized geography observations. It must not infer authorization from the presence of coordinates, scrape coordinates from `source_payload`, or geocode free-text zones.

Each observation must carry:

- `geography_authorized = true`
- `provenance_label` in `synthetic`, `reported`, or `imported`
- opaque record identifier sufficient for deterministic duplicate detection within the request
- origin latitude and longitude
- destination latitude and longitude
- optional declared institution/site/cohort identifiers used only as consistency assertions against the resolved scope

`modeled` geography is not accepted as participant-observation geography in H3 v1. Scenario/modeling use requires a separate future contract so modeled locations cannot be mistaken for reported or imported commuter evidence.

For H3 v1 acceptance fixtures, geography observations must be explicitly marked:

```text
geography_authorized = true
provenance_label = synthetic
```

For future reported/imported callers, the application layer is responsible for establishing the authorization basis before constructing an H3 observation. If `geography_authorized` is absent or false, or provenance is unsupported, the H3 request fails closed.

The H3 layer does not persist a new consent record in v1 and does not alter the existing `CommuterRecord.consent_confirmed` contract.

## Input contract

The H3 service receives:

1. a resolved canonical `PrivacyGeographyScope`; and
2. an observation collection satisfying the authorization/provenance contract above.

The service must reject:

- missing or unresolved canonical institution scope
- invalid canonical site/cohort relationships
- `geography_authorized != true`
- unsupported provenance label
- latitude outside `[-90, 90]`
- longitude outside `[-180, 180]`
- NaN or infinite coordinate values
- observation-declared scope inconsistent with the resolved canonical scope
- duplicate opaque record identifiers within the selected analysis scope

Validation errors must not echo raw coordinate values or full input payloads.

## Transformation contract

The geography service converts valid coordinates to H3 cells using the configured resolution.

Conceptual interface:

```text
Canonical PrivacyGeographyScope
        +
Authorized geography observations
        ↓
validate canonical scope + authorization + provenance + coordinate bounds
        ↓
H3 lat/lng → cell
        ↓
Restricted PrivacyGeographyRecord
```

A restricted derived record may contain:

- canonical institution identifier
- canonical site/cohort scope identifiers when applicable
- opaque record identifier
- origin H3 cell
- destination H3 cell
- H3 resolution
- transformation version
- provenance label

It must not contain raw latitude or longitude.

Transformation version for v1: `h3-privacy-geography-v1`.

## Control 3: H3 cells remain restricted derived geography

Individual H3 indexes are still location data. They are not automatically safe because exact coordinates have been removed.

The classification boundary is:

```text
Raw coordinates
    ↓ restricted precise geography

Individual H3 cells
    ↓ restricted derived geography

Aggregate H3 corridor with participant_count >= 5
    ↓ eligible for controlled institutional aggregate use
```

The restricted `PrivacyGeographyRecord` is an internal service value only in v1. It must not be added to participant responses, normal institutional dashboards, commuter-record CSV exports, Decision Cards, or existing API serializers.

No existing output should suddenly display H3 indexes in this phase.

### Differencing protection

Minimum-count suppression alone does not prevent inference from repeated, overlapping queries.

H3 v1 therefore exposes no general-purpose user-controlled aggregation API and no arbitrary interactive cohort slicing. Aggregation is invoked by trusted backend code against a fixed canonical institution/site/cohort scope.

A future external/queryable H3 output must receive a separate privacy design covering differencing controls, minimum cohort stability, query budgets or equivalent disclosure controls before launch.

## Corridor aggregation contract

The service groups restricted derived records within one canonical scope by:

```text
origin_h3_cell → destination_h3_cell
```

A publishable corridor aggregate contains only:

- canonical institution identifier
- canonical site/cohort scope identifiers when applicable
- origin H3 cell
- destination H3 cell
- participant count
- H3 resolution
- suppression threshold
- transformation version

No participant identifier, external ID, raw coordinate, exact address, source payload, or individual provenance object may appear in a publishable corridor aggregate.

### Suppression

If `participant_count < RELAY_H3_MIN_PUBLISHABLE_COUNT`, the corridor is suppressed.

Suppressed corridors are not returned in the publishable aggregate collection.

Suppressed H3 cells, suppressed-group counts, and suppressed-contributor counts are not included in ordinary publishable output. They may exist only in a restricted internal audit summary available to authorized backend/admin operations and test evidence.

The restricted audit summary must never identify the origin/destination H3 cells of suppressed groups.

## Deduplication

Within a single aggregation request, an opaque record identifier may contribute at most once to the selected analysis scope.

A duplicate record identifier is a hard error. The entire aggregation request fails closed with `duplicate observation identifier`; duplicates are never silently filtered, merged, or double-counted.

## Tenant isolation

The service never aggregates across institutions.

Canonical `PrivacyGeographyScope` establishes the expected institution/site/cohort boundary. Every observation must be consistent with it.

A scope mismatch is a hard error, not a filtered-out observation.

Institution A and Institution B may happen to occupy the same H3 cells, but their records and aggregates remain completely separate because aggregation is keyed under the canonical tenant scope before H3 corridor grouping.

## Logging and audit evidence

The service must not log raw latitude/longitude values, raw input payloads, or suppressed-cell identifiers.

Allowed restricted audit metadata is limited to:

- transformation version
- H3 resolution
- suppression threshold
- canonical institution/site/cohort scope identifiers
- provenance labels represented in the request
- total observations considered
- valid observations transformed
- publishable corridor count
- suppressed corridor-group count
- suppressed contributing-observation count

This audit metadata is not ordinary participant/admin publishable output.

If an exception occurs, application logs may record error type and canonical scope metadata, but not coordinate values, H3 cells from suppressed groups, or full input payloads.

## Integration boundary for v1

H3 v1 is a foundation service and test contract only.

It does not change:

- `CommuterRecord` fields
- `origin_zone` / `destination_zone` semantics
- current CSV import contract
- current dashboard payload
- current commuter-record CSV export
- Core Engine weights, factors, explanations, or version
- Rule 2202 input/output behavior
- Decision Card generation
- frontend ranking
- participant UI
- routing or detour calculations
- Access Point logic
- Green Wallet / Charging Intelligence

## Expected implementation units

### `backend/relay/services/privacy_geography.py`

Owns:

- configuration access
- canonical Django scope resolution/validation
- geography authorization/provenance validation
- coordinate validation
- H3 conversion
- restricted derived privacy-geography records
- corridor aggregation
- sparse-group suppression
- restricted safe audit-summary construction

This module must not import or modify Core Engine scoring code.

### `backend/relay/test_privacy_geography.py`

Owns focused service tests for the contract in this document.

Existing vertical-slice and acceptance suites remain unchanged except for dependency installation and minimal non-regression assertions.

### `backend/requirements.txt`

Adds `h3==4.5.0`.

### `backend/config/settings.py`

Adds the two configuration defaults:

```text
RELAY_H3_RESOLUTION = 7
RELAY_H3_MIN_PUBLISHABLE_COUNT = 5
```

No Django model migration should be generated by H3 v1.

## Error handling

The service fails closed for invalid canonical scope, missing authorization, unsupported provenance, invalid coordinates, duplicate identifiers, or malformed observations.

Errors are deterministic and privacy-safe. They identify the field/category of failure without embedding sensitive values.

Examples:

- `invalid privacy geography scope`
- `institution scope mismatch`
- `site scope mismatch`
- `cohort scope mismatch`
- `geography authorization required`
- `unsupported geography provenance`
- `invalid latitude`
- `invalid longitude`
- `duplicate observation identifier`

H3-library exceptions must be caught at the service boundary and converted into Relay Rider-owned error types/messages that do not expose input values.

## Testing requirements

Implementation must use RED → GREEN TDD evidence.

Required tests:

1. Same valid coordinates and resolution always produce the same H3 cell.
2. Resolution is configurable and recorded in restricted derived output.
3. Invalid latitude/longitude, NaN, and infinity fail closed.
4. Validation errors do not contain raw coordinate values.
5. Restricted derived records contain no raw latitude/longitude fields.
6. Scope resolver rejects a `Site` belonging to another institution.
7. Scope resolver rejects a `Cohort` belonging to another institution.
8. Scope resolver rejects a `Cohort` whose site differs from the resolved site.
9. Transformation functions require a resolved canonical scope rather than trusting raw observation IDs.
10. Missing/false `geography_authorized` fails closed.
11. Unsupported or `modeled` provenance fails closed.
12. Synthetic acceptance observations require `geography_authorized=true` and `provenance_label=synthetic`.
13. Observation-declared institution mismatch fails the complete request.
14. Observation-declared site mismatch fails the complete request.
15. Observation-declared cohort mismatch fails the complete request.
16. Duplicate record identifiers fail the complete request and cannot double-count.
17. Five compatible observations publish one corridor at the default threshold.
18. Four compatible observations suppress the corridor.
19. Ordinary publishable output contains no suppressed-group count, suppressed-contributor count, or suppressed H3 cells.
20. Restricted internal audit summary may contain aggregate suppression counts but never suppressed H3 cells.
21. Individual restricted H3 records are not emitted through existing dashboard/export contracts.
22. Multiple publishable corridors aggregate independently.
23. Institution A and Institution B can use the same H3 cell without data mixing.
24. Existing `CommuterRecord` schema remains unchanged.
25. `python manage.py makemigrations --check --dry-run` reports no model changes.
26. Existing Core Engine score regression remains unchanged.
27. Existing institutional PostgreSQL + Rule 2202 vertical slice remains green.
28. Existing frontend checks/build remain green.
29. Existing security checks remain green.

## Control 4: RC2 sequencing and merge governance

H3 implementation must not leapfrog the Operational Research Beta v1 RC2 identity/review hardening boundary.

Before the H3 implementation PR may merge, one of the following must be true:

1. PR #63 (or its canonical successor) has merged into `main`, and the H3 branch has been rebased/updated onto that authoritative `main`; or
2. PR #63 has been closed as superseded, and equivalent ownership/review/deployment-hardening controls are demonstrably present on `main`.

The H3 PR must not resolve or weaken RC2 identity, authorization, Decision Card review, or deployment-credential controls as part of its own scope.

### CI enforcement reality

At design time, `main` is marked protected but GitHub required-status-check enforcement is not configured with required contexts. Therefore the H3 merge gate cannot rely solely on branch-protection automation.

Until required status checks are actually enforced, the H3 PR must include a recorded manual verification checklist showing the exact head SHA and successful results for every required CI/security job before merge.

Required proof includes:

- full Django backend suite
- Django system check
- no missing migrations
- existing migration rollback/reapply gate, updated to the authoritative migration graph after RC2
- canonical PostgreSQL + Rule 2202 vertical slice
- H3 privacy-geography tests
- frontend typecheck/tests/build
- application security checks
- dependency review
- CodeQL

The exact merged SHA must then pass push-triggered `main` CI and security workflows before the H3 step is called complete.

If branch protection is updated to enforce these required checks before H3 merges, that automated enforcement may replace the manual pre-merge checklist, but the post-merge exact-SHA verification still remains required.

## Non-goals

Explicitly excluded from H3 Privacy Geography v1:

- geocoding addresses or free-text zones
- collecting precise participant addresses
- persisting raw coordinates
- persisting H3 fields on `CommuterRecord`
- publishing individual H3 cells
- a general-purpose H3 query API
- arbitrary interactive geographic cohort slicing
- PostGIS
- H3 PostgreSQL extensions
- Valhalla or OSRM
- route geometry
- detour calculations
- match activation
- changes to Core Engine scoring
- changes to Rule 2202 calculations
- maps or new UI
- Charging Intelligence
- payments or automated incentives
- claims that H3 provides anonymity or guarantees privacy

## Future promotion criteria

Persisted H3 fields, queryable H3 APIs, or H3-backed institutional outputs may be considered only after v1 demonstrates:

- deterministic transformation behavior
- privacy-safe errors/logging
- canonical tenant/scope isolation
- machine-enforced authorization/provenance checks
- effective sparse-group suppression
- restricted handling of individual H3 cells
- stable resolution/threshold policy
- no regression to current institutional proof chain

Any queryable or interactive geography output must also receive a separate privacy design addressing differencing risk before launch.

A future persistence promotion must receive its own design and migration review.

## Success criterion

H3 Privacy Geography v1 is successful when Relay Rider can take an explicitly authorized synthetic/test geography observation set, resolve its tenant/site/cohort boundary from canonical Django relationships, transform coordinates into restricted H3 geography, suppress corridor groups below five contributors, expose only eligible tenant-scoped aggregate corridors, reveal no raw coordinates or suppressed-cell identifiers in publishable output/errors/logs, and do so without changing current `CommuterRecord`, scoring, Rule 2202, dashboard/export, UI, or routing behavior.
