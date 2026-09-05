# Green Route Credit Lifecycle v1 — Architecture Design

**Status:** Approved design; not yet implemented  
**Date:** 2026-09-04  
**Repository baseline:** `main` at `b5b631475dc799d11b0004d7cb80be2420c17a02`  
**Product state:** Research beta / controlled beta  

## 1. Purpose

Green Wallet v1 is the governed institutional mobility-benefit layer for Relay Rider. It converts approved participation evidence into auditable Green Route Credit issuance, exposes a canonical participant wallet balance, and supports institution-reviewed redemption against approved mobility benefits.

Green Route Credits are program-defined participation-benefit units. They are not cash, wages, fares, guaranteed payments, charging reimbursements, certified carbon credits, utility credits, or automatic payment instruments.

Green Wallet v1 is **not charging-only**. EV charging is one eligible benefit category. Transit, Access Point, clean-commute, and other institution-approved mobility benefits may use the same lifecycle without changing the accounting model.

This design does not add live charging-network settlement, automatic charging payments, ChargingStation/EVSE/ChargingSession domains, or unrestricted marketplace behavior.

## 2. Current-state baseline

The current merged code already contains:

- `Institution`, `Membership`, and tenant-scoped authorization;
- `Profile`, but no authenticated `User -> Profile` ownership link;
- `GreenRouteCredit` with explicit `amount_units`, `unit_label`, and `issued|redeemed|expired` status;
- `ProgramBenefitPolicy` scaffolding with version, caps, expiry, descriptive eligibility/earning text, effective dates, and status;
- `RedemptionRequest` with `requested -> under-review -> fulfilled|denied` lifecycle;
- immutable-at-application-layer `WalletLedgerEntry` events supporting `ISSUE`, `HOLD`, `RELEASE`, `DEBIT`, `REVERSAL`, `EXPIRE`, and `ADJUSTMENT`;
- transactional redemption creation with credit row locking and overcommit prevention;
- `HOLD` creation on redemption submission;
- `DEBIT` on fulfillment and `RELEASE` on denial;
- participant-facing wallet UI that still derives balances locally from credit/request statuses;
- a charging-specific redemption flow tied to one `GreenRouteCredit` and one `ChargingHub`.

The current Green Wallet API contract remains runtime truth until this v1 design is implemented and accepted. This design supersedes prior open design questions only as a target architecture; it does not claim the target capabilities are live.

The current Django settings are local-development settings using SQLite, `DEBUG=True`, localhost-only hosts, and a development secret. The repository security architecture also states that the current application does not yet have a production identity provider or production participant-login boundary. Green Wallet Lifecycle v1 therefore must not be described as production-operational merely because the domain model is implemented.

## 3. Approved product decisions

The following decisions are locked for Lifecycle v1:

1. Green Wallet is a **general institutional mobility-benefit wallet**.
2. Common Pathways controls the permitted rule framework; an authorized institution administrator activates institution-specific policy configuration inside that framework.
3. V1 issuance is **evidence-backed, deterministically calculated, and administratively approved**.
4. Later automatic issuance may be enabled selectively per mature policy; it is out of scope for v1.
5. V1 evidence may come from Relay Rider native evidence, authorized imports, or administrator attestation. Live third-party evidence integrations are deferred.
6. `Profile.user` is nullable for imported/unclaimed profiles and becomes the authenticated participant binding once claimed.
7. Every post-v1 issuance must carry policy-version and evidence provenance.
8. Redemption targets a general institution-approved `ProgramBenefit`; `ChargingHub` is optional EV-specific metadata, not the core redemption target.
9. The immutable ledger plus a server-side projection is the authoritative wallet-accounting source.
10. Individual issuance buckets remain auditable while the participant sees one unified balance.
11. Redemption allocation uses oldest-expiring eligible issuance buckets first.
12. Expiration is automatic and ledger-driven. A valid hold created before expiry remains protected while the request is under review.
13. Redemption idempotency is mandatory and client-generated.
14. Rule evaluation uses platform-defined deterministic rule types with institution-configurable parameters; institutions cannot supply executable formulas.
15. `institution_admin` alone may approve issuance.
16. `program_staff` may triage a redemption and move it to `under-review`; `institution_admin` alone may fulfill or deny it.
17. Redemption fulfillment is all-or-nothing per request.
18. Program-wide and participant issuance caps are enforced atomically at issuance.
19. Finite ProgramBenefit capacity is reserved when a valid redemption request is created, consumed on fulfillment, and released on denial.

## 4. Target architecture

```text
Platform-approved rule framework
            ↓
Institution ProgramBenefitPolicy
            ↓
QualifyingEvidence[]
            ↓
Deterministic policy evaluation
            ↓
IssuanceDecision
            ↓
institution_admin approval
            ↓
GreenRouteCredit issuance bucket
            ↓
ISSUE ledger event
            ↓
┌──────────────────────────────────────────┐
│ Unified Green Wallet server projection   │
│ available / held / fulfilled / expired   │
└──────────────────────────────────────────┘
            ↓
Participant selects ProgramBenefit
            ↓
RedemptionRequest + idempotency UUID
            ↓
RedemptionAllocation[]
(oldest-expiring eligible buckets first)
            ↓
HOLD ledger events
+ finite benefit-capacity reservation
            ↓
program_staff review
            ↓
institution_admin terminal decision
       ┌──────────┴──────────┐
       ↓                     ↓
   fulfilled               denied
       ↓                     ↓
 DEBIT events          RELEASE events
 consume benefit       release benefit
 reservation           reservation
```

## 5. Identity and authorization model

### 5.1 Profile ownership

Add nullable `Profile.user -> AUTH_USER_MODEL` using `SET_NULL` so imported commuter records may exist before account claim and audit provenance can survive account deletion/de-identification.

Enforce at most one claimed profile per `(user, institution)` with a conditional unique constraint where `user IS NOT NULL`.

### 5.2 Participant authorization

Do not use the administrative `viewer` role as a commuter identity.

Add `participant` as a valid `Membership.role` for participant-only users. A participant-only user has:

- one tenant membership with `role=participant`;
- one claimed Profile linked to the same user and institution.

Participant self-service authority is derived from the claimed Profile, not merely from the membership role. This allows an `institution_admin` or `program_staff` member who also has a claimed Profile to use participant self-service without requiring multiple Membership rows for the same `(user, institution)`.

For any participant-facing wallet or redemption action, the server resolves:

`authenticated user + institution -> claimed Profile`

The client does not submit an arbitrary Profile ID to establish ownership.

### 5.3 Administrative role boundaries

- `participant`: own wallet, own eligible benefits, own redemption requests.
- `viewer`: permitted administrative read-only surfaces only; no participant authority and no approval authority.
- `program_staff`: evidence preparation/review, issuance recommendation, redemption triage, `requested -> under-review`.
- `institution_admin`: institution policy activation, issuance approval, redemption fulfillment/denial.
- `platform_admin`: platform framework governance and exceptional oversight, always audit-traced.

## 6. Policy framework

### 6.1 Platform rule registry

V1 uses a code-owned rule registry. Institutions cannot upload arbitrary formulas or executable policy code.

The initial v1 rule type is:

`verified_participation`

It evaluates approved evidence records and deterministically calculates eligible Green Route Credit units.

Future rule types must be added through reviewed platform code and tests.

### 6.2 ProgramBenefitPolicy

Extend `ProgramBenefitPolicy` with:

- `framework_version` — identifies the Common Pathways rule framework version;
- `rule_type` — one platform-approved rule identifier;
- `parameters` — validated JSON matching the schema for the selected rule type;
- activation metadata such as `activated_by` and `activated_at`;
- existing participant/program caps, expiry, effective dates, status, unit label, and evidence label.

For an active v1 `verified_participation` policy, required validated configuration includes:

- positive `units_per_qualifying_event`;
- allowed evidence-source types;
- positive participant issuance cap;
- positive program-wide issuance cap;
- positive expiry period;
- bounded effective start/end dates;
- optional eligible cohort identifiers.

No default numerical award, cap, or expiry value is defined by this architecture. Each institution configures those values inside the platform validation envelope.

Only `institution_admin` or `platform_admin` may activate a policy. Activation fails if any required parameter is absent, inconsistent, outside the approved schema, or if the effective period is invalid.

For v1, an institution has at most one active Green Wallet issuance policy at a time. Multiple `ProgramBenefit` records may exist under that wallet program.

## 7. Evidence and issuance provenance

### 7.1 QualifyingEvidence

Add `QualifyingEvidence` with at least:

- `institution`;
- `profile`;
- `source_type`: `relay_rider | authorized_import | admin_attestation`;
- `source_reference`;
- `evidence_label`: `synthetic | modeled | verified`;
- `observed_at`;
- minimal structured provenance metadata;
- creation actor/time.

`source_reference` must be unique within an institution/source type when present so an import retry does not silently create duplicate evidence.

Evidence records used by a decided issuance are not edited in place. Corrections create a superseding evidence record or a governed correction path.

### 7.2 IssuanceDecision

Add `IssuanceDecision` with:

- `institution`;
- `profile`;
- exact `ProgramBenefitPolicy` version;
- `status`: `evaluated | approved | denied`;
- deterministic `calculated_units`;
- evaluation metadata sufficient to explain the result without storing sensitive free-form commuter data;
- `evaluated_at`;
- `approved_by` / `approved_at` when approved;
- denial metadata when denied;
- correlation identifier.

Add `IssuanceDecisionEvidence` as an explicit link table so one decision may rely on one or more evidence records.

A single IssuanceDecision may produce at most one GreenRouteCredit. Repeated approval of an already-approved decision is idempotent and returns the existing issuance rather than creating another credit.

### 7.3 Issuance transaction

`IssuanceService` is the only normal application writer for new post-v1 GreenRouteCredit records.

Within one database transaction it must:

1. authenticate and authorize the actor;
2. row-lock the active policy/cap boundary required for safe concurrent issuance;
3. resolve the participant Profile;
4. verify evidence belongs to the same institution/profile and is allowed by policy;
5. run deterministic policy evaluation;
6. enforce effective dates;
7. enforce participant issuance cap;
8. enforce program-wide issuance cap;
9. approve the IssuanceDecision only for `institution_admin`/`platform_admin`;
10. create the GreenRouteCredit issuance bucket;
11. derive `expires_at` from the policy;
12. write exactly one corresponding `ISSUE` WalletLedgerEntry;
13. commit all state atomically.

If any step fails, no credit, ISSUE event, or consumed cap capacity is left behind.

Direct normal creation of GreenRouteCredit through public APIs or unrestricted Django Admin must be disabled once the issuance service becomes canonical. Historical/migration tooling must be clearly separated from normal issuance.

## 8. GreenRouteCredit issuance buckets

Each post-v1 GreenRouteCredit remains an auditable issuance bucket and must reference:

- institution;
- participant Profile;
- exact ProgramBenefitPolicy version;
- approved IssuanceDecision;
- amount units;
- unit label;
- issued time;
- `expires_at`;
- optional existing corridor/impact evidence fields.

Mileage and CO2 estimates remain impact evidence only and never determine Green Route Credit quantity unless an approved future rule explicitly does so.

`GreenRouteCredit.status` may remain during migration for compatibility, but it is not the authoritative wallet balance source. Any eventual status projection must be derived consistently from ledger/accounting state.

## 9. ProgramBenefit model

Add `ProgramBenefit` as the generic redemption target.

Minimum fields:

- institution;
- name and participant-facing description;
- `benefit_type`: initially `ev_charging | transit | access_point | other`;
- `status`: `draft | active | retired`;
- Green Route Credit unit label;
- validated minimum/maximum requested units and request increment for bounded variable-unit requests;
- optional finite `capacity_total` measured as number of simultaneous/terminal benefit allocations available under the institution program;
- optional `ChargingHub` reference for an EV-charging benefit;
- effective dates and evidence label where applicable.

A ProgramBenefit does not imply cash value, payment settlement, transportation availability, charger reservation, or guaranteed benefit delivery.

Only active, in-period ProgramBenefit records are participant-selectable.

## 10. Benefit capacity reservations

Add `BenefitCapacityReservation` for finite-capacity ProgramBenefit records.

Fields include:

- ProgramBenefit;
- RedemptionRequest;
- state: `reserved | consumed | released`;
- timestamps.

Each valid RedemptionRequest consumes one benefit-capacity slot when the selected ProgramBenefit has finite capacity.

Creation row-locks the ProgramBenefit while calculating existing `reserved + consumed` capacity. If no capacity remains, the entire redemption transaction fails and no Green Route Credit HOLDs persist.

Fulfillment changes the reservation to `consumed`; denial changes it to `released` in the same terminal-review transaction.

Unlimited benefits do not require a capacity reservation row.

## 11. Redemption and pooled allocation

### 11.1 RedemptionRequest

The participant submits:

- institution scope;
- `program_benefit_id`;
- requested Green Route Credit units consistent with that benefit's configured min/max/increment;
- mandatory client-generated idempotency UUID;
- any benefit-specific non-identity fields explicitly allowed by the benefit.

The participant does **not** submit:

- Profile ownership as an authorization field;
- one specific GreenRouteCredit to spend;
- an institution ID that overrides the URL/authorized tenant scope.

Use a uniqueness constraint over `(institution, profile, idempotency_key)`.

### 11.2 RedemptionAllocation

Add `RedemptionAllocation` with:

- RedemptionRequest;
- GreenRouteCredit;
- allocated units.

The server allocates the requested total across eligible issuance buckets ordered by earliest `expires_at`, then issuance time/ID for deterministic tie breaking.

Allocation rules:

- only participant-owned, institution-matching issuance buckets may fund the request;
- expired available units are excluded;
- units already held, debited, or expired according to ledger projection are excluded;
- allocations may partially consume an issuance bucket;
- the sum of all allocations must equal the request's requested units;
- failure to fund the full amount rolls back the whole request.

### 11.3 Redemption creation transaction

`RedemptionService` performs one transaction:

1. authenticate user and resolve claimed Profile server-side;
2. validate active ProgramBenefit and request-unit bounds;
3. validate mandatory idempotency UUID;
4. return the existing logical request on replay;
5. row-lock eligible credit buckets in deterministic order;
6. calculate canonical available units;
7. construct RedemptionAllocation rows;
8. row-lock and reserve finite ProgramBenefit capacity when required;
9. create the RedemptionRequest with `requested` status;
10. create exactly one `HOLD` ledger event per allocation;
11. commit atomically.

No partial request survives a failure.

## 12. Administrative review

The lifecycle remains:

`requested -> under-review -> fulfilled | denied`

No direct `requested -> fulfilled` or `requested -> denied` transition is permitted.

`program_staff`, `institution_admin`, or `platform_admin` may start review.

Only `institution_admin` or `platform_admin` may make a terminal decision.

V1 is all-or-nothing: the full request is fulfilled or denied. The requested units cannot be edited after submission.

### 12.1 Terminal transaction

`RedemptionReviewService` must:

1. row-lock the RedemptionRequest;
2. verify it is currently `under-review`;
3. row-lock its RedemptionAllocation rows and capacity reservation;
4. write reviewer metadata from the authenticated actor;
5. on fulfillment, create exactly one `DEBIT` event for each held allocation and consume benefit capacity;
6. on denial, create exactly one `RELEASE` event for each held allocation and release benefit capacity;
7. if a denied allocation's issuance bucket passed `expires_at` while the hold was protected, create an `EXPIRE` event for the released quantity in the same transaction so the units do not become newly spendable;
8. commit terminal state and all ledger/capacity effects atomically.

A concurrent second terminal decision receives a conflict and creates no additional ledger events.

`fulfilled` remains a manual institution-program fulfillment decision. It is not proof of an external charging session, payment, transportation delivery, or charging-network settlement.

## 13. Ledger contract

`WalletLedgerEntry` becomes the authoritative accounting event stream for wallet projections.

The existing field `quantity_delta` is treated as an event quantity, not something that may be blindly summed across event types.

Canonical event transitions are:

| Event | Accounting effect |
|---|---|
| `ISSUE` | increases issued and available units |
| `HOLD` | moves units from available to held |
| `RELEASE` | moves units from held back to available unless immediately expired by the same transaction |
| `DEBIT` | moves units from held to fulfilled |
| `EXPIRE` | moves eligible available units to expired |
| `REVERSAL` | applies the exact inverse of a specifically referenced prior event when a governed correction is valid |
| `ADJUSTMENT` | exceptional platform-controlled reconciliation event; never a normal issuance substitute |

Add optional `redemption_allocation` linkage for allocation-specific HOLD/RELEASE/DEBIT events.

Add `reverses_entry` for REVERSAL events. A reversal must reference the prior event it reverses and cannot exceed that event's remaining unreversed quantity.

`ADJUSTMENT` has no participant-facing endpoint in v1 and is restricted to platform-controlled reconciliation with mandatory reason/correlation metadata.

Ledger rows remain append-only. Existing model/queryset/API/admin protections stay in place. Deployment documentation must also define the database privilege boundary for the authoritative ledger; if the production database supports an append-only trigger or equivalent privilege restriction, it should be enforced there and covered by environment-specific tests.

## 14. WalletProjectionService

The frontend must not reproduce accounting rules.

`WalletProjectionService` computes, per participant and institution:

- `issued_units`;
- `available_units`;
- `held_units`;
- `fulfilled_units`;
- `expired_units`;
- correction/reversal metadata as required for audit presentation;
- recent activity;
- eligible active ProgramBenefits.

Core invariant:

`available_units >= 0`

and all projection state must reconcile to the underlying issuance buckets and ledger events.

A participant may have many GreenRouteCredit issuance buckets but sees one unified balance for the institution/unit label.

## 15. Expiration

Every post-v1 issuance receives `expires_at` from the active ProgramBenefitPolicy.

`ExpirationService` runs idempotently on a schedule and:

- considers only remaining available quantity in issuance buckets whose `expires_at` has passed;
- never expires units currently protected by a valid HOLD;
- writes `EXPIRE` events for the eligible available quantity;
- is safe to retry without duplicate expiration.

If a pre-expiry hold is later fulfilled after natural expiry, its DEBIT remains valid because the hold protected the units.

If a pre-expiry hold is later denied after natural expiry, the terminal transaction writes RELEASE followed by EXPIRE for the same quantity, leaving the participant with expired rather than newly available units.

## 16. Application service boundaries

Business logic must move out of serializers/views into focused services:

- `ParticipantIdentityService`
- `PolicyEvaluationService`
- `IssuanceService`
- `WalletProjectionService`
- `RedemptionService`
- `RedemptionReviewService`
- `ExpirationService`

These services own transaction boundaries and domain invariants. Serializers validate transport shape; views authenticate, authorize, invoke the correct service, and return the result.

Later trusted third-party evidence integrations and selectively automatic issuance must call the same PolicyEvaluationService/IssuanceService rather than bypassing the ledger or caps.

## 17. API contract

All canonical Green Wallet endpoints are institution-scoped so multi-institution users are unambiguous. Example target paths:

### Participant

- `GET /api/institutions/{institution_id}/wallet/`
- `GET /api/institutions/{institution_id}/program-benefits/`
- `POST /api/institutions/{institution_id}/redemptions/`
- `GET /api/institutions/{institution_id}/redemptions/{id}/`

### Institution operations

- `GET /api/institutions/{institution_id}/program-benefit-policies/`
- `POST /api/institutions/{institution_id}/program-benefit-policies/{id}/activate/`
- `GET /api/institutions/{institution_id}/qualifying-evidence/`
- `POST /api/institutions/{institution_id}/qualifying-evidence/`
- `POST /api/institutions/{institution_id}/issuance-decisions/evaluate/`
- `POST /api/institutions/{institution_id}/issuance-decisions/{id}/approve/`
- `GET /api/institutions/{institution_id}/redemptions/review-queue/`
- `POST /api/institutions/{institution_id}/redemptions/{id}/start-review/`
- `POST /api/institutions/{institution_id}/redemptions/{id}/fulfill/`
- `POST /api/institutions/{institution_id}/redemptions/{id}/deny/`

Prefer explicit action endpoints over arbitrary lifecycle PATCH requests. A call such as `/fulfill/` owns the status transition, reviewer metadata, row locks, ledger writes, and benefit-capacity state as one service operation.

### 17.1 Error contract

Use stable machine-readable error codes. Target HTTP semantics:

- `400` malformed request/unsupported transport shape;
- `401` unauthenticated;
- `403` authenticated but unauthorized;
- `404` resource not visible within caller's tenant scope;
- `409` idempotency/concurrency/state conflict;
- `422` valid transport request rejected by program policy/business rules.

Examples include:

- `PARTICIPANT_PROFILE_NOT_CLAIMED`
- `POLICY_INACTIVE`
- `EVIDENCE_NOT_ELIGIBLE`
- `PARTICIPANT_CAP_EXCEEDED`
- `PROGRAM_CAP_EXCEEDED`
- `INSUFFICIENT_AVAILABLE_UNITS`
- `BENEFIT_CAPACITY_EXHAUSTED`
- `REDEMPTION_ALREADY_TERMINAL`

## 18. Frontend contract

Green Wallet UI is a server projection plus governed actions.

Participant summary cards are:

- Available
- Under review / Held
- Fulfilled
- Expired

The current client-side logic that infers available/pending/redeemed balances from raw GreenRouteCredit and RedemptionRequest status values must be removed from the canonical API-backed path.

The benefit list is generated from active ProgramBenefit records. Future/unbuilt benefits remain visibly non-operational and must not appear clickable.

EV charging copy must continue to state that the request does not reserve a charger, start a charging session, process a payment, or guarantee charger access.

The recent-activity view derives from canonical server events/projections and should distinguish issuance, hold/review, fulfillment, denial/release, and expiry without implying monetary value.

### 18.1 Administrative UI

Keep three distinct work surfaces:

1. Evidence / issuance review
2. Redemption review
3. Program configuration

The UI must visibly reflect role restrictions instead of relying only on hidden backend authorization.

## 19. Migration strategy

Current Django migrations through `0005_green_wallet_ledger_and_policy` remain immutable historical migrations.

New lifecycle migrations start at the next migration number and are additive first.

### Phase 1 — Add v1 spine

Add identity, evidence, issuance, benefit, allocation, reservation, provenance, expiry, and correction-reference fields/models. Keep legacy `RedemptionRequest.credit` and `charging_hub` temporarily for compatibility.

### Phase 2 — Canonical services

Introduce identity resolution, policy evaluation, issuance, pooled redemption, terminal review, wallet projection, and expiration services. New canonical writes use these services only.

### Phase 3 — Data/backfill classification

For historical records:

- backfill only facts supported by existing data;
- do not invent policy/evidence provenance;
- label unverifiable historical credits as legacy/pre-v1 issuance;
- preserve the merged synthetic Pasadena acceptance fixture as a migration regression case.

### Phase 4 — Dual-read verification

For synthetic acceptance data, compare legacy display state against canonical ledger projection and investigate every mismatch before switching the participant UI.

### Phase 5 — Frontend/API cutover

Switch participant and admin surfaces to the v1 institution-scoped APIs and server projection.

### Phase 6 — Legacy retirement

Only after acceptance:

- remove single-credit redemption dependence;
- remove mandatory ChargingHub redemption coupling;
- remove legacy frontend `creditId`/`chargingHubId` assumptions;
- remove legacy status-derived balance calculations;
- remove or deprecate unrestricted GreenRouteCredit admin creation.

### 19.1 Rollback policy

Every schema migration must be classified as:

- fully reversible without loss of accepted business evidence, or
- intentionally irreversible after authoritative v1 audit data exists.

Do not pretend a destructive rollback is safe. Before authoritative v1 data is accepted, migration verification should exercise `forward -> checks -> backward -> forward -> latest` where supported. Once rollback would destroy accepted ledger/provenance evidence, deployment rollback must use application rollback/forward-fix procedures that preserve the data.

## 20. Test strategy

### 20.1 Identity and tenant isolation

Prove:

- unclaimed imported Profile cannot self-redeem;
- successful secure Profile claim;
- duplicate `(user, institution)` claim rejected;
- participant cannot operate on another participant's same-tenant Profile;
- cross-tenant wallet/credit/evidence/benefit/redemption access denied;
- one user may legitimately participate in two institutions;
- administrative users with a claimed Profile can use participant self-service without changing their administrative membership role.

### 20.2 Policy evaluation

For `verified_participation`:

- same inputs always produce same eligible-unit output;
- inactive/out-of-period policies rejected;
- unsupported evidence sources rejected;
- malformed parameters rejected before activation;
- participant cap enforced;
- program cap enforced;
- concurrent approvals cannot exceed either cap.

### 20.3 Issuance

Prove:

`Evidence[] -> evaluation -> institution_admin approval -> GreenRouteCredit -> exactly one ISSUE`

Also prove:

- approval replay does not double issue;
- failure at any step leaves no partial credit, ISSUE event, or cap consumption;
- program_staff cannot approve issuance;
- direct canonical API issuance bypass is unavailable.

### 20.4 Wallet accounting

At minimum:

```text
ISSUE 10  => available 10
HOLD 4    => available 6, held 4
RELEASE 4 => available 10, held 0
HOLD 4
DEBIT 4   => available 6, held 0, fulfilled 4
EXPIRE 2  => available 4, expired 2
```

Also test:

- multiple issuance buckets;
- oldest-expiring-first allocation;
- deterministic tie breaking;
- partial bucket allocation;
- reversal references and exact inverse semantics;
- platform-controlled adjustment semantics;
- no negative available balance.

### 20.5 Redemption

Prove:

- UUID required;
- replay returns same logical request;
- insufficient balance rejected;
- finite benefit capacity exhaustion rejected;
- all allocations + HOLDs + capacity reservation commit atomically;
- any allocation failure rolls back the full request.

### 20.6 RBAC

Prove all approved role boundaries, especially:

- viewer cannot act as participant merely because they are a tenant member;
- program_staff may start review but cannot issue, fulfill, or deny;
- institution_admin may approve issuance and make terminal decisions;
- platform-admin exceptional actions are audit-traced.

### 20.7 Terminal concurrency

Simulate two authorized administrators attempting the same terminal decision concurrently. Exactly one terminal result and one set of DEBIT/RELEASE effects may exist.

### 20.8 Expiration

Prove:

- available units expire;
- held units remain protected during valid review;
- fulfillment after natural expiry remains valid for protected holds;
- denial after natural expiry produces RELEASE + EXPIRE atomically;
- expiration retry is idempotent;
- expired units cannot fund new requests.

### 20.9 Frontend acceptance

For a synthetic Pasadena institution:

- Award A = 5 units, earlier expiry;
- Award B = 10 units, later expiry;
- wallet available = 15;
- redemption request = 7;
- allocation = 5 from A + 2 from B;
- after request: available 8, held 7, fulfilled 0, expired 0;
- after fulfillment: available 8, held 0, fulfilled 7, expired 0.

The same accounting path must work for an EV charging ProgramBenefit and a non-charging institutional mobility ProgramBenefit.

The frontend must render server-projected quantities, not recompute them from raw resource states.

## 21. Acceptance proof chain

Green Route Credit Lifecycle v1 is not complete until one synthetic institution proves:

```text
Institution
-> active ProgramBenefitPolicy
-> authenticated participant
-> claimed Profile
-> QualifyingEvidence[]
-> deterministic evaluation
-> institution_admin issuance approval
-> GreenRouteCredit
-> ISSUE
-> canonical wallet projection
-> active ProgramBenefit
-> idempotent redemption request
-> pooled RedemptionAllocation[]
-> HOLD events
-> benefit-capacity reservation when finite
-> program_staff review
-> institution_admin fulfillment or denial
-> DEBIT or RELEASE/EXPIRE effects
-> benefit-capacity consumed/released
-> updated wallet projection
-> admin audit trail
-> participant UI
```

Required negative/concurrency evidence:

- cross-tenant denial;
- same-tenant wrong-participant denial;
- viewer denial;
- program_staff terminal-decision denial;
- overcommit prevention;
- participant/program cap concurrency;
- duplicate issuance prevention;
- duplicate redemption prevention;
- terminal-review concurrency;
- expiration idempotency;
- migration verification;
- rollback procedure;
- exact deployed SHA and migration state.

## 22. Explicit v1 exclusions

Do not add as part of this lifecycle:

- live charger-network APIs;
- charging-session ingestion or Charging Intelligence domains;
- automatic charging settlement;
- cash-equivalent wallet accounting;
- automatic issuance;
- arbitrary institution-authored formulas;
- live third-party evidence integrations;
- partial fulfillment of one RedemptionRequest;
- driver earnings or fare collection;
- unrestricted public marketplace behavior;
- guaranteed transportation, benefit delivery, charger access, savings, or emissions outcomes.

## 23. Security and production-readiness boundary

Lifecycle v1 domain correctness is necessary but not sufficient for real commuter data.

Current repository security documentation separately requires production authentication, stronger administrator authentication, secure sessions, database authorization/RLS or equivalent tenant isolation, retention/deletion controls, managed secrets, backups/restore verification, abuse controls, and security assessment before real-data operation.

Implementation of this design must preserve that boundary. Synthetic acceptance may prove the lifecycle before those production gates are complete, but the release must remain labeled research beta / demonstration environment until all applicable production security gates pass.

## 24. Success criterion

Lifecycle v1 succeeds when Relay Rider can answer, from authoritative application state and without reconstructing intent from logs:

> Which institution program issued these Green Route Credits, to which authenticated participant, under which exact policy version, from which qualifying evidence, how were the units calculated and approved, what amount is currently available/held/fulfilled/expired, which approved mobility benefit was requested, who reviewed and finalized it, and which immutable ledger events prove every accounting transition?

If that answer cannot be reconstructed deterministically, the lifecycle is not complete.
