# Green Route Credit Lifecycle v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Green Route Credit Lifecycle v1 so Relay Rider can deterministically issue, account for, redeem, review, expire, and audit institution-sponsored mobility-benefit units for authenticated participants without adding Charging Intelligence or payment settlement.

**Architecture:** Extend the existing Django Green Wallet domain additively, move lifecycle invariants into focused application services, make immutable ledger events the accounting source for a server-side wallet projection, and replace single-credit/ChargingHub redemption with generic `ProgramBenefit` redemption plus pooled `RedemptionAllocation` rows. Preserve legacy Green Wallet fields during migration, classify historical records as pre-v1 where provenance cannot be proven, and cut the React UI over only after the new institution-scoped API and synthetic Pasadena acceptance chain pass.

**Tech Stack:** Django 5.2 / Django REST Framework / Django ORM transactions, SQLite for current local/CI compatibility with PostgreSQL-safe locking patterns, React 19, TypeScript 7, Vite 8, Vitest 4, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-04-green-route-credit-lifecycle-v1-design.md`

## Global Constraints

- Green Wallet is a general institution-sponsored mobility-benefit wallet; EV charging is one benefit category only.
- Green Route Credits are program-defined units, not cash, wages, fares, charging reimbursement, certified carbon credits, utility credits, or automatic payments.
- Do not add live charger-network APIs, ChargingStation, EVSE, ChargingSession, automatic settlement, or Charging Intelligence domains.
- V1 issuance is evidence-backed, deterministically calculated, and `institution_admin` approved.
- Institutions may configure only platform-defined deterministic rule types and validated parameters; no arbitrary executable formulas.
- `program_staff` may triage redemption to `under-review`; only `institution_admin` or `platform_admin` may fulfill or deny.
- Redemption is all-or-nothing per request.
- Mandatory client-generated UUID idempotency is required on v1 redemption requests.
- Program and participant issuance caps are enforced atomically at issuance.
- Finite `ProgramBenefit` capacity is reserved at request creation and consumed/released on terminal review.
- Oldest-expiring eligible issuance buckets fund pooled redemption first.
- Ledger rows are append-only and interpreted by event semantics, never by blindly summing `quantity_delta`.
- Participant wallet quantities come only from the server-side projection; the canonical frontend must not recompute balances from raw statuses.
- Existing migrations `0001` through `0005_green_wallet_ledger_and_policy` remain unchanged.
- Existing unverifiable historical credits must be labeled legacy/pre-v1; do not invent policy or evidence provenance.
- Synthetic test constants are fixtures only and must never become production defaults.
- Current production-readiness security gates remain separate; successful lifecycle tests do not authorize real commuter-data operation.

---

## Target File Structure

### Existing files to modify

- `backend/relay/models.py`
- `backend/relay/permissions.py`
- `backend/relay/admin.py`
- `backend/config/urls.py`
- `src/types.ts`
- `src/lib/greenWalletApi.ts`
- `src/screens/WalletScreen.tsx`
- `src/context/AppContext.tsx`
- `docs/GREEN_WALLET_API_CONTRACT.md`

### New backend files

- `backend/relay/migrations/0006_green_wallet_lifecycle_v1_spine.py`
- `backend/relay/migrations/0007_green_wallet_lifecycle_v1_constraints.py`
- `backend/relay/services/__init__.py`
- `backend/relay/services/errors.py`
- `backend/relay/services/participant_identity.py`
- `backend/relay/services/policy_rules.py`
- `backend/relay/services/issuance.py`
- `backend/relay/services/wallet_projection.py`
- `backend/relay/services/redemption.py`
- `backend/relay/services/redemption_review.py`
- `backend/relay/services/expiration.py`
- `backend/relay/green_wallet_v1_serializers.py`
- `backend/relay/green_wallet_v1_views.py`
- `backend/relay/management/commands/expire_green_route_credits.py`

### New backend tests

- `backend/relay/test_green_wallet_v1_schema.py`
- `backend/relay/test_green_wallet_v1_identity.py`
- `backend/relay/test_green_wallet_v1_policy.py`
- `backend/relay/test_green_wallet_v1_issuance.py`
- `backend/relay/test_green_wallet_v1_projection.py`
- `backend/relay/test_green_wallet_v1_redemption.py`
- `backend/relay/test_green_wallet_v1_review.py`
- `backend/relay/test_green_wallet_v1_expiration.py`
- `backend/relay/test_green_wallet_v1_api.py`
- `backend/relay/test_green_wallet_v1_pasadena_acceptance.py`

### New frontend files

- `src/flows/ProgramBenefitRedemptionFlow.tsx`
- `src/lib/greenWalletApi.v1.test.ts`
- `src/screens/WalletScreen.v1.test.tsx`
- `src/flows/ProgramBenefitRedemptionFlow.test.tsx`

---

### Task 1: Add the v1 schema spine and legacy classification

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/migrations/0006_green_wallet_lifecycle_v1_spine.py`
- Test: `backend/relay/test_green_wallet_v1_schema.py`

**Interfaces:**
- Produces: participant profile ownership, participant Membership role, policy-framework fields, evidence/issuance models, ProgramBenefit, pooled allocations, capacity reservations, v1 provenance fields, and ledger references.
- Consumes: existing `Institution`, `Membership`, `Profile`, `GreenRouteCredit`, `ProgramBenefitPolicy`, `RedemptionRequest`, `ChargingHub`, `WalletLedgerEntry`.

- [ ] **Step 1: Write schema tests that describe the additive migration contract**

Create tests proving claimed Profile uniqueness per user/institution, multiple unclaimed Profiles, participant membership role, legacy credit provenance default, nullable legacy redemption credit/hub FKs, and single-use evidence linkage.

- [ ] **Step 2: Run the schema test and verify it fails**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema -v 2
```

Expected: FAIL because v1 fields/models do not exist.

- [ ] **Step 3: Add participant identity and policy-framework fields**

Add nullable `Profile.user` with `SET_NULL` and conditional unique `(user, institution)` where user is non-null. Add `participant` to Membership roles. Extend ProgramBenefitPolicy with `framework_version`, `rule_type`, `parameters`, `activated_by`, and `activated_at`. Keep existing `max_units_per_participant`, `max_units_program_wide`, and `expiry_days` as canonical cap/expiry fields.

- [ ] **Step 4: Add evidence and issuance provenance models**

Add `QualifyingEvidence` with institution/profile PROTECT FKs, source types `relay_rider | authorized_import | admin_attestation`, evidence label, observed time, provenance JSON, created-by user, and unique nonblank source reference per institution/source type.

Add `IssuanceDecision` with statuses `evaluated | approved | denied`, institution/profile/policy, calculated units, evaluation metadata, evaluation/approval/denial metadata, and correlation ID.

Add `IssuanceDecisionEvidence` where `evidence` is OneToOne to prevent double-awarding the same v1 evidence.

- [ ] **Step 5: Add generic ProgramBenefit and pooled-redemption models**

Add ProgramBenefit with approved types, active lifecycle, unit bounds/increment, optional finite capacity, optional ChargingHub metadata, and effective dates. Relax legacy RedemptionRequest credit/charging_hub FKs to nullable and add nullable program_benefit. Add RedemptionAllocation and BenefitCapacityReservation.

- [ ] **Step 6: Add v1 provenance fields to credits and ledger**

GreenRouteCredit gets nullable policy/issuance_decision/issued_at/expires_at and provenance_state `legacy | v1`. WalletLedgerEntry gets nullable redemption_allocation and self-reference reverses_entry, both PROTECT.

- [ ] **Step 7: Generate and inspect migration `0006`**

```bash
cd backend
python manage.py makemigrations relay --name green_wallet_lifecycle_v1_spine
python manage.py makemigrations --check --dry-run
```

Expected: 0006 then No changes detected.

- [ ] **Step 8: Run schema and existing Green Wallet tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema relay.test_green_wallet_contract relay.test_green_wallet_ledger_and_policy relay.test_green_wallet_pasadena_acceptance relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 9: Verify 0006 forward/backward/forward**

```bash
cd backend
python manage.py migrate relay 0005
python manage.py migrate relay 0006
python manage.py check
python manage.py migrate relay 0005
python manage.py migrate relay 0006
python manage.py migrate
```

Expected: PASS.

- [ ] **Step 10: Commit Task 1**

```bash
git add backend/relay/models.py backend/relay/migrations/0006_green_wallet_lifecycle_v1_spine.py backend/relay/test_green_wallet_v1_schema.py
git commit -m "feat(wallet): add lifecycle v1 schema spine"
```

---

### Task 2: Bind authenticated users to participant Profiles and enforce role boundaries

**Files:**
- Modify: `backend/relay/permissions.py`
- Create: `backend/relay/services/__init__.py`
- Create: `backend/relay/services/errors.py`
- Create: `backend/relay/services/participant_identity.py`
- Test: `backend/relay/test_green_wallet_v1_identity.py`

**Interfaces:**
- Produces: `resolve_participant_profile(*, user, institution)`, `GreenWalletDomainError`, operation-specific role helpers.

- [ ] **Step 1: Define transport-agnostic domain error**

```python
class GreenWalletDomainError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
```

- [ ] **Step 2: Write identity/RBAC tests**

Test claimed/unclaimed resolution, wrong same-tenant user, multi-institution user, viewer without claimed Profile, program_staff triage-only, and institution_admin approval/finalization.

- [ ] **Step 3: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity -v 2
```

- [ ] **Step 4: Implement participant identity resolver**

Resolve exactly `authenticated user + institution -> Profile`; on failure raise `PARTICIPANT_PROFILE_NOT_CLAIMED`.

- [ ] **Step 5: Split permissions by operation**

```python
TRIAGE_ROLES = {'program_staff', 'institution_admin'}
TERMINAL_REVIEW_ROLES = {'institution_admin'}
ISSUANCE_APPROVAL_ROLES = {'institution_admin'}
```

Platform admin remains explicit bypass.

- [ ] **Step 6: Run identity plus existing security/RBAC tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add backend/relay/permissions.py backend/relay/services backend/relay/test_green_wallet_v1_identity.py
git commit -m "feat(wallet): bind participant identity and role gates"
```

---

### Task 3: Implement deterministic policy rules and governed activation

**Files:**
- Create: `backend/relay/services/policy_rules.py`
- Modify: `backend/relay/services/errors.py`
- Test: `backend/relay/test_green_wallet_v1_policy.py`

**Interfaces:**
- Produces: `PolicyEvaluationResult`, `validate_policy_configuration`, `activate_policy`, `evaluate_policy`.

- [ ] **Step 1: Write policy tests**

Fixture-only parameters: 5 units/event and allowed source list in `parameters`; participant cap 20, program cap 100, expiry 90 days in existing policy columns. Test deterministic output, unknown rule rejection, invalid values, out-of-period policy, activation retiring prior active version, and non-admin activation denial.

- [ ] **Step 2: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_policy -v 2
```

- [ ] **Step 3: Implement code-owned rule registry**

Register only `verified_participation`. Validate positive units/event, nonempty evidence sources, positive existing cap/expiry fields, and valid effective dates.

- [ ] **Step 4: Implement governed activation**

Inside one transaction authorize admin/platform admin, validate, lock institution policy rows, retire any prior active version, and activate requested version with actor/time.

- [ ] **Step 5: Implement deterministic evaluation**

Require active/in-period policy; same institution/profile evidence; allowed source types; no evidence already linked to an IssuanceDecision. Calculate units/event × evidence count with Decimal.

- [ ] **Step 6: Run policy tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_policy -v 2
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add backend/relay/services/policy_rules.py backend/relay/services/errors.py backend/relay/test_green_wallet_v1_policy.py
git commit -m "feat(wallet): add deterministic benefit policy rules"
```

---

### Task 4: Implement evidence-backed issuance and atomic ISSUE events

**Files:**
- Create: `backend/relay/services/issuance.py`
- Modify: `backend/relay/admin.py`
- Test: `backend/relay/test_green_wallet_v1_issuance.py`

**Interfaces:**
- Produces: `evaluate_issuance`, `approve_issuance`.

- [ ] **Step 1: Write issuance tests**

Test complete evidence linking, single-use evidence, staff approval denial, admin issuance creates one credit/one ISSUE, replay idempotency, participant/program caps, and forced ledger-write rollback.

- [ ] **Step 2: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance -v 2
```

- [ ] **Step 3: Implement evaluation**

Call evaluate_policy, create evaluated IssuanceDecision, link evidence, create no credit.

- [ ] **Step 4: Implement atomic approval**

Lock decision/policy/Profile; replay approved decision to existing credit; authorize admin/platform admin; enforce existing model caps against prior v1 issuance; create v1 credit with issued_at/expires_at; create exactly one ISSUE; mark decision approved in same transaction.

- [ ] **Step 5: Make GreenRouteCredit read-only in Django Admin**

Custom ModelAdmin denies add/change/delete.

- [ ] **Step 6: Run issuance and existing Green Wallet tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance relay.test_green_wallet_contract relay.test_green_wallet_ledger_and_policy relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add backend/relay/services/issuance.py backend/relay/admin.py backend/relay/test_green_wallet_v1_issuance.py
git commit -m "feat(wallet): govern credit issuance and issue ledger events"
```

---

### Task 5: Make ledger events the authoritative wallet projection

**Files:**
- Create: `backend/relay/services/wallet_projection.py`
- Test: `backend/relay/test_green_wallet_v1_projection.py`

- [ ] **Step 1: Write accounting tests**

Prove ISSUE/HOLD/RELEASE/DEBIT/EXPIRE transitions, signed ADJUSTMENT to available, exact REVERSAL inverse, and negative-state rejection.

- [ ] **Step 2: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_projection -v 2
```

- [ ] **Step 3: Implement BucketProjection and WalletProjection dataclasses**

Track issued/available/held/fulfilled/expired per credit and aggregated wallet.

- [ ] **Step 4: Implement explicit event semantics**

ISSUE adds issued+available; HOLD available->held; RELEASE held->available; DEBIT held->fulfilled; EXPIRE available->expired; signed ADJUSTMENT changes available; REVERSAL applies exact inverse of referenced unreversed quantity. Reject any negative state.

- [ ] **Step 5: Run projection tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_projection -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add backend/relay/services/wallet_projection.py backend/relay/test_green_wallet_v1_projection.py
git commit -m "feat(wallet): add authoritative ledger projection"
```

---

### Task 6: Implement pooled ProgramBenefit redemption and capacity reservation

**Files:**
- Create: `backend/relay/services/redemption.py`
- Modify: `backend/relay/services/errors.py`
- Test: `backend/relay/test_green_wallet_v1_redemption.py`

- [ ] **Step 1: Write pooled-redemption tests**

Use Award A=5 earlier expiry, Award B=10 later expiry, Request=7, expected 5+2. Test required/valid UUID, replay, expiry ordering, ties, partial bucket allocation, insufficient balance rollback, same-tenant wrong participant, cross-tenant benefit, finite capacity reservation, capacity exhaustion rollback.

- [ ] **Step 2: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption -v 2
```

- [ ] **Step 3: Implement UUID replay**

Validate with uuid.UUID; replay scope `(institution, profile, idempotency_key)`.

- [ ] **Step 4: Implement pooled allocation transaction**

Resolve participant server-side; validate benefit; replay UUID; lock v1 credits ordered expires_at/issued_at/id; project and fully fund; lock/check capacity; create request with legacy credit/hub null; create allocations/HOLDs/reservation; commit all-or-nothing.

- [ ] **Step 5: Run redemption plus legacy regression tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption relay.test_green_wallet_ledger_and_policy relay.test_green_wallet_pasadena_acceptance -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add backend/relay/services/redemption.py backend/relay/services/errors.py backend/relay/test_green_wallet_v1_redemption.py
git commit -m "feat(wallet): add pooled benefit redemption"
```

---

### Task 7: Make review processing atomic and role-separated

**Files:**
- Create: `backend/relay/services/redemption_review.py`
- Modify: `backend/relay/models.py`
- Create: `backend/relay/migrations/0007_green_wallet_lifecycle_v1_constraints.py`
- Test: `backend/relay/test_green_wallet_v1_review.py`

- [ ] **Step 1: Write review tests**

Prove staff triage only, admin terminal decisions, no direct requested->terminal, one terminal ledger effect per allocation, capacity consume/release, rollback on ledger failure, duplicate terminal protection.

- [ ] **Step 2: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_review -v 2
```

- [ ] **Step 3: Add reviewed_by_user FK**

Nullable FK for v1 audit while retaining legacy string reviewer.

- [ ] **Step 4: Implement start_review with row lock**

Require requested; authorize staff/admin/platform admin; set under-review/reviewer metadata atomically.

- [ ] **Step 5: Implement terminal transaction**

Lock request/allocations/reservation; require under-review; admin/platform only; fulfilled=>DEBIT+consume; denied=>RELEASE+release, plus EXPIRE for already naturally expired released units; update terminal metadata; commit together.

- [ ] **Step 6: Add 0007 constraints/indexes**

V1 credit provenance completeness, positive allocations, one active policy per institution, unique v1 idempotency scope, projection/review indexes. Keep legacy credit/idempotency constraint while old route exists.

- [ ] **Step 7: Run review/schema/migration tests**

```bash
cd backend
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py check
python manage.py test relay.test_green_wallet_v1_review relay.test_green_wallet_v1_schema relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

```bash
git add backend/relay/services/redemption_review.py backend/relay/models.py backend/relay/migrations/0007_green_wallet_lifecycle_v1_constraints.py backend/relay/test_green_wallet_v1_review.py
git commit -m "feat(wallet): make redemption review atomic"
```

---

### Task 8: Implement automatic ledger-driven expiration

**Files:**
- Create: `backend/relay/services/expiration.py`
- Create: `backend/relay/management/commands/expire_green_route_credits.py`
- Test: `backend/relay/test_green_wallet_v1_expiration.py`

- [ ] **Step 1: Write expiration tests**

Available expiry, held protection, retry idempotency, partial remaining expiry, fulfillment after natural expiry, denial-after-expiry zero restored availability.

- [ ] **Step 2: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration -v 2
```

- [ ] **Step 3: Implement idempotent expiration service**

Lock each due v1 credit, project current available, create EXPIRE only for available units. Held units remain protected.

- [ ] **Step 4: Add management command**

Command invokes service and prints counts only.

- [ ] **Step 5: Run expiration and review tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration relay.test_green_wallet_v1_review -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add backend/relay/services/expiration.py backend/relay/management/commands/expire_green_route_credits.py backend/relay/test_green_wallet_v1_expiration.py
git commit -m "feat(wallet): add ledger driven credit expiration"
```

---

### Task 9: Add institution-scoped v1 APIs and stable errors

**Files:**
- Create: `backend/relay/green_wallet_v1_serializers.py`
- Create: `backend/relay/green_wallet_v1_views.py`
- Modify: `backend/config/urls.py`
- Test: `backend/relay/test_green_wallet_v1_api.py`

- [ ] **Step 1: Write API tests**

Wallet projection, active benefits, no client profile/credit authority, required UUID, staff triage, staff terminal 403, admin terminal success, cross-tenant 404, business 422, state 409.

- [ ] **Step 2: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_api -v 2
```

- [ ] **Step 3: Implement transport-only serializers**

Evidence, issuance, redemption, review, wallet, benefits, activity. Business invariants remain in services.

- [ ] **Step 4: Implement institution-scoped action endpoints**

Use exactly the participant/admin routes in spec Section 17; URL institution scope is authoritative.

- [ ] **Step 5: Centralize error mapping**

Stable JSON `{code,message}` with 400/401/403/404/409/422 semantics from spec.

- [ ] **Step 6: Keep legacy routes mounted temporarily**

Do not remove until frontend cutover.

- [ ] **Step 7: Run complete backend suite**

```bash
cd backend
python manage.py test relay -v 2
python manage.py check
python manage.py makemigrations --check --dry-run
```

Expected: PASS.

- [ ] **Step 8: Commit Task 9**

```bash
git add backend/relay/green_wallet_v1_serializers.py backend/relay/green_wallet_v1_views.py backend/config/urls.py backend/relay/test_green_wallet_v1_api.py
git commit -m "feat(wallet): add institution scoped lifecycle api"
```

---

### Task 10: Cut the React wallet over to server projection and generic ProgramBenefit redemption

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/greenWalletApi.ts`
- Modify: `src/screens/WalletScreen.tsx`
- Modify: `src/context/AppContext.tsx`
- Create: `src/flows/ProgramBenefitRedemptionFlow.tsx`
- Test: `src/lib/greenWalletApi.v1.test.ts`
- Test: `src/screens/WalletScreen.v1.test.tsx`
- Test: `src/flows/ProgramBenefitRedemptionFlow.test.tsx`

- [ ] **Step 1: Write adapter tests and canonical types**

WalletProjection contains issued/available/held/fulfilled/expired/unitLabel/recentActivity. ProgramBenefit contains type/status/min/max/increment/optional chargingHubId.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- src/lib/greenWalletApi.v1.test.ts
```

- [ ] **Step 3: Implement v1 API methods**

`getWallet`, `listProgramBenefits`, `createRedemption`, `startReview`, `fulfillRedemption`, `denyRedemption`; GreenWalletApiError preserves machine code.

- [ ] **Step 4: Write WalletScreen tests**

Mock server projection 15 issued, 8 available, 7 held, 0 fulfilled, 0 expired. Assert exact values and operational Transit Benefit without ChargingHub.

- [ ] **Step 5: Remove client-side accounting**

Delete canonical raw credit/request balance reducers; render projection only.

- [ ] **Step 6: Implement generic ProgramBenefitRedemptionFlow**

Generate one client UUID per intentional submit, validate benefit bounds/increment, submit only programBenefitId/requestedUnits/idempotencyKey. EV metadata remains optional and never implies reservation/payment.

- [ ] **Step 7: Remove canonical wallet mutations from AppContext**

WalletScreen/ProgramBenefitRedemptionFlow no longer use in-memory credit/request mutations as truth.

- [ ] **Step 8: Run frontend verification**

```bash
npm test
npm run check
npm run security:check
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit Task 10**

```bash
git add src/types.ts src/lib/greenWalletApi.ts src/screens/WalletScreen.tsx src/context/AppContext.tsx src/flows/ProgramBenefitRedemptionFlow.tsx src/lib/greenWalletApi.v1.test.ts src/screens/WalletScreen.v1.test.tsx src/flows/ProgramBenefitRedemptionFlow.test.tsx
git commit -m "feat(wallet): render canonical program benefit wallet"
```

---

### Task 11: Retire legacy Green Wallet write paths after cutover verification

**Files:**
- Modify: `backend/relay/views.py`
- Modify: `backend/relay/serializers.py`
- Modify: `backend/config/urls.py`
- Modify: `docs/GREEN_WALLET_API_CONTRACT.md`
- Modify or delete: `src/flows/EVChargeCreditRedemptionFlow.tsx`
- Test: `backend/relay/test_green_wallet_contract.py`
- Test: `src/screens/WalletScreen.v1.test.tsx`

- [ ] **Step 1: Add legacy-bypass tests**

No public credit POST; canonical UI never PATCHes lifecycle status; v1 redemption never submits arbitrary participant/credit ownership; historical credits remain readable and legacy-labeled.

- [ ] **Step 2: Search exact legacy dependencies**

```bash
rg "EVChargeCreditRedemptionFlow|creditId|chargingHubId|createRedemptionRequest|reviewRedemptionRequest|greenRouteCredits" src
```

- [ ] **Step 3: Retire charging-only canonical flow**

Delete if unused; otherwise clearly demo-only and never imported by WalletScreen.

- [ ] **Step 4: Disable legacy write route**

After cutover, old `/api/redemption-requests/` becomes read-only compatibility/history or is removed if unused. Tests prove POST/PATCH unavailable.

- [ ] **Step 5: Update API contract docs**

V1 endpoints canonical; legacy resources history/compatibility only; no-settlement boundary explicit.

- [ ] **Step 6: Run full suites**

```bash
cd backend
python manage.py test relay -v 2
python manage.py check
python manage.py makemigrations --check --dry-run
cd ..
npm test
npm run check
npm run security:check
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 11**

```bash
git add backend/relay/views.py backend/relay/serializers.py backend/config/urls.py docs/GREEN_WALLET_API_CONTRACT.md src
git commit -m "refactor(wallet): retire legacy wallet write paths"
```

---

### Task 12: Prove synthetic Pasadena Lifecycle v1 acceptance

**Files:**
- Create: `backend/relay/test_green_wallet_v1_pasadena_acceptance.py`
- Modify: `src/screens/WalletScreen.v1.test.tsx`
- Create: `docs/GREEN_WALLET_V1_ACCEPTANCE.md`

- [ ] **Step 1: Build one synthetic Pasadena institution and two issuance buckets**

Pasadena Mobility Research Institute; participant/staff/admin/viewer plus Glendale participant; verified_participation policy with fixture-only 5 units/event, caps 20/100, expiry 90 days; active EV Charge Benefit and Transit Benefit. One evidence=>Award A 5; two distinct evidence=>Award B 10; patch issuance times so A expires first; wallet starts available 15.

- [ ] **Step 2: Prove pooled 7-unit Transit Benefit redemption**

Allocation A=5/B=2; after request available 8/held 7; staff starts review; viewer and staff terminal attempts denied; admin fulfills; final available 8/held 0/fulfilled 7.

- [ ] **Step 3: Prove EV charging uses same accounting without settlement claims**

Separate synthetic EV benefit request; no ChargingSession/payment/settlement object or claim.

- [ ] **Step 4: Add negative/concurrency cases**

Cross-tenant, same-tenant wrong participant, evidence reuse, duplicate approval/UUID, overcommit, caps, duplicate terminal, denial-after-expiry RELEASE+EXPIRE, expiration retry.

- [ ] **Step 5: Verify migrations on disposable data**

```bash
cd backend
python manage.py migrate relay 0005
python manage.py migrate relay 0006
python manage.py migrate relay 0007
python manage.py check
python manage.py migrate relay 0005
python manage.py migrate relay 0007
python manage.py migrate
```

- [ ] **Step 6: Run complete verification**

```bash
cd backend
python manage.py test relay -v 2
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py showmigrations relay
cd ..
npm test
npm run check
npm run security:check
npm run build
```

Expected: PASS.

- [ ] **Step 7: Record durable acceptance evidence**

Record exact SHA, migrations, exact test totals, fixtures, projections, RBAC/cross-tenant/idempotency/concurrency/cap results, frontend DOM evidence, build/security results, rollback procedure, and every blocker. Do not call Lifecycle v1 operational if any proof segment fails.

- [ ] **Step 8: Commit Task 12**

```bash
git add backend/relay/test_green_wallet_v1_pasadena_acceptance.py src/screens/WalletScreen.v1.test.tsx docs/GREEN_WALLET_V1_ACCEPTANCE.md
git commit -m "test(wallet): prove lifecycle v1 Pasadena acceptance chain"
```

---

## Final Verification Gate

```bash
cd backend
python manage.py test relay -v 2
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py showmigrations relay
cd ..
npm test
npm run check
npm run security:check
npm run build
git status --short
git log --oneline --decorate -15
```

Required: clean git state; migrations 0001-0007 in order; backend/frontend/type/security/build pass; no canonical frontend balance math; no arbitrary Profile/credit identity inputs; no generic PATCH terminal transition; no Charging Intelligence/payment code.

## Plan Self-Review

**Spec coverage:** Tasks 1-12 cover identity/authorization, versioned policy activation, evidence provenance and anti-double-award, deterministic issuance, ISSUE accounting, caps, ProgramBenefit targeting, pooled oldest-expiring allocations, idempotency, capacity reservations, role-separated atomic review, authoritative projection, expiration, institution-scoped APIs, frontend cutover, legacy retirement, and Pasadena acceptance.

**Placeholder scan:** No step depends on an unspecified production default, file name, test module, rule, cap, or expiry. Synthetic numeric values are fixture-only. Existing regression coverage is invoked explicitly through `relay.tests` and named Green Wallet modules.

**Type consistency:** Later tasks use `resolve_participant_profile`, `activate_policy`, `evaluate_policy`, `evaluate_issuance`, `approve_issuance`, `project_credit_bucket`, `project_wallet`, `create_redemption`, `start_review`, `finalize_redemption`, `expire_due_credits`.

**Accounting consistency:** Existing ProgramBenefitPolicy cap/expiry columns are canonical; only rule-specific values live in `parameters`. V1 pooled requests keep legacy credit/ChargingHub FKs nullable until cutover. ADJUSTMENT uses signed quantity_delta; normal non-adjustment event quantities are positive. Evidence is single-use for v1 issuance.

**Rollback boundary:** 0006 is additive/relaxing and 0007 hardens constraints. Before accepted v1 audit data, forward/backward verification is required. After accepted v1 data exists, destructive rollback is not treated as safe; preserve data and use application rollback/forward-fix.
