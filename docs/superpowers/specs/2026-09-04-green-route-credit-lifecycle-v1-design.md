# Green Route Credit Lifecycle v1 — Architecture Design

**Status:** Approved architecture with approved EV charging-benefit amendment; amended written spec pending founder re-review  
**Original design date:** 2026-09-04  
**Amendment date:** 2026-09-05  
**Repository baseline:** `main` at `b5b631475dc799d11b0004d7cb80be2420c17a02`  
**Product state:** Research beta / controlled beta  

> **Planning gate:** The implementation plan at `docs/superpowers/plans/2026-09-04-green-route-credit-lifecycle-v1.md` predates the Benefit Inventory + ChargingBenefitFulfillment amendment and is therefore stale. Do not execute it until this amended specification is founder-reviewed and a replacement implementation plan is written.

## 1. Purpose

Green Wallet v1 is the governed institutional mobility-benefit layer for Relay Rider. It converts approved participation evidence into auditable Green Route Credit issuance, exposes a canonical participant wallet balance, and supports institution-reviewed redemption against approved mobility benefits.

Green Route Credits are program-defined participation-benefit units. They are not cash, wages, fares, guaranteed payments, charging reimbursements, certified carbon credits, utility credits, or automatic payment instruments.

Green Wallet v1 is **not charging-only**. EV charging is one eligible benefit category. Transit, Access Point, clean-commute, and other institution-approved mobility benefits may use the same wallet and accounting lifecycle.

For EV charging benefits, v1 additionally governs whether an actual institution-sponsored external charging benefit exists, is assigned exactly once, is delivered securely, and is reconciled afterward. Relay Rider does not become a charging network, payment processor, reimbursement service, or charger-settlement layer.

This design does not add live charging-network settlement, automatic charging payments, ChargingStation/EVSE/ChargingSession domains, or unrestricted marketplace behavior.

## 2. Current-state baseline

The current merged code already contains:

- `Institution`, `Membership`, and tenant-scoped authorization;
- `Profile`, but no authenticated `User -> Profile` ownership link at the original design baseline;
- `GreenRouteCredit` with explicit `amount_units`, `unit_label`, and `issued|redeemed|expired` status;
- `ProgramBenefitPolicy` scaffolding with version, caps, expiry, descriptive eligibility/earning text, effective dates, and status;
- `RedemptionRequest` with `requested -> under-review -> fulfilled|denied` lifecycle;
- immutable-at-application-layer `WalletLedgerEntry` events supporting `ISSUE`, `HOLD`, `RELEASE`, `DEBIT`, `REVERSAL`, `EXPIRE`, and `ADJUSTMENT`;
- transactional redemption creation with credit row locking and overcommit prevention;
- `HOLD` creation on redemption submission;
- `DEBIT` on fulfillment and `RELEASE` on denial;
- participant-facing wallet UI that still derives balances locally from credit/request statuses;
- a charging-specific redemption flow tied to one `GreenRouteCredit` and one `ChargingHub`.

The current Green Wallet API contract remains runtime truth until this v1 design is implemented and accepted. This design supersedes prior open design questions only as target architecture; it does not claim the target capabilities are live.

The current repository security posture is separately governed by the project security architecture. Green Wallet Lifecycle v1 must not be described as production-operational merely because its domain model is implemented.

## 3. Approved product decisions

The following decisions are locked for Lifecycle v1:

1. Green Wallet is a **general institutional mobility-benefit wallet**.
2. Common Pathways controls the permitted rule framework; an authorized institution administrator activates institution-specific policy configuration inside that framework.
3. V1 issuance is **evidence-backed, deterministically calculated, and administratively approved**.
4. Later automatic issuance may be enabled selectively per mature policy; it is out of scope for v1.
5. V1 earning evidence may come from Relay Rider native evidence, authorized imports, or administrator attestation. Live third-party evidence integrations are deferred.
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
20. V1 ProgramBenefits use **fixed Green Route Credit bundle costs**, not participant-selected variable-unit redemption.
21. Green Route Credits have **no participant-facing monetary exchange rate**. Sponsor cost and external benefit face value are separate administrative accounting fields.
22. EV charging redemption supports both `network_promo` benefits and `site_host_entitlement` benefits.
23. An EV charging redemption may be fulfilled only when a real, eligible benefit inventory item or pre-authorized site-host entitlement is successfully assigned.
24. Green Route Credits are debited when the sponsored external charging benefit is successfully issued, not when later usage evidence arrives.
25. Charging-session evidence is post-redemption outcome evidence, not a prerequisite for earning Green Route Credits or requesting redemption.
26. One EV charging redemption produces one charging-benefit fulfillment in v1; no bundling of multiple charging events into one fulfillment.
27. External benefit expiration does not automatically restore Green Route Credits.
28. An `institution_admin` or `platform_admin` may authorize a documented exceptional reversal when an external benefit was unusable, issued incorrectly, or another governed exception applies.
29. Benefit credentials are delivered inside Green Wallet. Email may notify the participant that a benefit is ready but does not carry the credential itself.
30. Institutions obtain/fund external charging benefits. Relay Rider governs inventory, assignment, audit, and outcome tracking; it does not automatically purchase benefits in v1.

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
Participant selects fixed ProgramBenefit
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
    fulfill                 deny
       ↓                     ↓
For EV charging:        RELEASE events
lock eligible           release capacity
BenefitInventoryItem    + EXPIRE if required
       ↓
ChargingBenefitFulfillment
       ↓
secure external-benefit assignment
       ↓
DEBIT events
consume capacity
       ↓
participant reveals benefit in Green Wallet
       ↓
optional post-use outcome evidence
       ↓
confirmed_used / expired_unused / fulfillment_issue
```

For non-charging ProgramBenefits, the same wallet, allocation, HOLD, review, and DEBIT/RELEASE accounting path applies. EV charging adds the inventory and external-fulfillment proof layer before DEBIT.

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

For any participant-facing wallet, redemption, or benefit-reveal action, the server resolves:

`authenticated user + institution -> claimed Profile`

The client does not submit an arbitrary Profile ID to establish ownership.

### 5.3 Administrative role boundaries

- `participant`: own wallet, own eligible benefits, own redemption requests, reveal only own assigned benefit credentials.
- `viewer`: permitted administrative read-only surfaces only; no participant authority and no approval authority.
- `program_staff`: evidence preparation/review, issuance recommendation, redemption triage, `requested -> under-review`, non-secret inventory availability visibility; no credential reveal.
- `institution_admin`: institution policy activation, issuance approval, inventory administration, redemption fulfillment/denial, governed replacement/reversal authorization.
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
- positive fixed `credit_cost_units`;
- optional finite `capacity_total` measured as number of benefit allocations authorized under the institution program;
- optional `ChargingHub` reference for an EV-charging benefit;
- effective dates and evidence label where applicable;
- participant eligibility metadata supported by the platform framework;
- administrative sponsor-cost / external-benefit-value fields where needed for budgeting, never exposed as a Green Route Credit exchange rate.

V1 does not allow participants to choose arbitrary redemption-unit quantities. Each ProgramBenefit is a fixed bundle: one approved benefit costs the configured fixed number of Green Route Credits.

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

ProgramBenefit capacity is an authorization limit. It is distinct from external Benefit Inventory. For example, an institution may authorize 100 EV Charging Benefits for a period while only 27 actual promotional codes or site-host entitlements are currently available. An EV charging redemption must satisfy both constraints before fulfillment.

## 11. Redemption and pooled allocation

### 11.1 RedemptionRequest

The participant submits:

- institution scope through the institution-scoped URL;
- `program_benefit_id`;
- mandatory client-generated idempotency UUID;
- any benefit-specific non-identity fields explicitly allowed by the benefit.

The server derives the requested Green Route Credit quantity from `ProgramBenefit.credit_cost_units`. The participant does not submit an arbitrary requested-unit amount.

The participant does **not** submit:

- Profile ownership as an authorization field;
- one specific GreenRouteCredit to spend;
- an institution ID that overrides the URL/authorized tenant scope;
- an arbitrary monetary value or Green Route Credit exchange rate.

Use a uniqueness constraint over `(institution, profile, idempotency_key)`.

### 11.2 RedemptionAllocation

Add `RedemptionAllocation` with:

- RedemptionRequest;
- GreenRouteCredit;
- allocated units.

The server allocates the ProgramBenefit's fixed `credit_cost_units` across eligible issuance buckets ordered by earliest `expires_at`, then issuance time/ID for deterministic tie breaking.

Allocation rules:

- only participant-owned, institution-matching issuance buckets may fund the request;
- expired available units are excluded;
- units already held, debited, or expired according to ledger projection are excluded;
- allocations may partially consume an issuance bucket;
- the sum of all allocations must equal `ProgramBenefit.credit_cost_units`;
- failure to fund the full amount rolls back the whole request.

### 11.3 Redemption creation transaction

`RedemptionService` performs one transaction:

1. authenticate user and resolve claimed Profile server-side;
2. validate active/in-period ProgramBenefit and participant eligibility;
3. derive fixed requested units from `credit_cost_units`;
4. validate mandatory idempotency UUID;
5. return the existing logical request on replay;
6. row-lock eligible credit buckets in deterministic order;
7. calculate canonical available units;
8. construct RedemptionAllocation rows;
9. row-lock and reserve finite ProgramBenefit capacity when required;
10. create the RedemptionRequest with `requested` status;
11. create exactly one `HOLD` ledger event per allocation;
12. commit atomically.

No partial request survives a failure.

## 12. Benefit Inventory + ChargingBenefitFulfillment

EV charging redemption requires an explicit external-benefit fulfillment layer between administrative approval and Green Route Credit DEBIT.

### 12.1 BenefitInventoryItem

Add `BenefitInventoryItem` as the institution-controlled record of one external benefit Relay Rider can actually assign. It is not a Green Route Credit and does not create participant wallet value by itself.

Supported v1 fulfillment types:

- `network_promo` — approved charging-network promotional credit/code or equivalent provider entitlement;
- `site_host_entitlement` — employer/campus/site-host charging access or sponsored entitlement.

Minimum fields:

- `institution`;
- `program_benefit`;
- `fulfillment_type`;
- `provider_name`;
- optional `provider_program_reference`;
- optional non-secret `external_reference`;
- optional encrypted secret credential for network promotional benefits;
- participant instructions;
- `status`: `available | issued | expired | voided`;
- `valid_from`;
- optional `expires_at`;
- `loaded_by` / `loaded_at`;
- `issued_at` when assigned.

For a network promotion, the secret credential is stored encrypted at rest and never returned by ordinary list/report/export endpoints. For a site-host entitlement, no secret credential is required when the institution can represent the benefit through approved account/site access instructions and an external entitlement reference.

Institutions obtain or authorize these benefits outside Relay Rider and load them into governed inventory. Relay Rider does not automatically purchase promotional codes or entitlements in v1.

Each inventory item may be successfully assigned at most once. Concurrent fulfillment attempts must not assign one item to two participants.

### 12.2 ChargingBenefitFulfillment

Add `ChargingBenefitFulfillment` as the audit record proving that an EV charging RedemptionRequest resulted in an actual institution-sponsored external charging benefit.

Minimum fields:

- `institution`;
- `profile`;
- `redemption_request`;
- `program_benefit`;
- `benefit_inventory_item`;
- `fulfillment_type`;
- `provider_name`;
- non-secret `external_reference`;
- `status`: `issued | confirmed_used | expired_unused | fulfillment_issue | replaced | voided_reversed`;
- `issued_by` / `issued_at`;
- optional `expires_at`;
- optional self-reference `replacement_for`;
- optional outcome reference/evidence label;
- optional `outcome_recorded_at`.

One initial EV charging RedemptionRequest produces at most one active issued fulfillment. A governed replacement creates a new fulfillment linked to the prior one and does not create a second Green Route Credit DEBIT.

### 12.3 Secure delivery

The external benefit is delivered inside Green Wallet.

For `network_promo`, the participant sees non-secret provider/expiry metadata and may explicitly reveal the credential after authenticating as the Profile owner. The secret must not appear in:

- ordinary admin tables;
- application logs;
- analytics payloads;
- participant or administrative exports;
- notification email.

Email may notify the participant that an EV Charging Benefit is ready in Green Wallet.

For `site_host_entitlement`, Green Wallet shows approved access/activation instructions and non-secret entitlement metadata. No artificial promo code is created when one does not exist.

Add append-only `BenefitAccessEvent` records for sensitive benefit operations with at least:

- fulfillment;
- actor;
- `action`: `reveal | admin_inventory_load | void | replacement`;
- occurred time;
- correlation identifier.

`program_staff` may see non-secret inventory availability but may not reveal participant benefit credentials.

### 12.4 Post-redemption outcome evidence

Separate three evidence concepts:

```text
EARNING EVIDENCE
-> why Green Route Credits were issued

REDEMPTION
-> why credits were committed and spent for a ProgramBenefit

OUTCOME EVIDENCE
-> whether the issued external charging benefit was later used
```

Charging-session outcome evidence is optional in the first beta and does not control the original Green Route Credit DEBIT. Accepted v1 outcome evidence sources may include:

- participant-submitted receipt/provider transaction record;
- authorized institution/site-host export;
- administrator-attested outcome.

Outcome evidence may update a fulfillment from `issued` to `confirmed_used`, `expired_unused`, or `fulfillment_issue`. It does not create a generic ChargingSession/EVSE/OCPI domain.

## 13. Administrative review and terminal fulfillment

The redemption lifecycle remains:

`requested -> under-review -> fulfilled | denied`

No direct `requested -> fulfilled` or `requested -> denied` transition is permitted.

`program_staff`, `institution_admin`, or `platform_admin` may start review.

Only `institution_admin` or `platform_admin` may make a terminal decision.

V1 is all-or-nothing: the full fixed-bundle request is fulfilled or denied. The credit cost cannot be edited after submission.

### 13.1 EV charging fulfillment transaction

For `benefit_type=ev_charging`, `RedemptionReviewService.fulfill()` must perform one atomic transaction:

1. row-lock the RedemptionRequest;
2. verify it is currently `under-review`;
3. authorize `institution_admin` or `platform_admin`;
4. row-lock its RedemptionAllocation rows and validate the held units;
5. row-lock its BenefitCapacityReservation when finite;
6. select and row-lock one eligible `BenefitInventoryItem` for the same institution and ProgramBenefit;
7. verify the inventory item is `available`, in-period, and not expired;
8. create the `ChargingBenefitFulfillment`;
9. mark the inventory item `issued` and bind it to that fulfillment;
10. create exactly one `DEBIT` event for each held RedemptionAllocation;
11. consume the ProgramBenefit capacity reservation;
12. mark the RedemptionRequest `fulfilled` and persist reviewer metadata;
13. commit.

If inventory assignment, fulfillment creation, ledger writing, capacity consumption, or terminal-state persistence fails, the entire transaction rolls back. No Green Route Credit DEBIT or terminal request state may remain without a successfully assigned external benefit.

If no eligible inventory is available, return `BENEFIT_INVENTORY_EXHAUSTED`; leave the request `under-review` and its existing HOLDs/capacity reservation intact so an authorized administrator can load inventory and retry or deny the request.

### 13.2 Non-charging terminal transaction

For non-charging ProgramBenefits, terminal fulfillment retains the generic all-or-nothing transaction:

1. row-lock RedemptionRequest, allocations, and capacity reservation;
2. verify `under-review` and terminal authority;
3. create exactly one `DEBIT` per held allocation;
4. consume capacity when finite;
5. mark fulfilled with reviewer metadata;
6. commit atomically.

A future benefit-specific fulfillment proof layer may be added for other benefit types through a separately approved design.

### 13.3 Denial

On denial, the terminal transaction:

1. row-locks request, allocations, and capacity reservation;
2. writes one `RELEASE` event for each held allocation;
3. releases finite ProgramBenefit capacity;
4. if a released allocation's source issuance expired while the hold was protected, immediately writes `EXPIRE` for the released quantity in the same transaction;
5. records denial actor/reason and commits atomically.

A concurrent second terminal decision receives a conflict and creates no additional ledger events or benefit assignment.

### 13.4 Replacement and exceptional restoration

If an issued external charging benefit is unusable, replacement is preferred where possible:

```text
original fulfillment -> fulfillment_issue
-> assign replacement inventory item
-> original fulfillment = replaced
-> new ChargingBenefitFulfillment(replacement_for=original)
```

A replacement does not create a new Green Route Credit DEBIT because the participant already paid the fixed credit cost once.

There is no automatic Green Route Credit restoration when an external benefit expires unused.

Only `institution_admin` or `platform_admin` may authorize exceptional restoration for documented cases such as unusable benefits, incorrect issuance, or another governed program exception. Restoration must reference the exact prior DEBIT event(s):

```text
DEBIT
-> REVERSAL of exact DEBIT
-> RELEASE restored held quantity
-> if source issuance already expired: immediate EXPIRE
```

The correction, release, and any required expiry must be atomic. The fulfillment becomes `voided_reversed`. Reason, actor, timestamp, and correlation identifier are mandatory.

## 14. Ledger contract

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

## 15. WalletProjectionService

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

ChargingBenefitFulfillment outcome states do not silently alter wallet balances. Only explicit ledger events do that.

## 16. Expiration

Every post-v1 issuance receives `expires_at` from the active ProgramBenefitPolicy.

`ExpirationService` runs idempotently on a schedule and:

- considers only remaining available quantity in issuance buckets whose `expires_at` has passed;
- never expires units currently protected by a valid HOLD;
- writes `EXPIRE` events for the eligible available quantity;
- is safe to retry without duplicate expiration.

If a pre-expiry hold is later fulfilled after natural expiry, its DEBIT remains valid because the hold protected the units.

If a pre-expiry hold is later denied after natural expiry, the terminal transaction writes RELEASE followed by EXPIRE for the same quantity, leaving the participant with expired rather than newly available units.

Expiration of an external charging benefit is separate. `ChargingBenefitFulfillment.status=expired_unused` does not automatically restore Green Route Credits.

## 17. Application service boundaries

Business logic must move out of serializers/views into focused services:

- `ParticipantIdentityService`
- `PolicyEvaluationService`
- `IssuanceService`
- `WalletProjectionService`
- `RedemptionService`
- `RedemptionReviewService`
- `BenefitInventoryService`
- `ChargingBenefitFulfillmentService`
- `BenefitOutcomeService`
- `ExpirationService`

These services own transaction boundaries and domain invariants. Serializers validate transport shape; views authenticate, authorize, invoke the correct service, and return the result.

Later trusted third-party evidence integrations and selectively automatic issuance must call the same PolicyEvaluationService/IssuanceService rather than bypassing the ledger or caps. Future charging-provider integrations must reconcile through ChargingBenefitFulfillment/BenefitOutcome services rather than bypassing inventory or wallet accounting.

## 18. API contract

All canonical Green Wallet endpoints are institution-scoped so multi-institution users are unambiguous.

### Participant

- `GET /api/institutions/{institution_id}/wallet/`
- `GET /api/institutions/{institution_id}/program-benefits/`
- `POST /api/institutions/{institution_id}/redemptions/`
- `GET /api/institutions/{institution_id}/redemptions/{id}/`
- `GET /api/institutions/{institution_id}/redemptions/{id}/charging-fulfillment/`
- `POST /api/institutions/{institution_id}/charging-benefit-fulfillments/{id}/reveal/`
- `POST /api/institutions/{institution_id}/charging-benefit-fulfillments/{id}/outcome-evidence/`

The reveal endpoint is an explicit action, not a list field, so sensitive credentials are not accidentally serialized or cached with ordinary wallet data.

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
- `GET /api/institutions/{institution_id}/benefit-inventory/`
- `POST /api/institutions/{institution_id}/benefit-inventory/`
- `POST /api/institutions/{institution_id}/benefit-inventory/{id}/void/`
- `GET /api/institutions/{institution_id}/charging-benefit-fulfillments/`
- `POST /api/institutions/{institution_id}/charging-benefit-fulfillments/{id}/replace/`
- `POST /api/institutions/{institution_id}/charging-benefit-fulfillments/{id}/reverse/`

Prefer explicit action endpoints over arbitrary lifecycle PATCH requests. A call such as `/fulfill/` owns status transition, reviewer metadata, row locks, external-benefit assignment, ledger writes, and benefit-capacity state as one service operation.

### 18.1 Error contract

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
- `BENEFIT_INVENTORY_EXHAUSTED`
- `BENEFIT_INVENTORY_EXPIRED`
- `BENEFIT_ALREADY_ASSIGNED`
- `FULFILLMENT_NOT_OWNED`
- `REDEMPTION_ALREADY_TERMINAL`

## 19. Frontend contract

Green Wallet UI is a server projection plus governed actions.

Participant summary cards are:

- Available
- Under review / Held
- Fulfilled
- Expired

The current client-side logic that infers available/pending/redeemed balances from raw GreenRouteCredit and RedemptionRequest status values must be removed from the canonical API-backed path.

The benefit list is generated from active ProgramBenefit records and shows fixed Green Route Credit costs. Future/unbuilt benefits remain visibly non-operational and must not appear clickable.

EV charging copy must continue to state that the request does not reserve a charger, start a charging session, process a payment, reimburse a charging expense, or guarantee charger access.

After successful EV charging fulfillment, the participant sees an `Issued` benefit card in Green Wallet. Network promotional credentials are revealed only through the explicit secure reveal action. Site-host entitlements show institution-approved access instructions.

No participant UI may display a fixed dollar exchange rate for Green Route Credits. Sponsor cost and external benefit face value remain administrative-only fields.

The recent-activity view derives from canonical server events/projections and should distinguish issuance, hold/review, external-benefit issuance, fulfillment, denial/release, expiry, replacement, and governed reversal without implying monetary value.

### 19.1 Administrative UI

Keep four distinct work surfaces:

1. Evidence / issuance review
2. Redemption review
3. Benefit inventory / fulfillment operations
4. Program configuration

Administrative inventory lists expose counts and non-secret metadata only. Secret promotional credentials are not rendered in general tables.

The UI must visibly reflect role restrictions instead of relying only on hidden backend authorization.

## 20. Migration strategy

Current Django migrations through `0005_green_wallet_ledger_and_policy` remain immutable historical migrations.

New lifecycle migrations start at the next migration number available on the implementation branch and are additive first. If main has advanced beyond the original baseline, the replacement implementation plan must first reconcile the current migration graph rather than assuming a hard-coded migration number.

### Phase 1 — Add v1 spine

Add identity, evidence, issuance, fixed-benefit, allocation, capacity reservation, BenefitInventoryItem, ChargingBenefitFulfillment, BenefitAccessEvent, provenance, expiry, and correction-reference fields/models. Keep legacy `RedemptionRequest.credit` and `charging_hub` temporarily for compatibility.

### Phase 2 — Canonical services

Introduce identity resolution, policy evaluation, issuance, pooled redemption, benefit inventory, terminal review/fulfillment, wallet projection, benefit outcome, and expiration services. New canonical writes use these services only.

### Phase 3 — Data/backfill classification

For historical records:

- backfill only facts supported by existing data;
- do not invent policy/evidence provenance;
- do not invent benefit inventory or external fulfillment evidence for historical fulfilled requests;
- label unverifiable historical credits as legacy/pre-v1 issuance;
- preserve the merged synthetic Pasadena acceptance fixture as a migration regression case.

### Phase 4 — Dual-read verification

For synthetic acceptance data, compare legacy display state against canonical ledger projection and investigate every mismatch before switching the participant UI.

### Phase 5 — Frontend/API cutover

Switch participant and admin surfaces to the v1 institution-scoped APIs, fixed ProgramBenefit bundles, server projection, and governed benefit-fulfillment surfaces.

### Phase 6 — Legacy retirement

Only after acceptance:

- remove single-credit redemption dependence;
- remove mandatory ChargingHub redemption coupling;
- remove legacy frontend `creditId`/`chargingHubId` assumptions;
- remove variable participant-entered redemption-unit assumptions from v1 paths;
- remove legacy status-derived balance calculations;
- remove or deprecate unrestricted GreenRouteCredit admin creation.

### 20.1 Rollback policy

Every schema migration must be classified as:

- fully reversible without loss of accepted business evidence, or
- intentionally irreversible after authoritative v1 audit/fulfillment data exists.

Do not pretend a destructive rollback is safe. Before authoritative v1 data is accepted, migration verification should exercise `forward -> checks -> backward -> forward -> latest` where supported. Once rollback would destroy accepted ledger, provenance, inventory-assignment, credential-access, or fulfillment evidence, deployment rollback must use application rollback/forward-fix procedures that preserve the data.

## 21. Test strategy

### 21.1 Identity and tenant isolation

Prove:

- unclaimed imported Profile cannot self-redeem;
- successful secure Profile claim;
- duplicate `(user, institution)` claim rejected;
- participant cannot operate on another participant's same-tenant Profile;
- cross-tenant wallet/credit/evidence/benefit/inventory/fulfillment/redemption access denied;
- one user may legitimately participate in two institutions;
- administrative users with a claimed Profile can use participant self-service without changing their administrative membership role.

### 21.2 Policy evaluation

For `verified_participation`:

- same inputs always produce same eligible-unit output;
- inactive/out-of-period policies rejected;
- unsupported evidence sources rejected;
- malformed parameters rejected before activation;
- participant cap enforced;
- program cap enforced;
- concurrent approvals cannot exceed either cap.

### 21.3 Issuance

Prove:

`Evidence[] -> evaluation -> institution_admin approval -> GreenRouteCredit -> exactly one ISSUE`

Also prove:

- approval replay does not double issue;
- failure at any step leaves no partial credit, ISSUE event, or cap consumption;
- program_staff cannot approve issuance;
- direct canonical API issuance bypass is unavailable.

### 21.4 Wallet accounting

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

### 21.5 Fixed-bundle redemption

Prove:

- UUID required;
- replay returns same logical request;
- server derives units from `ProgramBenefit.credit_cost_units`;
- participant cannot override the credit cost;
- insufficient balance rejected;
- finite benefit capacity exhaustion rejected;
- all allocations + HOLDs + capacity reservation commit atomically;
- any allocation failure rolls back the full request.

### 21.6 Benefit Inventory and EV charging fulfillment

Prove:

- only authorized institution_admin/platform_admin actors may load/void inventory;
- network-promo secret values are not exposed by list/report/export serialization;
- program_staff sees non-secret availability only;
- participant can reveal only the credential assigned to their own Profile;
- one inventory item cannot be assigned twice, including concurrent fulfillment attempts;
- expired/voided/wrong-ProgramBenefit/wrong-tenant inventory cannot fulfill a request;
- EV fulfillment without eligible inventory returns `BENEFIT_INVENTORY_EXHAUSTED` and leaves the request under review with no DEBIT;
- successful EV fulfillment atomically creates ChargingBenefitFulfillment, marks inventory issued, writes all DEBIT events, consumes capacity, and terminally fulfills the request;
- failure of any one of those writes rolls back the entire terminal operation;
- one redemption produces at most one active initial fulfillment;
- replacement uses new inventory but no new Green Route Credit DEBIT;
- `expired_unused` does not automatically restore credits;
- governed exceptional restoration creates exact DEBIT reversal + release and immediate expiry when required;
- BenefitAccessEvent records credential reveal/replacement/void operations.

### 21.7 RBAC

Prove all approved role boundaries, especially:

- viewer cannot act as participant merely because they are a tenant member;
- program_staff may start review but cannot issue, terminally fulfill/deny, reveal credentials, or authorize reversal;
- institution_admin may approve issuance, manage inventory, and make terminal decisions;
- platform-admin exceptional actions are audit-traced.

### 21.8 Terminal concurrency

Simulate two authorized administrators attempting the same terminal EV charging fulfillment concurrently. Exactly one terminal result, one inventory assignment, one ChargingBenefitFulfillment, and one set of DEBIT effects may exist.

### 21.9 Expiration

Prove:

- available Green Route Credit units expire;
- held units remain protected during valid review;
- fulfillment after natural credit expiry remains valid for protected holds;
- denial after natural credit expiry produces RELEASE + EXPIRE atomically;
- credit expiration retry is idempotent;
- expired credits cannot fund new requests;
- external fulfillment expiry is tracked separately as `expired_unused` and does not mutate wallet accounting without an explicit governed reversal.

### 21.10 Frontend acceptance

For a synthetic Pasadena institution:

- Award A = 5 units, earlier expiry;
- Award B = 10 units, later expiry;
- wallet available = 15;
- fixed EV Charging ProgramBenefit cost = 7 units for the synthetic fixture only;
- allocation = 5 from A + 2 from B;
- after request: available 8, held 7, fulfilled 0, expired 0;
- synthetic BenefitInventoryItem exists and is available;
- after institution_admin fulfillment: inventory item issued, ChargingBenefitFulfillment issued, available 8, held 0, fulfilled 7, expired 0;
- participant can reveal only their synthetic assigned benefit;
- a second synthetic non-charging ProgramBenefit uses the same wallet allocation/HOLD/DEBIT accounting path without ChargingBenefitFulfillment.

The synthetic 7-unit cost is a test fixture only and must not become a production default or participant-facing monetary conversion.

The frontend must render server-projected quantities, not recompute them from raw resource states.

## 22. Acceptance proof chain

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
-> active fixed ProgramBenefit
-> idempotent redemption request
-> pooled RedemptionAllocation[]
-> HOLD events
-> benefit-capacity reservation when finite
-> program_staff review
-> institution_admin terminal decision
-> for EV charging: eligible BenefitInventoryItem
-> ChargingBenefitFulfillment
-> secure benefit assignment
-> DEBIT
-> benefit-capacity consumed
-> participant in-wallet reveal/access
-> optional outcome evidence
-> confirmed_used / expired_unused / fulfillment_issue
-> updated wallet projection
-> admin audit trail + BenefitAccessEvent
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
- inventory double-assignment prevention;
- terminal-review concurrency;
- secret-credential non-disclosure;
- expiration idempotency;
- migration verification;
- rollback procedure;
- exact tested SHA and migration state.

Synthetic acceptance proves software behavior only. Before a real-value EV charging pilot is described as operational, at least one actual institution-funded or institution-authorized charging-network promotional mechanism or site-host entitlement process must exist outside the synthetic fixture.

## 23. Explicit v1 exclusions

Do not add as part of this lifecycle:

- live charger-network APIs;
- ChargingStation, EVSE, or generic ChargingSession domains;
- OCPI/OCPP provider integration;
- automatic charging settlement;
- stored payment methods;
- cash-equivalent wallet accounting;
- participant-facing Green Route Credit dollar exchange rates;
- generic gift-card redemption;
- cash/Venmo/Zelle reimbursement;
- automatic purchase of promotional codes or entitlements;
- automatic issuance;
- arbitrary institution-authored formulas;
- live third-party earning-evidence integrations;
- partial fulfillment of one RedemptionRequest;
- driver earnings or fare collection;
- unrestricted public marketplace behavior;
- guaranteed transportation, benefit delivery, charger access, savings, or emissions outcomes.

## 24. Privacy, secret handling, and audit requirements

The fulfillment layer may contain externally issued credentials. Treat those credentials as secrets rather than ordinary participant profile data.

Required controls include:

- encrypt secret benefit credentials at rest;
- never place credentials in application logs, analytics, ordinary exports, or notification email;
- least-privilege reveal access bound to the authenticated participant owner;
- no `program_staff` credential reveal;
- append-only access audit for reveal, inventory load, void, and replacement actions;
- institution/tenant isolation on inventory and fulfillment records;
- retention/deletion policy that preserves required audit evidence while removing credentials when they are no longer operationally necessary and retention rules permit;
- correlation identifiers linking inventory load, redemption, fulfillment, ledger entries, credential access, replacement/reversal, and outcome evidence.

The exact production encryption/KMS mechanism is an implementation/deployment decision and must be selected in the replacement implementation plan without weakening these requirements.

## 25. Security and production-readiness boundary

Lifecycle v1 domain correctness is necessary but not sufficient for real commuter data or real-value external benefits.

Repository security documentation separately governs production authentication, administrator authentication, secure sessions, database authorization/RLS or equivalent tenant isolation, retention/deletion controls, managed secrets, backups/restore verification, abuse controls, and security assessment before real-data operation.

Implementation of this design must preserve that boundary. Synthetic acceptance may prove the lifecycle before those production gates are complete, but the release must remain labeled research beta / demonstration environment until all applicable production security and operational benefit-procurement gates pass.

## 26. Success criterion

Lifecycle v1 succeeds when Relay Rider can answer, from authoritative application state and without reconstructing intent from logs:

> Which institution program issued these Green Route Credits, to which authenticated participant, under which exact policy version, from which qualifying evidence, how were the units calculated and approved, what amount is currently available/held/fulfilled/expired, which fixed ProgramBenefit was requested, how were issuance buckets allocated, who reviewed and finalized it, and which immutable ledger events prove every accounting transition?

For an EV Charging ProgramBenefit, Relay Rider must additionally be able to answer:

> Which real institution-controlled external charging benefit was available, who loaded it, which redemption received it, who approved its assignment, when the participant gained access, whether it was later confirmed used/expired unused/reported unusable, whether any replacement or exceptional reversal occurred, and which audit records prove that the external benefit and Green Route Credit accounting never diverged?

If those answers cannot be reconstructed deterministically, the lifecycle is not complete.
