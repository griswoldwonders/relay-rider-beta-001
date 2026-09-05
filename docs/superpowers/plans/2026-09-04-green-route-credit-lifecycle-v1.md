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

- `backend/relay/models.py` — add v1 domain fields/models and database constraints while preserving legacy fields during cutover.
- `backend/relay/permissions.py` — add explicit participant role helpers and separate triage vs terminal-review permissions.
- `backend/relay/admin.py` — make canonical credit issuance read-only and register v1 audit/configuration models with least-privilege admin behavior.
- `backend/config/urls.py` — mount institution-scoped v1 Green Wallet endpoints alongside temporary legacy routes.
- `src/types.ts` — define canonical wallet projection, ProgramBenefit, and pooled redemption types; remove single-credit assumptions from v1 types.
- `src/lib/greenWalletApi.ts` — add institution-scoped v1 operations and stable error-code handling.
- `src/screens/WalletScreen.tsx` — render only server-projected balances and active ProgramBenefits.
- `src/context/AppContext.tsx` — stop treating session-memory credit/request objects as canonical Green Wallet state.
- `docs/GREEN_WALLET_API_CONTRACT.md` — update runtime contract after cutover.

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

Create `backend/relay/test_green_wallet_v1_schema.py`:

```python
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import (
    GreenRouteCredit,
    Institution,
    IssuanceDecisionEvidence,
    Membership,
    Profile,
    RedemptionRequest,
)


class GreenWalletV1SchemaTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name='Pasadena Synthetic Institute', slug='pasadena-synthetic-v1')
        self.user = User.objects.create_user(username='participant-a', password='pw')

    def test_claimed_profile_is_unique_per_user_and_institution(self):
        Profile.objects.create(institution=self.institution, user=self.user, name='A')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Profile.objects.create(institution=self.institution, user=self.user, name='Duplicate')

    def test_multiple_unclaimed_profiles_are_allowed(self):
        Profile.objects.create(institution=self.institution, user=None, name='Imported A')
        Profile.objects.create(institution=self.institution, user=None, name='Imported B')

    def test_participant_membership_role_exists(self):
        membership = Membership.objects.create(user=self.user, institution=self.institution, role='participant')
        self.assertEqual(membership.role, 'participant')

    def test_legacy_credit_defaults_to_legacy_provenance(self):
        credit = GreenRouteCredit.objects.create(institution=self.institution, amount_units='2.00')
        self.assertEqual(credit.provenance_state, 'legacy')

    def test_legacy_redemption_fields_are_nullable_for_v1_pooled_requests(self):
        self.assertTrue(RedemptionRequest._meta.get_field('credit').null)
        self.assertTrue(RedemptionRequest._meta.get_field('charging_hub').null)

    def test_each_evidence_record_can_feed_only_one_v1_issuance_decision(self):
        self.assertTrue(IssuanceDecisionEvidence._meta.get_field('evidence').unique)
```

- [ ] **Step 2: Run the schema test and verify it fails before model changes**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema -v 2
```

Expected: FAIL because v1 fields/models do not exist.

- [ ] **Step 3: Add participant identity and policy-framework fields**

In `backend/relay/models.py`, add nullable `Profile.user` with `SET_NULL` and related name `relay_profiles`, then add this conditional uniqueness constraint:

```python
models.UniqueConstraint(
    fields=['user', 'institution'],
    condition=models.Q(user__isnull=False),
    name='unique_claimed_profile_user_institution',
)
```

Add `'participant'` to `Membership.ROLE_CHOICES`.

Extend `ProgramBenefitPolicy` with:

```python
framework_version = models.PositiveIntegerField(default=1)
rule_type = models.CharField(max_length=64, blank=True)
parameters = models.JSONField(default=dict, blank=True)
activated_by = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name='activated_green_wallet_policies',
)
activated_at = models.DateTimeField(null=True, blank=True)
```

Keep existing `max_units_per_participant`, `max_units_program_wide`, and `expiry_days` as canonical cap/expiry fields; do not duplicate those values in `parameters`.

- [ ] **Step 4: Add evidence and issuance provenance models**

Add `QualifyingEvidence` with institution/profile PROTECT FKs, source type choices `relay_rider | authorized_import | admin_attestation`, evidence label, observed time, provenance JSON, created-by user, and unique nonblank `(institution, source_type, source_reference)`.

Add `IssuanceDecision` with statuses `evaluated | approved | denied`, fields `institution`, `profile`, `policy`, `calculated_units`, `evaluation_metadata`, `evaluated_at`, approval/denial actors/times, denial reason, and indexed correlation ID.

Add `IssuanceDecisionEvidence`:

```python
issuance_decision = models.ForeignKey(IssuanceDecision, on_delete=models.PROTECT, related_name='evidence_links')
evidence = models.OneToOneField(QualifyingEvidence, on_delete=models.PROTECT, related_name='issuance_link')
```

V1 intentionally prevents one evidence record from creating multiple credit awards; corrections use superseding evidence.

- [ ] **Step 5: Add generic ProgramBenefit and pooled-redemption models**

Add `ProgramBenefit` with institution, name/description, benefit type `ev_charging | transit | access_point | other`, status `draft | active | retired`, unit label, positive min/max/increment fields, optional finite `capacity_total`, optional ChargingHub, and effective dates.

Alter legacy `RedemptionRequest.credit` and `RedemptionRequest.charging_hub` to `null=True, blank=True`; add nullable `program_benefit` FK.

Add `RedemptionAllocation(redemption_request, credit, allocated_units)` with unique `(redemption_request, credit)`.

Add `BenefitCapacityReservation` as one-to-one with RedemptionRequest, states `reserved | consumed | released`.

- [ ] **Step 6: Add v1 provenance fields to credits and ledger**

Extend GreenRouteCredit with nullable policy, nullable one-to-one issuance decision (`related_name='green_route_credit'`), nullable issued/expires timestamps, and `provenance_state = legacy | v1` defaulting to legacy.

Extend WalletLedgerEntry with nullable `redemption_allocation` and nullable self-reference `reverses_entry`, both PROTECT.

- [ ] **Step 7: Generate and inspect migration `0006`**

```bash
cd backend
python manage.py makemigrations relay --name green_wallet_lifecycle_v1_spine
python manage.py makemigrations --check --dry-run
```

Expected: `0006_green_wallet_lifecycle_v1_spine.py`, then `No changes detected`.

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

Expected: PASS on synthetic/local data.

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
- Consumes: Membership, Profile, Institution.

- [ ] **Step 1: Define domain-error contract**

```python
class GreenWalletDomainError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
```

- [ ] **Step 2: Write failing identity and role tests**

Cover claimed/unclaimed resolution, wrong same-tenant user, one user in two institutions, viewer without claimed profile, program_staff triage-only, and institution_admin approval/finalization. Use exact error code `PARTICIPANT_PROFILE_NOT_CLAIMED` when participant resolution fails.

- [ ] **Step 3: Run identity tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity -v 2
```

Expected: FAIL.

- [ ] **Step 4: Implement participant identity service**

```python
from relay.models import Membership, Profile
from .errors import GreenWalletDomainError


def resolve_participant_profile(*, user, institution):
    if not user or not user.is_authenticated:
        raise GreenWalletDomainError('UNAUTHENTICATED', 'Authentication is required.')
    profile = Profile.objects.filter(user=user, institution=institution).first()
    if profile is None:
        raise GreenWalletDomainError(
            'PARTICIPANT_PROFILE_NOT_CLAIMED',
            'No claimed participant Profile exists for this user and institution.',
        )
    return profile
```

Add `has_role(user, institution, roles)` helper.

- [ ] **Step 5: Split permissions by operation**

```python
TRIAGE_ROLES = {'program_staff', 'institution_admin'}
TERMINAL_REVIEW_ROLES = {'institution_admin'}
ISSUANCE_APPROVAL_ROLES = {'institution_admin'}
```

Keep platform_admin as explicit bypass. Legacy `CanReviewRedemptionRequest` remains only for the old endpoint until Task 11.

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
- Produces: `PolicyEvaluationResult`, `validate_policy_configuration(policy)`, `activate_policy(*, actor, policy)`, `evaluate_policy(*, policy, profile, evidence_records)`.

- [ ] **Step 1: Write failing policy tests**

Use fixture-only parameters:

```python
parameters = {
    'units_per_qualifying_event': '5.00',
    'allowed_evidence_source_types': ['relay_rider', 'authorized_import'],
}
```

Store `max_units_per_participant='20.00'`, `max_units_program_wide='100.00'`, `expiry_days=90` in existing policy fields. Test deterministic output, unknown rule rejection, invalid units/evidence sources/caps/expiry, out-of-period policy, activation retiring prior active version, and non-admin activation denial.

- [ ] **Step 2: Run policy tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_policy -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement code-owned rule registry**

Create a frozen `PolicyEvaluationResult` dataclass with calculated_units, evidence IDs, and metadata. Register only `verified_participation` for v1. Validate positive units per event, nonempty allowed source list, positive existing cap fields, positive existing expiry field, and valid effective dates.

- [ ] **Step 4: Implement governed activation**

Inside one transaction, authorize institution_admin/platform_admin, validate the policy, lock institution policy rows, mark any prior active version retired, then activate the requested version with actor/time. No historical policy is deleted.

- [ ] **Step 5: Implement deterministic evaluation**

Require active/in-period policy; same institution/profile evidence; allowed evidence sources; no previously linked evidence. Calculate:

```python
Decimal(str(policy.parameters['units_per_qualifying_event'])) * len(evidence_records)
```

Return exact evidence IDs and minimal explanation metadata.

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
- Produces: `evaluate_issuance(...)`, `approve_issuance(...)`.

- [ ] **Step 1: Write failing issuance tests**

Test complete evidence linking, single-use evidence, program_staff denial, admin issuance creating one credit/one ISSUE, replay idempotency, participant cap, program cap, and forced ledger-write rollback.

- [ ] **Step 2: Run issuance tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement evaluation operation**

Call `evaluate_policy`, create IssuanceDecision(status evaluated), then one IssuanceDecisionEvidence link per evidence record. No credit is created during evaluation.

- [ ] **Step 4: Implement atomic approval operation**

Inside transaction.atomic, lock decision, policy, and Profile. If already approved, return `decision.green_route_credit`. Authorize institution_admin/platform_admin. Sum existing v1 policy issuance for the participant and program, enforce existing model cap fields, then create the credit with policy/decision provenance, issued_at, expires_at derived from policy.expiry_days, and provenance_state v1. Create exactly one ISSUE event, then mark decision approved. Any failure rolls back all writes.

- [ ] **Step 5: Make GreenRouteCredit read-only in Django Admin**

Custom ModelAdmin: add/change/delete all return False; historical inspection remains.

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

**Interfaces:**
- Produces: `BucketProjection`, `WalletProjection`, `project_credit_bucket(credit)`, `project_wallet(...)`.

- [ ] **Step 1: Write failing accounting tests**

Prove:

```text
ISSUE 10       => available 10
HOLD 4         => available 6, held 4
RELEASE 4      => available 10, held 0
HOLD 4
DEBIT 4        => available 6, fulfilled 4
EXPIRE 2       => available 4, expired 2
ADJUSTMENT +1  => available 5
ADJUSTMENT -1  => available 4
```

Also test exact REVERSAL inverse semantics and reject over-reversal/negative state.

- [ ] **Step 2: Run projection tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_projection -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement projection dataclasses**

`BucketProjection` contains credit_id, issued, available, held, fulfilled, expired. `WalletProjection` contains aggregated issued/available/held/fulfilled/expired, unit_label, and buckets.

- [ ] **Step 4: Implement event transitions explicitly**

```text
ISSUE      available += q; issued += q
HOLD       available -= q; held += q
RELEASE    held -= q; available += q
DEBIT      held -= q; fulfilled += q
EXPIRE     available -= q; expired += q
ADJUSTMENT available += signed quantity_delta
REVERSAL   exact inverse of referenced event's remaining unreversed quantity
```

Non-ADJUSTMENT normal event quantities must be positive. Reject any negative bucket state with `LEDGER_INTEGRITY_ERROR`.

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

**Interfaces:**
- Produces: `create_redemption(*, actor, institution, program_benefit, requested_units, idempotency_key)`.

- [ ] **Step 1: Write failing pooled-redemption tests**

Use Award A=5 earlier expiry, Award B=10 later expiry, Request=7, expected allocations 5+2. Test required/valid UUID, replay, expiry ordering, deterministic ties, partial bucket use, insufficient balance rollback, wrong same-tenant participant, cross-tenant benefit, finite capacity reservation, and capacity exhaustion rollback.

- [ ] **Step 2: Run redemption tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement UUID replay contract**

Validate with `uuid.UUID(str(idempotency_key))`; lookup replay by `(institution, profile, idempotency_key)`.

- [ ] **Step 4: Implement pooled allocation in one transaction**

Resolve participant Profile server-side; validate active/in-period ProgramBenefit and min/max/increment; replay UUID; lock candidate v1 credits ordered expires_at/issued_at/id; project available units; fully fund or fail; lock finite benefit and check capacity; create v1 request with legacy credit/hub null; create allocations; one HOLD per allocation; optional reserved capacity row; commit all-or-nothing.

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

- [ ] **Step 1: Write failing review tests**

Prove program_staff triage only, admin fulfill/deny, no direct requested->terminal, one DEBIT/RELEASE per allocation, capacity consume/release, rollback on ledger failure, and no duplicate terminal effects.

- [ ] **Step 2: Run review tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_review -v 2
```

Expected: FAIL.

- [ ] **Step 3: Add v1 reviewer user reference**

Add nullable `reviewed_by_user` FK to RedemptionRequest; retain legacy string `reviewed_by`.

- [ ] **Step 4: Implement `start_review` with row lock**

Require requested state, authorize program_staff/institution_admin/platform_admin, set under-review and server reviewer metadata atomically.

- [ ] **Step 5: Implement atomic terminal processing**

Lock request, require under-review, authorize admin/platform admin, lock allocations/reservation, then fulfilled=>DEBIT per allocation + consumed reservation; denied=>RELEASE per allocation + released reservation; if a released credit is already naturally expired, immediately create matching EXPIRE in the same transaction. Update terminal reviewer metadata and commit together.

- [ ] **Step 6: Add `0007` constraints**

Add database checks/indexes for v1 credit provenance completeness, positive allocation units, one active policy per institution, unique `(institution, profile, idempotency_key)` when non-null, and wallet/review indexes. Keep legacy `(credit, idempotency_key)` while legacy route exists.

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

- [ ] **Step 1: Write failing expiration tests**

Test available expiry, held protection, retry idempotency, partial remaining expiry, valid fulfillment after natural expiry, and denial-after-expiry leaving zero restored availability.

- [ ] **Step 2: Run expiration tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement idempotent expiration service**

Frozen result: credits_scanned, credits_expired, units_expired. For each due v1 credit, lock, project, write EXPIRE only for current available units. Held units stay protected.

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

### Task 9: Add institution-scoped v1 APIs and stable error semantics

**Files:**
- Create: `backend/relay/green_wallet_v1_serializers.py`
- Create: `backend/relay/green_wallet_v1_views.py`
- Modify: `backend/config/urls.py`
- Test: `backend/relay/test_green_wallet_v1_api.py`

- [ ] **Step 1: Write failing API tests**

Test wallet projection, active benefits, no client profile/credit authority, required UUID, staff triage, staff terminal denial, admin terminal success, cross-tenant 404, business 422, state 409.

- [ ] **Step 2: Run API tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_api -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement transport-only serializers**

Define serializers for evidence create, issuance evaluate/approve, redemption create, review start, terminal decision, wallet projection, benefits, and activity. Keep business invariants in services.

- [ ] **Step 4: Implement exact institution-scoped action endpoints**

```text
GET  /api/institutions/{institution_id}/wallet/
GET  /api/institutions/{institution_id}/program-benefits/
POST /api/institutions/{institution_id}/redemptions/
GET  /api/institutions/{institution_id}/redemptions/{id}/
GET  /api/institutions/{institution_id}/program-benefit-policies/
POST /api/institutions/{institution_id}/program-benefit-policies/{id}/activate/
GET  /api/institutions/{institution_id}/qualifying-evidence/
POST /api/institutions/{institution_id}/qualifying-evidence/
POST /api/institutions/{institution_id}/issuance-decisions/evaluate/
POST /api/institutions/{institution_id}/issuance-decisions/{id}/approve/
GET  /api/institutions/{institution_id}/redemptions/review-queue/
POST /api/institutions/{institution_id}/redemptions/{id}/start-review/
POST /api/institutions/{institution_id}/redemptions/{id}/fulfill/
POST /api/institutions/{institution_id}/redemptions/{id}/deny/
```

URL institution scope is authoritative.

- [ ] **Step 5: Centralize error mapping**

Return stable `{"code":...,"message":...}`. Map unauthenticated 401, unauthorized 403, tenant invisibility 404, state/idempotency conflict 409, business/policy rejection 422, malformed transport 400.

- [ ] **Step 6: Keep legacy routes mounted temporarily**

Do not remove router endpoints until Task 11 verifies frontend cutover.

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

- [ ] **Step 1: Write failing adapter tests and canonical types**

Define WalletProjection with issued/available/held/fulfilled/expired/unitLabel/recentActivity and ProgramBenefit with type/status/min/max/increment/optional chargingHubId.

- [ ] **Step 2: Run adapter test and verify failure**

```bash
npm test -- src/lib/greenWalletApi.v1.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement v1 API methods**

```ts
getWallet(institutionId: string): Promise<WalletProjection>
listProgramBenefits(institutionId: string): Promise<ProgramBenefit[]>
createRedemption(institutionId: string, input: {programBenefitId: string; requestedUnits: number; idempotencyKey: string}): Promise<RedemptionRequest>
startReview(institutionId: string, redemptionId: string): Promise<RedemptionRequest>
fulfillRedemption(institutionId: string, redemptionId: string, reviewNote: string): Promise<RedemptionRequest>
denyRedemption(institutionId: string, redemptionId: string, reviewNote: string): Promise<RedemptionRequest>
```

Extend GreenWalletApiError with optional machine `code`.

- [ ] **Step 4: Write failing WalletScreen tests**

Mock projection `{issuedUnits:15, availableUnits:8, heldUnits:7, fulfilledUnits:0, expiredUnits:0, unitLabel:'Green Route Credits', recentActivity:[]}`. Assert exact server quantities and operational Transit Benefit without ChargingHub.

- [ ] **Step 5: Remove client-side accounting from WalletScreen**

Delete canonical credit-status reducers/unavailable-credit math. Render server projection and active ProgramBenefits only.

- [ ] **Step 6: Implement generic ProgramBenefitRedemptionFlow**

Generate one `crypto.randomUUID()` per intentional submission; enforce benefit unit bounds/increment; submit only programBenefitId/requestedUnits/idempotencyKey. EV benefit may display ChargingHub metadata and no-reservation/no-payment copy; non-charging benefits never require charging metadata.

- [ ] **Step 7: Remove canonical wallet mutations from AppContext**

WalletScreen/ProgramBenefitRedemptionFlow must not use addGreenRouteCredit/createRedemptionRequest/reviewRedemptionRequest as truth. Remove methods if no callers remain; otherwise leave only clearly marked demo-only callers outside canonical wallet path.

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

- [ ] **Step 1: Add tests proving legacy paths cannot bypass v1**

Prove no public credit POST, canonical UI never PATCHes lifecycle status, v1 redemption never submits arbitrary participant/credit ownership, historical credits remain readable/legacy-labeled.

- [ ] **Step 2: Search exact legacy dependencies**

```bash
rg "EVChargeCreditRedemptionFlow|creditId|chargingHubId|createRedemptionRequest|reviewRedemptionRequest|greenRouteCredits" src
```

Every remaining hit must be removed from canonical wallet code or explicitly be an unrelated demo/test fixture.

- [ ] **Step 3: Retire charging-only canonical flow**

Delete EVChargeCreditRedemptionFlow if no canonical caller remains; otherwise mark it legacy/demo-only and ensure WalletScreen does not import it.

- [ ] **Step 4: Disable legacy write route**

After v1 frontend cutover, retain old `/api/redemption-requests/` only as read-only compatibility/history or remove it if no consumers remain. Add tests proving POST/PATCH are unavailable there.

- [ ] **Step 5: Update API contract documentation**

Document v1 institution-scoped endpoints as canonical, legacy resources as compatibility/history only, and keep research-beta/no-settlement wording explicit.

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

### Task 12: Prove the full synthetic Pasadena Lifecycle v1 acceptance chain

**Files:**
- Create: `backend/relay/test_green_wallet_v1_pasadena_acceptance.py`
- Modify: `src/screens/WalletScreen.v1.test.tsx`
- Create: `docs/GREEN_WALLET_V1_ACCEPTANCE.md`

- [ ] **Step 1: Build one synthetic Pasadena institution and two auditable issuance buckets**

Use Pasadena Mobility Research Institute; users participant/staff/admin/viewer plus Glendale participant; verified_participation policy with fixture-only 5 units/event, participant cap 20, program cap 100, expiry 90 days; active EV Charge Benefit and Transit Benefit.

Create one evidence event => Award A 5. Create two distinct new evidence events => Award B 10. Patch issuance times so Award A expires first. Expected wallet issued/available 15.

- [ ] **Step 2: Prove pooled 7-unit Transit Benefit redemption**

Expected allocation A=5/B=2; after request available 8, held 7; staff start review succeeds; viewer and staff terminal attempts fail; admin fulfill succeeds; final available 8, held 0, fulfilled 7.

- [ ] **Step 3: Prove EV charging uses same accounting without settlement claims**

Create separate synthetic EV Charge Benefit request and assert no ChargingSession/payment/settlement object or claim is created.

- [ ] **Step 4: Add negative/concurrency acceptance cases**

Cross-tenant denial, same-tenant wrong participant denial, evidence reuse denial, duplicate approval/UUID protection, overcommit, caps, duplicate terminal protection, denial-after-expiry RELEASE+EXPIRE, expiration retry idempotency.

- [ ] **Step 5: Verify migrations 0005 -> 0006 -> 0007 -> 0005 -> 0007 -> latest on disposable data**

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

After accepted v1 audit data exists, document application rollback/forward-fix rather than destructive schema rollback.

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

`docs/GREEN_WALLET_V1_ACCEPTANCE.md` must record exact SHA, migrations, exact test totals, fixtures, wallet projections, RBAC/cross-tenant/idempotency/concurrency/cap results, frontend DOM evidence, security/build results, rollback procedure, and every remaining blocker. Do not call Lifecycle v1 operational if any proof segment fails.

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

Required results: clean git state; migrations 0001-0007 in order; backend/frontend/type/security/build all pass; no canonical frontend balance math; no arbitrary Profile/credit identity inputs; no generic PATCH terminal transition; no Charging Intelligence/payment code added.

## Plan Self-Review

**Spec coverage:** Tasks 1-12 cover identity/authorization, versioned policy activation, evidence provenance and anti-double-award, deterministic issuance, ISSUE accounting, caps, ProgramBenefit targeting, pooled oldest-expiring allocations, idempotency, capacity reservations, role-separated atomic review, authoritative projection, expiration, institution-scoped APIs, frontend cutover, legacy retirement, and Pasadena acceptance.

**Placeholder scan:** No step depends on an unspecified production default, file name, test module, rule, cap, or expiry. Synthetic numeric values are fixture-only. Existing general regression coverage is invoked explicitly through `relay.tests` and named Green Wallet modules.

**Type consistency:** Later tasks use the interfaces established earlier: `resolve_participant_profile`, `activate_policy`, `evaluate_policy`, `evaluate_issuance`, `approve_issuance`, `project_credit_bucket`, `project_wallet`, `create_redemption`, `start_review`, `finalize_redemption`, `expire_due_credits`.

**Accounting consistency:** Existing ProgramBenefitPolicy cap/expiry columns are canonical; only rule-specific values live in `parameters`. V1 pooled requests keep legacy credit/ChargingHub FKs nullable until cutover. ADJUSTMENT uses signed quantity_delta; all normal non-adjustment event quantities are positive. Evidence is single-use for v1 issuance.

**Rollback boundary:** 0006 is additive/relaxing and 0007 hardens constraints. Before accepted v1 audit data, forward/backward verification is required. After accepted v1 data exists, destructive rollback is not treated as safe; preserve data and use application rollback/forward-fix.
