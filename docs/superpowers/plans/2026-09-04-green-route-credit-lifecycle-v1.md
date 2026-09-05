# Green Route Credit Lifecycle v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Green Route Credit Lifecycle v1 so Relay Rider can deterministically issue, account for, redeem, review, expire, and audit institution-sponsored mobility-benefit units for authenticated participants without adding Charging Intelligence or payment settlement.

**Architecture:** Extend the existing Django Green Wallet domain additively, move lifecycle invariants into focused application services, make the immutable ledger the accounting source for a server-side wallet projection, and replace single-credit/ChargingHub redemption with generic `ProgramBenefit` redemption plus pooled `RedemptionAllocation` rows. Preserve legacy Green Wallet fields during migration, classify existing records as pre-v1 where provenance cannot be proven, and cut the React UI over only after the new institution-scoped API and synthetic Pasadena acceptance chain pass.

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
- Ledger event rows are append-only and are interpreted by event semantics, never by blindly summing `quantity_delta`.
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
- `src/types.ts` — define canonical wallet projection, ProgramBenefit, and pooled redemption types; remove single-credit assumptions from the v1 types.
- `src/lib/greenWalletApi.ts` — replace legacy Green Wallet operations with institution-scoped v1 operations and stable error-code handling.
- `src/screens/WalletScreen.tsx` — render only server-projected balances and active ProgramBenefits.
- `src/context/AppContext.tsx` — stop treating session-memory credit/request objects as canonical Green Wallet state.
- `backend/relay/test_green_wallet_pasadena_acceptance.py` — retain the merged fixture as a legacy regression reference while adding v1 acceptance separately.

### New backend files

- `backend/relay/migrations/0006_green_wallet_lifecycle_v1_spine.py` — additive v1 schema and legacy classification.
- `backend/relay/migrations/0007_green_wallet_lifecycle_v1_constraints.py` — post-backfill constraints/indexes that are safe only after v1-compatible rows exist.
- `backend/relay/services/__init__.py` — service package marker.
- `backend/relay/services/errors.py` — transport-agnostic Green Wallet domain errors with stable machine codes.
- `backend/relay/services/participant_identity.py` — authenticated user/institution to claimed Profile resolution.
- `backend/relay/services/policy_rules.py` — code-owned deterministic rule registry and `verified_participation` evaluator.
- `backend/relay/services/issuance.py` — evidence evaluation, cap checks, issuance approval, credit creation, and ISSUE event transaction.
- `backend/relay/services/wallet_projection.py` — authoritative per-bucket and unified wallet accounting projection.
- `backend/relay/services/redemption.py` — pooled allocation, idempotent request creation, HOLD events, and capacity reservation.
- `backend/relay/services/redemption_review.py` — review start and atomic terminal DEBIT/RELEASE processing.
- `backend/relay/services/expiration.py` — idempotent EXPIRE processing and post-expiry denial behavior support.
- `backend/relay/green_wallet_v1_serializers.py` — request/response serializers for explicit v1 operations.
- `backend/relay/green_wallet_v1_views.py` — institution-scoped APIViews that invoke services; no lifecycle business logic in views.
- `backend/relay/management/commands/expire_green_route_credits.py` — scheduled/manual expiration entrypoint.

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

- `src/flows/ProgramBenefitRedemptionFlow.tsx` — generic participant benefit request flow using server-projected balance and ProgramBenefit data.
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
- Produces: `Profile.user`, `Membership.role='participant'`, `ProgramBenefitPolicy.framework_version`, `ProgramBenefitPolicy.rule_type`, `ProgramBenefitPolicy.parameters`, `QualifyingEvidence`, `IssuanceDecision`, `IssuanceDecisionEvidence`, `ProgramBenefit`, `RedemptionAllocation`, `BenefitCapacityReservation`, v1 provenance fields on `GreenRouteCredit`, v1 target fields on `RedemptionRequest`, and ledger linkage fields.
- Consumes: existing `Institution`, `Membership`, `Profile`, `GreenRouteCredit`, `ProgramBenefitPolicy`, `RedemptionRequest`, `ChargingHub`, `WalletLedgerEntry`.

- [ ] **Step 1: Write schema tests that describe the additive migration contract**

Create `backend/relay/test_green_wallet_v1_schema.py` with tests equivalent to:

```python
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import (
    BenefitCapacityReservation,
    GreenRouteCredit,
    Institution,
    IssuanceDecision,
    Membership,
    Profile,
    ProgramBenefit,
    ProgramBenefitPolicy,
    QualifyingEvidence,
    RedemptionAllocation,
    RedemptionRequest,
    WalletLedgerEntry,
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

    def test_v1_models_are_importable(self):
        self.assertIsNotNone(QualifyingEvidence)
        self.assertIsNotNone(IssuanceDecision)
        self.assertIsNotNone(ProgramBenefit)
        self.assertIsNotNone(RedemptionAllocation)
        self.assertIsNotNone(BenefitCapacityReservation)
        self.assertIsNotNone(WalletLedgerEntry)
```

- [ ] **Step 2: Run the schema test and verify it fails before model changes**

Run:

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema -v 2
```

Expected: FAIL because v1 fields/models do not exist.

- [ ] **Step 3: Add the v1 model fields and models without deleting legacy fields**

Implement these exact domain shapes in `backend/relay/models.py`:

```python
class Profile(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='relay_profiles',
    )
    # existing fields stay

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'institution'],
                condition=models.Q(user__isnull=False),
                name='unique_claimed_profile_user_institution',
            ),
        ]
```

Add `'participant'` to `Membership.ROLE_CHOICES`.

Extend `ProgramBenefitPolicy` with:

```python
framework_version = models.PositiveIntegerField(default=1)
rule_type = models.CharField(max_length=64, blank=True)
parameters = models.JSONField(default=dict, blank=True)
activated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='activated_green_wallet_policies')
activated_at = models.DateTimeField(null=True, blank=True)
```

Add `QualifyingEvidence`:

```python
class QualifyingEvidence(TimestampedModel):
    SOURCE_TYPES = [('relay_rider', 'Relay Rider'), ('authorized_import', 'Authorized import'), ('admin_attestation', 'Administrative attestation')]
    EVIDENCE_LABELS = [('synthetic', 'Synthetic'), ('modeled', 'Modeled'), ('verified', 'Verified')]
    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='qualifying_evidence')
    profile = models.ForeignKey(Profile, on_delete=models.PROTECT, related_name='qualifying_evidence')
    source_type = models.CharField(max_length=32, choices=SOURCE_TYPES)
    source_reference = models.CharField(max_length=160, blank=True)
    evidence_label = models.CharField(max_length=32, choices=EVIDENCE_LABELS, default='synthetic')
    observed_at = models.DateTimeField()
    provenance = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_qualifying_evidence')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['institution', 'source_type', 'source_reference'],
                condition=~models.Q(source_reference=''),
                name='unique_evidence_source_reference_per_institution',
            ),
        ]
```

Add `IssuanceDecision`, `IssuanceDecisionEvidence`, and enforce one credit per decision through a one-to-one relation from `GreenRouteCredit.issuance_decision`.

Use decision statuses `evaluated | approved | denied`, store `calculated_units`, `evaluation_metadata`, `evaluated_at`, `approved_by`, `approved_at`, `denied_by`, `denied_at`, `denial_reason`, and indexed `correlation_id`.

Add `ProgramBenefit` with approved benefit types `ev_charging | transit | access_point | other`, statuses `draft | active | retired`, unit bounds/increment, optional finite `capacity_total`, optional `charging_hub`, and effective dates.

Add `RedemptionRequest.program_benefit` nullable during migration and leave legacy `credit`/`charging_hub` in place.

Add `RedemptionAllocation(redemption_request, credit, allocated_units)` with unique `(redemption_request, credit)` and positive-unit validation at service layer.

Add `BenefitCapacityReservation` as one-to-one with `RedemptionRequest`, with `reserved | consumed | released` state.

Extend `GreenRouteCredit` with nullable `policy`, nullable one-to-one `issuance_decision`, nullable `expires_at`, explicit `issued_at`, and `provenance_state` choices `legacy | v1`, default `legacy`.

Extend `WalletLedgerEntry` with nullable `redemption_allocation` and nullable self-reference `reverses_entry` using `PROTECT`.

- [ ] **Step 4: Generate and inspect migration `0006`**

Run:

```bash
cd backend
python manage.py makemigrations relay --name green_wallet_lifecycle_v1_spine
python manage.py makemigrations --check --dry-run
```

Expected: first command creates `0006_green_wallet_lifecycle_v1_spine.py`; second reports `No changes detected`.

Inspect the migration and confirm it only adds/extends schema; it must not delete `RedemptionRequest.credit`, `RedemptionRequest.charging_hub`, existing statuses, or migrations 0001-0005.

- [ ] **Step 5: Run schema and existing Green Wallet tests**

Run:

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema relay.test_green_wallet_contract relay.test_green_wallet_ledger_and_policy relay.test_green_wallet_pasadena_acceptance -v 2
```

Expected: PASS.

- [ ] **Step 6: Verify migration forward/backward/forward while it is still purely additive**

Run:

```bash
cd backend
python manage.py migrate relay 0005
python manage.py migrate relay 0006
python manage.py check
python manage.py migrate relay 0005
python manage.py migrate relay 0006
python manage.py migrate
```

Expected: all commands succeed with no data-loss warnings on synthetic/local data.

- [ ] **Step 7: Commit Task 1**

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
- Produces: `resolve_participant_profile(*, user, institution) -> Profile`, `GreenWalletDomainError`, `can_start_redemption_review(user, institution)`, `can_finalize_redemption(user, institution)`, `can_approve_issuance(user, institution)`.
- Consumes: `Membership`, `Profile`, `Institution`.

- [ ] **Step 1: Define domain-error contract first**

Create `backend/relay/services/errors.py`:

```python
class GreenWalletDomainError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
```

No HTTP status belongs in this class; API mapping is Task 9.

- [ ] **Step 2: Write failing identity and RBAC tests**

Create tests covering:

```python
class ParticipantIdentityTests(TestCase):
    def test_resolves_claimed_profile_for_user_and_institution(self): ...
    def test_unclaimed_profile_is_not_resolved(self): ...
    def test_wrong_users_same_tenant_profile_is_not_resolved(self): ...
    def test_same_user_can_have_one_profile_in_two_institutions(self): ...
    def test_viewer_does_not_gain_participant_authority_without_claimed_profile(self): ...
    def test_program_staff_can_start_review_but_cannot_finalize(self): ...
    def test_institution_admin_can_approve_issuance_and_finalize(self): ...
```

Use exact expected code `PARTICIPANT_PROFILE_NOT_CLAIMED` when resolution fails.

- [ ] **Step 3: Run identity tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity -v 2
```

Expected: FAIL because service helpers do not exist.

- [ ] **Step 4: Implement participant identity service**

Create `backend/relay/services/participant_identity.py`:

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


def has_role(user, institution, roles):
    return bool(user and user.is_authenticated and Membership.objects.filter(user=user, institution=institution, role__in=roles).exists())
```

- [ ] **Step 5: Split permission helpers by operation**

Update `backend/relay/permissions.py` so the reusable role sets are explicit:

```python
TRIAGE_ROLES = {'program_staff', 'institution_admin'}
TERMINAL_REVIEW_ROLES = {'institution_admin'}
ISSUANCE_APPROVAL_ROLES = {'institution_admin'}
```

`platform_admin` remains an explicit bypass. Do not leave `CanReviewRedemptionRequest` as the only lifecycle write gate; retain it only for the temporary legacy endpoint until Task 9 removes v1 reliance on PATCH.

- [ ] **Step 6: Run identity/RBAC tests plus existing security tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity relay.test_rbac_security -v 2
```

If `relay.test_rbac_security` is not an existing module, run the repository's actual RBAC test modules discovered by `python manage.py test relay -v 1` and record the exact module names in the task commit message/PR notes.

Expected: PASS and no weakening of cross-tenant behavior.

- [ ] **Step 7: Commit Task 2**

```bash
git add backend/relay/permissions.py backend/relay/services backend/relay/test_green_wallet_v1_identity.py
git commit -m "feat(wallet): bind participant identity and role gates"
```

---

### Task 3: Implement platform-defined policy rules and governed activation

**Files:**
- Create: `backend/relay/services/policy_rules.py`
- Modify: `backend/relay/services/errors.py`
- Test: `backend/relay/test_green_wallet_v1_policy.py`

**Interfaces:**
- Produces: `PolicyEvaluationResult`, `validate_policy_configuration(policy)`, `evaluate_policy(*, policy, profile, evidence_records) -> PolicyEvaluationResult`.
- Consumes: `ProgramBenefitPolicy`, `QualifyingEvidence`, `Profile`.

- [ ] **Step 1: Write failing deterministic-policy tests**

Use synthetic configuration values only:

```python
VALID_PARAMETERS = {
    'units_per_qualifying_event': '5.00',
    'allowed_evidence_source_types': ['relay_rider', 'authorized_import'],
    'max_units_per_participant': '20.00',
    'max_units_program_wide': '100.00',
    'expiry_days': 90,
}
```

Tests must prove:

```python
def test_verified_participation_is_deterministic(): ...
def test_rejects_unknown_rule_type(): ...
def test_rejects_non_positive_units_per_event(): ...
def test_rejects_missing_allowed_evidence_sources(): ...
def test_rejects_evidence_source_not_allowed_by_policy(): ...
def test_rejects_policy_outside_effective_period(): ...
def test_two_qualifying_events_calculate_ten_units_for_fixture_only(): ...
```

- [ ] **Step 2: Run policy tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_policy -v 2
```

Expected: FAIL because policy rule registry does not exist.

- [ ] **Step 3: Implement code-owned rule registry**

Create `backend/relay/services/policy_rules.py` with:

```python
from dataclasses import dataclass
from decimal import Decimal
from django.utils import timezone

from .errors import GreenWalletDomainError


@dataclass(frozen=True)
class PolicyEvaluationResult:
    calculated_units: Decimal
    qualifying_evidence_ids: tuple[int, ...]
    metadata: dict


def _validate_verified_participation_parameters(parameters):
    required = {
        'units_per_qualifying_event',
        'allowed_evidence_source_types',
        'max_units_per_participant',
        'max_units_program_wide',
        'expiry_days',
    }
    missing = required - set(parameters)
    if missing:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', f'Missing required policy parameters: {sorted(missing)}')
    units = Decimal(str(parameters['units_per_qualifying_event']))
    if units <= 0:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'units_per_qualifying_event must be positive.')
    if not parameters['allowed_evidence_source_types']:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'At least one evidence source type is required.')
    if Decimal(str(parameters['max_units_per_participant'])) <= 0 or Decimal(str(parameters['max_units_program_wide'])) <= 0:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'Issuance caps must be positive.')
    if int(parameters['expiry_days']) <= 0:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'expiry_days must be positive.')


RULE_VALIDATORS = {'verified_participation': _validate_verified_participation_parameters}
```

Implement `evaluate_policy` so it:

1. requires `policy.status == 'active'`;
2. checks effective dates against `timezone.localdate()`;
3. requires all evidence belong to the same institution/profile;
4. filters/rejects evidence not in the configured allowed source list;
5. calculates `units_per_qualifying_event * qualifying_event_count` using `Decimal`;
6. returns evidence IDs and minimal explanation metadata.

Do not implement arbitrary expressions or user-provided code execution.

- [ ] **Step 4: Run policy tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_policy -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

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
- Produces: `evaluate_issuance(*, actor, institution, profile, policy, evidence_records, correlation_id) -> IssuanceDecision`, `approve_issuance(*, actor, decision) -> GreenRouteCredit`.
- Consumes: `evaluate_policy`, `WalletLedgerEntry`, `GreenRouteCredit`, `IssuanceDecisionEvidence`, role helpers from Task 2.

- [ ] **Step 1: Write failing issuance tests**

Cover these exact cases:

```python
def test_evaluation_records_policy_and_all_evidence_links(): ...
def test_program_staff_cannot_approve_issuance(): ...
def test_admin_approval_creates_one_credit_and_one_issue_atomically(): ...
def test_approval_replay_returns_existing_credit_without_second_issue(): ...
def test_participant_cap_is_enforced(): ...
def test_program_cap_is_enforced(): ...
def test_concurrent_or_replayed_approval_cannot_exceed_caps(): ...
def test_issue_failure_rolls_back_credit_and_approval_state(): ...
```

Use `unittest.mock.patch` to force `WalletLedgerEntry.objects.create` to raise inside the transaction and assert that no v1 credit survives.

- [ ] **Step 2: Run issuance tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance -v 2
```

Expected: FAIL because issuance service is missing.

- [ ] **Step 3: Implement evaluation and approval as separate operations**

Create `backend/relay/services/issuance.py`.

`evaluate_issuance` must run the deterministic evaluator and create an `IssuanceDecision(status='evaluated')` plus `IssuanceDecisionEvidence` rows. It does not create spendable credit.

`approve_issuance` must use `transaction.atomic()` and `select_for_update()` on the decision, policy, and participant Profile. It must:

```python
if decision.status == 'approved' and hasattr(decision, 'green_route_credit'):
    return decision.green_route_credit
```

Then enforce institution-admin/platform-admin authorization and calculate prior approved v1 issuance under that policy/profile using `GreenRouteCredit` rows with `provenance_state='v1'`.

Use policy JSON values `max_units_per_participant` and `max_units_program_wide` as Decimal caps. Do not silently fall back to nullable legacy model columns when the active v1 parameter schema is incomplete; fail with `POLICY_CONFIGURATION_INVALID`.

Create the credit with:

```python
credit = GreenRouteCredit.objects.create(
    institution=decision.institution,
    profile=decision.profile,
    policy=decision.policy,
    issuance_decision=decision,
    amount_units=decision.calculated_units,
    unit_label=decision.policy.unit_label,
    status='issued',
    provenance_state='v1',
    issued_at=timezone.now(),
    expires_at=timezone.now() + timedelta(days=int(decision.policy.parameters['expiry_days'])),
)
```

Then create exactly one ledger event:

```python
WalletLedgerEntry.objects.create(
    credit=credit,
    institution=credit.institution,
    entry_type='ISSUE',
    quantity_delta=credit.amount_units,
    reason='Green Route Credits issued under approved ProgramBenefitPolicy.',
    correlation_id=decision.correlation_id,
    actor_reference=actor.get_username(),
)
```

Only after both writes succeed, set decision `status='approved'`, `approved_by=actor`, `approved_at=timezone.now()` and commit.

- [ ] **Step 4: Restrict direct normal credit creation in Django Admin**

Replace generic registration of `GreenRouteCredit` with a read-only `ModelAdmin`:

```python
@admin.register(GreenRouteCredit)
class GreenRouteCreditAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
```

Retain historical inspection. Do not add a public issuance CRUD endpoint.

- [ ] **Step 5: Run issuance and legacy contract tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance relay.test_green_wallet_contract relay.test_green_wallet_ledger_and_policy -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add backend/relay/services/issuance.py backend/relay/admin.py backend/relay/test_green_wallet_v1_issuance.py
git commit -m "feat(wallet): govern credit issuance and issue ledger events"
```

---

### Task 5: Make the ledger the authoritative wallet projection

**Files:**
- Create: `backend/relay/services/wallet_projection.py`
- Test: `backend/relay/test_green_wallet_v1_projection.py`

**Interfaces:**
- Produces: `BucketProjection`, `WalletProjection`, `project_credit_bucket(credit)`, `project_wallet(*, profile, institution, unit_label='Green Route Credits')`.
- Consumes: `GreenRouteCredit`, `WalletLedgerEntry`, `RedemptionAllocation`.

- [ ] **Step 1: Write failing event-semantics tests**

Use event sequences, not credit statuses:

```python
def test_issue_ten_projects_ten_available(): ...
def test_hold_four_moves_available_to_held(): ...
def test_release_four_moves_held_back_to_available(): ...
def test_debit_four_moves_held_to_fulfilled(): ...
def test_expire_two_moves_available_to_expired(): ...
def test_multiple_issuance_buckets_aggregate_into_one_wallet(): ...
def test_projection_never_blindly_sums_quantity_delta(): ...
def test_negative_available_projection_raises_integrity_error(): ...
def test_reversal_references_specific_prior_event_and_inverts_remaining_effect(): ...
```

For the canonical fixture:

```text
ISSUE 10 => available 10
HOLD 4 => available 6, held 4
RELEASE 4 => available 10, held 0
HOLD 4 + DEBIT 4 => available 6, fulfilled 4
EXPIRE 2 => available 4, expired 2
```

- [ ] **Step 2: Run projection tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_projection -v 2
```

Expected: FAIL because projection service is missing.

- [ ] **Step 3: Implement explicit event transition accounting**

Use immutable dataclasses:

```python
@dataclass(frozen=True)
class BucketProjection:
    issued_units: Decimal
    available_units: Decimal
    held_units: Decimal
    fulfilled_units: Decimal
    expired_units: Decimal

@dataclass(frozen=True)
class WalletProjection:
    issued_units: Decimal
    available_units: Decimal
    held_units: Decimal
    fulfilled_units: Decimal
    expired_units: Decimal
    unit_label: str
    buckets: tuple[BucketProjection, ...]
```

Process ledger rows ordered by `(created_at, id)` and apply semantics by `entry_type`. `HOLD` subtracts from available and adds to held; `RELEASE` subtracts from held and adds to available; `DEBIT` subtracts from held and adds to fulfilled; `EXPIRE` subtracts from available and adds to expired. `REVERSAL` must reference `reverses_entry` and apply the exact inverse only up to unreversed quantity. `ADJUSTMENT` must be handled through an explicit direction stored in reason/metadata only if the implementation adds a dedicated field; do not infer sign from prose. If the current schema cannot represent adjustment direction safely, exclude ADJUSTMENT from participant balances and raise `LEDGER_ADJUSTMENT_UNSUPPORTED` until a later reviewed schema extension.

This is intentionally stricter than guessing.

- [ ] **Step 4: Add projection integrity checks**

At every event transition enforce:

```python
if available < 0 or held < 0 or fulfilled < 0 or expired < 0:
    raise GreenWalletDomainError('LEDGER_INTEGRITY_ERROR', 'Wallet ledger event sequence produced an invalid negative quantity.')
```

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

### Task 6: Implement pooled ProgramBenefit redemption, oldest-expiring allocation, and capacity reservation

**Files:**
- Create: `backend/relay/services/redemption.py`
- Modify: `backend/relay/services/errors.py`
- Test: `backend/relay/test_green_wallet_v1_redemption.py`

**Interfaces:**
- Produces: `create_redemption(*, actor, institution, program_benefit, requested_units, idempotency_key) -> RedemptionRequest`.
- Consumes: `resolve_participant_profile`, `project_credit_bucket`, `ProgramBenefit`, `RedemptionAllocation`, `BenefitCapacityReservation`, `WalletLedgerEntry`.

- [ ] **Step 1: Write failing pooled-redemption tests**

Use two synthetic v1 awards:

```text
Award A = 5 units, expires first
Award B = 10 units, expires later
Request = 7 units
Expected allocation = 5 from A + 2 from B
```

Tests:

```python
def test_uuid_is_required(): ...
def test_replay_same_uuid_returns_same_request_without_duplicate_holds(): ...
def test_oldest_expiring_credit_allocates_first(): ...
def test_ties_break_by_issued_at_then_id(): ...
def test_partial_bucket_allocation_is_supported(): ...
def test_insufficient_balance_rolls_back_everything(): ...
def test_wrong_participant_same_tenant_cannot_spend_other_profile_credit(): ...
def test_cross_tenant_benefit_is_rejected(): ...
def test_finite_benefit_capacity_is_reserved_atomically(): ...
def test_capacity_exhaustion_leaves_no_hold(): ...
```

- [ ] **Step 2: Run redemption tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption -v 2
```

Expected: FAIL because pooled redemption service does not exist.

- [ ] **Step 3: Implement mandatory UUID validation and replay lookup**

Use Python `uuid.UUID(str(idempotency_key))` and reject invalid/missing values with `IDEMPOTENCY_KEY_REQUIRED` or `IDEMPOTENCY_KEY_INVALID`.

Replay lookup is scoped exactly to:

```python
RedemptionRequest.objects.filter(
    institution=institution,
    profile=profile,
    idempotency_key=str(parsed_uuid),
).first()
```

- [ ] **Step 4: Implement deterministic allocation inside one transaction**

Inside `transaction.atomic()`:

1. resolve participant Profile from `actor + institution`;
2. validate ProgramBenefit belongs to institution, is active, in date range, and requested units satisfy min/max/increment;
3. replay existing UUID if present;
4. query participant v1 credits with matching institution/unit label and order by `expires_at`, `issued_at`, `id`;
5. lock candidate credits with `select_for_update()`;
6. use `project_credit_bucket` to determine each bucket's available quantity;
7. build allocations until request is fully funded;
8. if total is insufficient, raise `INSUFFICIENT_AVAILABLE_UNITS` before any durable write;
9. lock finite ProgramBenefit row and count `reserved|consumed` reservations; if full, raise `BENEFIT_CAPACITY_EXHAUSTED`;
10. create `RedemptionRequest(status='requested', program_benefit=..., profile=..., institution=..., requested_units=..., idempotency_key=...)`;
11. create `RedemptionAllocation` rows;
12. create one `HOLD` ledger event per allocation with allocation FK;
13. create `BenefitCapacityReservation(state='reserved')` only when `capacity_total` is finite;
14. commit.

Do not populate legacy `credit` or `charging_hub` for v1 requests unless a migration-compatibility serializer explicitly needs them; v1 accounting must use allocations.

- [ ] **Step 5: Run redemption tests plus existing overcommit/idempotency tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption relay.test_green_wallet_ledger_and_policy relay.test_green_wallet_pasadena_acceptance -v 2
```

Expected: PASS; legacy tests continue to protect the pre-v1 endpoint until cutover.

- [ ] **Step 6: Commit Task 6**

```bash
git add backend/relay/services/redemption.py backend/relay/services/errors.py backend/relay/test_green_wallet_v1_redemption.py
git commit -m "feat(wallet): add pooled benefit redemption"
```

---

### Task 7: Make review triage and terminal processing atomic and role-separated

**Files:**
- Create: `backend/relay/services/redemption_review.py`
- Modify: `backend/relay/models.py` if a `reviewed_by_user` FK is needed for v1 audit metadata
- Create: `backend/relay/migrations/0007_green_wallet_lifecycle_v1_constraints.py`
- Test: `backend/relay/test_green_wallet_v1_review.py`

**Interfaces:**
- Produces: `start_review(*, actor, redemption_request) -> RedemptionRequest`, `finalize_redemption(*, actor, redemption_request, decision, review_note='') -> RedemptionRequest`.
- Consumes: operation-specific role helpers, `RedemptionAllocation`, `BenefitCapacityReservation`, `WalletLedgerEntry`, `ExpirationService` helper for post-expiry release handling.

- [ ] **Step 1: Write failing review-authority and concurrency tests**

Tests must prove:

```python
def test_program_staff_can_move_requested_to_under_review(): ...
def test_program_staff_cannot_fulfill_or_deny(): ...
def test_institution_admin_can_fulfill(): ...
def test_institution_admin_can_deny(): ...
def test_requested_cannot_skip_directly_to_terminal(): ...
def test_fulfillment_writes_one_debit_per_allocation_and_consumes_capacity(): ...
def test_denial_writes_one_release_per_allocation_and_releases_capacity(): ...
def test_terminal_ledger_failure_rolls_back_status_and_capacity(): ...
def test_second_terminal_attempt_returns_conflict_without_extra_ledger_events(): ...
```

- [ ] **Step 2: Run review tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_review -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement `start_review`**

Inside `transaction.atomic()` and `select_for_update()` on request:

```python
if request.status != 'requested':
    raise GreenWalletDomainError('REDEMPTION_STATE_CONFLICT', 'Only requested redemptions may enter review.')
```

Authorize `program_staff`, `institution_admin`, or platform admin. Set `status='under-review'`, server reviewer metadata, and save.

- [ ] **Step 4: Implement atomic terminal processing**

Inside `transaction.atomic()`:

1. lock `RedemptionRequest`;
2. require status `under-review`;
3. authorize institution-admin/platform-admin only;
4. lock allocations in deterministic ID order;
5. lock capacity reservation if present;
6. for `fulfilled`, create one DEBIT per held allocation and set reservation `consumed`;
7. for `denied`, create one RELEASE per held allocation and set reservation `released`;
8. if denied allocation's credit `expires_at <= now`, write matching EXPIRE in the same transaction after RELEASE so quantity does not return to spendable balance;
9. set terminal status, reviewer user/name/time/note, fulfillment method `manual_program_action` only for fulfilled;
10. commit.

If any ledger write fails, status and capacity changes must roll back.

- [ ] **Step 5: Add post-spine constraints in migration `0007`**

Create constraints that are safe after Task 1-7 data shapes exist, including:

- v1 `GreenRouteCredit` requires non-null `profile`, `policy`, `issuance_decision`, `expires_at`, `issued_at` when `provenance_state='v1'`;
- `RedemptionAllocation.allocated_units > 0` database check;
- one `BenefitCapacityReservation` per request is already enforced by OneToOneField;
- add index for `(institution, profile, idempotency_key)` and unique constraint when idempotency key is non-null;
- do not remove the legacy `(credit, idempotency_key)` constraint yet if legacy endpoint still exists.

- [ ] **Step 6: Run review, schema, and migration checks**

```bash
cd backend
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py check
python manage.py test relay.test_green_wallet_v1_review relay.test_green_wallet_v1_schema -v 2
```

Expected: PASS and no uncommitted model changes.

- [ ] **Step 7: Commit Task 7**

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

**Interfaces:**
- Produces: `expire_due_credits(*, as_of=None, institution=None) -> ExpirationResult` and management command `python manage.py expire_green_route_credits`.
- Consumes: `project_credit_bucket`, `GreenRouteCredit`, `WalletLedgerEntry`.

- [ ] **Step 1: Write failing expiration tests**

Prove:

```python
def test_available_units_expire_after_expires_at(): ...
def test_held_units_are_not_expired_by_worker(): ...
def test_worker_retry_does_not_duplicate_expire_event(): ...
def test_partially_available_bucket_expires_only_remaining_available_units(): ...
def test_fulfillment_after_natural_expiry_of_preexpiry_hold_is_valid(): ...
def test_denial_after_natural_expiry_results_in_zero_available_and_expired_quantity(): ...
```

- [ ] **Step 2: Run expiration tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement idempotent expiration service**

Use a frozen result type:

```python
@dataclass(frozen=True)
class ExpirationResult:
    credits_scanned: int
    credits_expired: int
    units_expired: Decimal
```

For each v1 credit with `expires_at <= as_of`, lock the credit, project its bucket, and write one EXPIRE only for current `available_units`. Because a second run will project zero available after the first EXPIRE, retries are idempotent without relying on wall-clock assumptions.

Do not expire held units.

- [ ] **Step 4: Add management command**

`expire_green_route_credits.py` should call the service and print counts only. It must not contain accounting logic.

- [ ] **Step 5: Run expiration and review tests together**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration relay.test_green_wallet_v1_review -v 2
```

Expected: PASS, especially denial-after-expiry behavior.

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

**Interfaces:**
- Produces target endpoints from spec Section 17.
- Consumes all services from Tasks 2-8.

- [ ] **Step 1: Write failing API tests before views**

Cover exact endpoint behavior:

```python
def test_participant_wallet_endpoint_returns_server_projection(): ...
def test_participant_program_benefits_lists_only_active_in_period_benefits(): ...
def test_redemption_post_does_not_accept_profile_or_credit_as_authority(): ...
def test_redemption_post_requires_uuid(): ...
def test_program_staff_start_review_succeeds(): ...
def test_program_staff_fulfill_returns_403(): ...
def test_institution_admin_fulfill_succeeds(): ...
def test_cross_tenant_resource_returns_404(): ...
def test_business_rule_failure_returns_422_with_machine_code(): ...
def test_state_conflict_returns_409_with_machine_code(): ...
```

Expected response shape for a domain error:

```json
{
  "code": "INSUFFICIENT_AVAILABLE_UNITS",
  "message": "Requested units exceed the participant's available Green Route Credit balance."
}
```

- [ ] **Step 2: Run API tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_api -v 2
```

Expected: FAIL because institution-scoped endpoints do not exist.

- [ ] **Step 3: Implement transport serializers only**

In `green_wallet_v1_serializers.py`, define request serializers for:

- evidence create;
- issuance evaluate;
- issuance approve (no client-calculated amount field);
- redemption create with `program_benefit_id`, `requested_units`, `idempotency_key`;
- review start;
- terminal decision note.

Define response serializers/projection mapping for wallet and benefits. Do not reimplement service invariants in serializer `validate()` methods beyond transport-level shape and UUID/decimal parsing.

- [ ] **Step 4: Implement explicit action views**

Use DRF `APIView` or narrowly-scoped generic views for exact paths:

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

Always resolve institution from the URL and caller membership; never let request JSON override it.

- [ ] **Step 5: Centralize domain-error to HTTP mapping**

Map service errors by code category:

```python
HTTP_401_CODES = {'UNAUTHENTICATED'}
HTTP_403_CODES = {'ISSUANCE_APPROVAL_FORBIDDEN', 'REDEMPTION_REVIEW_FORBIDDEN', 'REDEMPTION_FINALIZE_FORBIDDEN'}
HTTP_409_CODES = {'REDEMPTION_STATE_CONFLICT', 'REDEMPTION_ALREADY_TERMINAL', 'IDEMPOTENCY_CONFLICT'}
HTTP_422_CODES = {
    'PARTICIPANT_PROFILE_NOT_CLAIMED',
    'POLICY_INACTIVE',
    'POLICY_CONFIGURATION_INVALID',
    'EVIDENCE_NOT_ELIGIBLE',
    'PARTICIPANT_CAP_EXCEEDED',
    'PROGRAM_CAP_EXCEEDED',
    'INSUFFICIENT_AVAILABLE_UNITS',
    'BENEFIT_CAPACITY_EXHAUSTED',
}
```

Tenant invisibility must return 404 before revealing whether the object exists.

- [ ] **Step 6: Mount v1 URLs without removing legacy routes yet**

Modify `backend/config/urls.py` to add explicit institution-scoped paths. Keep existing router routes temporarily until Task 11 cutover verification confirms the frontend no longer depends on them.

- [ ] **Step 7: Run API, RBAC, and full backend tests**

```bash
cd backend
python manage.py test relay -v 2
python manage.py check
python manage.py makemigrations --check --dry-run
```

Expected: all backend tests PASS; no model drift.

- [ ] **Step 8: Commit Task 9**

```bash
git add backend/relay/green_wallet_v1_serializers.py backend/relay/green_wallet_v1_views.py backend/config/urls.py backend/relay/test_green_wallet_v1_api.py
git commit -m "feat(wallet): add institution scoped lifecycle api"
```

---

### Task 10: Cut the React Green Wallet over to server projection and generic ProgramBenefit redemption

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/greenWalletApi.ts`
- Modify: `src/screens/WalletScreen.tsx`
- Modify: `src/context/AppContext.tsx`
- Create: `src/flows/ProgramBenefitRedemptionFlow.tsx`
- Test: `src/lib/greenWalletApi.v1.test.ts`
- Test: `src/screens/WalletScreen.v1.test.tsx`
- Test: `src/flows/ProgramBenefitRedemptionFlow.test.tsx`

**Interfaces:**
- Produces: `WalletProjection`, `ProgramBenefit`, v1 `RedemptionRequest`, `greenWalletApi.getWallet(institutionId)`, `listProgramBenefits(institutionId)`, `createRedemption(institutionId, input)`.
- Consumes: Task 9 institution-scoped API.

- [ ] **Step 1: Write failing TypeScript/API adapter tests**

Define expected canonical types:

```ts
export interface WalletProjection {
  issuedUnits: number;
  availableUnits: number;
  heldUnits: number;
  fulfilledUnits: number;
  expiredUnits: number;
  unitLabel: string;
  recentActivity: WalletActivity[];
}

export interface ProgramBenefit {
  id: string;
  name: string;
  description: string;
  benefitType: 'ev_charging' | 'transit' | 'access_point' | 'other';
  status: 'draft' | 'active' | 'retired';
  minRequestedUnits: number;
  maxRequestedUnits: number;
  requestIncrement: number;
  chargingHubId?: string;
}
```

Write adapter tests that prove snake_case backend fields map correctly and errors preserve `status`, `code`, and `message`.

- [ ] **Step 2: Run frontend adapter tests and verify failure**

```bash
npm test -- src/lib/greenWalletApi.v1.test.ts
```

Expected: FAIL because v1 methods/types do not exist.

- [ ] **Step 3: Replace v1 API methods in `greenWalletApi.ts`**

Add exact signatures:

```ts
getWallet(institutionId: string): Promise<WalletProjection>
listProgramBenefits(institutionId: string): Promise<ProgramBenefit[]>
createRedemption(institutionId: string, input: {
  programBenefitId: string;
  requestedUnits: number;
  idempotencyKey: string;
}): Promise<RedemptionRequest>
startReview(institutionId: string, redemptionId: string): Promise<RedemptionRequest>
fulfillRedemption(institutionId: string, redemptionId: string, reviewNote: string): Promise<RedemptionRequest>
denyRedemption(institutionId: string, redemptionId: string, reviewNote: string): Promise<RedemptionRequest>
```

Update `GreenWalletApiError` with `code?: string` and preserve machine-readable backend errors.

- [ ] **Step 4: Write failing wallet-screen tests**

Mock API-backed state so the server returns:

```ts
{
  issuedUnits: 15,
  availableUnits: 8,
  heldUnits: 7,
  fulfilledUnits: 0,
  expiredUnits: 0,
  unitLabel: 'Green Route Credits',
}
```

Assert the screen displays exactly 8 Available, 7 Under review / Held, 0 Fulfilled, 0 Expired even if raw legacy credits would imply another number. Assert an active transit ProgramBenefit renders as operational without requiring a ChargingHub.

- [ ] **Step 5: Implement WalletScreen as projection renderer**

Remove canonical use of:

```ts
unavailableCreditIds
credits.filter(...).reduce(...)
pending = credits.filter(...)
redeemed = credits.filter(...)
```

Instead consume the API-backed `WalletProjection` and ProgramBenefit list. Keep disclosures that credits are not cash/wages/fares/automatic payments.

- [ ] **Step 6: Implement generic `ProgramBenefitRedemptionFlow`**

The flow must:

1. receive selected `ProgramBenefit` and institution ID;
2. show benefit-specific information;
3. let the participant select/request a permitted unit amount respecting min/max/increment;
4. generate `crypto.randomUUID()` once per intentional submission;
5. POST `programBenefitId`, `requestedUnits`, and UUID;
6. show `requested`/under-review status;
7. for `ev_charging`, show optional ChargingHub information and explicit no-reservation/no-payment copy;
8. for transit/access-point/other benefits, never require charging metadata.

- [ ] **Step 7: Remove canonical wallet mutation responsibility from AppContext**

Keep session-memory demo state only where unrelated legacy prototype screens still need it, but WalletScreen and ProgramBenefitRedemptionFlow must no longer call `addGreenRouteCredit`, `createRedemptionRequest`, or `reviewRedemptionRequest` as their source of truth.

Document deprecated context methods in code comments and remove them entirely if no remaining imports exist after a repository-wide search.

- [ ] **Step 8: Run frontend tests, typecheck, security check, and build**

```bash
npm test
npm run check
npm run security:check
npm run build
```

Expected: all PASS; build succeeds.

- [ ] **Step 9: Commit Task 10**

```bash
git add src/types.ts src/lib/greenWalletApi.ts src/screens/WalletScreen.tsx src/context/AppContext.tsx src/flows/ProgramBenefitRedemptionFlow.tsx src/lib/greenWalletApi.v1.test.ts src/screens/WalletScreen.v1.test.tsx src/flows/ProgramBenefitRedemptionFlow.test.tsx
git commit -m "feat(wallet): render canonical program benefit wallet"
```

---

### Task 11: Perform legacy cutover, migration classification, and retirement safeguards

**Files:**
- Modify: `backend/relay/views.py`
- Modify: `backend/relay/serializers.py`
- Modify: `backend/config/urls.py`
- Modify: `docs/GREEN_WALLET_API_CONTRACT.md`
- Modify: `src/flows/EVChargeCreditRedemptionFlow.tsx` or delete if no longer referenced
- Test: extend `backend/relay/test_green_wallet_contract.py`
- Test: extend `src/screens/WalletScreen.v1.test.tsx`

**Interfaces:**
- Produces: canonical v1 endpoints as the only operational Green Wallet write path; legacy data remains readable for migration/history but not a competing writer.
- Consumes: all prior tasks.

- [ ] **Step 1: Add regression tests proving legacy write paths cannot bypass v1 issuance/redemption**

Backend tests must prove:

- no public POST route creates GreenRouteCredit directly;
- v1 participant flow cannot PATCH redemption lifecycle status;
- direct legacy redemption POST is either disabled for canonical deployments or explicitly marked compatibility-only and inaccessible from the v1 frontend;
- legacy historical credits remain readable but are `provenance_state='legacy'`.

- [ ] **Step 2: Search frontend for legacy Green Wallet dependencies**

Run:

```bash
rg "EVChargeCreditRedemptionFlow|creditId|chargingHubId|createRedemptionRequest|reviewRedemptionRequest|greenRouteCredits" src
```

For every hit, classify it as either unrelated research-beta fixture/test or canonical wallet code. Remove canonical dependencies. Do not blindly delete unrelated prototype data.

- [ ] **Step 3: Retire or isolate charging-only flow**

If `EVChargeCreditRedemptionFlow.tsx` has no remaining canonical caller, delete it and its obsolete tests. If another research-beta demo still references it, rename/annotate it as legacy demonstration-only and ensure WalletScreen never imports it.

- [ ] **Step 4: Update current API contract document to distinguish runtime v1 from legacy**

Rewrite `docs/GREEN_WALLET_API_CONTRACT.md` so it accurately states which v1 endpoints are canonical and which legacy resources remain compatibility-only. Do not claim Charging Intelligence, automatic settlement, or production identity is live.

- [ ] **Step 5: Run full backend/frontend suites**

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

Expected: all PASS.

- [ ] **Step 6: Commit Task 11**

```bash
git add backend/relay/views.py backend/relay/serializers.py backend/config/urls.py docs/GREEN_WALLET_API_CONTRACT.md src
git commit -m "refactor(wallet): retire legacy wallet write paths"
```

---

### Task 12: Prove the full synthetic Pasadena Lifecycle v1 acceptance chain

**Files:**
- Create: `backend/relay/test_green_wallet_v1_pasadena_acceptance.py`
- Modify: `src/screens/WalletScreen.v1.test.tsx`
- Create or modify: `docs/GREEN_WALLET_V1_ACCEPTANCE.md`

**Interfaces:**
- Produces: durable acceptance evidence for one synthetic Pasadena institution and release blockers.
- Consumes: entire Lifecycle v1 implementation.

- [ ] **Step 1: Write one end-to-end backend acceptance test using synthetic data only**

The fixture must create:

```text
Institution: Pasadena Mobility Research Institute
Users:
  pasadena-participant (participant)
  pasadena-staff (program_staff)
  pasadena-admin (institution_admin)
  pasadena-viewer (viewer)
  glendale-participant (participant in another tenant)
Policy rule: verified_participation
Synthetic parameters:
  units_per_qualifying_event = 5
  participant cap = 20
  program cap = 100
  expiry = 90 days
Evidence: two synthetic qualifying events for Pasadena participant
Benefits:
  EV Charge Benefit (active, optional ChargingHub metadata)
  Transit Benefit (active, no ChargingHub)
```

Test chain:

```text
Institution
-> active policy
-> authenticated participant
-> claimed Profile
-> two QualifyingEvidence rows
-> deterministic evaluation = 10 synthetic fixture units
-> admin approval
-> GreenRouteCredit provenance_state=v1
-> exactly one ISSUE
-> wallet available=10
-> participant selects Transit Benefit
-> mandatory UUID redemption for 7
-> pooled allocations sum=7
-> HOLD events sum=7
-> wallet available=3, held=7
-> program_staff start review
-> viewer terminal attempt denied
-> program_staff terminal attempt denied
-> admin fulfill
-> DEBIT sum=7
-> wallet available=3, held=0, fulfilled=7
```

Also run the same accounting path for an EV Charge Benefit and assert no payment/charging-session claim is created.

- [ ] **Step 2: Add negative and concurrency cases to the acceptance module**

Prove:

- Glendale participant cannot view or redeem Pasadena wallet/benefits;
- second Pasadena participant cannot redeem first participant's balance;
- duplicate issuance approval does not create second ISSUE;
- duplicate redemption UUID does not create second HOLD;
- overcommit request fails;
- program cap/participant cap fixture limits are enforced;
- terminal second decision creates no second DEBIT/RELEASE;
- denial after natural expiry yields RELEASE + EXPIRE and zero newly available units;
- expiration worker retry is idempotent.

- [ ] **Step 3: Run migration forward/backward verification from 0005 through current latest before accepting authoritative v1 data**

On a disposable test database:

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

If rollback from 0007 to 0005 would destroy accepted v1 ledger/provenance data in a real environment, document that production rollback after acceptance is application rollback/forward-fix only. Do not present destructive schema rollback as safe.

- [ ] **Step 4: Run complete verification suite**

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

Expected: all PASS.

- [ ] **Step 5: Record acceptance evidence in `docs/GREEN_WALLET_V1_ACCEPTANCE.md`**

Record:

- exact branch/head SHA;
- migration list and latest applied migration;
- exact backend/frontend test totals;
- migration verification commands/results;
- synthetic institution and role fixture names;
- wallet projection before request, under review, after fulfillment, and after expiration fixture;
- cross-tenant and wrong-participant negative results;
- duplicate/idempotency results;
- cap/concurrency results;
- UI DOM acceptance results;
- security/build results;
- rollback procedure;
- every remaining blocker.

Do not call Lifecycle v1 operational if any proof-chain segment fails.

- [ ] **Step 6: Commit Task 12**

```bash
git add backend/relay/test_green_wallet_v1_pasadena_acceptance.py src/screens/WalletScreen.v1.test.tsx docs/GREEN_WALLET_V1_ACCEPTANCE.md
git commit -m "test(wallet): prove lifecycle v1 Pasadena acceptance chain"
```

---

## Final Verification Gate

Before opening or updating the implementation PR as ready for review, run exactly:

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

Then verify git state:

```bash
git status --short
git log --oneline --decorate -15
```

Expected:

- no uncommitted generated files;
- migrations 0001-0007 present in order;
- all backend tests pass;
- all frontend tests pass;
- TypeScript check passes;
- security check passes;
- production build passes;
- no canonical Green Wallet UI computes balances locally;
- no canonical participant redemption submits arbitrary Profile or credit ownership fields;
- no canonical terminal transition is performed by generic PATCH;
- no live charging/payment/Charging Intelligence code was introduced.

## Plan Self-Review

**Spec coverage:** Tasks 1-12 cover identity, participant role, policy framework, evidence provenance, deterministic issuance, ISSUE accounting, caps, generic ProgramBenefit targeting, pooled oldest-expiring allocations, mandatory idempotency, benefit-capacity reservations, separated RBAC, atomic terminal review, ledger projection, expiration, explicit APIs, UI cutover, migration/backfill rules, and Pasadena acceptance.

**Intentional non-implementation:** automatic issuance, live third-party evidence, charging-network integration, payment settlement, arbitrary formulas, and partial fulfillment remain excluded by design.

**Type consistency:** service signatures and v1 entity names are consistent across tasks: `resolve_participant_profile`, `evaluate_policy`, `evaluate_issuance`, `approve_issuance`, `project_credit_bucket`, `project_wallet`, `create_redemption`, `start_review`, `finalize_redemption`, and `expire_due_credits`.

**Rollback boundary:** schema is additive through 0006/0007. Once accepted v1 audit data exists, destructive rollback is not considered safe; preserve data and use application rollback/forward-fix.
