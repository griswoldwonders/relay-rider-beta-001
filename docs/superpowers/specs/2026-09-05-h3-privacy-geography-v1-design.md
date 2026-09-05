# H3 Privacy Geography v1 Design

Date: 2026-09-05  
Baseline: `main` at `6d375157f8f99d1e8915711d190de09a7ecdbe96`  
Status: Founder-approved design, awaiting written-spec review before implementation planning

## Purpose

Introduce a narrow, reversible privacy-geography layer for Relay Rider institutional corridor analysis without changing persisted commuter records, Core Engine scoring, Rule 2202 behavior, routing, UI, or Charging Intelligence.

The layer converts explicitly approved latitude/longitude inputs into coarse H3 cells and aggregates those cells into tenant-scoped corridor counts. It suppresses sparse outputs before they can be used by institutional corridor intelligence.

This is a disclosure-reduction and spatial-abstraction control. H3 cells and minimum-count suppression do not guarantee anonymity or safety.

## Product boundary

Relay Rider remains an employer-funded commuter coordination and TDM platform. This change supports institutional corridor intelligence by reducing reliance on precise location data before downstream analysis.

This design does not create live routing, live dispatch, ride guarantees, nearest-driver matching, fare logic, payment processing, route activation, or a public marketplace.

## Current-state observations

The current canonical `CommuterRecord` persists human-readable `origin_zone` and `destination_zone` strings. Existing institutional CSV export includes those values. The current Django Core Engine does not use location geometry in its score; it scores intervention opportunity using commute mode, vehicle fuel type, parking difficulty, Access Point willingness, and schedule flexibility.

Therefore H3 v1 can be introduced as an isolated service boundary without changing the `CommuterRecord` schema or scoring semantics.

## Chosen approach

Use a service-only H3 foundation in Django/Python.

Do not add `origin_h3` or `destination_h3` database fields in v1. Do not repurpose `origin_zone` or `destination_zone` to hold H3 indexes.

A future schema migration may persist derived H3 cells only after the service contract, privacy policy, and aggregation behavior are proven stable.

## Dependency

Use the official Python H3 bindings from `uber/h3-py`.

Pin `h3==4.5.0` in `backend/requirements.txt` for this implementation.

No H3 PostgreSQL extension, PostGIS dependency, routing engine, or additional geospatial service is introduced in this phase.

## Privacy policy defaults

The research-beta defaults are:

- H3 resolution: `7`
- Minimum publishable participant count: `5`
- Suppression policy: any cell or corridor aggregate with fewer than 5 contributing records is excluded from aggregate output
- Tenant boundary: aggregation never combines records across institutions
- Site/cohort boundary: callers must explicitly choose whether aggregation is institution-wide, site-scoped, or cohort-scoped; the service may not silently broaden scope
- Exact coordinate retention: the H3 service does not persist, return, or log raw latitude/longitude values

Both resolution and suppression threshold must be configurable in Django settings, but production/research-beta defaults remain locked to the values above unless deliberately changed and reviewed.

## Input contract

The H3 layer accepts only explicit, already-authorized geography observations. It does not geocode addresses, infer coordinates from free-text zones, or scrape locations from `source_payload`.

Each observation must include:

- institution identifier
- optional site identifier
- optional cohort identifier
- opaque record identifier sufficient for deterministic counting/deduplication within the request
- origin latitude and longitude
- destination latitude and longitude

The layer must reject:

- missing tenant identity
- latitude outside `[-90, 90]`
- longitude outside `[-180, 180]`
- NaN or infinite coordinate values
- mixed-tenant observation sets when a single tenant scope is expected
- site/cohort observations inconsistent with the requested aggregation scope

Validation errors must not echo raw coordinate values.

## Transformation contract

The geography service converts valid coordinates to H3 cells using the configured resolution.

Conceptual interface:

```text
Approved geography observation
        ↓
validate tenant + coordinate bounds
        ↓
H3 lat/lng → cell
        ↓
PrivacyGeographyRecord
```

A derived record may contain:

- institution identifier
- site/cohort scope identifiers when applicable
- opaque record identifier
- origin H3 cell
- destination H3 cell
- H3 resolution
- transformation version

It must not contain raw latitude or longitude.

Transformation version for v1: `h3-privacy-geography-v1`.

## Corridor aggregation contract

The service groups derived records by tenant scope and by:

```text
origin_h3_cell → destination_h3_cell
```

Each aggregate contains only derived/aggregate fields:

- institution identifier
- optional site/cohort scope identifiers
- origin H3 cell
- destination H3 cell
- participant count
- H3 resolution
- suppression threshold
- transformation version
- suppression status

No participant identifier, external ID, raw coordinate, exact address, or source payload may appear in a publishable corridor aggregate.

### Suppression

If `participant_count < minimum_publishable_count`, the corridor is suppressed.

Suppressed corridors are not returned in the normal publishable aggregate collection. A separate aggregate-level summary may report only the number of suppressed groups and number of suppressed contributing observations. It must not identify their H3 cells.

This prevents sparse cells from being exposed merely because a caller asks for aggregation metadata.

## Deduplication

Within a single aggregation request, an opaque record identifier may contribute at most once to the selected analysis scope.

A duplicate record identifier is a hard error. The entire aggregation request fails closed with `duplicate observation identifier`; duplicates are never silently filtered, merged, or double-counted.

## Tenant isolation

The service never aggregates across institutions.

A caller supplies an expected institution scope. Every observation must match it. A mismatch is a hard error, not a filtered-out record.

For site- or cohort-scoped aggregation, the same fail-closed rule applies to the selected scope.

This service-layer check complements existing Django RBAC and tenant isolation. It does not replace them.

## Logging and audit evidence

The service must not log raw latitude/longitude values.

Allowed audit metadata is limited to:

- transformation version
- H3 resolution
- suppression threshold
- expected institution/site/cohort scope identifiers
- total observations considered
- valid observations transformed
- publishable corridor count
- suppressed corridor-group count
- suppressed contributing-observation count

If an exception occurs, application logs may record error type and scope metadata, but not coordinate values or full input payloads.

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

No existing output should suddenly display H3 indexes in this phase.

## Expected implementation units

### `backend/relay/services/privacy_geography.py`

Owns:

- configuration access
- coordinate validation
- H3 conversion
- tenant/scope validation
- derived privacy-geography records
- corridor aggregation
- sparse-group suppression
- safe audit-summary construction

This module must not import or modify Core Engine scoring code.

### `backend/relay/test_privacy_geography.py`

Owns focused service tests for the contract in this document.

Existing vertical-slice and acceptance suites remain unchanged except for dependency installation and any minimal import needed to verify non-regression.

### `backend/requirements.txt`

Adds `h3==4.5.0`.

No Django migration should be generated.

## Error handling

The service fails closed for invalid scope, invalid coordinates, duplicate identifiers, or malformed observations.

Errors are deterministic and privacy-safe. They identify the field/category of failure without embedding sensitive values.

Examples:

- `invalid latitude`
- `invalid longitude`
- `institution scope mismatch`
- `site scope mismatch`
- `cohort scope mismatch`
- `duplicate observation identifier`

H3-library exceptions must be caught at the service boundary and converted into Relay Rider-owned error types/messages that do not expose input values.

## Testing requirements

Implementation must use RED → GREEN TDD evidence.

Required tests:

1. Same valid coordinates and resolution always produce the same H3 cell.
2. Resolution is configurable and recorded in derived output.
3. Invalid latitude/longitude, NaN, and infinity fail closed.
4. Validation errors do not contain raw coordinate values.
5. Derived records contain no raw latitude/longitude fields.
6. Mixed-institution observations fail closed.
7. Site-scope mismatch fails closed.
8. Cohort-scope mismatch fails closed.
9. Duplicate record identifiers fail the complete request and cannot double-count.
10. Five compatible observations publish one corridor at the default threshold.
11. Four compatible observations suppress the corridor.
12. Suppression summary does not reveal suppressed H3 cells.
13. Multiple publishable corridors aggregate independently.
14. Institution A and Institution B can use the same H3 cell without data mixing.
15. Existing `CommuterRecord` schema remains unchanged.
16. `python manage.py makemigrations --check --dry-run` reports no model changes.
17. Existing Core Engine score regression remains unchanged.
18. Existing institutional PostgreSQL + Rule 2202 vertical slice remains green.
19. Existing frontend checks/build remain green.
20. Existing security checks remain green.

## CI and merge gate

The implementation PR must target current `main` and may merge only when all existing CI/security jobs plus the new H3 privacy-geography tests pass.

Required proof includes:

- full Django backend suite
- Django system check
- no missing migrations
- existing migration rollback/reapply gate
- canonical PostgreSQL + Rule 2202 vertical slice
- frontend typecheck/tests/build
- application security checks
- dependency review
- CodeQL

The exact merged SHA must then pass push-triggered `main` CI and security workflows before the H3 step is called complete.

## Non-goals

Explicitly excluded from H3 Privacy Geography v1:

- geocoding addresses or free-text zones
- collecting precise participant addresses
- persisting raw coordinates
- persisting H3 fields on `CommuterRecord`
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

Persisted H3 fields or H3-backed institutional outputs may be considered only after v1 demonstrates:

- deterministic transformation behavior
- privacy-safe errors/logging
- reliable tenant/scope isolation
- effective sparse-group suppression
- stable resolution/threshold policy
- no regression to current institutional proof chain

A future promotion must receive its own design and migration review.

## Success criterion

H3 Privacy Geography v1 is successful when Relay Rider can take an explicitly approved synthetic/test geography observation set, transform it into tenant-scoped H3 corridor aggregates, suppress groups below five contributors, expose no raw coordinates in derived outputs/errors/audit summaries, and do so without changing current `CommuterRecord`, scoring, Rule 2202, dashboard/export, UI, or routing behavior.
