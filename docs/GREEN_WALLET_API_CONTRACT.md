# Green Wallet API contract and adapter draft

**Status:** Draft for Relay Rider beta integration  
**Base path:** `/api`  
**Current backend:** Django REST Framework  
**Current frontend adapter:** `src/lib/greenWalletApi.ts`

## Integration boundary

Relay Rider beta is the canonical host for participant identity, Green Wallet navigation, credit activity, and administrator review. The standalone Green Wallet remains a UX reference until both applications share a stable contract.

The API must model credits and redemption requests separately. A credit is an issuance or activity record. A redemption request is a participant action against a credit. The API must not imply cash value, charger reservation, payment processing, or live network availability.

## Resources

### Green Route Credit

A credit is linked to the Relay Rider profile and, optionally, the corridor that generated it. Credit records should be treated as immutable issuance history. The current backend model exposes mileage and CO2 estimates; before production, a dedicated unit and earning-rule field should be added rather than inferring reward units from mileage.

### Charging Hub

A Charging Hub is a program-configured location. `candidate` hubs are informational; `verified` hubs may be selectable for pilot review; `active` hubs are eligible for the current program. `evidence_label` describes the confidence of the program record and must not be presented as live availability.

### Redemption Request

A request references one credit, one participant profile, and one Charging Hub. It records requested units, status, timestamps, reviewer identity, and review notes. A request is not fulfillment itself; fulfillment is a recorded program decision until a later partner adapter is implemented.

## Endpoints

| Method | Endpoint | Actor | Purpose |
|---|---|---|---|
| `GET` | `/api/green-route-credits/?profile={id}` | Participant or admin | List credits visible to the authenticated actor. |
| `GET` | `/api/charging-hubs/?status=verified` | Authenticated participant/admin | List hubs eligible for the current pilot. |
| `GET` | `/api/redemption-requests/?profile={id}` | Participant or admin | List the actor’s requests, or admin-visible queue. |
| `POST` | `/api/redemption-requests/` | Participant | Submit one redemption request. |
| `PATCH` | `/api/redemption-requests/{id}/` | Admin only | Approve or deny a request with a review note. |
| `GET` | `/api/redemption-requests/{id}/` | Participant or admin | Read a single request and its current status. |

The existing beta router already exposes the three resource families. The current `ModelViewSet` implementation is a persistence scaffold. It must be tightened before real participant data is used.

## Create request

### Request

```http
POST /api/redemption-requests/
Content-Type: application/json
Idempotency-Key: 8b6b4f6e-8d4f-4d6d-9d8d-ev-credit-001
```

```json
{
  "credit": "credit_123",
  "profile": "profile_456",
  "charging_hub": "hub_campus_west",
  "requested_units": 120,
  "unit_label": "Green Route Credits"
}
```

The server must derive `profile` from the authenticated session rather than trusting a participant-supplied profile ID. The explicit profile field is retained in the draft because the existing Django model requires the relationship, but production authorization must override or validate it.

### Response: `201 Created`

```json
{
  "id": "request_789",
  "credit": "credit_123",
  "profile": "profile_456",
  "charging_hub": "hub_campus_west",
  "requested_units": "120.00",
  "unit_label": "Green Route Credits",
  "status": "requested",
  "requested_at": "2026-08-26T00:00:00Z",
  "reviewed_at": null,
  "reviewed_by": "",
  "review_note": ""
}
```

The server must return `409 Conflict` when the credit already has an active request, `422 Unprocessable Entity` when the credit is not eligible, and `403 Forbidden` when the actor cannot use the credit.

## Review request

### Request

```http
PATCH /api/redemption-requests/request_789/
Content-Type: application/json
```

```json
{
  "status": "fulfilled",
  "review_note": "Approved for the verified Campus West Garage pilot location."
}
```

Only authenticated administrators may perform this transition. The server must set `reviewed_at` and `reviewed_by`, ignore participant-provided reviewer fields, and append an audit event. A denial must require a non-empty review note.

### Valid statuses

| Status | Meaning | Allowed next status |
|---|---|---|
| `requested` | Participant submitted a request. | `under-review`, `fulfilled`, `denied` |
| `under-review` | Administrator has opened or claimed the request. | `fulfilled`, `denied` |
| `fulfilled` | Program approved the request for fulfillment. | Terminal in the pilot. |
| `denied` | Program rejected the request. | Terminal unless a separate appeal flow is added. |

The system must not automatically deduct, transfer, or convert credits until the program owner defines the unit, fulfillment method, and reversal policy.

## Frontend adapter

`src/lib/greenWalletApi.ts` provides a typed adapter with these methods:

```ts
listCredits(profileId?)
listChargingHubs()
listRedemptionRequests(profileId?)
createRedemptionRequest(input)
reviewRedemptionRequest(id, decision, reviewNote)
```

The adapter maps Django snake_case payloads to the beta’s camelCase domain types and throws `GreenWalletApiError` with HTTP status and response details. It uses `VITE_API_BASE_URL` when configured and falls back to the local beta API at `http://127.0.0.1:8877/api`.

The next wiring step is to add an API-backed repository mode to `AppContext`, for example:

```ts
const credits = storageMode === 'api'
  ? await greenWalletApi.listCredits(userProfile?.id)
  : demoCredits;
```

The UI should retain a session-memory fallback for demos, but API failures must be visible to the user and must not silently make a request look fulfilled.

## Authorization requirements before production

The current backend is configured with `AllowAny`, which is acceptable only for local development. Before deployment, implement authenticated request handling, participant-filtered querysets, administrator-only review actions, CSRF or token protection appropriate to the deployment, and server-side validation of credit ownership and hub eligibility.

Add database-level or transactional protection for one active request per credit. Add an audit event for creation, review, denial, fulfillment, and any future cancellation. Do not accept `reviewed_by`, `reviewed_at`, or participant identity as authoritative client input.

## Rollout order

1. Keep the adapter unused behind a feature flag and validate response mapping against the local Django API.
2. Add API-backed reads for hubs and credits while retaining local submission fallback.
3. Add authenticated request creation with idempotency and duplicate protection.
4. Add administrator review authorization and audit events.
5. Run a supervised pilot with no partner-network settlement.
6. Add a partner adapter only after the program defines unit conversion, fulfillment, reversals, support ownership, and availability behavior.

## Open program decisions

The API cannot safely finalize the product until the program defines what earns a credit, what one unit represents, whether partial redemption is allowed, whether denied requests restore eligibility, when credits expire, which hub statuses are eligible, and what “fulfilled” means in the real world.
