# Green Route Credit Lifecycle v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Green Route Credit Lifecycle v1 with deterministic issuance, authoritative ledger projection, fixed ProgramBenefit redemption, institution-controlled EV charging Benefit Inventory, secure ChargingBenefitFulfillment delivery, and auditable outcome/reversal handling.

**Architecture:** Django remains authoritative for identity, policy, issuance, wallet accounting, redemption, external-benefit inventory, and fulfillment. Green Route Credits are participation-benefit units issued from governed evidence; fixed ProgramBenefits allocate those credits oldest-expiring-first, create HOLDs, and for EV charging may DEBIT only inside the same atomic transaction that assigns a real eligible BenefitInventoryItem and creates ChargingBenefitFulfillment. React consumes institution-scoped APIs and server projections; it never reconstructs accounting or persists charging-benefit secrets.

**Tech Stack:** Django 5.x, Django REST Framework 3.16, Django ORM transactions, PostgreSQL-compatible locking with SQLite-compatible unit tests, `cryptography` Fernet/MultiFernet for application-level benefit-secret encryption, React 19, TypeScript 7, Vite 8, Vitest 4, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-04-green-route-credit-lifecycle-v1-design.md`

## Global Constraints

- Green Wallet is a general institution-sponsored mobility-benefit wallet; EV charging is one ProgramBenefit category.
- Green Route Credits are participation-benefit units, not cash, wages, fares, charging reimbursement, guaranteed payments, certified carbon credits, utility credits, or automatic payment instruments.
- V1 ProgramBenefits use fixed `credit_cost_units`; no participant-selected redemption quantity and no participant-facing dollar exchange rate.
- V1 issuance is evidence-backed, deterministic, and `institution_admin` approved; no automatic issuance.
- `program_staff` may triage `requested -> under-review`; only `institution_admin` or `platform_admin` may approve issuance or make terminal redemption decisions.
- EV charging supports only `network_promo` and `site_host_entitlement` fulfillment types in v1.
- EV charging redemption may DEBIT credits only when a real eligible external benefit is assigned in the same database transaction.
- Institutions obtain/fund external charging benefits. Relay Rider does not automatically buy benefits, process charging payments, reimburse charging expenses, reserve chargers, or guarantee charger access.
- Network-promo credentials are encrypted at rest, accepted only as write-only input, absent from logs/analytics/exports/list serializers/email, and revealed only through an explicit owner-only no-store action.
- External-benefit expiry does not automatically restore Green Route Credits. Replacement uses fresh inventory without a second DEBIT. Exceptional restoration uses exact REVERSAL semantics with reason/correlation metadata.
- Wallet accounting is ledger-authoritative and event-semantic; never blindly sum `quantity_delta` across event types or derive balance from raw resource status.
- Existing migrations remain immutable. At planning time `main` is observed at `6d375157f8f99d1e8915711d190de09a7ecdbe96` with relay migrations through `0006_institutional_vertical_slice`. At execution time refresh `main`, reuse equivalent fields/models if already merged, and use the next free migration number.
- Preserve the institutional vertical slice, Rule 2202 boundary, Pandera commuter import, current tenant security, and existing Pasadena regressions.
- Do not add Charging Intelligence, OCPI/OCPP, EVSE, ChargingSession, live provider APIs, routing, payments, or marketplace expansion.
- Synthetic numerical values are fixtures only and must not become production defaults.
- Lifecycle correctness does not imply production readiness; preserve separate real-data security/deployment gates.

---

## Execution Preflight

Before Task 1, use `superpowers:using-git-worktrees`. Create an implementation branch from `docs/green-wallet-lifecycle-v1-design-20260904`, merge the latest `origin/main`, and record the refreshed main SHA and migration graph in the SDD ledger.

```bash
git fetch origin
git rev-parse origin/main
git merge --no-ff origin/main
ls backend/relay/migrations
cd backend
python manage.py showmigrations relay
python manage.py makemigrations --check --dry-run
```

If `main` has gained equivalent Profile ownership, participant-role, Decision Card, or migration work, reuse it rather than creating duplicate domain fields/models. If `0007` is no longer free, renumber this plan's planned migrations sequentially and record that ruling in the SDD ledger; do not rewrite any historical migration.

---

## Target File Structure

### Existing files to modify

- `backend/requirements.txt`
- `backend/config/settings.py`
- `backend/config/urls.py`
- `backend/relay/models.py`
- `backend/relay/permissions.py`
- `backend/relay/admin.py`
- `backend/relay/views.py`
- `backend/relay/serializers.py`
- `src/types.ts`
- `src/lib/greenWalletApi.ts`
- `src/context/AppContext.tsx`
- `src/screens/WalletScreen.tsx`
- `src/screens/WalletAdminScreen.tsx`
- `src/green-wallet.css`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY_ARCHITECTURE.md`

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
- `backend/relay/migrations/0007_green_wallet_lifecycle_v1_core.py` — expected against planning baseline; renumber if needed.
- `backend/relay/migrations/0008_green_wallet_benefit_fulfillment.py` — expected second additive migration.
- `backend/relay/migrations/0009_green_wallet_v1_constraints.py` — post-backfill constraints/legacy contract cleanup.
- `backend/relay/migrations/0010_green_wallet_append_only_guards.py` — PostgreSQL-only UPDATE/DELETE guards for authoritative audit tables; SQLite no-op.

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
- `backend/relay/test_green_wallet_v1_migration.py`
- `backend/relay/test_green_wallet_v1_pasadena_acceptance.py`

### New frontend files

- `src/flows/ProgramBenefitRedemptionFlow.tsx`
- `src/components/ChargingBenefitCard.tsx`
- `src/components/ChargingBenefitRevealDialog.tsx`
- `src/components/WalletEvidenceIssuancePanel.tsx`
- `src/components/WalletAdminReviewPanel.tsx`
- `src/components/WalletAdminInventoryPanel.tsx`
- `src/components/WalletProgramConfigPanel.tsx`
- `src/lib/greenWalletApi.v1.test.ts`
- `src/screens/WalletScreen.v1.test.tsx`
- `src/screens/WalletAdminScreen.v1.test.tsx`
- `src/flows/ProgramBenefitRedemptionFlow.test.tsx`

---

### Task 1: Add the v1 core schema without fabricating legacy provenance

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/migrations/0007_green_wallet_lifecycle_v1_core.py` (or next free number)
- Test: `backend/relay/test_green_wallet_v1_schema.py`

**Interfaces:**
- Consumes: current `Institution`, `Membership`, `Profile`, `GreenRouteCredit`, `ProgramBenefitPolicy`, `RedemptionRequest`, `ChargingHub`, `WalletLedgerEntry`.
- Produces: claimed Profile ownership, `participant` membership role, `QualifyingEvidence`, `IssuanceDecision`, `IssuanceDecisionEvidence`, fixed `ProgramBenefit`, `RedemptionAllocation`, `BenefitCapacityReservation`, v1 credit provenance/expiry fields, v1 redemption target, ledger allocation/reversal linkage.

- [ ] **Step 1: Write failing schema tests**

```python
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from relay.models import Institution, Membership, Profile, GreenRouteCredit, ProgramBenefit

User = get_user_model()

class GreenWalletV1SchemaTests(TestCase):
    def setUp(self):
        self.inst = Institution.objects.create(name='Pasadena Synthetic Institute', slug='pasadena-wallet-v1')
        self.user = User.objects.create_user(username='participant-a')

    def test_claimed_profile_unique_per_user_institution(self):
        Profile.objects.create(institution=self.inst, user=self.user, name='A')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Profile.objects.create(institution=self.inst, user=self.user, name='Duplicate')

    def test_multiple_unclaimed_profiles_allowed(self):
        Profile.objects.create(institution=self.inst, name='Imported A')
        Profile.objects.create(institution=self.inst, name='Imported B')

    def test_participant_role_exists(self):
        m = Membership.objects.create(user=self.user, institution=self.inst, role='participant')
        self.assertEqual(m.role, 'participant')

    def test_program_benefit_has_fixed_cost(self):
        b = ProgramBenefit.objects.create(
            institution=self.inst,
            name='Synthetic EV Charging Benefit',
            benefit_type='ev_charging',
            status='active',
            unit_label='Green Route Credits',
            credit_cost_units='7.00',
        )
        self.assertEqual(str(b.credit_cost_units), '7.00')

    def test_legacy_credit_defaults_to_legacy(self):
        c = GreenRouteCredit.objects.create(institution=self.inst, amount_units='5.00')
        self.assertEqual(c.provenance_state, 'legacy')
```

- [ ] **Step 2: Run and confirm the test fails before model changes**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema -v 2
```

Expected: FAIL because v1 fields/models do not exist.

- [ ] **Step 3: Add Profile and policy invariants**

Add nullable `Profile.user -> AUTH_USER_MODEL` with `SET_NULL` and conditional unique `(user, institution)` where `user IS NOT NULL`. Add `participant` to `Membership.ROLE_CHOICES`.

Extend `ProgramBenefitPolicy` with `framework_version`, `rule_type`, `parameters`, `activated_by`, `activated_at`. Add a conditional database unique constraint allowing at most one `status='active'` policy per institution.

- [ ] **Step 4: Add evidence and issuance models**

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

Add conditional unique `(institution, source_type, source_reference)` where `source_reference != ''`.

Add `IssuanceDecision` with `status=evaluated|approved|denied`, policy/profile/institution FKs, `calculated_units`, `evaluation_metadata`, `evaluated_at`, approval/denial actor+time+reason, indexed `correlation_id`. Add `IssuanceDecisionEvidence` with unique `(issuance_decision, evidence)`.

- [ ] **Step 5: Add fixed benefits, pooled allocations, and legacy-compatible redemption fields**

Add `ProgramBenefit` with `benefit_type=ev_charging|transit|access_point|other`, `status=draft|active|retired`, positive fixed `credit_cost_units`, `unit_label`, optional finite `capacity_total`, optional `charging_hub`, effective dates, eligibility metadata, and admin-only nullable sponsor-cost/external-value amount+currency fields.

Add `RedemptionAllocation(redemption_request, credit, allocated_units)` unique on `(redemption_request, credit)` and `BenefitCapacityReservation(redemption_request one-to-one, program_benefit, state=reserved|consumed|released)`.

Extend `GreenRouteCredit` with nullable `policy`, nullable one-to-one `issuance_decision`, `issued_at`, `expires_at`, and `provenance_state=legacy|v1` default `legacy`.

Extend `RedemptionRequest` with nullable `program_benefit`. **Do not convert existing idempotency data to a database UUID type.** Preserve the existing idempotency field type if present and enforce UUID syntax in v1 service/serializer validation. Make legacy `credit` and `charging_hub` nullable so pooled/non-hub v1 requests can exist while the legacy columns remain available for historical rows. Preserve `requested_units`/`unit_label` and populate them server-side from the fixed ProgramBenefit for compatibility.

Extend `WalletLedgerEntry` with nullable `redemption_allocation` and nullable self-FK `reverses_entry=PROTECT`.

- [ ] **Step 6: Generate and inspect the additive migration**

```bash
cd backend
python manage.py makemigrations relay --name green_wallet_lifecycle_v1_core
python manage.py makemigrations --check --dry-run
```

Expected: one new migration and then `No changes detected`. It must not edit migrations 0001-0006 or delete legacy fields.

- [ ] **Step 7: Run schema plus existing wallet regressions**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_schema relay.test_green_wallet_contract relay.test_green_wallet_ledger_and_policy relay.test_green_wallet_pasadena_acceptance -v 2
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add backend/relay/models.py backend/relay/migrations backend/relay/test_green_wallet_v1_schema.py
git commit -m "feat(wallet): add lifecycle v1 core schema"
```

---

### Task 2: Implement participant identity, RBAC, policy activation, and evidence governance

**Files:**
- Modify: `backend/relay/permissions.py`
- Create: `backend/relay/services/__init__.py`
- Create: `backend/relay/services/errors.py`
- Create: `backend/relay/services/participant_identity.py`
- Create: `backend/relay/services/policy_rules.py`
- Test: `backend/relay/test_green_wallet_v1_identity.py`
- Test: `backend/relay/test_green_wallet_v1_policy.py`

**Interfaces:**
- Produces: `resolve_participant_profile()`, administrative capability helpers, `activate_policy()`, `evaluate_policy()`, deterministic `verified_participation` rule.
- Consumes: Task 1 models.

- [ ] **Step 1: Define stable domain errors**

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

Prove claimed-profile resolution, unclaimed denial, same-tenant wrong-participant denial, cross-tenant denial, viewer denial, one user in two institutions, program_staff triage permission, institution_admin terminal/inventory/issuance permission, and platform-admin oversight. Participant self-service always requires a claimed Profile even for an administrator.

```python
profile = resolve_participant_profile(user=participant, institution=pasadena)
self.assertEqual(profile.user_id, participant.id)
self.assertTrue(can_start_redemption_review(staff, pasadena))
self.assertFalse(can_finalize_redemption(staff, pasadena))
self.assertTrue(can_finalize_redemption(admin, pasadena))
```

- [ ] **Step 3: Write failing policy tests**

Use a synthetic `verified_participation` policy with `units_per_qualifying_event='5.00'`, allowed source `relay_rider`, participant cap `20.00`, program cap `100.00`, expiry days `30`, bounded dates. Prove deterministic output, malformed/zero/negative parameters rejected, inactive/out-of-period rejected, unsupported source rejected, and activation retires/rejects any competing active policy so there is at most one active policy.

- [ ] **Step 4: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity relay.test_green_wallet_v1_policy -v 2
```

- [ ] **Step 5: Implement identity/capability helpers**

Expose:

```python
def resolve_participant_profile(*, user, institution) -> Profile: ...
def can_start_redemption_review(user, institution) -> bool: ...
def can_finalize_redemption(user, institution) -> bool: ...
def can_approve_issuance(user, institution) -> bool: ...
def can_manage_benefit_inventory(user, institution) -> bool: ...
```

Use code `PARTICIPANT_PROFILE_NOT_CLAIMED` when no claimed Profile exists.

- [ ] **Step 6: Implement policy activation/evaluation and evidence immutability**

```python
@dataclass(frozen=True)
class PolicyEvaluationResult:
    calculated_units: Decimal
    qualifying_evidence_ids: tuple[int, ...]
    metadata: dict[str, object]

RULE_REGISTRY = {'verified_participation': evaluate_verified_participation}
```

Expose `activate_policy(*, actor, policy_id) -> ProgramBenefitPolicy` and `evaluate_policy(*, policy, evidence) -> PolicyEvaluationResult`. Activation requires institution_admin/platform_admin, validates parameters/dates, and enforces one active policy. Evidence used by a decided issuance is never updated in place; API/service attempts to mutate it must fail with `EVIDENCE_IMMUTABLE_AFTER_DECISION` and corrections create a new evidence record/reference.

- [ ] **Step 7: Run identity/policy/tenant regressions**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_identity relay.test_green_wallet_v1_policy relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add backend/relay/permissions.py backend/relay/services backend/relay/test_green_wallet_v1_identity.py backend/relay/test_green_wallet_v1_policy.py
git commit -m "feat(wallet): govern participant identity and policy"
```

---

### Task 3: Implement governed issuance, ISSUE events, and authoritative wallet projection

**Files:**
- Create: `backend/relay/services/issuance.py`
- Create: `backend/relay/services/wallet_projection.py`
- Modify: `backend/relay/admin.py`
- Test: `backend/relay/test_green_wallet_v1_issuance.py`
- Test: `backend/relay/test_green_wallet_v1_projection.py`

**Interfaces:**
- Produces: `evaluate_issuance()`, `approve_issuance()`, `deny_issuance()`, `project_wallet()`, per-bucket available-quantity helper.
- Consumes: Task 2 policy/RBAC services and Task 1 ledger models.

- [ ] **Step 1: Write failing issuance tests**

Prove:

```text
QualifyingEvidence[] -> evaluated IssuanceDecision -> institution_admin approval -> one GreenRouteCredit -> exactly one ISSUE
```

Also prove approval replay does not double issue, program_staff cannot approve, participant/program caps reject atomically, denied decision cannot issue, and an injected failure after credit creation rolls back both credit and ISSUE.

- [ ] **Step 2: Write failing projection tests**

```text
ISSUE 10  => available 10
HOLD 4    => available 6, held 4
RELEASE 4 => available 10, held 0
HOLD 4
DEBIT 4   => available 6, held 0, fulfilled 4
EXPIRE 2  => available 4, held 0, fulfilled 4, expired 2
```

Also test multiple buckets, exact reversal linkage, partial reversal, ADJUSTMENT isolation, and impossible negative availability raising `WALLET_LEDGER_INCONSISTENT`.

- [ ] **Step 3: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance relay.test_green_wallet_v1_projection -v 2
```

- [ ] **Step 4: Implement issuance transactions**

`evaluate_issuance()` stores the deterministic decision and explicit decision-evidence links. `approve_issuance()` uses `transaction.atomic()`, locks the decision, policy, and participant Profile so participant/program cap checks serialize safely, rechecks policy/evidence, creates one v1 GreenRouteCredit with `expires_at`, then exactly one `WalletLedgerEntry(entry_type='ISSUE')`, then approval metadata. `deny_issuance()` records denial actor/time/reason and creates no credit/ledger entry.

- [ ] **Step 5: Implement semantic projection**

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

Interpret ISSUE/HOLD/RELEASE/DEBIT/EXPIRE/REVERSAL/ADJUSTMENT explicitly. Do not use one aggregate SUM across event types.

- [ ] **Step 6: Harden normal issuance/admin paths**

Make GreenRouteCredit normal add/change/delete unavailable through Django Admin/public lifecycle routes; keep legacy rows readable. Make WalletLedgerEntry change/delete unavailable in Django Admin/application query paths.

- [ ] **Step 7: Run tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_issuance relay.test_green_wallet_v1_projection relay.test_green_wallet_ledger_and_policy -v 2
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add backend/relay/services/issuance.py backend/relay/services/wallet_projection.py backend/relay/admin.py backend/relay/test_green_wallet_v1_issuance.py backend/relay/test_green_wallet_v1_projection.py
git commit -m "feat(wallet): govern issuance and wallet projection"
```

---

### Task 4: Implement fixed-bundle pooled redemption and finite ProgramBenefit capacity

**Files:**
- Create: `backend/relay/services/redemption.py`
- Test: `backend/relay/test_green_wallet_v1_redemption.py`

**Interfaces:**
- Produces: `create_redemption(*, user, institution, program_benefit_id, idempotency_key) -> RedemptionRequest`.
- Consumes: claimed Profile identity and WalletProjectionService.

- [ ] **Step 1: Write failing pooled-redemption tests**

Synthetic fixture:

```text
Award A = 5, earlier expiry
Award B = 10, later expiry
ProgramBenefit.credit_cost_units = 7
```

Assert allocation `A:5 + B:2`, wallet `available=8, held=7`, one HOLD per allocation, mandatory UUID syntax, replay returns the same logical request, participant cannot override fixed cost, expired/debited/held quantities are excluded, insufficient balance rolls back, and finite capacity exhaustion leaves no request/HOLD.

- [ ] **Step 2: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption -v 2
```

- [ ] **Step 3: Implement one atomic redemption transaction**

Within `transaction.atomic()`:

```text
resolve claimed Profile
-> load active/in-period eligible ProgramBenefit
-> derive requested_units from credit_cost_units
-> validate idempotency_key parses as UUID
-> replay existing (institution, profile, key) if present
-> lock eligible credit buckets by expires_at, issued_at, id
-> allocate full fixed cost oldest-expiring-first
-> lock ProgramBenefit and reserve finite capacity
-> create request + allocations + HOLD events
-> commit
```

Persist `requested_units`/`unit_label` from ProgramBenefit for legacy read compatibility, but never accept participant-supplied values as authority.

- [ ] **Step 4: Run redemption/projection tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_redemption relay.test_green_wallet_v1_projection -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add backend/relay/services/redemption.py backend/relay/test_green_wallet_v1_redemption.py
git commit -m "feat(wallet): add fixed pooled benefit redemption"
```

---

### Task 5: Add encrypted Benefit Inventory and exactly-once inventory assignment

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/config/settings.py`
- Modify: `backend/relay/models.py`
- Create: `backend/relay/services/benefit_secrets.py`
- Create: `backend/relay/services/benefit_inventory.py`
- Create: `backend/relay/migrations/0008_green_wallet_benefit_fulfillment.py` (or next sequential number)
- Test: `backend/relay/test_green_wallet_v1_inventory.py`

**Interfaces:**
- Produces: `BenefitSecretCodec`, `BenefitInventoryItem`, `ChargingBenefitFulfillment`, `BenefitAccessEvent`, inventory load/void/select services.
- Consumes: ProgramBenefit and RBAC helpers.

- [ ] **Step 1: Write failing encryption/inventory tests**

```python
from django.test import TestCase, override_settings
from relay.services.benefit_secrets import BenefitSecretCodec

@override_settings(GREEN_WALLET_BENEFIT_FERNET_KEYS=['MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA='])
class BenefitSecretTests(TestCase):
    def test_ciphertext_does_not_contain_plaintext(self):
        codec = BenefitSecretCodec()
        ciphertext = codec.encrypt('PROMO-SECRET-123')
        self.assertNotIn('PROMO-SECRET-123', ciphertext)
        self.assertEqual(codec.decrypt(ciphertext), 'PROMO-SECRET-123')

    def test_fingerprint_is_deterministic(self):
        codec = BenefitSecretCodec()
        self.assertEqual(codec.fingerprint('PROMO-SECRET-123'), codec.fingerprint('PROMO-SECRET-123'))
```

Also test institution_admin/platform_admin load/void permission, program_staff non-secret read only, duplicate promo secret rejection, site-host item without secret, expired/voided/wrong-benefit/wrong-tenant selection rejection, and one inventory item cannot be linked to two fulfillments.

- [ ] **Step 2: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_inventory -v 2
```

- [ ] **Step 3: Add encryption dependency/configuration**

Append:

```text
cryptography>=43,<47
```

Parse `GREEN_WALLET_BENEFIT_FERNET_KEYS` as a comma-separated list in settings. No hard-coded production key and no key logging.

- [ ] **Step 4: Implement `BenefitSecretCodec`**

Use MultiFernet: first key encrypts, all keys decrypt. `fingerprint()` uses HMAC-SHA256 with key material derived from the first decoded Fernet key and domain separator `relay-rider-benefit-fingerprint-v1`, not raw SHA256 of the promo code.

```python
class BenefitSecretCodec:
    def encrypt(self, plaintext: str) -> str: ...
    def decrypt(self, ciphertext: str) -> str: ...
    def fingerprint(self, plaintext: str) -> str: ...
```

Secret operations without keys raise `BENEFIT_SECRET_KEY_UNAVAILABLE`.

- [ ] **Step 5: Add exact inventory/fulfillment/audit models**

`BenefitInventoryItem`: institution, ProgramBenefit, `fulfillment_type=network_promo|site_host_entitlement`, provider metadata, non-secret external reference, `secret_ciphertext`, `secret_fingerprint`, participant instructions, `status=available|issued|expired|voided`, valid/expiry dates, loaded actor/time, issued time. Add conditional uniqueness on non-empty `(institution, provider_name, secret_fingerprint)` and non-empty `(institution, provider_name, external_reference)`.

`ChargingBenefitFulfillment`: institution, Profile, RedemptionRequest, ProgramBenefit, **one-to-one** BenefitInventoryItem, fulfillment/provider metadata, `status=issued|confirmed_used|expired_unused|fulfillment_issue|replaced|voided_reversed`, issued actor/time, optional expiry, nullable `replacement_for`, outcome reference/label/time. Add conditional uniqueness: only one initial fulfillment per redemption where `replacement_for IS NULL`.

`BenefitAccessEvent`: nullable fulfillment, nullable inventory item, actor, `action=reveal|admin_inventory_load|void|replacement`, occurred_at, correlation_id; add check constraint requiring at least one object reference. Make application/admin mutation unavailable after creation.

- [ ] **Step 6: Implement inventory service**

```python
def load_inventory_item(*, actor, institution, program_benefit, fulfillment_type,
                        provider_name, provider_program_reference='', external_reference='',
                        secret_value='', participant_instructions='', valid_from=None,
                        expires_at=None, correlation_id: str) -> BenefitInventoryItem: ...

def void_inventory_item(*, actor, item_id, reason: str, correlation_id: str) -> BenefitInventoryItem: ...

def select_inventory_for_fulfillment(*, institution, program_benefit, now) -> BenefitInventoryItem: ...
```

Inventory is v1 EV-only: reject non-`ev_charging` ProgramBenefits. Encrypt network promo plaintext immediately and never persist/log it. Site-host entitlement requires a non-secret external reference or explicit entitlement instructions. Selection locks eligible inventory deterministically and uses `skip_locked=True` on PostgreSQL where supported.

- [ ] **Step 7: Generate migration and run tests**

```bash
cd backend
python manage.py makemigrations relay --name green_wallet_benefit_fulfillment
python manage.py makemigrations --check --dry-run
python manage.py test relay.test_green_wallet_v1_inventory -v 2
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add backend/requirements.txt backend/config/settings.py backend/relay/models.py backend/relay/services/benefit_secrets.py backend/relay/services/benefit_inventory.py backend/relay/migrations backend/relay/test_green_wallet_v1_inventory.py
git commit -m "feat(wallet): add encrypted charging benefit inventory"
```

---

### Task 6: Implement atomic terminal review, EV fulfillment, replacement, outcome governance, and exceptional reversal

**Files:**
- Create: `backend/relay/services/redemption_review.py`
- Create: `backend/relay/services/benefit_outcomes.py`
- Test: `backend/relay/test_green_wallet_v1_fulfillment.py`

**Interfaces:**
- Produces: `start_review()`, `fulfill_redemption()`, `deny_redemption()`, `replace_charging_fulfillment()`, `submit_participant_outcome_reference()`, `confirm_charging_outcome()`, `reverse_charging_fulfillment()`.
- Consumes: redemption allocations/HOLDs, inventory service, wallet ledger, RBAC helpers.

- [ ] **Step 1: Write failing review/fulfillment tests**

Prove program_staff may `requested -> under-review` but cannot fulfill/deny. For EV fulfillment, assert one atomic operation creates one initial ChargingBenefitFulfillment, binds/marks one inventory item issued, writes one DEBIT per allocation, consumes finite capacity, and marks request fulfilled. Inject failure after fulfillment creation and assert all state rolls back.

Assert `BENEFIT_INVENTORY_EXHAUSTED` leaves request under-review, HOLDs/capacity reservation intact, and creates no DEBIT/fulfillment.

- [ ] **Step 2: Write failing replacement/outcome/reversal tests**

Prove replacement marks original `replaced`, assigns fresh inventory, creates linked replacement fulfillment, and creates **no second DEBIT**. Prove `expired_unused` creates no wallet mutation. Prove participant-submitted usage reference alone does not self-certify `confirmed_used`; program_staff/institution_admin may verify the reference and set `confirmed_used`. Prove participant may report `fulfillment_issue` for their own fulfillment without accessing another participant's fulfillment.

Prove exceptional reversal requires institution_admin/platform_admin, documented reason/correlation, exact prior DEBIT references, no duplicate/excess reversal, RELEASE after reversal, and immediate EXPIRE when the source issuance has already expired.

- [ ] **Step 3: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_fulfillment -v 2
```

- [ ] **Step 4: Implement terminal services**

`start_review()` locks request and permits only `requested -> under-review`.

`fulfill_redemption()` locks request, allocations, finite capacity reservation, and for EV charging selects/locks inventory; then creates fulfillment, marks inventory issued, writes DEBITs, consumes capacity, marks request fulfilled, persists reviewer metadata, and commits. Non-charging fulfillment uses the same DEBIT/capacity path without ChargingBenefitFulfillment.

`deny_redemption()` writes one RELEASE per allocation, releases capacity, and if the source issuance expired while held, writes immediate EXPIRE in the same transaction.

- [ ] **Step 5: Implement governed outcome/replacement/reversal services**

Participant outcome submission records only a non-secret provider transaction/reference plus source label `participant_submitted`; it does not change to `confirmed_used`. Authorized program_staff/institution_admin may confirm `confirmed_used` using participant reference, authorized import, or admin attestation. `expired_unused` and `fulfillment_issue` do not alter wallet accounting.

Replacement and reversal follow the exact semantics in the spec and create `BenefitAccessEvent(action='replacement')`/audit metadata without exposing secrets.

- [ ] **Step 6: Add terminal concurrency test**

Use `TransactionTestCase` and the repository PostgreSQL integration path to prove two authorized admins cannot produce two terminal decisions, two initial fulfillments, two assignments, or duplicate DEBIT sets.

- [ ] **Step 7: Run fulfillment/redemption/projection tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_fulfillment relay.test_green_wallet_v1_redemption relay.test_green_wallet_v1_projection -v 2
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add backend/relay/services/redemption_review.py backend/relay/services/benefit_outcomes.py backend/relay/test_green_wallet_v1_fulfillment.py
git commit -m "feat(wallet): atomically fulfill sponsored charging benefits"
```

---

### Task 7: Implement idempotent credit, inventory, and external-benefit expiration

**Files:**
- Create: `backend/relay/services/expiration.py`
- Create: `backend/relay/management/commands/expire_green_wallet_state.py`
- Test: `backend/relay/test_green_wallet_v1_expiration.py`

**Interfaces:**
- Produces: `expire_green_route_credits(now)`, `expire_inventory(now)`, `expire_unused_fulfillments(now)`.
- Consumes: projection and benefit state.

- [ ] **Step 1: Write failing expiration tests**

Prove available source-credit units expire once, held units remain protected, retry is idempotent, denial after source expiry produces RELEASE+EXPIRE, available inventory past expiry becomes `expired`, issued external fulfillment past expiry becomes `expired_unused`, and `expired_unused` does not write wallet events.

- [ ] **Step 2: Run failing tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration -v 2
```

- [ ] **Step 3: Implement expiration services and command**

The command runs bounded batches, prints counts only, never credentials, and is safe to rerun:

```bash
python manage.py expire_green_wallet_state
```

- [ ] **Step 4: Run tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_expiration -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add backend/relay/services/expiration.py backend/relay/management/commands/expire_green_wallet_state.py backend/relay/test_green_wallet_v1_expiration.py
git commit -m "feat(wallet): expire wallet and benefit state idempotently"
```

---

### Task 8: Expose institution-scoped APIs and secure credential reveal

**Files:**
- Create: `backend/relay/green_wallet_v1_serializers.py`
- Create: `backend/relay/green_wallet_v1_views.py`
- Modify: `backend/config/urls.py`
- Test: `backend/relay/test_green_wallet_v1_api.py`

**Interfaces:**
- Produces: spec participant/admin endpoints plus a capability endpoint required for visible frontend role restrictions.
- Consumes: Tasks 2-7 services; views contain no accounting logic.

- [ ] **Step 1: Write failing API/error/secret-leak tests**

Test stable response shape:

```json
{"code":"BENEFIT_INVENTORY_EXHAUSTED","detail":"No eligible charging benefit is currently available."}
```

Map malformed=400, unauthenticated=401, unauthorized=403, tenant-hidden=404, idempotency/concurrency/state conflict=409, business-rule failure=422.

Assert inventory/fulfillment list/detail/export serializers never expose `secret_ciphertext`, `secret_fingerprint`, or plaintext. Capture application logs around inventory load/reveal and assert the plaintext secret is absent.

- [ ] **Step 2: Run failing API tests**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_api -v 2
```

- [ ] **Step 3: Implement serializers**

Inventory create accepts `secret_value = serializers.CharField(write_only=True, required=False)` and passes it directly to BenefitInventoryService. It is never mapped to a model plaintext field.

- [ ] **Step 4: Implement explicit action endpoints**

Participant:

```text
GET  /api/institutions/{institution_id}/wallet/
GET  /api/institutions/{institution_id}/program-benefits/
POST /api/institutions/{institution_id}/redemptions/
GET  /api/institutions/{institution_id}/redemptions/{id}/
GET  /api/institutions/{institution_id}/redemptions/{id}/charging-fulfillment/
POST /api/institutions/{institution_id}/charging-benefit-fulfillments/{id}/reveal/
POST /api/institutions/{institution_id}/charging-benefit-fulfillments/{id}/outcome-evidence/
GET  /api/institutions/{institution_id}/wallet-capabilities/
```

Institution:

```text
GET/POST policy/evidence endpoints
POST issuance-decisions/evaluate/
POST issuance-decisions/{id}/approve/
POST issuance-decisions/{id}/deny/
GET review-queue/
POST redemptions/{id}/start-review/
POST redemptions/{id}/fulfill/
POST redemptions/{id}/deny/
GET/POST benefit-inventory/
POST benefit-inventory/{id}/void/
GET charging-benefit-fulfillments/
POST charging-benefit-fulfillments/{id}/confirm-outcome/
POST charging-benefit-fulfillments/{id}/replace/
POST charging-benefit-fulfillments/{id}/reverse/
```

The reveal endpoint verifies tenant + claimed Profile ownership, creates `BenefitAccessEvent(action='reveal')`, decrypts only after authorization, and returns `Cache-Control: no-store, private` and `Pragma: no-cache`. Never include secret in exception/audit text.

- [ ] **Step 5: Run API/security regressions**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_api relay.test_green_wallet_v1_identity relay.tests -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add backend/relay/green_wallet_v1_serializers.py backend/relay/green_wallet_v1_views.py backend/config/urls.py backend/relay/test_green_wallet_v1_api.py
git commit -m "feat(wallet): expose institution scoped lifecycle APIs"
```

---

### Task 9: Cut participant Green Wallet UI to server projection and fixed ProgramBenefits

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/greenWalletApi.ts`
- Modify: `src/context/AppContext.tsx`
- Modify: `src/screens/WalletScreen.tsx`
- Modify: `src/green-wallet.css`
- Create: `src/flows/ProgramBenefitRedemptionFlow.tsx`
- Create: `src/components/ChargingBenefitCard.tsx`
- Create: `src/components/ChargingBenefitRevealDialog.tsx`
- Create: `src/lib/greenWalletApi.v1.test.ts`
- Create: `src/screens/WalletScreen.v1.test.tsx`
- Create: `src/flows/ProgramBenefitRedemptionFlow.test.tsx`

**Interfaces:**
- Produces: canonical participant wallet UI.
- Consumes: Task 8 APIs.

- [ ] **Step 1: Define canonical frontend types and failing tests**

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

Add fulfillment status/type unions matching backend. Test ordinary fetches never expect a credential and reveal is a separate method.

- [ ] **Step 2: Run failing frontend tests**

```bash
npm test -- src/lib/greenWalletApi.v1.test.ts src/screens/WalletScreen.v1.test.tsx src/flows/ProgramBenefitRedemptionFlow.test.tsx
```

- [ ] **Step 3: Remove client-side wallet accounting**

Delete helpers that derive available/pending/redeemed from raw credit/request status. Render Available, Under review/Held, Fulfilled, Expired from server projection only.

- [ ] **Step 4: Replace charging-hub-specific participant request with fixed ProgramBenefit flow**

POST only `program_benefit_id` + generated UUID. Show the fixed Green Route Credit cost; no editable units, no required ChargingHub, no dollar conversion.

- [ ] **Step 5: Add secure issued-benefit UI**

`ChargingBenefitCard` shows provider/type/status/expiry/non-secret instructions. `ChargingBenefitRevealDialog` fetches plaintext only after explicit click, keeps it only in component memory, and clears it on close/unmount. Never store it in AppContext, localStorage, sessionStorage, URL, analytics, or console.

- [ ] **Step 6: Test product language boundaries**

Tests assert participant UI does not render `$` exchange-rate language, reimbursement/payment/reservation guarantees, or unbuilt benefit controls.

- [ ] **Step 7: Run frontend checks**

```bash
npm run check
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit Task 9**

```bash
git add src/types.ts src/lib/greenWalletApi.ts src/context/AppContext.tsx src/screens/WalletScreen.tsx src/green-wallet.css src/flows/ProgramBenefitRedemptionFlow.tsx src/components/ChargingBenefitCard.tsx src/components/ChargingBenefitRevealDialog.tsx src/lib/greenWalletApi.v1.test.ts src/screens/WalletScreen.v1.test.tsx src/flows/ProgramBenefitRedemptionFlow.test.tsx
git commit -m "feat(wallet): cut participant wallet to lifecycle v1"
```

---

### Task 10: Build the four governed administrative wallet surfaces

**Files:**
- Modify: `src/screens/WalletAdminScreen.tsx`
- Modify: `src/green-wallet.css`
- Create: `src/components/WalletEvidenceIssuancePanel.tsx`
- Create: `src/components/WalletAdminReviewPanel.tsx`
- Create: `src/components/WalletAdminInventoryPanel.tsx`
- Create: `src/components/WalletProgramConfigPanel.tsx`
- Create: `src/screens/WalletAdminScreen.v1.test.tsx`

**Interfaces:**
- Produces: distinct evidence/issuance review, redemption review, inventory/fulfillment operations, and program configuration surfaces.
- Consumes: Task 8 capability/admin APIs.

- [ ] **Step 1: Write failing role-visibility/admin-flow tests**

Program_staff may view evidence/review queues and start review but cannot approve issuance, fulfill/deny, manage inventory, reveal participant credentials, or reverse. Institution_admin may activate policy, approve/deny issuance, manage inventory, terminally decide redemptions, replace/reverse fulfillment. Inventory tables show counts/provider/reference/status/expiry only, never secret values.

- [ ] **Step 2: Run failing admin UI tests**

```bash
npm test -- src/screens/WalletAdminScreen.v1.test.tsx
```

- [ ] **Step 3: Implement four explicit panels driven by capabilities**

```ts
export type WalletCapabilities = {
  canStartReview: boolean;
  canFinalizeRedemption: boolean;
  canApproveIssuance: boolean;
  canManageInventory: boolean;
  canReverseFulfillment: boolean;
};
```

`WalletEvidenceIssuancePanel` supports evidence review, deterministic evaluation display, admin approve/deny. `WalletAdminReviewPanel` supports staff start-review and admin terminal actions. `WalletAdminInventoryPanel` accepts write-only `secretValue` and clears form state immediately after success; it never renders saved secret. `WalletProgramConfigPanel` validates/activates policy and configures fixed ProgramBenefit metadata/cost/capacity without arbitrary formulas.

- [ ] **Step 4: Implement fulfillment operational states**

Display `issued`, `confirmed_used`, `expired_unused`, `fulfillment_issue`, `replaced`, `voided_reversed`; replacement/reversal require institution-admin capability and reason confirmation.

- [ ] **Step 5: Run frontend checks**

```bash
npm run check
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit Task 10**

```bash
git add src/screens/WalletAdminScreen.tsx src/components/WalletEvidenceIssuancePanel.tsx src/components/WalletAdminReviewPanel.tsx src/components/WalletAdminInventoryPanel.tsx src/components/WalletProgramConfigPanel.tsx src/screens/WalletAdminScreen.v1.test.tsx src/green-wallet.css
git commit -m "feat(wallet): add governed wallet administration"
```

---

### Task 11: Backfill supported facts only, tighten constraints, retire legacy write paths, and enforce append-only DB guards

**Files:**
- Modify: `backend/relay/models.py`
- Modify: `backend/relay/views.py`
- Modify: `backend/relay/serializers.py`
- Modify: `backend/relay/admin.py`
- Modify: `src/context/AppContext.tsx`
- Create: `backend/relay/migrations/0009_green_wallet_v1_constraints.py` (or next sequential number)
- Create: `backend/relay/migrations/0010_green_wallet_append_only_guards.py` (or next sequential number)
- Create: `backend/relay/test_green_wallet_v1_migration.py`

**Interfaces:**
- Produces: canonical v1 write paths only, historical rows preserved without invented provenance, DB-level append-only guards on PostgreSQL.
- Consumes: all prior tasks.

- [ ] **Step 1: Write migration/backfill tests before tightening constraints**

Migrate legacy fixtures forward and assert historical credits remain `provenance_state='legacy'`; historical fulfilled requests do not get fabricated policy/evidence/inventory/ChargingBenefitFulfillment; pooled v1 request can have `credit=NULL` and `charging_hub=NULL`; legacy non-UUID idempotency strings remain readable but cannot be submitted through v1 endpoints.

- [ ] **Step 2: Add post-backfill constraints**

Add conditional unique `(institution, profile, idempotency_key)` for non-null/non-empty v1 keys, positive `ProgramBenefit.credit_cost_units`, positive allocation units, and any fulfillment/inventory constraints not already in prior migrations. Remove the old `(credit, idempotency_key)` uniqueness constraint once the new pooled idempotency contract is proven. Keep legacy `credit`/`charging_hub` columns nullable; do not destructively remove historical fields in this release.

- [ ] **Step 3: Retire legacy lifecycle writes**

Legacy RedemptionRequestViewSet must not allow arbitrary PATCH terminal status. Public/admin GreenRouteCredit creation must not bypass IssuanceService. WalletScreen/WalletAdminScreen must not consume session-memory wallet mutation helpers; remove or explicitly quarantine those helpers as non-canonical legacy prototype state.

- [ ] **Step 4: Add PostgreSQL append-only trigger migration**

In `0010_green_wallet_append_only_guards.py`, use `RunPython`/schema editor vendor check. On PostgreSQL create BEFORE UPDATE OR DELETE triggers for `relay_walletledgerentry` and `relay_benefitaccessevent` that raise an exception; on SQLite do nothing. Reverse migration drops only these triggers/functions. Add an environment-specific PostgreSQL test that direct UPDATE/DELETE fails while INSERT succeeds.

- [ ] **Step 5: Verify migration forward/backward/forward before accepting authoritative v1 data**

Use actual generated numbers:

```bash
cd backend
python manage.py migrate relay 0006
python manage.py migrate
python manage.py check
python manage.py migrate relay 0006
python manage.py migrate
python manage.py makemigrations --check --dry-run
```

After authoritative ledger/inventory/credential-access/fulfillment evidence is accepted, destructive schema rollback is no longer the recovery mechanism; use application rollback/forward-fix preserving data.

- [ ] **Step 6: Run migration and full backend/frontend regressions**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_migration -v 2
python manage.py test -v 2
cd ..
npm run check
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 11**

```bash
git add backend/relay/models.py backend/relay/views.py backend/relay/serializers.py backend/relay/admin.py backend/relay/migrations backend/relay/test_green_wallet_v1_migration.py src/context/AppContext.tsx
git commit -m "refactor(wallet): retire legacy writes and enforce audit guards"
```

---

### Task 12: Prove the synthetic Pasadena lifecycle and all negative/concurrency invariants

**Files:**
- Create: `backend/relay/test_green_wallet_v1_pasadena_acceptance.py`
- Preserve: `backend/relay/test_green_wallet_pasadena_acceptance.py`

**Interfaces:**
- Produces: end-to-end acceptance proof; no new product behavior.
- Consumes: Tasks 1-11.

- [ ] **Step 1: Create the exact synthetic Pasadena fixture**

```text
Institution: Pasadena Synthetic Institute
Award A: 5 Green Route Credits, earlier expiry
Award B: 10 Green Route Credits, later expiry
Fixed EV Charging ProgramBenefit cost: 7 Green Route Credits
Initial available: 15
Inventory: one encrypted synthetic network_promo item
Also: one fixed non-charging ProgramBenefit
```

Create participant, program_staff, institution_admin, active `verified_participation` policy, qualifying evidence, and approved issuance decisions.

- [ ] **Step 2: Prove issuance and wallet projection**

```text
Evidence -> evaluation -> admin approval -> Award A + ISSUE -> Award B + ISSUE -> available 15
```

- [ ] **Step 3: Prove EV charging redemption and actual external-benefit assignment**

Participant requests the fixed benefit with UUID; allocation must be `A:5 + B:2`; wallet becomes `available=8, held=7`. program_staff starts review but cannot fulfill. institution_admin fulfills; assert one inventory item `issued`, one ChargingBenefitFulfillment `issued`, one DEBIT per allocation, wallet `available=8, held=0, fulfilled=7`, and only the participant owner can reveal the synthetic credential.

Record participant outcome reference, then program_staff/admin confirmation to `confirmed_used`; wallet totals must not change.

- [ ] **Step 4: Prove the non-charging ProgramBenefit uses the same wallet accounting without charging fulfillment**

Create/fund a fixed non-charging request and prove pooled HOLD/DEBIT behavior with no BenefitInventoryItem or ChargingBenefitFulfillment.

- [ ] **Step 5: Prove negative/concurrency behavior**

Require executable assertions for cross-tenant denial, same-tenant wrong-participant denial, viewer denial, program_staff issuance/terminal/inventory/reveal denial, duplicate evidence reference rejection, duplicate issuance prevention, duplicate redemption replay, overcommit prevention, participant/program issuance caps, benefit capacity exhaustion, inventory exhaustion preserving HOLD, one inventory item concurrent assignment, one terminal decision, credit expiration, `expired_unused` no automatic restoration, replacement no second DEBIT, exact exceptional reversal, secret absence from ordinary serializers/logs, and PostgreSQL append-only guards.

- [ ] **Step 6: Run acceptance and PostgreSQL concurrency path**

```bash
cd backend
python manage.py test relay.test_green_wallet_v1_pasadena_acceptance -v 2
```

Then run the repository's PostgreSQL integration workflow used by the institutional vertical slice. Do not claim concurrency proof from SQLite alone.

- [ ] **Step 7: Commit Task 12**

```bash
git add backend/relay/test_green_wallet_v1_pasadena_acceptance.py
git commit -m "test(wallet): prove Pasadena lifecycle v1 acceptance"
```

---

### Task 13: Document secret operations, rollback boundaries, and run final verification

**Files:**
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/SECURITY_ARCHITECTURE.md`

**Interfaces:**
- Produces: deployment/security runbook and final verification evidence.
- Consumes: complete implementation.

- [ ] **Step 1: Document benefit-secret configuration and rotation**

Document:

```text
GREEN_WALLET_BENEFIT_FERNET_KEYS=<comma-separated Fernet keys; first encrypts, all keys decrypt>
```

Keys live in deployment secret management, never Git. Rotation prepends a new key, verifies old ciphertext decryptability, re-encrypts inventory, then retires the old key. Reveal responses are no-store. Logs/analytics/exports/email must never contain benefit credentials.

- [ ] **Step 2: Document append-only and rollback boundaries**

Document application + PostgreSQL UPDATE/DELETE guards for WalletLedgerEntry and BenefitAccessEvent. Before authoritative v1 evidence is accepted, forward/backward/forward migration testing is permitted. After authoritative ledger/inventory/access/fulfillment data exists, rollback must preserve those records through application rollback or forward-fix.

- [ ] **Step 3: Run complete verification-before-completion suite**

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

Also run PostgreSQL integration/concurrency tests and the repository's existing institutional vertical-slice/Rule 2202 acceptance path to verify no regression.

- [ ] **Step 4: Record exact evidence**

In the SDD ledger/report record:

```text
implementation branch
starting/main SHA
final SHA
migrations created and actual numbers
all task commits
backend test total
frontend test total
TypeScript/build/security results
PostgreSQL concurrency/append-only result
Pasadena v1 acceptance result
existing institutional/Rule 2202 regression result
review findings and fixes
all SDD Rulings
remaining security/deployment blockers
rollback procedure
```

Do not call the release operational or production-ready solely because Lifecycle v1 passes.

- [ ] **Step 5: Commit Task 13**

```bash
git add docs/DEPLOYMENT.md docs/SECURITY_ARCHITECTURE.md
git commit -m "docs(wallet): document lifecycle v1 operations"
```

---

## Completion Gate

Green Route Credit Lifecycle v1 is ready for founder review only when all 13 tasks are complete, task-level reviews and the final whole-branch review are complete, all backend/frontend/PostgreSQL verification passes, and the synthetic Pasadena chain proves:

```text
Institution
-> active deterministic ProgramBenefitPolicy
-> claimed authenticated participant
-> immutable qualifying evidence
-> issuance decision
-> GreenRouteCredit + ISSUE
-> server wallet projection
-> fixed ProgramBenefit
-> idempotent pooled RedemptionRequest
-> HOLD
-> program_staff triage
-> institution_admin terminal decision
-> real eligible BenefitInventoryItem assignment for EV charging
-> ChargingBenefitFulfillment
-> DEBIT
-> secure participant reveal
-> optional governed outcome evidence
-> institutional audit/reportable state
```

No merge to `main`, deployment, external provider purchase, email delivery of credentials, live charging-network integration, or production-data activation is authorized by this plan.