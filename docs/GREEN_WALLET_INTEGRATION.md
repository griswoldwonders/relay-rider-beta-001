# Green Wallet integration

**Status:** Research beta / pilot implementation  
**Host application:** Relay Rider beta  
**Evidence label:** Proposed and synthetic; not an activated payment or charging-settlement system.

## Product boundary

Green Wallet is a first-class Relay Rider destination for Green Route Credits and program-configured benefits. EV Charge Credit redemption is a review-gated request flow. It does not represent cash, a fare, a payment instrument, a certified carbon credit, live charger availability, a charger reservation, or automatic settlement with a charging network.

## Integrated flow

`Route participation → Green Route Credit issued or pending → Wallet displays status → participant selects an eligible Charging Hub → participant confirms a redemption request → administrator reviews → request is fulfilled or denied`

The frontend uses session-memory state so the feature remains previewable without a production account system. The Django backend now includes persistence scaffolding for `ChargingHub` and `RedemptionRequest`, but connecting the frontend to those endpoints requires authentication, authorization, environment configuration, and a deployment database. No live OCPI or charging-network runtime is implied by this integration boundary.

## Frontend surfaces

| File | Responsibility |
|---|---|
| `src/screens/WalletScreen.tsx` | Shows the Green Wallet benefit, under-review, and redeemed states and launches the EV redemption flow. |
| `src/flows/EVChargeCreditRedemptionFlow.tsx` | Details, active-hub selection, confirmation, submission, and request-ID state. |
| `src/screens/WalletAdminScreen.tsx` | Prototype administrator queue for recording a manual program decision on session-memory requests. Preview with `?screen=wallet-admin`. |
| `src/context/AppContext.tsx` | Holds redemption requests and exposes create/review transition helpers. |
| `src/types.ts` | Defines `ChargingHub`, `RedemptionRequest`, and request status types. |

## Backend API surface

The Django router exposes `/api/charging-hubs/` and `/api/redemption-requests/`. Models are in `backend/relay/models.py`, serializers in `backend/relay/serializers.py`, viewsets in `backend/relay/views.py`, and migration `0002_green_wallet_redemption.py`.

Before production use, the viewsets must add authenticated participant/admin authorization, filtered querysets, immutable audit events, idempotent request creation, one-active-request enforcement at the database level, and explicit server-side transition validation. The current `ModelViewSet` exposure is a persistence scaffold for the research beta, not a production authorization boundary.

## Boundary terms

Use the following separation consistently:

- policy: the program rules that decide eligibility and who may act;
- credit: the issued Green Route Credit benefit unit;
- redemption request: the participant's request to use credit at a hub;
- manual program fulfillment / ledger: the administrator's recorded decision and any later accounting trail;
- future settlement: any later integration with external charging or payment systems.

Green Wallet currently covers policy, credit, redemption request, and manual program fulfillment state only. Future settlement is explicitly out of scope.

## Program decisions still required

The program owner must define the earning rule, the meaning of one Green Route Credit, whether a denied request becomes eligible again, whether partial redemption is allowed, credit expiration, hub eligibility, administrator roles, the real-world fulfillment method, and any later ledger/settlement model. Partner APIs must remain behind a separate adapter until those decisions and agreements are complete.

## Preview

The Wallet screen is available through the existing Relay Rider navigation. The prototype administrator view can be opened with `?screen=wallet-admin`. The default frontend build is static and can be deployed to a permanent host; durable participant workflows require the Django service and database to be deployed as well.
