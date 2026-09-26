# Green Wallet integration

**Status:** Local demo fixes verified and independently reviewed; GitHub CI and accountable approval required before merge. No deployment authorized.
**Host application:** Relay Rider beta  
**Evidence label:** Proposed and synthetic; not an activated payment or charging-settlement system.

## Product boundary

Green Wallet is a first-class Relay Rider destination for Green Route Credits and program-configured benefits. EV Charge Credit redemption is a review-gated request flow. It does not represent cash, a fare, a payment instrument, a certified carbon credit, live charger availability, a charger reservation, or automatic settlement with a charging network.

## Integrated flow

`Route participation → Green Route Credit issued or pending → Wallet displays status → participant selects an eligible Charging Hub → participant confirms a redemption request → administrator reviews → request is fulfilled or denied`

The in-app Green Wallet has two deliberately separate preview paths:

- **Embedded Green Route Credits demo:** `src/greenRoute/` keeps synthetic claims, draft campaigns, activity projections, and append-only review events in page-session memory. Navigation retains state; reload, **Reset demo**, or the app's **Clear session data** restores the fixture. No data is read from or written to persistent browser storage. The former `rr-green-route-credits-demo-v1` key is deleted only by the existing approved security cleanup boundary; blocked storage is tolerated and never reused. The fixture is Maya Chen in the fictional Pasadena–Glendale program. Its available balance is **$2.60 / 21.8 kWh**, derived from the unchanged seed ledger after consumed amounts and pending holds. Dollar and kWh values are illustrative caps, not cash or canonical credit units. Voucher **RR-PGC-9A7K-2026** is simulated and not redeemable. Use synthetic input only; receipt upload is disabled.
- **Classic hub-redemption preview:** `WalletScreen`, `EVChargeCreditRedemptionFlow`, and `WalletAdminScreen` still use `AppContext` session-memory state. They do not load or synchronize the embedded demo ledger. In a fresh session, credits, requests, and Charging Hubs are empty. The existing API adapter in `src/lib/greenWalletApi.ts` is separate and is not wired into these screens by this embed.

The role switch inside the embedded module and the hub review preview are demo navigation, not authorization boundaries. No live ChargePoint, Tesla, Stripe, or OCPI integration is activated. Green Wallet is not a charging network, eMSP, universal wallet, cash account, or wages. AQMD/Rule 2202 evidence does not mint benefits or certified carbon credits.

The route-participation-to-redemption sequence above describes the classic program workflow, not a new connection between the simulated monetary demo and canonical Django credit units. The canonical system of record remains the Django backend; the in-memory demo is not a second production ledger.

## Frontend surfaces

| File | Responsibility |
|---|---|
| `src/screens/GreenWalletHost.tsx` | Default Green Wallet destination after onboarding. Hosts the Green Route Credits prototype inside Relay Rider. |
| `src/greenRoute/` | Commuter dashboard, partner voucher, claim form, ledger, rules, and program-admin campaign/claim review (demo / page-session memory). |
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

## Demo accounting and validation

- Available units are the fixed monthly allocation minus approved/redeemed consumption and pending/flagged holds. No hard-coded balance override or duplicated mutable balance/claim array remains.
- Submission atomically checks the current page-session store and holds both dollar and kWh units. Duplicate receipt references or IDs and cumulative overcommit are rejected without mutation.
- Approval converts an existing hold to consumed units without a second deduction. Decline releases both units. Flagging retains the hold. Terminal decisions and unknown/invalid transitions cannot debit or release again.
- Current status is a projection; `reviewEvents` preserves append-only synthetic submission/review evidence until session reset. This is not the canonical server ledger or a durable audit log.
- Amounts use safe integer cents and tenths of kWh. Invalid amounts, unsupported precision, overflow, impossible dates/times, and dates outside the fixed September 2026 fixture period are rejected. No monthly rollover is implied.
- The original illustrative caps remain unchanged: $30/month, 50 kWh/month, $12/session, weekday commute-related charging. They do not define an approved real-world program.
- Campaigns are DRAFT-ONLY metadata. Saving them does not change eligibility, caps, or claim calculations. Invalid/zero caps and a session cap greater than the draft monthly cap are rejected, not replaced with defaults. Activating sponsor policies remains separately scoped.

## Verification and release boundary

The original `d93fc56` WIP failed the security configuration gate because of persistent browser-storage references. The follow-up removes those references rather than weakening the scanner. The initial delegated implementation stopped at a provider usage limit; its partial work was inspected and completed locally.

Verified locally:

- `npm run check`: passed.
- `npm test`: 129 tests passed across 14 files, including the default parallel run.
- `npm test -- --maxWorkers=1`: 129 tests passed.
- `npm run security:check`: passed with the unchanged scanner; production audit reports zero vulnerabilities.
- `npm audit --audit-level=high`: zero vulnerabilities across all dependencies.
- `npm run build` and `git diff --check`: passed.
- Test-first failures observed for storage cleanup, ledger/UI integration, campaign disclosure, reset controls, clipboard rejection, and out-of-period dates before their fixes.
- Local production-build browser checks passed on desktop (1280px) and mobile (390px): initial holds/balances, nonredeemable voucher, claim/duplicate handling, classic wallet and hub queue navigation, flag/decline/approval accounting, draft validation, reset/reload, and onboarding skip. No page runtime errors or mobile page-width overflow. External requests were blocked in the isolated synthetic browser. Screenshots were visually inspected; this is not a full accessibility audit.

Independent review found no blockers for a synthetic-demo PR. It checked the uncommitted diff, new tests, storage policy and ledger invariants; the parent independently ran all tests/build/browser checks above. The submission receipt now explicitly labels its status as the original submission acknowledgment, not the current decision. Non-blocking follow-ups: stronger mocked legacy-key deletion coverage and clearing component-local form drafts if a future route allows session clearing while the wallet stays mounted (the current Security Center route unmounts it). Remote CI and accountable founder/code-owner approval remain release gates. No merge, deployment, backend connection, charging-network activation, or real participant use is authorized by these local results.

## Source provenance and integration scope

Imported through the authenticated GitHub API from **`griswoldwonders/relay-rider-green-wallet`**, pinned main commit **`ceda8cf949d745558d04060d9b31e176dc6f7a3f`**, prefix **`integrations/relay-rider-beta-001`**, following its `APPLY.md`.

The original source pack was imported unchanged at `d93fc56`; the follow-up deliberately adapts its program logic, storage adapter, UI, and tests to the host policy. `src/App.tsx` remains a minimal lazy-host route merge rather than the source pack's full replacement. AppContext's session-clear action also resets demo memory; the approved security cleanup list includes the old demo key. No dependency, backend, infrastructure, or classic-wallet implementation/test changes are part of this fix.

The demo remains client-only and synthetic. Its role switch is not authentication, draft campaigns are not operational policies, and local review history is not a durable server audit log. Real program caps, earning rules, credit-unit meaning, provider agreements, authentication and fulfillment still require separate approval and implementation.
