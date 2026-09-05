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
    BenefitCapacityReservation,
    GreenRouteCredit,
    Institution,
    IssuanceDecision,
    IssuanceDecisionEvidence,
    Membership,
    Profile,
    ProgramBenefit,
    QualifyingEvidence,
    RedemptionAllocation,
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
        credit_field = RedemptionRequest._meta.get_field('credit')
        hub_field = RedemptionRequest._meta.get_field('charging_hub')
        self.assertTrue(credit_field.null)
        self.assertTrue(hub_field.null)

    def test_each_evidence_record_can_feed_only_one_v1_issuance_decision(self):
        evidence_field = IssuanceDecisionEvidence._meta.get_field('evidence')
        self.assertTrue(evidence_field.unique)
```

- [ ] **Step 2: Run the schema test and verify it fails before model changes**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema -v 2
```

Expected: FAIL because v1 fields/models do not exist.

- [ ] **Step 3: Add participant identity and policy-framework fields**

In `backend/relay/models.py`, add:

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
activated_by = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name='activated_green_wallet_policies',
)
activated_at = models.DateTimeField(null=True, blank=True)
```

Keep the existing `max_units_per_participant`, `max_units_program_wide`, and `expiry_days` columns as the canonical cap/expiry fields. Do not duplicate those values in `parameters`.

- [ ] **Step 4: Add evidence and issuance provenance models**

Add `QualifyingEvidence`:

```python
class QualifyingEvidence(TimestampedModel):
    SOURCE_TYPES = [
        ('relay_rider', 'Relay Rider'),
        ('authorized_import', 'Authorized import'),
        ('admin_attestation', 'Administrative attestation'),
    ]
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

Add `IssuanceDecision` with statuses `evaluated | approved | denied`, fields `institution`, `profile`, `policy`, `calculated_units`, `evaluation_metadata`, `evaluated_at`, `approved_by`, `approved_at`, `denied_by`, `denied_at`, `denial_reason`, and indexed `correlation_id`.

Add `IssuanceDecisionEvidence` with:

```python
issuance_decision = models.ForeignKey(IssuanceDecision, on_delete=models.PROTECT, related_name='evidence_links')
evidence = models.OneToOneField(QualifyingEvidence, on_delete=models.PROTECT, related_name='issuance_link')
```

V1 intentionally prevents one evidence record from creating multiple credit awards. Corrections use superseding evidence instead of reusing an already-decided evidence row.

- [ ] **Step 5: Add generic ProgramBenefit and pooled-redemption models**

Add `ProgramBenefit` fields:

```python
institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='program_benefits')
name = models.CharField(max_length=160)
description = models.TextField(blank=True)
benefit_type = models.CharField(max_length=32, choices=[
    ('ev_charging', 'EV charging'),
    ('transit', 'Transit'),
    ('access_point', 'Access Point'),
    ('other', 'Other'),
])
status = models.CharField(max_length=32, choices=[('draft', 'Draft'), ('active', 'Active'), ('retired', 'Retired')], default='draft')
unit_label = models.CharField(max_length=80, default='Green Route Credits')
min_requested_units = models.DecimalField(max_digits=10, decimal_places=2)
max_requested_units = models.DecimalField(max_digits=10, decimal_places=2)
request_increment = models.DecimalField(max_digits=10, decimal_places=2)
capacity_total = models.PositiveIntegerField(null=True, blank=True)
charging_hub = models.ForeignKey('ChargingHub', null=True, blank=True, on_delete=models.PROTECT, related_name='program_benefits')
effective_start = models.DateField(null=True, blank=True)
effective_end = models.DateField(null=True, blank=True)
```

Alter legacy `RedemptionRequest.credit` and `RedemptionRequest.charging_hub` to `null=True, blank=True` so v1 pooled requests can exist without fabricating a single credit or ChargingHub. Add nullable `program_benefit` FK.

Add `RedemptionAllocation(redemption_request, credit, allocated_units)` with unique `(redemption_request, credit)`.

Add `BenefitCapacityReservation` as a OneToOneField to `RedemptionRequest`, with state choices `reserved | consumed | released`.

- [ ] **Step 6: Add v1 provenance fields to credits and ledger**

Extend `GreenRouteCredit` with:

```python
policy = models.ForeignKey('ProgramBenefitPolicy', null=True, blank=True, on_delete=models.PROTECT, related_name='issued_credits')
issuance_decision = models.OneToOneField('IssuanceDecision', null=True, blank=True, on_delete=models.PROTECT, related_name='green_route_credit')
issued_at = models.DateTimeField(null=True, blank=True)
expires_at = models.DateTimeField(null=True, blank=True)
provenance_state = models.CharField(max_length=16, choices=[('legacy', 'Legacy/pre-v1'), ('v1', 'Lifecycle v1')], default='legacy')
```

Extend `WalletLedgerEntry` with nullable `redemption_allocation` and nullable self-reference `reverses_entry`, both `PROTECT`.

- [ ] **Step 7: Generate and inspect migration `0006`**

```bash
cd backend
python manage.py makemigrations relay --name green_wallet_lifecycle_v1_spine
python manage.py makemigrations --check --dry-run
```

Expected: first command creates `0006_green_wallet_lifecycle_v1_spine.py`; second reports `No changes detected`.

Confirm `0006` does not delete migrations 0001-0005 or remove legacy redemption fields.

- [ ] **Step 8: Run schema and existing Green Wallet tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema relay.test_green_wallet_contract relay.test_green_wallet_ledger_and_policy relay.test_green_wallet_pasadena_acceptance relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 9: Verify migration forward/backward/forward while it is still additive**

```bash
cd backend
python manage.py migrate relay 0005
python manage.py migrate relay 0006
python manage.py check
python manage.py migrate relay 0005
python manage.py migrate relay 0006
python manage.py migrate
```

Expected: all commands succeed on synthetic/local data.

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
- Produces: `resolve_participant_profile(*, user, institution) -> Profile`, `GreenWalletDomainError`, `can_start_redemption_review`, `can_finalize_redemption`, `can_approve_issuance`.
- Consumes: `Membership`, `Profile`, `Institution`.

- [ ] **Step 1: Define domain-error contract**

Create `backend/relay/services/errors.py`:

```python
class GreenWalletDomainError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
```

- [ ] **Step 2: Write failing identity and role tests**

Create tests for:

```python
def test_resolves_claimed_profile_for_user_and_institution(): ...
def test_unclaimed_profile_is_not_resolved(): ...
def test_wrong_users_same_tenant_profile_is_not_resolved(): ...
def test_same_user_can_have_one_claimed_profile_in_two_institutions(): ...
def test_viewer_without_claimed_profile_has_no_participant_authority(): ...
def test_program_staff_can_start_review_but_cannot_finalize(): ...
def test_institution_admin_can_approve_issuance_and_finalize(): ...
```

Use exact error code `PARTICIPANT_PROFILE_NOT_CLAIMED` when resolution fails.

- [ ] **Step 3: Run identity tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity -v 2
```

Expected: FAIL.

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
    return bool(
        user
        and user.is_authenticated
        and Membership.objects.filter(user=user, institution=institution, role__in=roles).exists()
    )
```

- [ ] **Step 5: Split permissions by operation**

In `backend/relay/permissions.py` define:

```python
TRIAGE_ROLES = {'program_staff', 'institution_admin'}
TERMINAL_REVIEW_ROLES = {'institution_admin'}
ISSUANCE_APPROVAL_ROLES = {'institution_admin'}
```

Keep `platform_admin` as explicit bypass. Retain the legacy `CanReviewRedemptionRequest` only for the old endpoint until Task 11; v1 actions must use the stricter operation-specific helpers.

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
- Consumes: `ProgramBenefitPolicy`, `QualifyingEvidence`, role helpers.

- [ ] **Step 1: Write failing policy tests**

Use fixture-only values:

```python
PARAMETERS = {
    'units_per_qualifying_event': '5.00',
    'allowed_evidence_source_types': ['relay_rider', 'authorized_import'],
}
```

Store caps/expiry in existing policy fields:

```python
max_units_per_participant='20.00'
max_units_program_wide='100.00'
expiry_days=90
```

Tests:

```python
def test_verified_participation_is_deterministic(): ...
def test_rejects_unknown_rule_type(): ...
def test_rejects_non_positive_units_per_event(): ...
def test_rejects_missing_evidence_sources(): ...
def test_rejects_missing_or_non_positive_caps_and_expiry(): ...
def test_rejects_evidence_source_not_allowed_by_policy(): ...
def test_rejects_policy_outside_effective_period(): ...
def test_activation_retires_prior_active_version_atomically(): ...
def test_non_admin_cannot_activate_policy(): ...
```

- [ ] **Step 2: Run policy tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_policy -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement code-owned rule registry**

Create `backend/relay/services/policy_rules.py`:

```python
from dataclasses import dataclass
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from relay.models import ProgramBenefitPolicy
from .errors import GreenWalletDomainError


@dataclass(frozen=True)
class PolicyEvaluationResult:
    calculated_units: Decimal
    qualifying_evidence_ids: tuple[int, ...]
    metadata: dict


def _validate_verified_participation(policy):
    parameters = policy.parameters
    units = Decimal(str(parameters.get('units_per_qualifying_event', '0')))
    allowed_sources = parameters.get('allowed_evidence_source_types') or []
    if units <= 0:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'units_per_qualifying_event must be positive.')
    if not allowed_sources:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'At least one evidence source type is required.')
    if policy.max_units_per_participant is None or policy.max_units_per_participant <= 0:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'Participant issuance cap must be positive.')
    if policy.max_units_program_wide is None or policy.max_units_program_wide <= 0:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'Program issuance cap must be positive.')
    if policy.expiry_days is None or policy.expiry_days <= 0:
        raise GreenWalletDomainError('POLICY_CONFIGURATION_INVALID', 'expiry_days must be positive.')
```

Register only `verified_participation` for v1.

- [ ] **Step 4: Implement governed activation**

`activate_policy(*, actor, policy)` must run inside `transaction.atomic()`, authorize `institution_admin`/platform admin, validate configuration, lock all policy rows for the institution, mark any other active policy `retired`, then mark the requested policy `active` with `activated_by` and `activated_at`.

This yields exactly one active policy per institution without deleting historical versions.

- [ ] **Step 5: Implement deterministic evaluation**

`evaluate_policy` must:

1. require active/in-period policy;
2. require evidence institution/profile match;
3. require evidence source types from policy `parameters`;
4. calculate `Decimal(units_per_qualifying_event) * len(evidence_records)`;
5. return evidence IDs and minimal explanation metadata;
6. reject any evidence already linked to an IssuanceDecision with `EVIDENCE_ALREADY_USED`.

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
- Produces: `evaluate_issuance(...) -> IssuanceDecision`, `approve_issuance(...) -> GreenRouteCredit`.
- Consumes: `evaluate_policy`, `WalletLedgerEntry`, v1 policy caps, role helpers.

- [ ] **Step 1: Write failing issuance tests**

```python
def test_evaluation_records_policy_and_all_evidence_links(): ...
def test_same_evidence_cannot_be_awarded_twice(): ...
def test_program_staff_cannot_approve_issuance(): ...
def test_admin_approval_creates_one_credit_and_one_issue_atomically(): ...
def test_approval_replay_returns_existing_credit_without_second_issue(): ...
def test_participant_cap_is_enforced(): ...
def test_program_cap_is_enforced(): ...
def test_issue_failure_rolls_back_credit_and_approval_state(): ...
```

Patch `WalletLedgerEntry.objects.create` to raise in the rollback test and assert no v1 credit remains.

- [ ] **Step 2: Run issuance tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement evaluation operation**

`evaluate_issuance` calls `evaluate_policy` and creates `IssuanceDecision(status='evaluated')` plus one `IssuanceDecisionEvidence` per evidence record. It creates no spendable credit.

- [ ] **Step 4: Implement atomic approval operation**

Inside `transaction.atomic()` and after locking decision, policy, and Profile:

```python
if decision.status == 'approved':
    return decision.green_route_credit
```

Authorize `institution_admin`/platform admin. Calculate already-issued v1 units under the same policy and same profile using `GreenRouteCredit` rows, and enforce:

```python
participant_total + decision.calculated_units <= decision.policy.max_units_per_participant
program_total + decision.calculated_units <= decision.policy.max_units_program_wide
```

Create the v1 credit:

```python
now = timezone.now()
credit = GreenRouteCredit.objects.create(
    institution=decision.institution,
    profile=decision.profile,
    policy=decision.policy,
    issuance_decision=decision,
    amount_units=decision.calculated_units,
    unit_label=decision.policy.unit_label,
    status='issued',
    provenance_state='v1',
    issued_at=now,
    expires_at=now + timedelta(days=decision.policy.expiry_days),
)
```

Create exactly one `ISSUE` ledger event in the same transaction, then mark the decision approved. If any write fails, the transaction must leave no v1 credit, ISSUE event, or approved decision.

- [ ] **Step 5: Make GreenRouteCredit read-only in Django Admin**

Replace generic registration with a ModelAdmin whose add/change/delete permissions all return `False`. Historical inspection remains available.

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
- Produces: `BucketProjection`, `WalletProjection`, `project_credit_bucket(credit)`, `project_wallet(*, profile, institution, unit_label='Green Route Credits')`.
- Consumes: `GreenRouteCredit`, `WalletLedgerEntry`.

- [ ] **Step 1: Write failing accounting tests**

Prove exact event semantics:

```text
ISSUE 10       => available 10
HOLD 4         => available 6, held 4
RELEASE 4      => available 10, held 0
HOLD 4
DEBIT 4        => available 6, held 0, fulfilled 4
EXPIRE 2       => available 4, expired 2
ADJUSTMENT +1  => available 5
ADJUSTMENT -1  => available 4
```

Also test one valid REVERSAL for each of ISSUE/HOLD/RELEASE/DEBIT/EXPIRE semantics and reject reversal that would make any bucket negative or that exceeds unreversed quantity.

- [ ] **Step 2: Run projection tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_projection -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement explicit projection dataclasses**

```python
@dataclass(frozen=True)
class BucketProjection:
    credit_id: int
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

Process ledger rows ordered by `(created_at, id)`.

- [ ] **Step 4: Implement event transitions without blind summation**

Rules:

```text
ISSUE      available += q; issued += q
HOLD       available -= q; held += q
RELEASE    held -= q; available += q
DEBIT      held -= q; fulfilled += q
EXPIRE     available -= q; expired += q
ADJUSTMENT available += signed quantity_delta
REVERSAL   apply exact inverse of the referenced event's remaining unreversed quantity
```

For non-ADJUSTMENT event types, require positive event quantity. For ADJUSTMENT, signed `quantity_delta` is authoritative and the API must never expose participant-controlled creation.

At every transition reject negative state with `LEDGER_INTEGRITY_ERROR`.

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
- Produces: `create_redemption(*, actor, institution, program_benefit, requested_units, idempotency_key) -> RedemptionRequest`.
- Consumes: participant identity, wallet projection, ProgramBenefit, RedemptionAllocation, BenefitCapacityReservation, WalletLedgerEntry.

- [ ] **Step 1: Write failing pooled-redemption tests**

Fixture:

```text
Award A = 5 units, earlier expiry
Award B = 10 units, later expiry
Request = 7 units
Expected allocation = 5 from A + 2 from B
```

Tests:

```python
def test_uuid_is_required(): ...
def test_invalid_uuid_is_rejected(): ...
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

Expected: FAIL.

- [ ] **Step 3: Implement UUID replay contract**

Use `uuid.UUID(str(idempotency_key))`; reject missing/invalid keys with stable codes. Replay lookup is exactly `(institution, profile, idempotency_key)`.

- [ ] **Step 4: Implement deterministic pooled allocation in one transaction**

Inside `transaction.atomic()`:

1. resolve participant Profile from actor + institution;
2. validate ProgramBenefit tenant/status/effective dates and min/max/increment;
3. return existing request on UUID replay;
4. lock candidate v1 credits ordered by `expires_at`, `issued_at`, `id`;
5. project each bucket and allocate only current available units;
6. reject insufficient total before durable request/hold writes;
7. lock finite ProgramBenefit and reject exhausted capacity;
8. create v1 RedemptionRequest with `program_benefit`, Profile, requested units, UUID, and legacy `credit=None`, `charging_hub=None`;
9. create allocations summing exactly to requested units;
10. create one HOLD ledger event per allocation;
11. create one capacity reservation when finite;
12. commit all-or-nothing.

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

**Interfaces:**
- Produces: `start_review(...)`, `finalize_redemption(...)`.
- Consumes: strict RBAC, allocations, capacity reservations, ledger events.

- [ ] **Step 1: Write failing review tests**

```python
def test_program_staff_can_move_requested_to_under_review(): ...
def test_program_staff_cannot_fulfill_or_deny(): ...
def test_institution_admin_can_fulfill(): ...
def test_institution_admin_can_deny(): ...
def test_requested_cannot_skip_directly_to_terminal(): ...
def test_fulfillment_writes_one_debit_per_allocation_and_consumes_capacity(): ...
def test_denial_writes_one_release_per_allocation_and_releases_capacity(): ...
def test_terminal_ledger_failure_rolls_back_status_and_capacity(): ...
def test_second_terminal_attempt_creates_no_extra_ledger_events(): ...
```

- [ ] **Step 2: Run review tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_review -v 2
```

Expected: FAIL.

- [ ] **Step 3: Add v1 reviewer user reference**

Add nullable `reviewed_by_user` FK to `RedemptionRequest`, retaining existing string `reviewed_by` for legacy compatibility.

- [ ] **Step 4: Implement `start_review` with row lock**

Require current state `requested`, authorize program_staff/institution_admin/platform_admin, set `under-review`, reviewer metadata, and commit atomically.

- [ ] **Step 5: Implement atomic terminal processing**

Inside one transaction:

1. lock request;
2. require `under-review`;
3. authorize institution_admin/platform_admin only;
4. lock allocations and reservation;
5. fulfilled => one DEBIT per allocation + reservation consumed;
6. denied => one RELEASE per allocation + reservation released;
7. if denied credit is naturally expired, immediately add matching EXPIRE after RELEASE in same transaction;
8. update terminal state and reviewer metadata;
9. commit all effects together.

- [ ] **Step 6: Add post-spine database constraints in `0007`**

Add:

```text
- v1 credit requires profile, policy, issuance_decision, issued_at, expires_at
- RedemptionAllocation.allocated_units > 0
- unique active ProgramBenefitPolicy per institution (conditional status='active')
- unique v1 redemption idempotency key per (institution, profile, idempotency_key) when key is non-null
- supporting indexes for wallet projection and review queues
```

Do not remove legacy `(credit, idempotency_key)` yet.

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

**Interfaces:**
- Produces: `expire_due_credits(*, as_of=None, institution=None) -> ExpirationResult`.
- Consumes: wallet projection, v1 credits, ledger.

- [ ] **Step 1: Write failing expiration tests**

```python
def test_available_units_expire_after_expires_at(): ...
def test_held_units_are_not_expired_by_worker(): ...
def test_worker_retry_does_not_duplicate_expire_event(): ...
def test_partially_available_bucket_expires_only_remaining_available_units(): ...
def test_fulfillment_after_natural_expiry_of_preexpiry_hold_is_valid(): ...
def test_denial_after_natural_expiry_has_zero_available_and_expired_quantity(): ...
```

- [ ] **Step 2: Run expiration tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement idempotent expiration service**

```python
@dataclass(frozen=True)
class ExpirationResult:
    credits_scanned: int
    credits_expired: int
    units_expired: Decimal
```

For each v1 credit with `expires_at <= as_of`, lock it, project it, and create EXPIRE only for current available units. Held units remain protected.

- [ ] **Step 4: Add management command**

`expire_green_route_credits.py` calls the service and prints counts only; no accounting logic in the command.

- [ ] **Step 5: Run expiration and review tests together**

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

**Interfaces:**
- Produces: exact institution-scoped target endpoints from spec Section 17.
- Consumes: Tasks 2-8 services.

- [ ] **Step 1: Write failing API tests**

```python
def test_wallet_returns_server_projection(): ...
def test_benefits_list_only_active_in_period_records(): ...
def test_redemption_post_does_not_accept_profile_or_credit_as_authority(): ...
def test_redemption_post_requires_uuid(): ...
def test_program_staff_start_review_succeeds(): ...
def test_program_staff_fulfill_returns_403(): ...
def test_institution_admin_fulfill_succeeds(): ...
def test_cross_tenant_resource_returns_404(): ...
def test_business_rule_failure_returns_422_machine_code(): ...
def test_state_conflict_returns_409_machine_code(): ...
```

- [ ] **Step 2: Run API tests and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_api -v 2
```

Expected: FAIL.

- [ ] **Step 3: Implement transport-only serializers**

Define serializers for evidence create, issuance evaluate/approve, redemption create, review start, terminal decision, wallet projection, benefits, and activity. Do not duplicate service invariants in serializer validation.

- [ ] **Step 4: Implement explicit action views and tenant resolution**

Mount:

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

URL institution scope is authoritative; JSON cannot override it.

- [ ] **Step 5: Centralize domain-error mapping**

Use stable JSON:

```json
{"code":"INSUFFICIENT_AVAILABLE_UNITS","message":"Requested units exceed the participant's available Green Route Credit balance."}
```

Map unauthenticated => 401, authorization => 403, tenant invisibility => 404, state/idempotency conflict => 409, program-rule/business rejection => 422, malformed transport => 400.

- [ ] **Step 6: Keep legacy routes mounted temporarily**

Do not remove current router endpoints until Task 11 confirms the frontend no longer uses them.

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

**Interfaces:**
- Produces: canonical `WalletProjection`, `ProgramBenefit`, v1 RedemptionRequest adapter methods.
- Consumes: Task 9 API.

- [ ] **Step 1: Write failing adapter tests and types**

Define:

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

- [ ] **Step 2: Run adapter test and verify failure**

```bash
npm test -- src/lib/greenWalletApi.v1.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement v1 API methods**

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

Extend `GreenWalletApiError` with optional `code`.

- [ ] **Step 4: Write failing WalletScreen tests**

Mock server projection:

```ts
{
  issuedUnits: 15,
  availableUnits: 8,
  heldUnits: 7,
  fulfilledUnits: 0,
  expiredUnits: 0,
  unitLabel: 'Green Route Credits',
  recentActivity: [],
}
```

Assert exactly 8 Available, 7 Under review/Held, 0 Fulfilled, 0 Expired. Assert active Transit Benefit is operational without a ChargingHub.

- [ ] **Step 5: Remove client-side accounting from WalletScreen**

Delete canonical use of `unavailableCreditIds`, credit-status reducers, and raw request-status balance math. Render only the server projection and active ProgramBenefits.

- [ ] **Step 6: Implement generic `ProgramBenefitRedemptionFlow`**

The flow must generate `crypto.randomUUID()` once per intentional submit, validate requested unit bounds/increment from ProgramBenefit, submit only `programBenefitId`, `requestedUnits`, `idempotencyKey`, and show requested/review state. EV charging benefits may display optional ChargingHub metadata with explicit no-reservation/no-payment copy; non-charging benefits never require charging metadata.

- [ ] **Step 7: Remove canonical Green Wallet mutation responsibility from AppContext**

WalletScreen and ProgramBenefitRedemptionFlow must not call `addGreenRouteCredit`, `createRedemptionRequest`, or `reviewRedemptionRequest` as source of truth. Delete deprecated context methods if repository search finds no remaining callers; otherwise leave them clearly marked demo-only and unreachable from canonical wallet screens.

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

**Interfaces:**
- Produces: v1 as the only operational Green Wallet write path; legacy history remains inspectable.
- Consumes: Tasks 1-10.

- [ ] **Step 1: Add tests proving legacy paths cannot bypass v1**

Prove:

```text
- no public API creates GreenRouteCredit directly
- canonical participant UI never PATCHes lifecycle status
- v1 participant redemption never submits arbitrary profile/credit ownership fields
- historical credits remain readable and labeled provenance_state=legacy
```

- [ ] **Step 2: Search exact legacy dependencies**

```bash
rg "EVChargeCreditRedemptionFlow|creditId|chargingHubId|createRedemptionRequest|reviewRedemptionRequest|greenRouteCredits" src
```

Every remaining hit must be either removed from canonical wallet code or explicitly retained as an unrelated demonstration/test fixture.

- [ ] **Step 3: Retire charging-only canonical flow**

If no canonical caller remains, delete `EVChargeCreditRedemptionFlow.tsx`. If another demonstration screen still imports it, keep it only with a prominent legacy/demo-only comment and ensure `WalletScreen.tsx` does not import it.

- [ ] **Step 4: Disable legacy canonical write route**

Remove `RedemptionRequestViewSet` from the operational v1 frontend path. If the old `/api/redemption-requests/` route is retained for legacy regression, make it read-only after the cutover and keep explicit tests proving POST/PATCH are unavailable there.

- [ ] **Step 5: Update API contract documentation**

Document v1 institution-scoped endpoints as canonical, legacy resources as history/compatibility only, and keep the research-beta/no-settlement boundary explicit.

- [ ] **Step 6: Run full backend/frontend suites**

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

**Interfaces:**
- Produces: durable acceptance evidence and blocker list.
- Consumes: entire Lifecycle v1.

- [ ] **Step 1: Build one synthetic Pasadena institution and two auditable issuance buckets**

Use:

```text
Institution: Pasadena Mobility Research Institute
Users:
  pasadena-participant = participant
  pasadena-staff = program_staff
  pasadena-admin = institution_admin
  pasadena-viewer = viewer
  glendale-participant = participant in another tenant
Policy: verified_participation
Fixture-only policy values:
  5 units per qualifying event
  participant cap 20
  program cap 100
  expiry 90 days
Benefits:
  EV Charge Benefit = active, optional ChargingHub metadata
  Transit Benefit = active, no ChargingHub
```

Create Evidence A with one qualifying event => IssuanceDecision A => 5-unit Award A. Create Evidence B/C with two separate qualifying events => IssuanceDecision B => 10-unit Award B. Freeze/patch issuance times so Award A expires before Award B.

Expected initial wallet: issued 15, available 15.

- [ ] **Step 2: Prove pooled 7-unit redemption**

Participant requests 7 units against Transit Benefit with client UUID.

Expected:

```text
Allocation A = 5
Allocation B = 2
available = 8
held = 7
fulfilled = 0
expired = 0
```

Then:

```text
program_staff -> start review succeeds
viewer -> fulfill denied
program_staff -> fulfill denied
institution_admin -> fulfill succeeds
```

Expected final projection: available 8, held 0, fulfilled 7, expired 0.

- [ ] **Step 3: Prove EV charging uses the same accounting path without settlement claims**

Create a separate synthetic EV Charge Benefit request and assert no ChargingSession/payment/settlement object is created and participant copy/API metadata does not claim a charger reservation or automatic payment.

- [ ] **Step 4: Add negative/concurrency acceptance cases**

Prove:

```text
- Glendale participant cannot view/redeem Pasadena wallet
- second Pasadena participant cannot spend first participant balance
- evidence cannot be reused for second issuance
- duplicate approval does not create second ISSUE
- duplicate UUID does not create second HOLD
- overcommit fails
- participant/program caps are enforced
- second terminal decision creates no extra DEBIT/RELEASE
- denial after natural expiry yields RELEASE + EXPIRE with no restored availability
- expiration retry is idempotent
```

- [ ] **Step 5: Verify migrations from 0005 through latest on disposable data**

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

Document that once accepted v1 ledger/provenance data exists, destructive schema rollback is not considered safe; application rollback/forward-fix must preserve accepted audit data.

- [ ] **Step 6: Run complete verification suite**

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

In `docs/GREEN_WALLET_V1_ACCEPTANCE.md`, record exact branch/head SHA, migrations, exact backend/frontend test totals, synthetic fixtures, wallet projections, RBAC negatives, cross-tenant negatives, idempotency/concurrency/cap results, frontend DOM evidence, build/security results, rollback procedure, and every remaining blocker. Do not call Lifecycle v1 operational if any proof-chain segment fails.

- [ ] **Step 8: Commit Task 12**

```bash
git add backend/relay/test_green_wallet_v1_pasadena_acceptance.py src/screens/WalletScreen.v1.test.tsx docs/GREEN_WALLET_V1_ACCEPTANCE.md
git commit -m "test(wallet): prove lifecycle v1 Pasadena acceptance chain"
```

---

## Final Verification Gate

Run exactly:

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

Required results:

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

**Spec coverage:** Tasks 1-12 cover participant identity/authorization, policy activation and rule evaluation, evidence provenance and anti-double-award, deterministic issuance, ISSUE accounting, caps, generic ProgramBenefit targeting, pooled oldest-expiring allocations, mandatory idempotency, capacity reservations, role-separated review, atomic terminal transitions, authoritative ledger projection, automatic expiration, explicit institution-scoped APIs, frontend cutover, legacy retirement, and Pasadena acceptance.

**Placeholder scan:** No implementation step depends on an unspecified rule, default award, cap, expiry, file name, or test module. Synthetic constants are explicitly fixture-only. Existing general regression tests run through `relay.tests` and current Green Wallet test modules.

**Type consistency:** Later tasks use the exact interfaces established earlier: `resolve_participant_profile`, `activate_policy`, `evaluate_policy`, `evaluate_issuance`, `approve_issuance`, `project_credit_bucket`, `project_wallet`, `create_redemption`, `start_review`, `finalize_redemption`, and `expire_due_credits`.

**Accounting consistency:** Existing policy cap/expiry columns are canonical; rule-specific values remain in `parameters`. V1 pooled RedemptionRequests keep legacy single-credit/ChargingHub FKs nullable until cutover. ADJUSTMENT uses signed `quantity_delta`; all other normal event quantities are positive. Evidence is single-use for v1 issuance to prevent double awards.

**Rollback boundary:** schema is additive/relaxing through 0006 and constraint-hardening through 0007. Before accepted v1 audit data, forward/backward verification is required. After accepted v1 data exists, destructive schema rollback is not treated as safe; preserve data and use application rollback/forward-fix.
