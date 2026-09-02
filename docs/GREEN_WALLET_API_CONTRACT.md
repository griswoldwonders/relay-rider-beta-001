# Green Wallet API Contract

**Status:** Research-beta canonical contract  
**Base path:** `/api`  
**Canonical backend:** Django REST Framework in `relay-rider-beta-001`  
**Frontend adapter:** `src/lib/greenWalletApi.ts`

## Ownership boundary

`relay-rider-beta-001` is the authoritative system of record for the current
Green Wallet domain: Institution/Membership tenant context, Green Route Credit,
Charging Hub reference data, Redemption Request state, and administrative
review metadata.

The standalone `relay-rider-green-wallet` repository is a synthetic reference
client. It mirrors this contract and must not become a second persistence layer.

Credits and redemption requests are separate resources. A Green Route Credit is
an issued program-defined participation benefit. A Redemption Request is a
participant action against issued credit units. Neither resource implies cash
value, charger reservation, payment processing, a charging session, or live
network availability.

## Resources

### Green Route Credit

Canonical fields include:

- `amount_units` — explicit program-defined non-monetary quantity.
- `unit_label` — display/unit vocabulary, currently defaulting to
  `Green Route Credits`.
- `status` — `issued | redeemed | expired`.
- `estimated_miles_reduced` and `estimated_co2_lbs_reduced` — separate impact
  evidence fields. They are never used as a proxy for credit quantity.

Credit earning rules and the real-world value/fulfillment semantics of a unit
remain `[NEEDS FOUNDER INPUT]`.

### Charging Hub

Charging Hub is participant-facing public research-beta reference data, not a
private charger inventory or real-time availability feed.

Canonical machine values:

- status: `candidate | verified | active`
- evidence label: `synthetic | modeled | verified`

`candidate`, `verified`, or `active` describe the Relay Rider program record;
they do not guarantee charger access or availability.

### Redemption Request

A request references a Green Route Credit, an optional participant profile, and
a Charging Hub. It stores requested units, unit label, status, timestamps,
reviewer identity, and review note.

Canonical lifecycle:

`requested → under-review → fulfilled | denied`

Direct `requested → fulfilled` or `requested → denied` transitions are rejected.
`fulfilled` and `denied` are terminal in the current research-beta state machine.

## Current endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/green-route-credits/` | Authenticated tenant member; platform admin sees all | List credits visible through membership-based tenant scoping. |
| `GET` | `/api/green-route-credits/{id}/` | Same tenant rules | Read one visible credit. |
| `GET` | `/api/charging-hubs/` | Public, read-only reference data | List program-configured Charging Hub records. |
| `GET` | `/api/charging-hubs/{id}/` | Public, read-only reference data | Read one Charging Hub record. |
| `GET` | `/api/redemption-requests/` | Authenticated tenant member; platform admin sees all | List visible requests. |
| `GET` | `/api/redemption-requests/{id}/` | Same tenant rules | Read one visible request. |
| `POST` | `/api/redemption-requests/` | Authenticated tenant member | Submit a request against an eligible credit visible to the caller. |
| `PATCH` | `/api/redemption-requests/{id}/` | Institution admin/program staff for that tenant, or platform admin | Move a request through the canonical administrative-review state machine. |

Tenant access is derived from authenticated `Membership` records; client-supplied
`?profile=` parameters do not define authorization.

## Redemption creation invariants

The server validates and controls the domain boundary. On creation:

- the referenced credit must belong to one of the caller's institutions unless
  the caller is a platform admin;
- the request institution is derived from the credit, not from an arbitrary
  first membership or client field;
- the credit must be `issued`;
- requested units must be greater than zero;
- the requested unit label must match the credit unit label;
- participant profile, when supplied, must belong to the credit institution;
- an institution-specific Charging Hub must belong to the same institution;
  a shared public-reference hub with `institution = null` is permitted;
- cumulative committed units across `requested`, `under-review`, and `fulfilled`
  requests may not exceed the credit's `amount_units`;
- `denied` requests do not reserve units for this calculation.

Creation uses a transaction and locks the credit row while evaluating committed
units. Invalid domain input currently returns DRF validation errors (`400 Bad
Request`). This contract does not promise `409`/`422` status codes.

Whether partial redemption should remain supported is `[NEEDS FOUNDER INPUT]`.
The current implementation supports it while preventing cumulative overcommit.

## Administrative review

Server-side status transition rules are:

| Current status | Allowed next status |
|---|---|
| `requested` | `under-review` |
| `under-review` | `fulfilled`, `denied` |
| `fulfilled` | terminal |
| `denied` | terminal |

Reviewer identity and timestamp are server-controlled when review begins or a
terminal decision is recorded. Client attempts to supply `reviewed_by` or
`reviewed_at` are ignored by the serializer.

A dedicated immutable AdminReview/AuditEvent model is **not implemented in this
contract reconciliation**. Adding one belongs to a later explicitly approved
domain change; this document does not claim that capability is live.

## Frontend adapter

`src/lib/greenWalletApi.ts` maps Django snake_case payloads into participant-facing
camelCase projections. Current methods are:

```ts
listCredits()
listChargingHubs()
listRedemptionRequests()
createRedemptionRequest(input)
startRedemptionReview(id)
reviewRedemptionRequest(id, decision, reviewNote)
```

The backend credit response is typed with the canonical status vocabulary only:
`issued | redeemed | expired`. The adapter consumes `amount_units` directly and
does not derive program benefits from mileage or CO2 estimates.

## Temporary research-beta frontend compatibility

Some pre-contract onboarding/session-memory flows still create legacy in-memory
credit objects using:

- `amount` instead of `amountUnits`
- `date` instead of `issuedAt`
- `pending | approved` prototype statuses

These values are explicitly isolated in the frontend type layer as a deprecated
`LegacyGreenRouteCredit` shape. They are **not accepted as canonical Django/API
statuses or fields**. The API adapter emits only `CanonicalGreenRouteCredit`.

Wallet and redemption screens temporarily understand both shapes so the
existing demonstration environment does not regress while the remaining legacy
flows are migrated. New backend/API code must not emit or persist the legacy
shape.

The participant UI also treats issued/legacy-approved credits tied to any
non-denied Redemption Request as unavailable for another request, mirroring the
backend's committed-unit protection.

## Migration 0004

`0004_green_wallet_contract` adds explicit credit units/status and canonical
choice vocabularies. Because pre-0004 Charging Hub and Redemption Request status
fields were free-form, the migration also normalizes known historical values:

- Charging Hub: `Candidate/Verified/Active` → lowercase canonical values
- evidence: `Synthetic/Modeled/Verified` → lowercase canonical values
- redemption: `approved → fulfilled`, `redemption_requested → requested`,
  `under_review → under-review`

Impact estimates are preserved and are not backfilled into `amount_units`.
Existing credits therefore receive the neutral default `0.00 Green Route Credits`
unless program-defined credit quantities are later assigned through an explicit
approved process.

The normalization is intentionally not reversed when rolling back to 0003; the
schema rollback is supported without inventing ambiguous historical semantics.

## Current authorization and research-beta limits

Implemented now:

- membership-based tenant scoping for credits and redemption requests;
- cross-tenant retrieval/update protection;
- role-gated administrative review;
- server-owned reviewer metadata;
- transactional credit-unit overcommit protection;
- public read-only Charging Hub reference endpoint;
- canonical status/unit validation.

Not implemented by this contract reconciliation:

- participant identity derived automatically from a dedicated authenticated
  participant-profile relationship;
- idempotency-key processing;
- immutable review/audit-event persistence;
- real charging-network fulfillment or payment settlement;
- ChargingStation, EVSE, ChargingSession, CreditEligibilityEvent,
  ProgramBudgetLedger, DecisionCard, or other Charging Intelligence entities.

These limitations must remain explicit in research-beta use.

## Open program decisions

The contract still requires founder/program decisions for:

- what earns a Green Route Credit — `[NEEDS FOUNDER INPUT]`;
- what one credit unit represents — `[NEEDS FOUNDER INPUT]`;
- whether partial redemption remains allowed — `[NEEDS FOUNDER INPUT]`;
- when credits expire — `[NEEDS FOUNDER INPUT]`;
- which Charging Hub statuses are selectable under a governed program —
  `[NEEDS FOUNDER INPUT]`;
- what real-world `fulfilled` means and who performs fulfillment —
  `[NEEDS FOUNDER INPUT]`.

No live charging integration should be inferred from this API contract.
