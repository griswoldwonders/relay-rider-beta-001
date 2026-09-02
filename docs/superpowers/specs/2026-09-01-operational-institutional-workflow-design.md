# Relay Rider Operational Institutional Workflow — Design

## Status
Approved architecture for development-branch implementation only. No production-data mutation, production Supabase DDL, live rides, payments, incentives, messaging, regulatory submissions, or claims of deployed Rule 2202 functionality are authorized by this design.

## Goal
Make Relay Rider operational, not feature-complete: an authenticated institutional administrator can import a synthetic commuter CSV and receive a reproducible, evidence-linked Decision Card and exportable report without developer intervention.

## Acceptance Criterion
From a clean development environment, an institutional administrator can:
1. authenticate;
2. operate only within an institution they are authorized to administer;
3. select/create an Institution → Site → Cohort context;
4. upload a synthetic commuter CSV;
5. receive deterministic row-level validation and provenance results;
6. create canonical commuter records only from accepted rows;
7. run a versioned Core Relay Rider analysis;
8. optionally run Rule 2202 calculations only when the Rule 2202 migration-state gate is explicitly satisfied;
9. inspect evidence-linked results and a Decision Card;
10. export a deterministic report without shell or database intervention.

The same accepted input dataset, canonicalization version, analysis version, and configuration must yield the same substantive metrics and reproducibility fingerprint.

## Canonical Persistence Decision
Django/Postgres is the canonical application persistence owner for the institutional operating workflow in this slice.

The existing `supabase/migrations` directory is treated as an isolated migration/calculation track until the known remote/local migration-history discrepancy is reconciled. No duplicate Institution/Site/Cohort/import/analysis/Decision Card domain tables are to be created in Supabase for this slice.

Supabase Rule 2202 SQL may be invoked only through an adapter after an explicit migration-state readiness check. Until then, the ordinary Relay Rider assessment workflow remains available and reports Rule 2202 as unavailable rather than failing the entire assessment.

## Migration-State Gate
Known condition: remote Supabase history contains approximately 30 applied migrations absent from the current local checkout. This is a release blocker for new Supabase DDL and for claiming Rule 2202 is deployed.

The application must represent Rule 2202 readiness as an explicit state, not an assumption:
- `unverified`: migration history has not been reconciled;
- `verified`: authoritative local history and intended remote history have been reconciled and independently checked;
- `disabled`: operator has intentionally disabled Rule 2202 execution.

Only `verified` permits execution against a Supabase-backed Rule 2202 adapter. No code in this slice repairs remote migration history.

## Domain Model
### Existing reused entities
- `Institution`
- `Membership`
- authenticated Django user

### New institutional hierarchy
- `Site`: belongs to one Institution; represents one worksite/campus/facility.
- `Cohort`: belongs to one Institution and one Site; defines the participant population included in an assessment.

### Ingestion and provenance
- `ImportBatch`: institution/site/cohort, uploader, original filename, SHA-256 file digest, schema version, import status, timestamps, row totals, accepted/rejected counts.
- `ImportRow`: immutable normalized representation of each submitted row plus row number, raw payload, validation status, error codes, warning codes, and source linkage.
- `CanonicalCommuterRecord`: accepted canonical representation linked to its `ImportRow`; stores only fields needed for institutional assessment.

Canonical records use approximate geography first and must not require a precise residential address. A minimum record may include opaque participant identifier, origin zone, destination/worksite zone, commute days, arrival/departure windows, flexibility, current mode, gasoline-SOV/vehicle classification where supplied, commute distance/time where supplied, parking difficulty, EV/hybrid signal, and evidence linkage.

## Validation Rules
Validation is deterministic and versioned. It must identify at minimum:
- missing required values;
- malformed or unsupported geography values;
- impossible or inverted time windows;
- duplicate participant rows according to the declared import key;
- inconsistent commute-mode and vehicle classifications;
- invalid numeric distance/time values;
- records excluded from a calculation, with explicit exclusion reasons.

Rejected rows never create canonical commuter records. Re-imports create new ImportBatch records and never mutate the original batch evidence.

## Core Relay Rider Analysis
Core analysis is a durable, versioned backend execution layer, not frontend ranking state.

`AnalysisRun` stores institution/site/cohort, source ImportBatch, canonical dataset fingerprint, engine version, configuration version, code/version identifier, start/end timestamps, status, and reproducibility fingerprint.

`AnalysisMetric` stores one output metric with:
- metric key;
- evidence class (`observed`, `calculated`, `modeled`);
- raw/source references;
- transformation/method identifier;
- value and unit;
- confidence/caveat text;
- privacy treatment;
- partner-facing wording.

The first operational analysis is intentionally narrow:
- data-quality and exclusion counts;
- commute mode distribution;
- gasoline-SOV opportunity counts;
- origin-zone/worksite corridor concentration;
- schedule/time-window clusters;
- parking-pressure signals;
- EV/hybrid participation/supply signals where present;
- corridor opportunity findings labeled as modeled where assumptions are used.

No guaranteed ride, route activation, payment, incentive issuance, or transportation outcome is generated.

## Optional Rule 2202 Run
`Rule2202Run` is a governed calculation lifecycle linked to an `AnalysisRun`.

It records readiness state, function-set version, inputs, outputs, exclusions, execution timestamps, errors, and evidence linkage. It is an assessment/calculation artifact only; it is not regulatory certification, compliance approval, or a regulatory submission.

When readiness is not `verified`, the administrator sees an explicit unavailable state and can still complete the ordinary Relay Rider analysis and report.

## Decision Card
`DecisionCard` is persisted and linked to one `AnalysisRun`.

It contains:
- institution/site/cohort context;
- the institutional decision question;
- evidence summary;
- key observed/calculated/modeled findings;
- recommended administrative action or next investigation;
- caveats and unsupported-claim suppression;
- evidence references;
- analysis reproducibility fingerprint;
- generation version and timestamp.

Decision Cards must distinguish observed facts from calculated and modeled findings. Unsupported claims are not rendered as findings.

## Report Export
`ReportArtifact` is immutable metadata for an exported report. It stores analysis run, Decision Card, export format, generation version, SHA-256 artifact digest, generated timestamp, and source/evidence manifest.

Initial export may be JSON plus a human-readable HTML or PDF-compatible representation, but the acceptance criterion requires at least one deterministic downloadable report format generated from persisted analysis data without developer intervention.

## Authorization and Tenant Isolation
All new tenant-scoped entities must carry institution ownership either directly or through an invariant that is enforced at the database/model boundary.

Institution administrators may create/read/run/export only within institutions represented by their authorized Membership. Cross-institution access must return no data or a permission denial; object IDs must never bypass tenant filtering.

Platform-admin behavior remains explicit and separately tested. Null-institution application records are not permitted for new workflow entities.

## Minimal Administrator Interface
UI work follows the persistence, validation, engine, and authorization layers. The minimum UI needs only:
- authenticated admin entry;
- site/cohort context selection;
- CSV upload;
- validation summary and row issues;
- run-analysis action;
- Rule 2202 readiness/status display;
- Decision Card view;
- report export.

No nonfunctional control may appear operational.

## Failure Behavior
- Invalid CSV: batch persists with errors; no canonical records created for rejected rows.
- Partial-valid CSV: accepted rows may canonicalize only if the import policy explicitly permits partial acceptance; rejected rows remain evidence-linked.
- Analysis failure: `AnalysisRun` records failure and error metadata; source and canonical records remain unchanged.
- Rule 2202 unavailable/failure: ordinary Core Relay Rider results remain available.
- Export failure: persisted analysis/Decision Card remain available; artifact is not marked generated.
- Cross-tenant request: denied without revealing protected object contents.

## Verification Requirements
Implementation must prove:
- deterministic validation;
- import provenance and SHA-256 source identity;
- rejected rows do not become canonical records;
- tenant isolation across at least two institutions;
- institution-admin authorization boundaries;
- reproducible analysis fingerprints;
- evidence-class labeling;
- Decision Card evidence linkage;
- deterministic report artifact generation;
- Rule 2202 gating when migration state is unverified;
- no production schema/data mutation.

## Explicit Non-Goals
- live transportation operations;
- nearest-driver or dispatch functionality;
- payments, fares, bids, earnings, incentive redemption/issuance;
- participant messaging;
- production-data migration or mutation;
- automated Supabase migration repair;
- regulatory filing/submission;
- claiming Rule 2202 compliance/certification;
- full TDM suite or feature-complete commuter marketplace.
