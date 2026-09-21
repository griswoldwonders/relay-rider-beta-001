# Green Wallet integration

**Status:** Work in progress — security gate blocked; not ready to merge or deploy
**Host application:** Relay Rider beta  
**Evidence label:** Proposed and synthetic; not an activated payment or charging-settlement system.

## Product boundary

Green Wallet is a first-class Relay Rider destination for Green Route Credits and program-configured benefits. EV Charge Credit redemption is a review-gated request flow. It does not represent cash, a fare, a payment instrument, a certified carbon credit, live charger availability, a charger reservation, or automatic settlement with a charging network.

## Integrated flow

`Route participation → Green Route Credit issued or pending → Wallet displays status → participant selects an eligible Charging Hub → participant confirms a redemption request → administrator reviews → request is fulfilled or denied`

The in-app Green Wallet has two deliberately separate preview paths:

- **Embedded Green Route Credits demo:** `src/greenRoute/` uses browser `localStorage` under `rr-green-route-credits-demo-v1` for simulated claims, campaign rules, ledger entries, and balance snapshots. The initial fixture is Maya Chen in the Pasadena–Glendale Clean Commute Pilot, with **$18.60 remaining**. Dollar and kWh values are illustrative sponsor-benefit caps, not cash or canonical credit units. Voucher **RR-PGC-9A7K-2026** is simulated and not redeemable. Use synthetic input only; do not enter real receipts, personal charging history, or sensitive information. Demo state survives reloads and is separate from the classic session-data clearing control; remove this localStorage key to reset the fixture.
- **Classic hub-redemption preview:** `WalletScreen`, `EVChargeCreditRedemptionFlow`, and `WalletAdminScreen` still use `AppContext` session-memory state. They do not load or synchronize the embedded demo ledger. In a fresh session, credits, requests, and Charging Hubs are empty. The existing API adapter in `src/lib/greenWalletApi.ts` is separate and is not wired into these screens by this embed.

The role switch inside the embedded module and the hub review preview are demo navigation, not authorization boundaries. No live ChargePoint, Tesla, Stripe, or OCPI integration is activated. Green Wallet is not a charging network, eMSP, universal wallet, cash account, or wages. AQMD/Rule 2202 evidence does not mint benefits or certified carbon credits.

The route-participation-to-redemption sequence above describes the classic program workflow, not a new connection between the simulated monetary demo and canonical Django credit units. The canonical system of record remains the Django backend; localStorage is not a second production ledger.

## Frontend surfaces

| File | Responsibility |
|---|---|
| `src/screens/GreenWalletHost.tsx` | Default Green Wallet destination after onboarding. Hosts the Green Route Credits prototype inside Relay Rider. |
| `src/greenRoute/` | Commuter dashboard, partner voucher, claim form, ledger, rules, and program-admin campaign/claim review (demo / localStorage). |
| `src/screens/WalletScreen.tsx` | Classic hub-redemption wallet (kept for acceptance tests and as a secondary surface). |
| `src/flows/EVChargeCreditRedemptionFlow.tsx` | Details, active-hub selection, confirmation, submission, and request-ID state. |
| `src/screens/WalletAdminScreen.tsx` | Prototype administrator queue for recording a manual program decision on session-memory requests. Preview with `?screen=wallet-admin`. |
| `src/context/AppContext.tsx` | Holds redemption requests and exposes create/review transition helpers. |
| `src/types.ts` | Defines `ChargingHub`, `RedemptionRequest`, and request status types. |

## Backend API surface

The Django router exposes credit, policy, Charging Hub, and redemption-request resources. Models, serializers, permissions, and viewsets are in `backend/relay/`; migrations `0002` through `0007` include the wallet's persistence, tenant, contract, ledger, and operational-hardening changes.

The current backend is **not** an unrestricted `ModelViewSet` scaffold: Charging Hubs are public read-only reference data; credits and requests have participant-owned/tenant-scoped querysets; request creation and review use distinct permissions. Request creation locks the credit row to prevent cumulative overcommit, supports idempotency keys, and records a `HOLD` ledger entry. The serializer enforces `requested → under-review → fulfilled | denied`; terminal decisions record `DEBIT` or `RELEASE`, with server-controlled reviewer metadata. `WalletLedgerEntry` has immutable model/queryset guards. These are existing backend controls, not additions from this UI embed and not a claim of live deployment or full production readiness.

See [Green Wallet API Contract](GREEN_WALLET_API_CONTRACT.md), the current backend implementation, and [deployment requirements](DEPLOYMENT.md). Connecting a frontend still requires the intended authenticated tenant environment and API integration. Neither the classic session-memory review controls nor the embedded demo role switch substitutes for those server controls.

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

The Wallet screen is the in-app Green Wallet. Home and Profile retain the introduction flow (`?screen=wallet-onboarding`); completing or skipping it opens the embedded wallet. Preview the wallet directly with `?screen=wallet`.

- **Open hub redemption wallet** opens the unchanged classic `WalletScreen` inside the host. Its existing **Back to profile** label returns to the embedded wallet in this host context; the host's own **Back to profile** returns to Profile.
- **Open hub review queue** opens the existing `WalletAdminScreen`, also available at `?screen=wallet-admin`. **Return to wallet** opens the embedded wallet.
- Commuter and program-administrator views within the embedded demo are independent of the classic hub queue.

Browser/visual review is separate from automated route and acceptance tests; earlier classic-wallet verification notes do not establish verification of this embed.

## WIP verification and security blocker

The founder authorized a feature-branch WIP push only: no merge or deployment. The existing security policy has not been weakened or bypassed.

- `npm run check`: passed.
- `npm test -- --maxWorkers=1`: 62 tests passed across 10 files. The earlier default parallel run hit worker-startup timeouts; it is not recorded as a passing gate.
- `npm run build`: passed.
- `git diff --cached --check`: passed before this documentation update.
- Added-line credential and unsafe-execution pattern scans: no matches (limited static checks, not a full security audit).
- `npm run security:check`: **failed**. The repository allows browser storage APIs only in `src/security/securityPolicy.ts`. The imported persistence adapter `src/greenRoute/storage.ts` and test references in `src/App.green-wallet.test.tsx` and `src/screens/GreenWalletHost.acceptance.test.tsx` violate that gate. The chained dependency audit did not run because the configuration check failed first.
- Browser/visual verification remains outstanding.
- Independent review found no added secrets, exfiltration paths, unsafe execution, or unrelated changes; it approved feature-branch archival only, not merge or deployment. It also identified prototype defects: claims do not reserve dollar balances or enforce remaining kWh, aggregate approvals can exceed available funds, declines do not restore reserved kWh, and stored campaign settings do not govern claim eligibility/estimates. Stored state lacks schema validation and write-error handling. These are unresolved WIP limitations, not acceptable accounting or production behavior.

Before merge, resolve the persistence-policy conflict in an explicitly reviewed change (for example, switch this synthetic demo to session-memory state), rerun all required gates, and finish browser verification. Do not approve an exception merely to make the scanner pass. This WIP is not production-ready and does not activate a program or benefit ledger.

## Source provenance and integration scope

Imported through the authenticated GitHub API from **`griswoldwonders/relay-rider-green-wallet`**, pinned main commit **`ceda8cf949d745558d04060d9b31e176dc6f7a3f`**, prefix **`integrations/relay-rider-beta-001`**, following its `APPLY.md`.

The five `src/greenRoute/*` files and `src/screens/GreenWalletHost.tsx` / `GreenWalletHost.acceptance.test.tsx` are copied unchanged. `src/App.tsx` is a minimal lazy-host route merge, not the source pack's full replacement. `src/App.green-wallet.test.tsx` adds route-level regression coverage. This document adapts the pack to the existing backend reality and storage boundaries; README Incentives describes the in-app demo. No dependency, backend, authentication, infrastructure, or existing classic-wallet implementation/test changes are part of this embed.

The imported demo is not an authoritative accounting implementation: its specified initial remaining snapshot is hard-coded rather than reconciled to the seed ledger, and its client-only claim/campaign behavior is not the canonical server policy engine. Preserve the approved fixture; reconcile those limitations in a separately scoped source change before considering real participant use.
