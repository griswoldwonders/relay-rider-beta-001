# Green Route Credit Lifecycle v1 + EV Charging Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Green Route Credit Lifecycle v1 so Relay Rider can deterministically issue Green Route Credits, project authoritative wallet balances, redeem fixed institution-approved ProgramBenefits, and securely assign auditable EV charging benefits from institution-controlled inventory without becoming a payment processor or charging network.

**Architecture:** Django remains the authoritative domain and accounting layer. Green Route Credits are issued from governed evidence and policy decisions into immutable ledger-backed issuance buckets; participant redemption allocates those buckets oldest-expiring-first, creates HOLDs, and for EV charging may DEBIT only inside the same atomic transaction that assigns a real `BenefitInventoryItem` and creates `ChargingBenefitFulfillment`. React becomes a client of institution-scoped APIs and server projections; it never reconstructs wallet accounting or exposes charging-benefit secrets outside an explicit secure reveal action.

**Tech Stack:** Django 5.x / Django REST Framework 3.16 / Django ORM transactions, PostgreSQL-compatible locking with SQLite-compatible tests, `cryptography` Fernet for application-level benefit-secret encryption, React 19, TypeScript 7, Vite 8, Vitest 4, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-04-green-route-credit-lifecycle-v1-design.md`

## Global Constraints

- Green Wallet is a general institution-sponsored mobility-benefit wallet; EV charging is one ProgramBenefit category, not the wallet itself.
- Green Route Credits are participation-benefit units, not cash, wages, fares, charging reimbursement, guaranteed payments, certified carbon credits, utility credits, or automatic payment instruments.
- V1 ProgramBenefits use fixed `credit_cost_units`; participants never submit arbitrary redemption units and no participant-facing dollar exchange rate exists.
- V1 issuance is evidence-backed, deterministic, and `institution_admin` approved; no automatic issuance.
- `program_staff` may triage `requested -> under-review`; only `institution_admin` or `platform_admin` may approve issuance or make terminal redemption decisions.
- EV charging supports `network_promo` and `site_host_entitlement` only.
- An EV charging request may DEBIT Green Route Credits only when a real eligible external benefit is successfully assigned in the same database transaction.
- Institutions obtain/fund external charging benefits. Relay Rider does not automatically buy codes, process charging payments, reimburse charging expenses, reserve chargers, or guarantee charger access.
- Network-promo credentials must be encrypted at rest, write-only on inventory creation, absent from logs/analytics/exports/list serializers/email, and revealed only through an explicit owner-only action with `Cache-Control: no-store`.
- External-benefit expiry does not automatically restore Green Route Credits. Replacement uses new inventory without a second DEBIT; exceptional restoration uses exact governed REVERSAL semantics.
- Wallet accounting is ledger-authoritative and event-semantic; never compute balance by blindly summing `quantity_delta` or by raw credit/request status.
- Existing migrations remain immutable. At planning time `main` is observed at `6d375157f8f99d1e8915711d190de09a7ecdbe96` with relay migrations `0001` through `0006_institutional_vertical_slice`. At execution time, refresh `main` and use the next free migration number; never duplicate equivalent fields/models that may have landed meanwhile.
- Preserve the institutional vertical slice, Rule 2202 boundary, Pandera commuter import, current tenant security, and Pasadena acceptance regressions. Do not add Charging Intelligence, OCPI/OCPP, EVSE, ChargingSession, live provider APIs, routing, payments, or marketplace expansion.
- Synthetic numerical values in tests are fixtures only and must not become production defaults.
- Lifecycle correctness does not imply production readiness; preserve the separate security/deployment gates for real commuter data.

---

## Execution Preflight

Before Task 1, create an isolated worktree/implementation branch from `docs/green-wallet-lifecycle-v1-design-20260904`, then merge or rebase the latest `origin/main` into that branch. Record the refreshed main SHA and migration list in the SDD ledger. Run:

```bash
git fetch origin
git rev-parse origin/main
git merge --no-ff origin/main
ls backend/relay/migrations
cd backend && python manage.py showmigrations relay && python manage.py makemigrations --check --dry-run
```

If current `main` already contains equivalent Profile ownership, participant-role, Decision Card, or migration changes from another reviewed PR, reuse them and adjust the migration number only; do not add a second field/model for the same invariant. The spec remains authoritative if an overlapping implementation conflicts with it.

---

## Target File Structure

### Existing files to modify

- `backend/requirements.txt` — add `cryptography` for encrypted charging-benefit credentials.
- `backend/config/settings.py` — read Green Wallet benefit-encryption key material from environment without hard-coded secrets.
- `backend/config/urls.py` — mount explicit institution-scoped Green Wallet v1 actions.
- `backend/relay/models.py` — add v1 identity, policy, issuance, fixed benefit, allocation, inventory, fulfillment, access-audit, and ledger-link models/fields.
- `backend/relay/permissions.py` — separate participant ownership, staff triage, institution-admin terminal actions, inventory administration, and platform override.
- `backend/relay/admin.py` — remove normal direct credit issuance, prevent secret rendering, and register non-secret v1 audit/configuration surfaces.
- `src/types.ts` — canonical wallet projection, fixed ProgramBenefit, fulfillment, and capability types.
- `src/lib/greenWalletApi.ts` — institution-scoped v1 API client; secure reveal is a separate call.
- `src/screens/WalletScreen.tsx` — render server projection, fixed benefit cards, request state, and issued charging benefits.
- `src/screens/WalletAdminScreen.tsx` — distinct review, inventory/fulfillment, and program-configuration surfaces with visible role restrictions.
- `src/context/AppContext.tsx` — remove session-memory Green Wallet accounting as canonical state.
- `src/green-wallet.css` — v1 wallet, fulfillment, inventory, and secure reveal states.

### New backend files

- `backend/relay/services/__init__.py`
- `backend/relay/services/errors.py`
- `backend/relay/services/participant_identity.py`
- `backend/relay/services/policy_rules.py`
- `backend/relay/services/issuance.py`
- `backend/relay/services/wallet_projection.py`
- `backend/relay/services/redemption.py`
- `backend/relay/services/benefit_secrets.py`
- `backend/relay/services/benefit_inventory.py`
- `backend/relay/services/redemption_review.py`
- `backend/relay/services/benefit_outcomes.py`
- `backend/relay/services/expiration.py`
- `backend/relay/green_wallet_v1_serializers.py`
- `backend/relay/green_wallet_v1_views.py`
- `backend/relay/management/commands/expire_green_wallet_state.py`
- `backend/relay/migrations/0007_green_wallet_lifecycle_v1_core.py` — expected name against the planning baseline; renumber to the next free number if `main` advances.
- `backend/relay/migrations/0008_green_wallet_benefit_fulfillment.py` — expected second additive migration; renumber together if needed.
- `backend/relay/migrations/0009_green_wallet_v1_constraints.py` — expected post-backfill constraint migration; renumber together if needed.

### New backend tests

- `backend/relay/test_green_wallet_v1_schema.py`
- `backend/relay/test_green_wallet_v1_identity.py`
- `backend/relay/test_green_wallet_v1_policy.py`
- `backend/relay/test_green_wallet_v1_issuance.py`
- `backend/relay/test_green_wallet_v1_projection.py`
- `backend/relay/test_green_wallet_v1_redemption.py`
- `backend/relay/test_green_wallet_v1_inventory.py`
- `backend/relay/test_green_wallet_v1_fulfillment.py`
- `backend/relay/test_green_wallet_v1_expiration.py`
- `backend/relay/test_green_wallet_v1_api.py`
- `backend/relay/test_green_wallet_v1_pasadena_acceptance.py`

### New frontend files

- `src/flows/ProgramBenefitRedemptionFlow.tsx`
- `src/components/ChargingBenefitCard.tsx`
- `src/components/ChargingBenefitRevealDialog.tsx`
- `src/components/WalletAdminInventoryPanel.tsx`
- `src/components/WalletAdminReviewPanel.tsx`
- `src/components/WalletProgramConfigPanel.tsx`
- `src/lib/greenWalletApi.v1.test.ts`
- `src/screens/WalletScreen.v1.test.tsx`
- `src/screens/WalletAdminScreen.v1.test.tsx`
- `src/flows/ProgramBenefitRedemptionFlow.test.tsx`

---

### Task 1: Add the Green Wallet v1 core schema and classify legacy records

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/migrations/0007_green_wallet_lifecycle_v1_core.py` (or next free number after refreshed main)
- Test: `backend/relay/test_green_wallet_v1_schema.py`

**Interfaces:**
- Consumes: existing `Institution`, `Membership`, `Profile`, `GreenRouteCredit`, `ProgramBenefitPolicy`, `RedemptionRequest`, `ChargingHub`, `WalletLedgerEntry`.
- Produces: claimed participant identity, `QualifyingEvidence`, `IssuanceDecision`, `IssuanceDecisionEvidence`, fixed `ProgramBenefit`, `RedemptionAllocation`, `BenefitCapacityReservation`, v1 credit provenance/expiry fields, v1 redemption target/idempotency fields, ledger allocation/reversal links.

- [ ] **Step 1: Write failing schema contract tests**

Create tests that require the exact v1 spine:

```python
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from relay.models import Institution, Membership, Profile, GreenRouteCredit, ProgramBenefit

User = get_user_model()

class GreenWalletV1SchemaTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(name='Pasadena Synthetic Institute', slug='pasadena-wallet-v1')
        self.user = User.objects.create_user(username='wallet-participant')

    def test_claimed_profile_unique_per_user_and_institution(self):
        Profile.objects.create(institution=self.institution, user=self.user, name='Primary')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Profile.objects.create(institution=self.institution, user=self.user, name='Duplicate')

    def test_unclaimed_profiles_remain_allowed(self):
        Profile.objects.create(institution=self.institution, name='Imported A')
        Profile.objects.create(institution=self.institution, name='Imported B')

    def test_participant_membership_role_is_valid(self):
        membership = Membership.objects.create(user=self.user, institution=self.institution, role='participant')
        self.assertEqual(membership.role, 'participant')

    def test_program_benefit_uses_fixed_credit_cost(self):
        benefit = ProgramBenefit.objects.create(
            institution=self.institution,
            name='Synthetic EV Charging Benefit',
            benefit_type='ev_charging',
            status='active',
            unit_label='Green Route Credits',
            credit_cost_units='7.00',
        )
        self.assertEqual(str(benefit.credit_cost_units), '7.00')

    def test_legacy_credit_is_explicitly_classified(self):
        credit = GreenRouteCredit.objects.create(institution=self.institution, amount_units='5.00')
        self.assertEqual(credit.provenance_state, 'legacy')
```

- [ ] **Step 2: Run the schema tests and confirm failure before implementation**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema -v 2
```

Expected: FAIL because the new fields/models are absent.

- [ ] **Step 3: Add the exact core model contracts**

In `backend/relay/models.py`:

```python
class Profile(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='relay_profiles',
    )
    # preserve existing fields

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'institution'],
                condition=models.Q(user__isnull=False),
                name='unique_claimed_profile_user_institution',
            ),
        ]
```

Add `('participant', 'Participant')` to `Membership.ROLE_CHOICES`.

Extend `ProgramBenefitPolicy` with `framework_version`, `rule_type`, `parameters`, `activated_by`, and `activated_at`.

Add:

```python
class QualifyingEvidence(TimestampedModel):
    SOURCE_TYPES = [('relay_rider', 'Relay Rider'), ('authorized_import', 'Authorized import'), ('admin_attestation', 'Administrative attestation')]
    EVIDENCE_LABELS = [('synthetic', 'Synthetic'), ('modeled', 'Modeled'), ('verified', 'Verified')]
    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='qualifying_evidence')
    profile = models.ForeignKey(Profile, on_delete=models.PROTECT, related_name='qualifying_evidence')
    source_type = models.CharField(max_length=32, choices=SOURCE_TYPES)
    source_reference = models.CharField(max_length=160, blank=True)
    evidence_label = models.CharField(max_length=32, choices=EVIDENCE_LABELS)
    observed_at = models.DateTimeField()
    provenance = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_qualifying_evidence')
```

Add `IssuanceDecision` with statuses `evaluated|approved|denied`, `calculated_units`, policy/profile/institution FKs, evaluation metadata, actor/time fields, and indexed `correlation_id`; add `IssuanceDecisionEvidence` as the explicit many-to-many link.

Add `ProgramBenefit` with `benefit_type=ev_charging|transit|access_point|other`, `status=draft|active|retired`, positive `credit_cost_units`, `unit_label`, optional `capacity_total`, optional `charging_hub`, effective dates, eligibility metadata, and nullable admin-only sponsor-cost/external-value amount+currency fields.

Add `RedemptionAllocation(redemption_request, credit, allocated_units)` with unique `(redemption_request, credit)` and `BenefitCapacityReservation(redemption_request one-to-one, program_benefit, state=reserved|consumed|released)`.

Extend `GreenRouteCredit` with nullable `policy`, one-to-one nullable `issuance_decision`, `issued_at`, `expires_at`, and `provenance_state=legacy|v1` defaulting to `legacy`.

Extend `RedemptionRequest` with nullable `program_benefit`, mandatory-for-v1 nullable `idempotency_key` UUID during migration, and preserve legacy `credit`/`charging_hub` fields temporarily.

Extend `WalletLedgerEntry` with nullable `redemption_allocation` and nullable self-FK `reverses_entry=PROTECT`.

- [ ] **Step 4: Generate and inspect the additive core migration**

```bash
cd backend
python manage.py makemigrations relay --name green_wallet_lifecycle_v1_core
python manage.py makemigrations --check --dry-run
```

Expected: the first command creates the next migration; the second prints `No changes detected`. Confirm the migration does not alter historical migration files or delete legacy redemption fields.

- [ ] **Step 5: Run core schema plus existing wallet/institution regressions**

```bash
cd backend
python manage.py test \
  relay.test_green_wallet_v1_schema \
  relay.test_green_wallet_contract \
  relay.test_green_wallet_ledger_and_policy \
  relay.test_green_wallet_pasadena_acceptance -v 2
```

Expected: PASS.

- [ ] **Step 6: Verify additive forward/backward/forward migration on synthetic/local data**

Replace `0007` below with the generated migration number if main advanced:

```bash
cd backend
python manage.py migrate relay 0006
python manage.py migrate relay 0007
python manage.py check
python manage.py migrate relay 0006
python manage.py migrate relay 0007
python manage.py migrate
```

Expected: all commands succeed before authoritative v1 audit data exists.

- [ ] **Step 7: Commit Task 1**

```bash
git add backend/relay/models.py backend/relay/migrations backend/relay/test_green_wallet_v1_schema.py
git commit -m "feat(wallet): add lifecycle v1 core schema"
```

---

### Task 2: Add encrypted Benefit Inventory and ChargingBenefitFulfillment schema

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/config/settings.py`
- Modify: `backend/relay/models.py`
- Create: `backend/relay/services/benefit_secrets.py`
- Create: `backend/relay/migrations/0008_green_wallet_benefit_fulfillment.py` (or next free sequential number)
- Test: `backend/relay/test_green_wallet_v1_inventory.py`

**Interfaces:**
- Produces: `BenefitSecretCodec.encrypt()`, `.decrypt()`, `.fingerprint()`, `BenefitInventoryItem`, `ChargingBenefitFulfillment`, `BenefitAccessEvent`.
- Consumes: `ProgramBenefit`, `RedemptionRequest`, `Profile`, `Institution` from Task 1.

- [ ] **Step 1: Add failing encryption and schema tests**

```python
from django.test import TestCase, override_settings
from relay.services.benefit_secrets import BenefitSecretCodec

@override_settings(GREEN_WALLET_BENEFIT_FERNET_KEYS=['MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA='])
class BenefitSecretTests(TestCase):
    def test_encrypt_never_returns_plaintext(self):
        codec = BenefitSecretCodec()
        ciphertext = codec.encrypt('PROMO-SECRET-123')
        self.assertNotIn('PROMO-SECRET-123', ciphertext)
        self.assertEqual(codec.decrypt(ciphertext), 'PROMO-SECRET-123')

    def test_fingerprint_is_deterministic_without_storing_plaintext(self):
        codec = BenefitSecretCodec()
        self.assertEqual(codec.fingerprint('PROMO-SECRET-123'), codec.fingerprint('PROMO-SECRET-123'))
```

Also test that a `BenefitInventoryItem` can represent `network_promo` with ciphertext or `site_host_entitlement` without a secret, and that one inventory item cannot be linked to two fulfillments.

- [ ] **Step 2: Run tests and verify they fail**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_inventory -v 2
```

Expected: FAIL because codec/models do not exist.

- [ ] **Step 3: Add cryptography and key configuration**

Append to `backend/requirements.txt`:

```text
cryptography>=43,<47
```

In `backend/config/settings.py`, parse a comma-separated environment variable without any hard-coded production key:

```python
GREEN_WALLET_BENEFIT_FERNET_KEYS = [
    value.strip()
    for value in os.environ.get('GREEN_WALLET_BENEFIT_FERNET_KEYS', '').split(',')
    if value.strip()
]
```

Do not log key material. Tests override this setting with generated/synthetic keys.

- [ ] **Step 4: Implement `BenefitSecretCodec`**

Use `cryptography.fernet.MultiFernet`; the first configured key encrypts and all configured keys may decrypt, enabling future rotation. `fingerprint()` must use keyed HMAC-SHA256 derived from the first decoded Fernet key plus domain separator `relay-rider-benefit-fingerprint-v1`, never raw SHA256 of a low-entropy promo code.

Expose exactly:

```python
class BenefitSecretCodec:
    def encrypt(self, plaintext: str) -> str: ...
    def decrypt(self, ciphertext: str) -> str: ...
    def fingerprint(self, plaintext: str) -> str: ...
```

Raise `GreenWalletConfigurationError('BENEFIT_SECRET_KEY_UNAVAILABLE', ...)` when secret operations are attempted without configured keys.

- [ ] **Step 5: Add inventory/fulfillment models**

Implement:

```python
class BenefitInventoryItem(TimestampedModel):
    FULFILLMENT_TYPES = [('network_promo', 'Network promotion'), ('site_host_entitlement', 'Site-host entitlement')]
    STATUS_CHOICES = [('available', 'Available'), ('issued', 'Issued'), ('expired', 'Expired'), ('voided', 'Voided')]
    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name='benefit_inventory')
    program_benefit = models.ForeignKey(ProgramBenefit, on_delete=models.PROTECT, related_name='inventory_items')
    fulfillment_type = models.CharField(max_length=32, choices=FULFILLMENT_TYPES)
    provider_name = models.CharField(max_length=160)
    provider_program_reference = models.CharField(max_length=160, blank=True)
    external_reference = models.CharField(max_length=160, blank=True)
    secret_ciphertext = models.TextField(blank=True)
    secret_fingerprint = models.CharField(max_length=64, blank=True)
    participant_instructions = models.TextField(blank=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='available')
    valid_from = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    loaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='loaded_benefit_inventory')
    issued_at = models.DateTimeField(null=True, blank=True)
```

Add conditional uniqueness for non-empty `(institution, provider_name, secret_fingerprint)` and for non-empty `(institution, provider_name, external_reference)`.

Add `ChargingBenefitFulfillment` with `status=issued|confirmed_used|expired_unused|fulfillment_issue|replaced|voided_reversed`, required institution/profile/redemption/program benefit/inventory references, fulfillment/provider metadata, issued actor/time, optional expiry, nullable `replacement_for`, and outcome metadata. Use a one-to-one relation from fulfillment to `BenefitInventoryItem` so an inventory item is assigned at most once. Add a conditional unique constraint allowing only one initial fulfillment per redemption (`replacement_for IS NULL`).

Add `BenefitAccessEvent` with nullable `fulfillment`, nullable `inventory_item`, actor, `action=reveal|admin_inventory_load|void|replacement`, occurred_at, correlation_id, and a check constraint requiring at least one of fulfillment/inventory_item.

- [ ] **Step 6: Generate and verify the second additive migration**

```bash
cd backend
python manage.py makemigrations relay --name green_wallet_benefit_fulfillment
python manage.py makemigrations --check --dry-run
python manage.py test relay.test_green_wallet_v1_inventory -v 2
```

Expected: migration created, no ungenerated model changes, tests PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add backend/requirements.txt backend/config/settings.py backend/relay/models.py backend/relay/services/benefit_secrets.py backend/relay/migrations backend/relay/test_green_wallet_v1_inventory.py
git commit -m "feat(wallet): add encrypted charging benefit inventory"
```

---

### Task 3: Bind authenticated users to Profiles and enforce Green Wallet RBAC

**Files:**
- Modify: `backend/relay/permissions.py`
- Create: `backend/relay/services/__init__.py`
- Create: `backend/relay/services/errors.py`
- Create: `backend/relay/services/participant_identity.py`
- Test: `backend/relay/test_green_wallet_v1_identity.py`

**Interfaces:**
- Produces: `GreenWalletDomainError`, `GreenWalletConfigurationError`, `resolve_participant_profile(*, user, institution)`, `can_start_redemption_review()`, `can_finalize_redemption()`, `can_approve_issuance()`, `can_manage_benefit_inventory()`.
- Consumes: `Profile.user`, `Membership.role` from Task 1.

- [ ] **Step 1: Define stable transport-agnostic domain errors**

```python
class GreenWalletDomainError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

class GreenWalletConfigurationError(GreenWalletDomainError):
    pass
```

- [ ] **Step 2: Write failing identity/RBAC tests**

Cover exact cases:

```python
profile = resolve_participant_profile(user=participant_user, institution=pasadena)
self.assertEqual(profile.user, participant_user)

with self.assertRaisesMessage(GreenWalletDomainError, 'claimed participant profile'):
    resolve_participant_profile(user=unclaimed_user, institution=pasadena)

self.assertTrue(can_start_redemption_review(staff_user, pasadena))
self.assertFalse(can_finalize_redemption(staff_user, pasadena))
self.assertTrue(can_finalize_redemption(admin_user, pasadena))
self.assertFalse(can_manage_benefit_inventory(staff_user, pasadena))
self.assertTrue(can_manage_benefit_inventory(admin_user, pasadena))
```

Also prove same-tenant wrong Profile denial, cross-tenant denial, viewer denial, and one user with separate claimed Profiles in two institutions.

- [ ] **Step 3: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity -v 2
```

- [ ] **Step 4: Implement participant identity and role helpers**

`resolve_participant_profile()` must query exactly one claimed Profile for `(user, institution)` and raise code `PARTICIPANT_PROFILE_NOT_CLAIMED` when absent. Platform admin does not bypass participant ownership; a platform admin must still have a claimed Profile to perform participant self-service.

Administrative helpers may treat `platform_admin` as exceptional oversight but must preserve tenant/audit context.

- [ ] **Step 5: Run identity and existing tenant-security regressions**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add backend/relay/permissions.py backend/relay/services backend/relay/test_green_wallet_v1_identity.py
git commit -m "feat(wallet): bind participant identity and wallet RBAC"
```

---

### Task 4: Implement deterministic policy activation and evidence evaluation

**Files:**
- Create: `backend/relay/services/policy_rules.py`
- Test: `backend/relay/test_green_wallet_v1_policy.py`

**Interfaces:**
- Produces: `validate_policy_parameters(policy)`, `evaluate_verified_participation(*, policy, evidence) -> Decimal`, `evaluate_policy(*, policy, evidence) -> PolicyEvaluationResult`.
- Consumes: `ProgramBenefitPolicy`, `QualifyingEvidence`.

- [ ] **Step 1: Write failing deterministic-policy tests**

Use a synthetic policy fixture with `units_per_qualifying_event='5.00'`, participant cap `20.00`, program cap `100.00`, expiry days `30`, allowed sources `['relay_rider']`, and bounded effective dates. Prove two identical evaluations return the same units, disallowed evidence source is rejected, inactive/out-of-period policy is rejected, and malformed/zero/negative numeric parameters cannot activate.

- [ ] **Step 2: Run and confirm failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_policy -v 2
```

- [ ] **Step 3: Implement a code-owned rule registry**

```python
RULE_REGISTRY = {
    'verified_participation': evaluate_verified_participation,
}

@dataclass(frozen=True)
class PolicyEvaluationResult:
    calculated_units: Decimal
    qualifying_evidence_ids: tuple[int, ...]
    metadata: dict[str, object]
```

`verified_participation` counts only evidence matching institution/profile, allowed source types, eligible cohort constraints when configured, and the policy period. No arbitrary formulas or eval/exec are permitted.

- [ ] **Step 4: Run policy tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_policy -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add backend/relay/services/policy_rules.py backend/relay/test_green_wallet_v1_policy.py
git commit -m "feat(wallet): add deterministic participation policy rules"
```

---

### Task 5: Implement governed issuance and immutable ISSUE events

**Files:**
- Create: `backend/relay/services/issuance.py`
- Modify: `backend/relay/admin.py`
- Test: `backend/relay/test_green_wallet_v1_issuance.py`

**Interfaces:**
- Produces: `evaluate_issuance(*, actor, institution, profile, evidence_ids, correlation_id) -> IssuanceDecision`, `approve_issuance(*, actor, decision_id) -> GreenRouteCredit`.
- Consumes: policy service from Task 4; role helpers from Task 3; ledger/core models from Task 1.

- [ ] **Step 1: Write failing issuance tests**

Prove:

```text
Evidence[] -> evaluated decision -> institution_admin approval -> one GreenRouteCredit -> exactly one ISSUE
```

Also assert program_staff approval is denied, replaying approval returns the same credit, participant cap/program cap are enforced, and injected failure after credit creation rolls back both credit and ISSUE.

- [ ] **Step 2: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance -v 2
```

- [ ] **Step 3: Implement `IssuanceService` transaction boundaries**

`evaluate_issuance()` creates an `evaluated` decision with explicit `IssuanceDecisionEvidence` rows. `approve_issuance()` must use `transaction.atomic()` and `select_for_update()` on the decision and active policy/cap boundary, recompute cap consumption from v1 issued decisions/credits, create one v1 credit with `expires_at`, create exactly one `WalletLedgerEntry(entry_type='ISSUE', quantity_delta=credit.amount_units, correlation_id=...)`, then mark approval metadata.

Use stable business codes `PARTICIPANT_CAP_EXCEEDED`, `PROGRAM_CAP_EXCEEDED`, `ISSUANCE_ALREADY_FINAL`, `EVIDENCE_NOT_ELIGIBLE`.

- [ ] **Step 4: Harden direct credit creation surfaces**

In `backend/relay/admin.py`, make v1 `GreenRouteCredit` rows read-only and remove/add permission for normal direct issuance. Preserve explicit superuser-only historical/migration support if already required, but do not expose a normal participant/admin “create credit” path.

- [ ] **Step 5: Run issuance plus ledger regressions**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance relay.test_green_wallet_ledger_and_policy -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add backend/relay/services/issuance.py backend/relay/admin.py backend/relay/test_green_wallet_v1_issuance.py
git commit -m "feat(wallet): govern credit issuance through policy evidence"
```

---

### Task 6: Make WalletProjectionService the accounting authority

**Files:**
- Create: `backend/relay/services/wallet_projection.py`
- Test: `backend/relay/test_green_wallet_v1_projection.py`

**Interfaces:**
- Produces: `project_wallet(*, institution, profile, unit_label='Green Route Credits') -> WalletProjection` and per-credit available quantity helper used by redemption/expiration.
- Consumes: `WalletLedgerEntry` event semantics, issuance buckets, reversal links.

- [ ] **Step 1: Write failing projection tests**

Assert exact sequence:

```text
ISSUE 10  => available 10
HOLD 4    => available 6, held 4
RELEASE 4 => available 10, held 0
HOLD 4
DEBIT 4   => available 6, held 0, fulfilled 4
EXPIRE 2  => available 4, fulfilled 4, expired 2
```

Add multiple-bucket, reversal-of-DEBIT, partial reversal, and “available can never become negative” cases.

- [ ] **Step 2: Run and verify failure**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_projection -v 2
```

- [ ] **Step 3: Implement semantic event interpretation**

Define immutable projection dataclasses:

```python
@dataclass(frozen=True)
class WalletProjection:
    issued_units: Decimal
    available_units: Decimal
    held_units: Decimal
    fulfilled_units: Decimal
    expired_units: Decimal
    recent_activity: tuple[dict[str, object], ...]
```

Process ISSUE/HOLD/RELEASE/DEBIT/EXPIRE/REVERSAL/ADJUSTMENT by explicit transition semantics. Do not `Sum('quantity_delta')` across unlike event types. Reject impossible ledger sequences with `WALLET_LEDGER_INCONSISTENT` rather than presenting a negative balance.

- [ ] **Step 4: Run projection tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_projection -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add backend/relay/services/wallet_projection.py backend/relay/test_green_wallet_v1_projection.py
git commit -m "feat(wallet): add authoritative ledger projection"
```

---

### Task 7: Implement fixed-bundle pooled redemption and capacity reservation

**Files:**
- Create: `backend/relay/services/redemption.py`
- Test: `backend/relay/test_green_wallet_v1_redemption.py`

**Interfaces:**
- Produces: `create_redemption(*, user, institution, program_benefit_id, idempotency_key) -> RedemptionRequest`.
- Consumes: participant identity, WalletProjectionService, fixed ProgramBenefit, `RedemptionAllocation`, `BenefitCapacityReservation`.

- [ ] **Step 1: Write failing pooled-redemption tests**

Synthetic fixture:

```text
Award A = 5, expires first
Award B = 10, expires later
ProgramBenefit.credit_cost_units = 7
```

Assert allocation `[A:5, B:2]`, wallet after request `available=8, held=7`, one HOLD per allocation, UUID required, replay returns the same request, participant cannot override `credit_cost_units`, insufficient balance fails atomically, and finite capacity exhaustion creates no request/HOLD.

- [ ] **Step 2: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption -v 2
```

- [ ] **Step 3: Implement one atomic redemption transaction**

Within `transaction.atomic()`:

1. resolve claimed Profile from user+institution;
2. load active/in-period ProgramBenefit and derive units solely from `credit_cost_units`;
3. enforce UUID and return existing `(institution, profile, idempotency_key)` request on replay;
4. lock eligible issuance buckets ordered by `expires_at`, `issued_at`, `id`;
5. use projection helper to calculate available quantity per bucket;
6. construct allocations summing exactly to fixed cost;
7. lock ProgramBenefit and reserve finite capacity;
8. create request + allocations + one HOLD per allocation;
9. commit.

Use codes `INSUFFICIENT_AVAILABLE_UNITS`, `BENEFIT_CAPACITY_EXHAUSTED`, `PROGRAM_BENEFIT_INACTIVE`.

- [ ] **Step 4: Run redemption and projection suites**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption relay.test_green_wallet_v1_projection -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add backend/relay/services/redemption.py backend/relay/test_green_wallet_v1_redemption.py
git commit -m "feat(wallet): add fixed pooled benefit redemption"
```

---

### Task 8: Implement institution-controlled Benefit Inventory operations

**Files:**
- Create: `backend/relay/services/benefit_inventory.py`
- Test: `backend/relay/test_green_wallet_v1_inventory.py`

**Interfaces:**
- Produces: `load_inventory_item()`, `void_inventory_item()`, `select_inventory_for_fulfillment()`.
- Consumes: secret codec, role helpers, BenefitInventoryItem.

- [ ] **Step 1: Extend failing inventory tests for operational rules**

Prove institution_admin/platform_admin may load/void, program_staff may read non-secret availability but not load/void, network secret is stored only as ciphertext+fingerprint, duplicate secret fingerprint is rejected, expired/voided/wrong-benefit/wrong-tenant items are not selectable, and concurrent selection cannot return one item to two transactions.

- [ ] **Step 2: Implement inventory load with write-only plaintext**

Expose service signature:

```python
def load_inventory_item(
    *, actor, institution, program_benefit, fulfillment_type,
    provider_name, provider_program_reference='', external_reference='',
    secret_value='', participant_instructions='', valid_from=None,
    expires_at=None, correlation_id: str,
) -> BenefitInventoryItem:
    ...
```

For `network_promo`, require non-empty `secret_value`, encrypt immediately, persist ciphertext+fingerprint, then discard plaintext. For `site_host_entitlement`, allow empty secret but require `external_reference` or explicit institution entitlement instructions.

Create `BenefitAccessEvent(action='admin_inventory_load', inventory_item=item, ...)` in the same transaction.

- [ ] **Step 3: Implement void/select operations**

`select_inventory_for_fulfillment()` must be called inside an outer transaction, use `select_for_update(skip_locked=True)` where supported, filter same institution+ProgramBenefit, `status='available'`, valid_from <= now, expires_at null or future, and deterministic ordering by expiry then id. SQLite tests may exercise deterministic selection without `skip_locked`; PostgreSQL integration must cover concurrent assignment.

- [ ] **Step 4: Run inventory tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_inventory -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit Task 8**

```bash
git add backend/relay/services/benefit_inventory.py backend/relay/test_green_wallet_v1_inventory.py
git commit -m "feat(wallet): govern charging benefit inventory"
```

---

### Task 9: Implement atomic EV fulfillment, replacement, outcome tracking, and exceptional reversal

**Files:**
- Create: `backend/relay/services/redemption_review.py`
- Create: `backend/relay/services/benefit_outcomes.py`
- Test: `backend/relay/test_green_wallet_v1_fulfillment.py`

**Interfaces:**
- Produces: `start_review()`, `fulfill_redemption()`, `deny_redemption()`, `replace_charging_fulfillment()`, `record_charging_outcome()`, `reverse_charging_fulfillment()`.
- Consumes: allocations/HOLDs, inventory service, role helpers, ledger projection, fulfillment models.

- [ ] **Step 1: Write failing terminal-flow tests**

Cover:

```text
requested -> under-review by program_staff
under-review -> fulfilled only by institution_admin
```

For EV fulfillment assert one atomic operation creates `ChargingBenefitFulfillment(status='issued')`, binds/marks one inventory item `issued`, writes one DEBIT per allocation, consumes finite capacity, and marks request fulfilled. Inject failure after fulfillment creation and assert all writes roll back.

Assert `BENEFIT_INVENTORY_EXHAUSTED` leaves request `under-review`, HOLDs intact, no DEBIT, no terminal status.

Also test denial RELEASE, replacement with no second DEBIT, `expired_unused` no wallet mutation, `fulfillment_issue`, and exceptional reversal referencing exact DEBIT entries.

- [ ] **Step 2: Run failing fulfillment tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_fulfillment -v 2
```

- [ ] **Step 3: Implement review/terminal services**

`start_review()` locks request and allows `requested -> under-review` only.

`fulfill_redemption()` locks request, allocations, capacity reservation, then for `ev_charging` calls inventory selection, creates fulfillment, marks inventory issued, writes DEBITs, consumes capacity, marks request fulfilled, and commits. For non-charging ProgramBenefits, it writes DEBITs/consumes capacity without ChargingBenefitFulfillment.

`deny_redemption()` writes one RELEASE per allocation, releases capacity, and if the source credit expired while held, writes immediate EXPIRE in the same transaction.

- [ ] **Step 4: Implement replacement/outcome/reversal semantics**

`replace_charging_fulfillment()` requires institution_admin/platform_admin, locks original fulfillment and fresh inventory, marks original `replaced`, creates replacement linked by `replacement_for`, emits `BenefitAccessEvent(action='replacement')`, and writes no new wallet DEBIT.

`record_charging_outcome()` accepts only `confirmed_used|expired_unused|fulfillment_issue`, records non-secret outcome reference/evidence label/time, and never changes wallet balances.

`reverse_charging_fulfillment()` requires documented reason+correlation, locks exact original DEBIT ledger entries, creates REVERSAL rows referencing them, writes RELEASE for restored held quantity, immediately EXPIREs any quantity whose source issuance is already expired, marks fulfillment `voided_reversed`, and emits audit access event. It must reject duplicate/excess reversal.

- [ ] **Step 5: Add concurrency coverage**

Use `TransactionTestCase` for two terminal attempts. SQLite may serialize; add a PostgreSQL-marked/integration test or documented CI database variant proving exactly one terminal result, one initial fulfillment, one inventory assignment, and one DEBIT set.

- [ ] **Step 6: Run fulfillment, redemption, projection suites**

```bash
cd backend
python manage.py test \
  relay.test_green_wallet_v1_fulfillment \
  relay.test_green_wallet_v1_redemption \
  relay.test_green_wallet_v1_projection -v 2
```

Expected: PASS.

- [ ] **Step 7: Commit Task 9**

```bash
git add backend/relay/services/redemption_review.py backend/relay/services/benefit_outcomes.py backend/relay/test_green_wallet_v1_fulfillment.py
git commit -m "feat(wallet): atomically fulfill sponsored charging benefits"
```

---

### Task 10: Implement credit, inventory, and external-benefit expiration

**Files:**
- Create: `backend/relay/services/expiration.py`
- Create: `backend/relay/management/commands/expire_green_wallet_state.py`
- Test: `backend/relay/test_green_wallet_v1_expiration.py`

**Interfaces:**
- Produces: `expire_green_route_credits(now)`, `expire_inventory(now)`, `expire_unused_fulfillments(now)` and one idempotent management command.
- Consumes: wallet projection, inventory/fulfillment models.

- [ ] **Step 1: Write failing expiration tests**

Prove available expired credit units get one EXPIRE, held units remain protected, retry is idempotent, denial after source expiry yields RELEASE+EXPIRE, available inventory past `expires_at` becomes `expired`, issued fulfillment past expiry becomes `expired_unused`, and `expired_unused` creates no wallet event.

- [ ] **Step 2: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration -v 2
```

- [ ] **Step 3: Implement idempotent expiration services and command**

The management command calls all three services under bounded batches, prints counts only, never prints credentials/external secrets, and is safe to rerun.

```bash
python manage.py expire_green_wallet_state
```

- [ ] **Step 4: Run expiration tests twice against the same fixture**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration -v 2
```

Expected: PASS with retry assertions.

- [ ] **Step 5: Commit Task 10**

```bash
git add backend/relay/services/expiration.py backend/relay/management/commands/expire_green_wallet_state.py backend/relay/test_green_wallet_v1_expiration.py
git commit -m "feat(wallet): expire credits and benefit state idempotently"
```

---

### Task 11: Expose institution-scoped Green Wallet v1 APIs with stable errors and secure reveal

**Files:**
- Create: `backend/relay/green_wallet_v1_serializers.py`
- Create: `backend/relay/green_wallet_v1_views.py`
- Modify: `backend/config/urls.py`
- Test: `backend/relay/test_green_wallet_v1_api.py`

**Interfaces:**
- Produces: all participant/admin API contracts in spec section 18, plus `GET /api/institutions/{institution_id}/wallet-capabilities/` for visible frontend role restrictions.
- Consumes: all application services; views contain no lifecycle accounting logic.

- [ ] **Step 1: Write failing API/RBAC/secret-leak tests**

Test 401/403/404/409/422 mappings and machine-readable bodies:

```json
{"code":"BENEFIT_INVENTORY_EXHAUSTED","detail":"No eligible charging benefit is currently available."}
```

Test that inventory list/detail and fulfillment list never include `secret_ciphertext`, `secret_fingerprint`, or plaintext secret. Test reveal owner gets plaintext only from explicit reveal action; another participant/program_staff gets 403/404. Assert response headers include `Cache-Control: no-store, private` and `Pragma: no-cache`.

- [ ] **Step 2: Run failing API tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_api -v 2
```

- [ ] **Step 3: Implement serializers with write-only secret input**

Inventory create serializer accepts `secret_value = serializers.CharField(write_only=True, required=False)` and delegates encryption to `BenefitInventoryService`; it never maps plaintext to a model field. Fulfillment serializers expose only non-secret metadata.

- [ ] **Step 4: Implement explicit action views**

Mount the spec endpoints for wallet, benefits, redemptions, policy, evidence, issuance, review queue, fulfill/deny, inventory load/void, fulfillment list, replace/reverse, reveal, outcome evidence, and capabilities.

The reveal view must call `BenefitSecretCodec.decrypt()` only after tenant+Profile ownership checks, create `BenefitAccessEvent(action='reveal')`, and return the secret in a no-store response. Do not place the secret in exception text or audit metadata.

- [ ] **Step 5: Run API + security regressions**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_api relay.test_green_wallet_v1_identity relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit Task 11**

```bash
git add backend/relay/green_wallet_v1_serializers.py backend/relay/green_wallet_v1_views.py backend/config/urls.py backend/relay/test_green_wallet_v1_api.py
git commit -m "feat(wallet): expose institution scoped lifecycle APIs"
```

---

### Task 12: Cut participant Green Wallet UI to server projection and secure EV benefit delivery

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/greenWalletApi.ts`
- Modify: `src/screens/WalletScreen.tsx`
- Modify: `src/context/AppContext.tsx`
- Modify: `src/green-wallet.css`
- Create: `src/flows/ProgramBenefitRedemptionFlow.tsx`
- Create: `src/components/ChargingBenefitCard.tsx`
- Create: `src/components/ChargingBenefitRevealDialog.tsx`
- Create: `src/lib/greenWalletApi.v1.test.ts`
- Create: `src/screens/WalletScreen.v1.test.tsx`
- Create: `src/flows/ProgramBenefitRedemptionFlow.test.tsx`

**Interfaces:**
- Produces: participant UI backed only by `WalletProjection`, fixed ProgramBenefits, RedemptionRequest, ChargingBenefitFulfillment.
- Consumes: Task 11 APIs.

- [ ] **Step 1: Define canonical TypeScript types and failing API tests**

```ts
export type WalletProjection = {
  issuedUnits: number;
  availableUnits: number;
  heldUnits: number;
  fulfilledUnits: number;
  expiredUnits: number;
  recentActivity: WalletActivity[];
};

export type ProgramBenefit = {
  id: string;
  name: string;
  benefitType: 'ev_charging' | 'transit' | 'access_point' | 'other';
  creditCostUnits: number;
  unitLabel: string;
  status: 'active' | 'draft' | 'retired';
};
```

Add fulfillment type/status definitions matching backend exactly. Test that `greenWalletApi.revealChargingBenefit()` is a separate call and ordinary wallet/fulfillment fetches never expect a secret field.

- [ ] **Step 2: Run frontend tests and verify failure**

```bash
npm test -- src/lib/greenWalletApi.v1.test.ts src/screens/WalletScreen.v1.test.tsx src/flows/ProgramBenefitRedemptionFlow.test.tsx
```

- [ ] **Step 3: Replace client-side wallet arithmetic**

Delete `WalletScreen` helpers that infer available/pending/redeemed from raw credit status. Fetch/render `availableUnits`, `heldUnits`, `fulfilledUnits`, `expiredUnits` from server projection. Label the third summary card **Fulfilled**, not cash/redeemed value.

- [ ] **Step 4: Replace charging-hub-specific request flow with fixed ProgramBenefit flow**

`ProgramBenefitRedemptionFlow` displays one fixed credit cost from the selected ProgramBenefit and POSTs only `program_benefit_id` + generated UUID. It does not accept participant-entered unit quantity or a required ChargingHub.

- [ ] **Step 5: Add issued EV benefit and secure reveal UI**

`ChargingBenefitCard` shows provider, type, status, expiry, and site-host instructions. `ChargingBenefitRevealDialog` calls the reveal endpoint only after an explicit button press; keep the secret in component state only for the open dialog and clear it on close/unmount. Do not persist it to localStorage/sessionStorage/AppContext/analytics.

- [ ] **Step 6: Preserve product boundaries in copy**

Participant copy must say institution-sponsored benefit, subject to program eligibility/availability, and no charger reservation/payment/reimbursement/guarantee. Do not display `$` conversion from Green Route Credits.

- [ ] **Step 7: Run frontend unit/type/build checks**

```bash
npm run check
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit Task 12**

```bash
git add src/types.ts src/lib/greenWalletApi.ts src/screens/WalletScreen.tsx src/context/AppContext.tsx src/green-wallet.css src/flows src/components src/lib/greenWalletApi.v1.test.ts src/screens/WalletScreen.v1.test.tsx
git commit -m "feat(wallet): cut participant wallet to lifecycle v1"
```

---

### Task 13: Build governed administrative review, inventory, and program surfaces

**Files:**
- Modify: `src/screens/WalletAdminScreen.tsx`
- Modify: `src/green-wallet.css`
- Create: `src/components/WalletAdminReviewPanel.tsx`
- Create: `src/components/WalletAdminInventoryPanel.tsx`
- Create: `src/components/WalletProgramConfigPanel.tsx`
- Create: `src/screens/WalletAdminScreen.v1.test.tsx`

**Interfaces:**
- Produces: four distinct admin work surfaces required by the spec: evidence/issuance review, redemption review, benefit inventory/fulfillment, program configuration.
- Consumes: capability endpoint and admin APIs from Task 11.

- [ ] **Step 1: Write failing role-visibility/admin-flow tests**

Test program_staff can see review queue and start review but terminal fulfill/deny, inventory load/void, credential reveal, and reversal controls are absent/disabled. Test institution_admin sees terminal and inventory controls. Ensure inventory tables display counts/provider/reference/status/expiry only and never a promo credential.

- [ ] **Step 2: Run failing admin UI tests**

```bash
npm test -- src/screens/WalletAdminScreen.v1.test.tsx
```

- [ ] **Step 3: Split the existing monolithic WalletAdminScreen into explicit panels**

Use server capabilities such as:

```ts
export type WalletCapabilities = {
  canStartReview: boolean;
  canFinalizeRedemption: boolean;
  canApproveIssuance: boolean;
  canManageInventory: boolean;
  canReverseFulfillment: boolean;
};
```

`WalletAdminInventoryPanel` loads inventory through write-only `secretValue` input and immediately clears form state after success. Never render stored secret values back to an administrator.

- [ ] **Step 4: Implement fulfillment operational states**

Show `issued`, `confirmed_used`, `expired_unused`, `fulfillment_issue`, `replaced`, `voided_reversed`; provide replacement/reversal actions only to institution_admin/platform_admin. Replacement asks for a reason and uses fresh inventory; reversal requires reason and confirmation.

- [ ] **Step 5: Run frontend checks**

```bash
npm run check
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit Task 13**

```bash
git add src/screens/WalletAdminScreen.tsx src/components/WalletAdminReviewPanel.tsx src/components/WalletAdminInventoryPanel.tsx src/components/WalletProgramConfigPanel.tsx src/screens/WalletAdminScreen.v1.test.tsx src/green-wallet.css
git commit -m "feat(wallet): add governed benefit administration"
```

---

### Task 14: Backfill only supported legacy facts, add post-backfill constraints, and retire legacy write paths

**Files:**
- Modify: `backend/relay/models.py`
- Modify: `backend/relay/views.py`
- Modify: `backend/relay/serializers.py`
- Modify: `backend/relay/admin.py`
- Create: `backend/relay/migrations/0009_green_wallet_v1_constraints.py` (or next sequential number)
- Modify: `src/context/AppContext.tsx`
- Test: `backend/relay/test_green_wallet_v1_schema.py`
- Test: `backend/relay/test_green_wallet_contract.py`

**Interfaces:**
- Produces: canonical v1 writes only; legacy rows remain readable/classified without invented provenance.
- Consumes: all v1 services/API/frontend from Tasks 1-13.

- [ ] **Step 1: Write migration/backfill tests before tightening constraints**

Create legacy rows from historical schema assumptions and migrate forward. Assert old credits remain `provenance_state='legacy'`; historical fulfilled requests do **not** receive fabricated policy/evidence/inventory/ChargingBenefitFulfillment records; current legacy API writes are rejected or routed to v1 actions.

- [ ] **Step 2: Add only safe constraints after backfill**

Enforce unique v1 redemption idempotency `(institution, profile, idempotency_key)` for non-null keys, positive ProgramBenefit fixed cost, positive allocation units, one inventory assignment, and other constraints already proven by migrated data. Keep `RedemptionRequest.credit`/`charging_hub` columns nullable for compatibility until a separately reviewed destructive-removal migration is safe.

- [ ] **Step 3: Retire legacy lifecycle mutations**

Legacy `RedemptionRequestViewSet` must not allow arbitrary PATCH terminal status. Legacy GreenRouteCredit public/admin creation must not bypass `IssuanceService`. Keep read compatibility only where existing clients/tests require it during the cutover.

Remove Green Wallet session-memory mutation methods from `AppContext` canonical paths; if legacy demo fixtures remain for non-canonical screens, name them explicitly `legacyPrototype...` and ensure WalletScreen/WalletAdminScreen do not consume them.

- [ ] **Step 4: Run forward/backward/forward migration while data-safe**

Use the actual generated migration numbers:

```bash
cd backend
python manage.py migrate relay 0006
python manage.py migrate
python manage.py check
python manage.py migrate relay 0006
python manage.py migrate
python manage.py makemigrations --check --dry-run
```

This is valid only before accepting authoritative v1 fulfillment/credential-audit data. Document that after such data exists, rollback is application rollback/forward-fix, not destructive schema reversal.

- [ ] **Step 5: Run full backend/frontend regression suites**

```bash
cd backend && python manage.py test -v 2
cd .. && npm run check && npm test && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit Task 14**

```bash
git add backend/relay/models.py backend/relay/views.py backend/relay/serializers.py backend/relay/admin.py backend/relay/migrations backend/relay/test_green_wallet_v1_schema.py backend/relay/test_green_wallet_contract.py src/context/AppContext.tsx
git commit -m "refactor(wallet): retire legacy lifecycle write paths"
```

---

### Task 15: Prove the synthetic Pasadena lifecycle, negative security cases, and release evidence

**Files:**
- Create: `backend/relay/test_green_wallet_v1_pasadena_acceptance.py`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/SECURITY_ARCHITECTURE.md`
- Preserve: `backend/relay/test_green_wallet_pasadena_acceptance.py` as legacy regression evidence.

**Interfaces:**
- Produces: executable acceptance proof and operational documentation; no new product behavior.
- Consumes: complete lifecycle from Tasks 1-14.

- [ ] **Step 1: Write the exact Pasadena acceptance fixture**

Create a synthetic institution, participant, program_staff, institution_admin, active `verified_participation` policy, qualifying evidence, and two issuance awards:

```text
Award A = 5 Green Route Credits, earlier expiry
Award B = 10 Green Route Credits, later expiry
Fixed EV Charging ProgramBenefit cost = 7 Green Route Credits (synthetic fixture only)
Available initial balance = 15
```

Load one synthetic `network_promo` inventory item with encrypted credential and one synthetic non-charging ProgramBenefit.

- [ ] **Step 2: Prove issuance through wallet projection**

Acceptance assertions:

```text
QualifyingEvidence[]
-> deterministic evaluation
-> institution_admin approval
-> Award A + ISSUE
-> Award B + ISSUE
-> wallet available = 15
```

- [ ] **Step 3: Prove EV charging redemption and fulfillment**

Participant submits fixed ProgramBenefit request with UUID; assert allocation `5 from A + 2 from B`; wallet becomes `available=8, held=7`. program_staff starts review but cannot fulfill. institution_admin fulfills; assert inventory item `issued`, one `ChargingBenefitFulfillment(status='issued')`, wallet becomes `available=8, held=0, fulfilled=7`, and participant alone can reveal the synthetic credential.

Record `confirmed_used` outcome and prove wallet totals do not change.

- [ ] **Step 4: Prove non-charging benefit uses same accounting without charging fulfillment**

Issue/fund a second synthetic fixed benefit request and prove HOLD/DEBIT accounting works without `ChargingBenefitFulfillment`.

- [ ] **Step 5: Prove negative/concurrency cases in the acceptance file or dedicated suites**

Require: cross-tenant denial, same-tenant wrong-participant denial, viewer denial, program_staff issuance/terminal/inventory/reveal denial, duplicate issuance prevention, duplicate redemption replay, overcommit prevention, program/participant cap concurrency, benefit-capacity exhaustion, inventory exhaustion with preserved HOLD, one-item concurrent assignment, terminal concurrency, expired credit behavior, `expired_unused` no auto-refund, replacement no second DEBIT, exact exceptional reversal, secret absence from lists/loggable serializer output, and migration verification.

- [ ] **Step 6: Run complete verification**

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test -v 2
cd ..
npm run check
npm test
npm run build
npm run security:check
```

Also run the repository's PostgreSQL/CI integration path used by the institutional vertical slice so row-lock/concurrency behavior is not inferred only from SQLite.

Expected: all applicable checks PASS. Record exact test totals rather than copying historical totals.

- [ ] **Step 7: Update deployment/security documentation**

Document:

```text
GREEN_WALLET_BENEFIT_FERNET_KEYS=<comma-separated Fernet keys; first key encrypts, all keys decrypt>
```

State that keys must be managed by the deployment secret store, never committed; production responses revealing credentials are no-store; logs/analytics/exports must exclude benefit secrets; rotation prepends a new key, verifies decryptability, then re-encrypts inventory before retiring an old key.

Document rollback boundary: before accepted v1 data, tested schema rollback may be used; after authoritative ledger/inventory/credential-access/fulfillment data exists, preserve data and use application rollback/forward-fix.

- [ ] **Step 8: Final verification-before-completion evidence**

Record in the SDD ledger/report:

```text
implementation branch
merge-base/main SHA
final SHA
migrations created and numbers
all task commits
backend test total
frontend test total
TypeScript/build/security results
PostgreSQL concurrency result
Pasadena acceptance result
review findings/fixes
all SDD Rulings
remaining security/deployment blockers
rollback procedure
```

Do not label the system operational/production-ready solely from this proof.

- [ ] **Step 9: Commit Task 15**

```bash
git add backend/relay/test_green_wallet_v1_pasadena_acceptance.py docs/DEPLOYMENT.md docs/SECURITY_ARCHITECTURE.md
git commit -m "test(wallet): prove Pasadena lifecycle v1 acceptance"
```

---

## Completion Gate

Lifecycle v1 is ready for founder review only when all 15 tasks are complete, every task-level review is clean or explicitly adjudicated under the SDD rules, the final whole-branch review is complete, the full backend/frontend/PostgreSQL verification passes, and the Pasadena proof demonstrates:

```text
Institution
-> active deterministic policy
-> claimed authenticated participant
-> earning evidence
-> issuance decision
-> GreenRouteCredit + ISSUE
-> server wallet projection
-> fixed ProgramBenefit
-> idempotent pooled redemption
-> HOLD
-> staff triage
-> actual eligible EV benefit inventory assignment
-> ChargingBenefitFulfillment
-> DEBIT
-> secure participant reveal
-> optional outcome evidence
-> institutional audit/reportable state
```

No merge to `main`, deployment, external provider purchase, email delivery of credentials, live charging-network integration, or production-data activation is authorized by this plan.