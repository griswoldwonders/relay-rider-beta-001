# Relay Rider Security Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement authenticated participant ownership, active membership semantics, protected role transitions, explicit platform-admin authority, PostgreSQL tenant-integrity guards, safe participant provisioning, minimized projections, auditability, and adversarial verification without changing Relay Rider’s canonical domain architecture.

**Architecture:** Keep Django ORM as the canonical application/domain persistence layer and PostgreSQL as the final tenant-integrity boundary in `relay_app`. Add identity/lifecycle primitives to existing models, route participant writes through transactional services, preserve application validation for SQLite, and install schema-qualified PostgreSQL triggers for writes that can bypass Django validation. Split the schema change into `0007_security_identity_foundation` and `0008_database_tenant_invariants` so identity rollback is separable from database-boundary enforcement.

**Tech Stack:** Django, Django REST Framework, PostgreSQL 17 integration tests, SQLite unit tests, pytest/Django test runner, existing `AssessmentAuditEvent`, existing `relay_app` schema deployment contract.

**Spec:** `docs/superpowers/specs/2026-09-05-relay-rider-security-foundation-design.md`

## Global Constraints

- Start from branch `security/foundation-identity-tenancy`, which was created from current `main` after PR #52.
- Do not merge or cherry-pick PR #53, PR #29, or PR #34.
- Do not add duplicate `Institution`, `Site`, `Cohort`, `Program`, `Assessment`, `DecisionCard`, `Rule2202CalculationRun`, or commuter-record models.
- Preserve the canonical hierarchy `Institution → Site → Cohort → DataSource/CommuteImport → CommuterRecord → EngineScore` plus `Rule2202CalculationRun → DecisionCard`.
- Preserve the `relay_app` PostgreSQL application schema boundary.
- Do not change any Rule 2202 formula, `public.vehicle_trip_weight`, `public.calculate_avr`, or Rule 2202 SQL migration.
- Do not change Supabase historical recovery anchors or weaken the migration-history provenance warning that reconciliation anchors are not replayable historical SQL.
- Do not automatically claim legacy Profiles by email, name, phone, or fuzzy matching.
- `platform_admin` may use explicitly authorized administrative/read paths but must not implicitly impersonate a participant through participant self-service endpoints.
- Participant authorization requires both an active Membership and an active Institution.
- Suspended or withdrawn Memberships confer no participant or tenant authorization.
- Preserve historical institutional evidence on withdrawal; do not invent an anonymization/deletion schedule. `[NEEDS FOUNDER INPUT: participant data-retention/anonymization period after withdrawal]` remains unresolved.
- PostgreSQL must reject cross-tenant raw ORM, bulk, `QuerySet.update()`, FK-ID reassignment, and raw SQL writes even when Django validation is bypassed.
- SQLite tests verify application/service validation only; PostgreSQL integration tests prove database enforcement.
- Every task follows TDD: failing test first, verify failure, minimal implementation, verify pass, commit.

---

## File Structure

**Modify**

- `backend/relay/models.py` — add Membership lifecycle fields, `PlatformRole`, Profile ownership, and model-level validation hooks that mirror PostgreSQL invariants.
- `backend/relay/permissions.py` — make active Membership and `PlatformRole` authoritative for authorization; remove global authority inference from Membership.
- `backend/relay/serializers.py` — replace broad participant `fields='__all__'` exposure with minimized participant write/read serializers and read-only ownership fields.
- `backend/relay/views.py` — authenticate participant endpoints, require explicit institution context, call transactional identity/write services, and preserve separate admin paths.
- `backend/relay/admin.py` — register `PlatformRole` and display Membership status safely if admin registration is already used for these models.
- `backend/relay/urls.py` or project router file — only if an explicit participant-profile provisioning endpoint is required by the existing router structure.
- `backend/relay/tests.py` — update legacy RBAC fixtures from Membership-based platform admins to `PlatformRole`; keep existing Green Wallet/RBAC behavior green.
- `supabase/MIGRATION_HISTORY.md` — only if the implementation requires documenting `0007/0008`; preserve the existing provenance warning verbatim or stronger, never weaken it.
- CI workflow under `.github/workflows/` — only if current CI does not execute PostgreSQL-specific security tests.

**Create**

- `backend/relay/services/participant_identity.py` — explicit institution-context resolution, owned Profile provisioning, transactional participant writes.
- `backend/relay/services/membership_security.py` — role-transition authorization, final-active-institution-admin protection, suspend/withdraw helpers.
- `backend/relay/services/security_preflight.py` — read-only tenant-invariant scanner used by migration preflight/tests/management command.
- `backend/relay/management/commands/security_preflight.py` — human/machine-readable preflight command with nonzero exit on violations.
- `backend/relay/migrations/0007_security_identity_foundation.py` — Membership lifecycle, `PlatformRole`, nullable `Profile.user`, conditional uniqueness, migration of legacy Membership platform-admin signal to PlatformRole.
- `backend/relay/migrations/0008_database_tenant_invariants.py` — PostgreSQL-only schema-qualified trigger functions and triggers; no-op trigger installation on SQLite.
- `backend/relay/tests_security_foundation.py` — SQLite/application/API identity, membership lifecycle, same-tenant participant isolation, projection, audit, role-transition tests.
- `backend/relay/tests_postgres_tenant_invariants.py` — PostgreSQL database-boundary adversarial tests.
- `docs/SECURITY_FOUNDATION.md` — operator-facing invariant, preflight, migration, rollback, and known-gap documentation.

---

### Task 1: Add failing identity and membership lifecycle model tests

**Files:**
- Create: `backend/relay/tests_security_foundation.py`
- Read: `backend/relay/models.py`
- Read: `backend/relay/tests.py`

**Interfaces:**
- Consumes: existing `Institution`, `Membership`, `Profile`, Django `User`.
- Produces test expectations for: `Membership.status`, `PlatformRole`, `Profile.user`, and conditional Profile uniqueness.

- [ ] **Step 1: Write failing tests for Membership lifecycle defaults and Profile ownership**

```python
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Institution, Membership, PlatformRole, Profile


class IdentityModelTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(
            name='Pasadena Fictional Institution',
            slug='pasadena-fictional',
            status='active',
        )
        self.user = User.objects.create_user(username='participant-a', password='pw')

    def test_membership_defaults_active(self):
        membership = Membership.objects.create(
            user=self.user,
            institution=self.institution,
            role='viewer',
        )
        self.assertEqual(membership.status, 'active')
        self.assertIsNotNone(membership.activated_at)
        self.assertIsNone(membership.deactivated_at)

    def test_profile_can_be_legacy_unclaimed(self):
        profile = Profile.objects.create(
            institution=self.institution,
            name='Legacy participant',
        )
        self.assertIsNone(profile.user_id)

    def test_one_authenticated_profile_per_user_per_institution(self):
        Membership.objects.create(
            user=self.user,
            institution=self.institution,
            role='viewer',
        )
        Profile.objects.create(user=self.user, institution=self.institution)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Profile.objects.create(user=self.user, institution=self.institution)

    def test_platform_role_is_global_not_tenant_membership(self):
        role = PlatformRole.objects.create(user=self.user, role='platform_admin', active=True)
        self.assertTrue(role.active)
        self.assertEqual(role.role, 'platform_admin')
```

- [ ] **Step 2: Run tests and verify they fail before model changes**

Run:

```bash
cd backend
python manage.py test relay.tests_security_foundation.IdentityModelTests -v 2
```

Expected: FAIL because `Membership.status`, `PlatformRole`, and `Profile.user` do not exist.

- [ ] **Step 3: Commit the failing tests**

```bash
git add backend/relay/tests_security_foundation.py
git commit -m "test: define security identity model contract"
```

---

### Task 2: Implement identity primitives and migration 0007

**Files:**
- Modify: `backend/relay/models.py`
- Create: `backend/relay/migrations/0007_security_identity_foundation.py`
- Test: `backend/relay/tests_security_foundation.py`

**Interfaces:**
- Produces: `Membership.is_active_for_authorization`, `PlatformRole`, `Profile.user`.
- Migration must convert legacy `Membership(role='platform_admin')` signal into a global `PlatformRole` row without deleting the source Membership.

- [ ] **Step 1: Add model fields and PlatformRole**

Implement the canonical shape:

```python
class Membership(TimestampedModel):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('withdrawn', 'Withdrawn'),
    ]
    # existing user/institution/role fields remain
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='active')
    activated_at = models.DateTimeField(auto_now_add=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    status_reason = models.CharField(max_length=255, blank=True)

    @property
    def is_active_for_authorization(self):
        return self.status == 'active' and self.institution.status == 'active'


class PlatformRole(TimestampedModel):
    ROLE_CHOICES = [('platform_admin', 'Platform admin')]
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='platform_role',
    )
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default='platform_admin')
    active = models.BooleanField(default=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='platform_roles_granted',
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
```

Add Profile ownership:

```python
class Profile(TimestampedModel):
    institution = models.ForeignKey(...)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='relay_profiles',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'institution'],
                condition=models.Q(user__isnull=False),
                name='unique_owned_profile_per_user_institution',
            ),
        ]
```

- [ ] **Step 2: Create migration 0007 with safe legacy platform-admin conversion**

Migration data function:

```python
def migrate_platform_admin_memberships(apps, schema_editor):
    Membership = apps.get_model('relay', 'Membership')
    PlatformRole = apps.get_model('relay', 'PlatformRole')
    for membership in Membership.objects.filter(role='platform_admin').iterator():
        PlatformRole.objects.get_or_create(
            user_id=membership.user_id,
            defaults={'role': 'platform_admin', 'active': True},
        )
```

Reverse data function removes only PlatformRole rows that migration can identify as originating from legacy platform-admin Memberships; do not mutate/delete Membership rows.

Migration dependency must be exactly:

```python
dependencies = [('relay', '0006_institutional_vertical_slice')]
```

- [ ] **Step 3: Run migration checks**

```bash
cd backend
python manage.py makemigrations --check --dry-run
python manage.py migrate relay 0007
python manage.py test relay.tests_security_foundation.IdentityModelTests -v 2
```

Expected: migration applies and IdentityModelTests PASS.

- [ ] **Step 4: Verify backward/forward migration on SQLite dev DB**

```bash
python manage.py migrate relay 0006
python manage.py migrate relay 0007
```

Expected: both commands succeed; reversing 0007 removes only new identity schema and leaves preexisting domain data intact.

- [ ] **Step 5: Commit**

```bash
git add backend/relay/models.py backend/relay/migrations/0007_security_identity_foundation.py backend/relay/tests_security_foundation.py
git commit -m "feat: add security identity foundation"
```

---

### Task 3: Replace Membership-derived global authority with PlatformRole and active-membership helpers

**Files:**
- Modify: `backend/relay/permissions.py`
- Modify: `backend/relay/serializers.py`
- Modify: `backend/relay/views.py`
- Modify: `backend/relay/tests.py`
- Test: `backend/relay/tests_security_foundation.py`

**Interfaces:**
- Produces: `active_memberships_for_user(user)`, `user_institution_ids(user)`, `user_is_platform_admin(user)`.

- [ ] **Step 1: Write failing authorization tests**

Add:

```python
class AuthorizationPrimitiveTests(TestCase):
    def test_inactive_membership_does_not_grant_tenant_access(self):
        membership = Membership.objects.create(
            user=self.user,
            institution=self.institution,
            role='viewer',
            status='suspended',
        )
        self.assertNotIn(
            self.institution.id,
            user_institution_ids(self.user),
        )

    def test_inactive_institution_does_not_grant_tenant_access(self):
        self.institution.status = 'inactive'
        self.institution.save(update_fields=['status'])
        Membership.objects.create(
            user=self.user,
            institution=self.institution,
            role='viewer',
        )
        self.assertNotIn(self.institution.id, user_institution_ids(self.user))

    def test_platform_admin_requires_platform_role(self):
        Membership.objects.create(
            user=self.user,
            institution=self.institution,
            role='platform_admin',
        )
        self.assertFalse(user_is_platform_admin(self.user))
        PlatformRole.objects.create(user=self.user, active=True)
        self.assertTrue(user_is_platform_admin(self.user))
```

- [ ] **Step 2: Verify failures**

```bash
cd backend
python manage.py test relay.tests_security_foundation.AuthorizationPrimitiveTests -v 2
```

Expected: FAIL under the legacy Membership-based implementation.

- [ ] **Step 3: Implement helpers**

```python
def active_memberships_for_user(user):
    if not user or not user.is_authenticated:
        return Membership.objects.none()
    return Membership.objects.filter(
        user=user,
        status='active',
        institution__status='active',
    )


def user_institution_ids(user):
    return set(active_memberships_for_user(user).values_list('institution_id', flat=True))


def user_is_platform_admin(user):
    if not user or not user.is_authenticated:
        return False
    return PlatformRole.objects.filter(
        user=user,
        role='platform_admin',
        active=True,
    ).exists()
```

Replace direct serializer Membership queries for platform admin/tenant access with these helpers. Update existing RBAC test fixtures so `self.platform_admin` gets a `PlatformRole` rather than relying on Membership role alone.

- [ ] **Step 4: Run legacy and new authorization tests**

```bash
python manage.py test relay.tests relay.tests_security_foundation.AuthorizationPrimitiveTests -v 2
```

Expected: all existing Green Wallet/RBAC tests and new primitive tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/relay/permissions.py backend/relay/serializers.py backend/relay/views.py backend/relay/tests.py backend/relay/tests_security_foundation.py
git commit -m "fix: separate platform and tenant authorization"
```

---

### Task 4: Implement protected Membership transitions and final-admin invariant

**Files:**
- Create: `backend/relay/services/membership_security.py`
- Modify: `backend/relay/models.py` only if DB/model helper is needed
- Test: `backend/relay/tests_security_foundation.py`

**Interfaces:**
- Produces:
  - `change_membership_role(*, actor, membership, new_role, reason='')`
  - `set_membership_status(*, actor, membership, new_status, reason='')`
  - `delete_membership(*, actor, membership, reason='')`
  - `MembershipSecurityError`

- [ ] **Step 1: Write failing transition tests**

```python
class MembershipTransitionTests(TestCase):
    def test_last_active_institution_admin_cannot_be_suspended(self):
        with self.assertRaises(MembershipSecurityError):
            set_membership_status(
                actor=self.admin_user,
                membership=self.admin_membership,
                new_status='suspended',
                reason='test',
            )

    def test_admin_cannot_change_own_role(self):
        with self.assertRaises(MembershipSecurityError):
            change_membership_role(
                actor=self.admin_user,
                membership=self.admin_membership,
                new_role='viewer',
            )

    def test_program_staff_cannot_promote_viewer(self):
        with self.assertRaises(MembershipSecurityError):
            change_membership_role(
                actor=self.staff_user,
                membership=self.viewer_membership,
                new_role='institution_admin',
            )
```

Also cover delete, withdraw, demote, and institution reassignment of the last active institution admin.

- [ ] **Step 2: Verify failures**

```bash
python manage.py test relay.tests_security_foundation.MembershipTransitionTests -v 2
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement transition service transactionally**

Core invariant helper:

```python
def _active_admin_count(institution_id, *, exclude_membership_id=None):
    qs = Membership.objects.select_for_update().filter(
        institution_id=institution_id,
        role='institution_admin',
        status='active',
    )
    if exclude_membership_id is not None:
        qs = qs.exclude(pk=exclude_membership_id)
    return qs.count()
```

Every destructive/demotion transition must execute in `transaction.atomic()`, lock the target Membership, confirm actor authority through an active Membership or active PlatformRole, reject self-role mutation, and prevent resulting active-admin count from reaching zero.

Write an `AssessmentAuditEvent` in the same transaction for successful membership changes.

- [ ] **Step 4: Run tests**

```bash
python manage.py test relay.tests_security_foundation.MembershipTransitionTests -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/relay/services/membership_security.py backend/relay/tests_security_foundation.py backend/relay/models.py
git commit -m "feat: protect membership role transitions"
```

---

### Task 5: Implement explicit participant context and safe Profile provisioning

**Files:**
- Create: `backend/relay/services/participant_identity.py`
- Modify: `backend/relay/serializers.py`
- Modify: `backend/relay/views.py`
- Test: `backend/relay/tests_security_foundation.py`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class ParticipantContext:
    user: User
    institution: Institution
    membership: Membership
    profile: Profile | None


def resolve_participant_context(*, user, institution_id, require_profile=True) -> ParticipantContext: ...
def provision_participant_profile(*, user, institution_id, profile_data) -> Profile: ...
def create_route_signal(*, user, institution_id, payload) -> RouteSignal: ...
def create_ev_participant_signal(*, user, institution_id, payload) -> EVParticipantSignal: ...
```

- [ ] **Step 1: Write failing context/provisioning tests**

```python
class ParticipantIdentityServiceTests(TestCase):
    def test_multi_membership_requires_explicit_institution(self):
        with self.assertRaises(ParticipantContextError):
            resolve_participant_context(user=self.user, institution_id=None)

    def test_suspended_membership_cannot_resolve_context(self):
        self.membership.status = 'suspended'
        self.membership.save(update_fields=['status'])
        with self.assertRaises(ParticipantContextError):
            resolve_participant_context(user=self.user, institution_id=self.institution.id)

    def test_provisioning_never_claims_unowned_profile_by_email(self):
        legacy = Profile.objects.create(
            institution=self.institution,
            email=self.user.email,
            name='Legacy',
        )
        created = provision_participant_profile(
            user=self.user,
            institution_id=self.institution.id,
            profile_data={'name': 'Owned participant'},
        )
        self.assertNotEqual(created.pk, legacy.pk)
        self.assertEqual(created.user_id, self.user.id)
```

- [ ] **Step 2: Verify failures**

```bash
python manage.py test relay.tests_security_foundation.ParticipantIdentityServiceTests -v 2
```

Expected: FAIL because participant identity service does not exist.

- [ ] **Step 3: Implement context resolution without `.first()`**

```python
def resolve_participant_context(*, user, institution_id, require_profile=True):
    if not user or not user.is_authenticated:
        raise ParticipantContextError('authentication_required')
    if institution_id is None:
        raise ParticipantContextError('institution_context_required')

    membership = Membership.objects.select_related('institution').get(
        user=user,
        institution_id=institution_id,
        status='active',
        institution__status='active',
    )
    profile = Profile.objects.filter(user=user, institution_id=institution_id).one_or_none()
    if require_profile and profile is None:
        raise ParticipantContextError('profile_required')
    return ParticipantContext(user=user, institution=membership.institution, membership=membership, profile=profile)
```

Do not literally use `.one_or_none()` unless an existing helper provides it; in Django use `get()` and handle `DoesNotExist`/`MultipleObjectsReturned` explicitly.

- [ ] **Step 4: Implement provisioning atomically**

Use `transaction.atomic()` and `Membership.objects.select_for_update()` to re-check active authorization at commit time. Create a new Profile only; never search unclaimed Profiles by email/name. Emit `profile.provisioned` audit event.

- [ ] **Step 5: Run tests**

```bash
python manage.py test relay.tests_security_foundation.ParticipantIdentityServiceTests -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/relay/services/participant_identity.py backend/relay/tests_security_foundation.py
git commit -m "feat: add participant identity resolution"
```

---

### Task 6: Harden participant serializers and self-service API ownership

**Files:**
- Modify: `backend/relay/serializers.py`
- Modify: `backend/relay/views.py`
- Modify: router/URLs only if required
- Test: `backend/relay/tests_security_foundation.py`

**Interfaces:**
- Consumes participant identity service from Task 5.
- Produces authenticated participant self-service POST behavior with server-owned `user`, `profile`, and `institution` fields.

- [ ] **Step 1: Write failing API isolation tests**

```python
class ParticipantApiIsolationTests(APITestCase):
    def test_unauthenticated_profile_submission_rejected(self):
        response = self.client.post('/api/profiles/', {'name': 'Alice'}, format='json')
        self.assertIn(response.status_code, (401, 403))

    def test_route_signal_rejects_same_tenant_other_participant_profile(self):
        self.client.force_authenticate(self.alice)
        response = self.client.post('/api/route-signals/', {
            'institution': self.institution.id,
            'profile': self.bob_profile.id,
            'origin_zone': 'Eagle Rock',
            'destination_zone': 'Pasadena',
        }, format='json', HTTP_X_RELAY_INSTITUTION=str(self.institution.id))
        self.assertIn(response.status_code, (400, 403))
        self.assertFalse(RouteSignal.objects.filter(profile=self.bob_profile).exists())

    def test_platform_admin_cannot_impersonate_participant_endpoint(self):
        self.client.force_authenticate(self.platform_admin)
        response = self.client.post('/api/route-signals/', {
            'profile': self.bob_profile.id,
            'origin_zone': 'Eagle Rock',
        }, format='json', HTTP_X_RELAY_INSTITUTION=str(self.institution.id))
        self.assertIn(response.status_code, (400, 403))
```

Use the project’s actual institution-context transport when implementing. If none exists, choose one explicit mechanism (URL parameter or documented request header) and keep it consistent; do not infer institution with `.first()`.

- [ ] **Step 2: Verify failures**

```bash
python manage.py test relay.tests_security_foundation.ParticipantApiIsolationTests -v 2
```

Expected: FAIL because current create-only participant endpoints are unauthenticated and accept broad serializer fields.

- [ ] **Step 3: Replace broad participant serializers**

Profile participant write fields should be explicit, e.g.:

```python
class ParticipantProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ('id', 'name', 'role', 'home_zone', 'destination_zone')
        read_only_fields = ('id',)
```

RouteSignal write fields should exclude `institution` and `profile` from client authority:

```python
class ParticipantRouteSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteSignal
        fields = (
            'id', 'origin_zone', 'destination_zone', 'departure_window',
            'proposed_contribution', 'status',
        )
        read_only_fields = ('id', 'status')
```

Do the same for EV participant signals. Preserve separate admin/internal serializers if existing administrative code requires richer fields.

- [ ] **Step 4: Authenticate participant views and delegate writes to services**

```python
class ProfileViewSet(CreateOnlyViewSet):
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        institution_id = resolve_request_institution_id(self.request)
        self.instance = provision_participant_profile(
            user=self.request.user,
            institution_id=institution_id,
            profile_data=serializer.validated_data,
        )
```

For RouteSignal/EVParticipantSignal, service code must ignore client-supplied ownership identifiers and persist the authenticated user’s owned Profile/institution only.

- [ ] **Step 5: Run participant API tests and existing API suite**

```bash
python manage.py test relay.tests_security_foundation.ParticipantApiIsolationTests relay.tests -v 2
```

Expected: PASS with no Green Wallet/RBAC regressions.

- [ ] **Step 6: Commit**

```bash
git add backend/relay/serializers.py backend/relay/views.py backend/relay/tests_security_foundation.py
git commit -m "fix: enforce participant self-service ownership"
```

---

### Task 7: Add minimized participant/admin projections and security audit events

**Files:**
- Modify: `backend/relay/serializers.py`
- Modify: `backend/relay/views.py`
- Modify: `backend/relay/services/participant_identity.py`
- Modify: `backend/relay/services/membership_security.py`
- Test: `backend/relay/tests_security_foundation.py`

**Interfaces:**
- Produces separate participant-safe serializers and admin-safe serializer/projection behavior.
- Reuses `AssessmentAuditEvent`; creates no second audit model.

- [ ] **Step 1: Write failing projection/audit tests**

```python
class ProjectionAndAuditTests(APITestCase):
    def test_admin_projection_omits_raw_source_payload_and_unneeded_identity(self):
        response = self.client.get(self.admin_projection_url)
        self.assertNotIn('source_payload', response.data[0])
        self.assertNotIn('email', response.data[0])

    def test_profile_provisioning_emits_minimal_audit_event(self):
        profile = provision_participant_profile(
            user=self.user,
            institution_id=self.institution.id,
            profile_data={'name': 'Alice'},
        )
        event = AssessmentAuditEvent.objects.get(
            action='profile.provisioned',
            entity_id=str(profile.pk),
        )
        self.assertEqual(event.actor_id, self.user.id)
        self.assertNotIn('email', event.metadata)
```

If no existing participant/admin detail endpoint exposes these models, test serializers/projection functions directly rather than expanding product scope solely to satisfy the test.

- [ ] **Step 2: Verify failures**

```bash
python manage.py test relay.tests_security_foundation.ProjectionAndAuditTests -v 2
```

Expected: FAIL until explicit projections/audit events exist.

- [ ] **Step 3: Implement explicit field-minimized serializers/projections**

Participant: own Profile/RouteSignal/EVParticipantSignal and participant-safe status only.

Institution admin: general zones, schedule windows, current mode, parking difficulty, EV/hybrid signal, Access Point willingness, validation/program status only. Do not expose raw `source_payload`, unnecessary email/identity, or audit metadata by default.

- [ ] **Step 4: Emit audit events in the same transaction as successful security-sensitive changes**

Approved action names:

```text
membership.created
membership.role_changed
membership.suspended
membership.withdrawn
profile.provisioned
profile.ownership_linked
profile.ownership_unlinked
participant.route_signal_created
participant.ev_signal_created
platform_admin.accessed_tenant_resource
```

For rejected security events, log only at bounded/high-value boundaries and store reason codes plus identifiers, not commute payloads.

- [ ] **Step 5: Run tests**

```bash
python manage.py test relay.tests_security_foundation.ProjectionAndAuditTests -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/relay/serializers.py backend/relay/views.py backend/relay/services/participant_identity.py backend/relay/services/membership_security.py backend/relay/tests_security_foundation.py
git commit -m "feat: minimize security projections and audit identity actions"
```

---

### Task 8: Build a read-only tenant-invariant preflight scanner

**Files:**
- Create: `backend/relay/services/security_preflight.py`
- Create: `backend/relay/management/commands/security_preflight.py`
- Test: `backend/relay/tests_security_foundation.py`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class InvariantViolation:
    table: str
    primary_key: str
    invariant: str
    expected_institution: int | None
    actual_institution: int | None
    related_entity: str


def scan_tenant_invariants(using='default') -> list[InvariantViolation]: ...
```

- [ ] **Step 1: Write failing scanner tests**

Use SQLite-valid ORM fixtures to construct any inconsistent rows that the current schema permits and assert the scanner reports, never repairs, them.

```python
violations = scan_tenant_invariants()
self.assertTrue(any(v.invariant == 'cohort_site_institution_match' for v in violations))
cohort.refresh_from_db()
self.assertEqual(cohort.institution_id, original_institution_id)
```

- [ ] **Step 2: Verify failure**

```bash
python manage.py test relay.tests_security_foundation.SecurityPreflightTests -v 2
```

- [ ] **Step 3: Implement scanner for every approved invariant**

Scan:

```text
Cohort ↔ Site
DataSource ↔ Site
CommuteImport ↔ Site/Cohort/DataSource
CommuterRecord ↔ Site/Cohort/CommuteImport
EngineScore ↔ Site/Cohort/CommuterRecord
Rule2202CalculationRun ↔ Site/Cohort/CommuteImport
DecisionCard ↔ Site/Cohort/CommuteImport/Rule2202CalculationRun
owned Profile ↔ active matching Membership
RouteSignal ↔ Profile
EVParticipantSignal ↔ Profile
```

Return identifiers only; never copy `source_payload` or participant-sensitive fields into violation output.

- [ ] **Step 4: Implement management command**

Behavior:

```bash
python manage.py security_preflight --format=json
```

Exit 0 with `[]` if clean. Raise `CommandError` after printing violations if any exist. No `--fix` flag is allowed.

- [ ] **Step 5: Run tests**

```bash
python manage.py test relay.tests_security_foundation.SecurityPreflightTests -v 2
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/relay/services/security_preflight.py backend/relay/management/commands/security_preflight.py backend/relay/tests_security_foundation.py
git commit -m "feat: add tenant security preflight"
```

---

### Task 9: Define failing PostgreSQL database-boundary adversarial tests

**Files:**
- Create: `backend/relay/tests_postgres_tenant_invariants.py`

**Interfaces:**
- Consumes models and migrations 0007.
- Produces the exact database behavior required from migration 0008.

- [ ] **Step 1: Add PostgreSQL-only test base**

```python
from django.db import connection
from django.test import TransactionTestCase
from unittest import skipUnless


@skipUnless(connection.vendor == 'postgresql', 'PostgreSQL tenant-boundary test')
class PostgreSQLTenantInvariantTests(TransactionTestCase):
    reset_sequences = True
```

- [ ] **Step 2: Add raw ORM and bulk bypass tests**

Test each category:

```python
with self.assertRaises(Exception):
    Cohort.objects.create(
        institution=self.institution_b,
        site=self.site_a,
        name='Injected',
        slug='injected',
    )

with self.assertRaises(Exception):
    Cohort.objects.filter(pk=self.cohort_a.pk).update(institution_id=self.institution_b.pk)

self.cohort_a.institution_id = self.institution_b.pk
with self.assertRaises(Exception):
    Cohort.objects.bulk_update([self.cohort_a], ['institution'])
```

Add FK-ID reassignment and raw SQL insert/update cases.

- [ ] **Step 3: Add parent reassignment/delete/cascade tests**

Verify Site institution reassignment fails when descendants would conflict. Verify approved CASCADE/PROTECT/SET_NULL operations do not leave cross-tenant descendants. Do not broaden deletion semantics in this task.

- [ ] **Step 4: Run PostgreSQL tests before 0008 and verify they fail**

Use the repository’s PostgreSQL integration environment. Minimum command target:

```bash
cd backend
python manage.py test relay.tests_postgres_tenant_invariants -v 2
```

Expected: security tests FAIL because database triggers are not yet installed.

- [ ] **Step 5: Commit failing PostgreSQL tests**

```bash
git add backend/relay/tests_postgres_tenant_invariants.py
git commit -m "test: define postgres tenant boundary contract"
```

---

### Task 10: Implement migration 0008 PostgreSQL tenant guards

**Files:**
- Create: `backend/relay/migrations/0008_database_tenant_invariants.py`
- Test: `backend/relay/tests_postgres_tenant_invariants.py`
- Consume: `backend/relay/services/security_preflight.py`

**Interfaces:**
- Produces schema-qualified trigger functions/triggers in `relay_app`.
- Must not create or modify functions in `public` except reading related rows where existing schema contract explicitly requires it; this migration should only operate on Relay Rider Django tables.

- [ ] **Step 1: Add migration preflight gate**

Use a `RunPython` operation before trigger installation. If `scan_tenant_invariants()` returns any row, raise `RuntimeError` with table/PK/invariant identifiers only. Do not repair data.

- [ ] **Step 2: Implement vendor-aware trigger installation**

Pattern:

```python
def install_tenant_guards(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(POSTGRES_INSTALL_SQL)


def remove_tenant_guards(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(POSTGRES_REMOVE_SQL)
```

- [ ] **Step 3: Harden each trigger function**

Each function must use explicit schema qualification and a controlled search path, e.g.:

```sql
CREATE OR REPLACE FUNCTION relay_app.rr_guard_cohort_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, relay_app
AS $$
BEGIN
  IF NEW.site_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM relay_app.relay_site s
    WHERE s.id = NEW.site_id
      AND s.institution_id = NEW.institution_id
  ) THEN
    RAISE EXCEPTION 'RR_TENANT_INVARIANT cohort_site_institution_match';
  END IF;
  RETURN NEW;
END;
$$;
```

Use the actual Django table names determined from migration state; do not assume them if `db_table` differs.

Install guards for all approved invariants and reverse-direction parent changes that could invalidate descendants.

- [ ] **Step 4: Add Profile/Membership database guard**

When `Profile.user_id IS NOT NULL`, PostgreSQL must require a matching Membership for the Profile institution. The application layer additionally requires that Membership to be active for authorization; the database guard should enforce structural ownership consistency without making historical Profiles invalid merely because a Membership is later suspended/withdrawn.

Guard Membership deletion/reassignment if it would leave an authenticated Profile with no matching membership. Suspension/withdrawal remains allowed because authorization is revoked at the service/permission layer while provenance is preserved.

- [ ] **Step 5: Apply migration and run PostgreSQL adversarial suite**

```bash
python manage.py migrate relay 0008
python manage.py test relay.tests_postgres_tenant_invariants -v 2
```

Expected: PASS for raw ORM, `QuerySet.update`, `bulk_update`, FK-ID reassignment, raw SQL, and parent-reassignment attacks.

- [ ] **Step 6: Verify migration backward/forward**

```bash
python manage.py migrate relay 0007
python manage.py migrate relay 0008
```

Expected: reverse removes only new trigger functions/triggers; forward reinstalls them; Rule 2202 functions remain untouched.

- [ ] **Step 7: Commit**

```bash
git add backend/relay/migrations/0008_database_tenant_invariants.py backend/relay/tests_postgres_tenant_invariants.py
git commit -m "feat: enforce postgres tenant invariants"
```

---

### Task 11: Mirror cross-tenant validation in Django for SQLite/application paths

**Files:**
- Modify: `backend/relay/models.py` and/or create focused validation helpers under `backend/relay/services/`
- Test: `backend/relay/tests_security_foundation.py`

**Interfaces:**
- Produces validation functions invoked by normal application writes.
- Does not claim SQLite can block `QuerySet.update()`/bulk SQL bypasses; those guarantees belong to PostgreSQL tests.

- [ ] **Step 1: Write failing application validation tests**

For each canonical relationship, instantiate invalid data and call the application write path; assert `ValidationError` before persistence.

```python
with self.assertRaises(ValidationError):
    validate_cohort_tenant_consistency(
        institution=self.institution_b,
        site=self.site_a,
    )
```

- [ ] **Step 2: Implement focused validators**

Keep one reusable assertion per relationship, for example:

```python
def require_same_institution(*pairs):
    ids = {institution_id for _, institution_id in pairs if institution_id is not None}
    if len(ids) > 1:
        raise ValidationError('Cross-institution relationship is not permitted.')
```

Relationship-specific validators must resolve parent institutions rather than trusting duplicate child institution IDs.

- [ ] **Step 3: Wire validators into service/serializer/model paths that perform normal writes**

Do not override unrelated behavior. Avoid a broad `save()` override unless necessary; service/serializer validation should be the primary application path, with PostgreSQL as the bypass-proof layer.

- [ ] **Step 4: Run SQLite security suite**

```bash
python manage.py test relay.tests_security_foundation -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/relay/models.py backend/relay/services backend/relay/tests_security_foundation.py
git commit -m "fix: mirror tenant invariants in django validation"
```

---

### Task 12: Add concurrency/revocation and platform-admin non-impersonation adversarial tests

**Files:**
- Modify: `backend/relay/tests_security_foundation.py`
- Modify: `backend/relay/tests_postgres_tenant_invariants.py` if transaction-level behavior requires PostgreSQL
- Modify implementation only as failures require.

**Interfaces:**
- Consumes Task 5 transactional participant services and Task 4 membership transition service.

- [ ] **Step 1: Add revocation-before-write test**

Test the service re-checks the locked Membership inside the write transaction rather than trusting stale request authorization. Use a transaction test or mocked interleaving that changes status before the persistence step.

Expected persisted RouteSignal/EVParticipantSignal count: zero after revocation wins.

- [ ] **Step 2: Add inactive Membership API tests**

Suspend and withdraw memberships, then assert participant endpoints and tenant-scoped admin endpoints deny access as specified.

- [ ] **Step 3: Add platform-admin behavior tests**

Assert:

```text
PlatformRole active + admin endpoint → allowed where policy permits
PlatformRole active + Bob participant endpoint → denied
PlatformRole revoked → global bypass denied
legacy Membership(role=platform_admin) without PlatformRole → no global bypass
```

- [ ] **Step 4: Run all security tests**

```bash
python manage.py test relay.tests_security_foundation relay.tests_postgres_tenant_invariants -v 2
```

Expected: PASS in PostgreSQL environment; PostgreSQL-only class skips under SQLite without being counted as database proof.

- [ ] **Step 5: Commit**

```bash
git add backend/relay/tests_security_foundation.py backend/relay/tests_postgres_tenant_invariants.py backend/relay/services backend/relay/permissions.py backend/relay/views.py
git commit -m "test: prove revocation and non-impersonation boundaries"
```

---

### Task 13: Preserve legacy behavior and migration-history provenance

**Files:**
- Modify: `backend/relay/tests.py`
- Modify: `supabase/MIGRATION_HISTORY.md` only to append new local Django security migration context if needed
- Test: complete backend suite

**Interfaces:**
- Confirms no Rule 2202 or migration-anchor behavior changed.

- [ ] **Step 1: Add/adjust regression assertions**

Update existing legacy RBAC fixtures to create `PlatformRole` for platform-admin tests. Add an assertion that Membership role alone is insufficient for global authority.

- [ ] **Step 2: Verify migration provenance warning remains intact**

Search:

```bash
grep -n "replay\|anchor\|historical\|provenance" supabase/MIGRATION_HISTORY.md
```

Expected: warning still states that historical recovery anchors reconcile version tracking and do not constitute complete replayable historical SQL.

Do not edit historical `.sql` anchors.

- [ ] **Step 3: Verify Rule 2202 files unchanged**

```bash
git diff main...HEAD -- supabase/migrations backend/relay/services/rule2202.py
```

Expected: no Rule 2202 formula/function modification and no historical-anchor edits. If `supabase/MIGRATION_HISTORY.md` is changed, only documentation lines describing the Django security migrations may differ.

- [ ] **Step 4: Run full backend suite**

```bash
cd backend
python manage.py test -v 2
python manage.py check
python manage.py makemigrations --check --dry-run
```

Expected: PASS.

- [ ] **Step 5: Commit documentation/regression adjustments**

```bash
git add backend/relay/tests.py supabase/MIGRATION_HISTORY.md
git commit -m "docs: preserve security migration provenance"
```

Skip `supabase/MIGRATION_HISTORY.md` from the commit if no edit is needed.

---

### Task 14: Ensure CI proves PostgreSQL security boundary

**Files:**
- Inspect/modify: `.github/workflows/*`
- Test: CI-equivalent local commands

**Interfaces:**
- Produces a required PostgreSQL test job or extends an existing PostgreSQL integration job to run `relay.tests_postgres_tenant_invariants`.

- [ ] **Step 1: Inspect existing workflow for PostgreSQL service/test invocation**

If an existing job already provisions PostgreSQL 17 and runs the entire Django suite, do not add a duplicate job. Add only an explicit assertion/command ensuring PostgreSQL security tests run.

- [ ] **Step 2: If needed, add PostgreSQL 17 service and environment**

Use the project’s existing DB environment variables. Do not add production credentials or Supabase production access to CI.

- [ ] **Step 3: Run equivalent local PostgreSQL commands**

```bash
python manage.py migrate
python manage.py security_preflight --format=json
python manage.py test relay.tests_postgres_tenant_invariants -v 2
python manage.py test -v 2
```

Expected: preflight clean; all tests PASS.

- [ ] **Step 4: Commit only if workflow changed**

```bash
git add .github/workflows
git commit -m "ci: prove postgres tenant security boundary"
```

---

### Task 15: Document operation, rollback, invariants, and remaining gap

**Files:**
- Create: `docs/SECURITY_FOUNDATION.md`
- Read: approved spec and both migrations

**Interfaces:**
- Produces operator/reviewer documentation used for PR acceptance.

- [ ] **Step 1: Document exact invariants**

Include every enforced relationship, active-Membership rule, last-active-institution-admin rule, Profile ownership rule, platform-admin non-impersonation rule, and field-minimization rule.

- [ ] **Step 2: Document preflight**

Provide exact command:

```bash
cd backend
python manage.py security_preflight --format=json
```

State explicitly: reports only, does not repair, nonzero exit on violation.

- [ ] **Step 3: Document rollback**

Required sequence:

```bash
python manage.py migrate relay 0007  # removes 0008 PostgreSQL guards only
python manage.py migrate relay 0006  # removes 0007 identity schema
```

Explain that reversing `0007` removes new Profile-user ownership links because the column is removed, while preexisting Profiles/domain records remain. Require an ownership-link export before intentional rollback in any environment containing real ownership assignments.

- [ ] **Step 4: Document unresolved security/privacy gap**

Include exactly:

```text
[NEEDS FOUNDER INPUT: participant data-retention/anonymization period after withdrawal]
```

Also report any discovered deletion/auditability problem rather than silently broadening schema behavior.

- [ ] **Step 5: Commit**

```bash
git add docs/SECURITY_FOUNDATION.md
git commit -m "docs: document Relay Rider security foundation"
```

---

### Task 16: Final verification and PR evidence package

**Files:**
- No product code unless verification uncovers a defect; defects return to the responsible task with a failing regression test first.

**Interfaces:**
- Produces objective merge-readiness evidence; does not merge the branch.

- [ ] **Step 1: Verify branch scope**

```bash
git diff --name-status main...HEAD
```

Expected: only security-foundation code/tests/docs/migrations and any necessary CI workflow changes. No donor PR files copied wholesale.

- [ ] **Step 2: Verify forbidden domain duplicates were not introduced**

```bash
grep -R "class Program\|class Assessment" backend/relay || true
```

Manually confirm no duplicate Site/Cohort/DecisionCard/Rule2202CalculationRun/CommuterRecord class was added.

- [ ] **Step 3: Run migration forward/backward proof on PostgreSQL**

```bash
python manage.py migrate relay 0006
python manage.py migrate relay 0007
python manage.py migrate relay 0008
python manage.py security_preflight --format=json
python manage.py migrate relay 0007
python manage.py migrate relay 0006
python manage.py migrate relay 0008
```

Expected: forward, reverse, and reapply all succeed on a disposable PostgreSQL database. After reapply, preflight is clean.

- [ ] **Step 4: Run complete backend verification**

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test -v 2
```

Then run the repository’s established dependency/security/CodeQL checks if they are part of current CI.

- [ ] **Step 5: Capture evidence**

Record:

```text
branch SHA
0007 forward/backward/reapply result
0008 forward/backward/reapply result
preflight result
SQLite/application suite count and result
PostgreSQL adversarial suite count and result
legacy backend suite count and result
CI/security scan result
all failed attempts and fixes
remaining identity/privacy gaps
rollback procedure
confirmation Rule 2202 formulas untouched
confirmation Supabase historical anchors untouched
```

- [ ] **Step 6: Request code review before PR merge**

Use `superpowers:requesting-code-review`. Review specifically:

```text
PlatformRole migration semantics
last-active-institution-admin race safety
participant context and profile ownership
same-tenant cross-participant isolation
PostgreSQL trigger reverse-direction coverage
trigger search_path and schema qualification
preflight completeness
rollback data-loss note for Profile.user
legacy RBAC regression behavior
Rule 2202 / historical migration non-diff
```

- [ ] **Step 7: Open a development PR only after verification passes**

PR title recommendation:

```text
Harden participant ownership and tenant security foundation
```

Do not label it operational or production-ready unless the complete proof chain passes.

---

## Plan Self-Review

**Spec coverage:** Every approved design area maps to a task: Membership lifecycle and final-admin protection (Tasks 2/4), PlatformRole separation (Tasks 2/3), Profile ownership/provisioning (Tasks 2/5/6), transactional writes and revocation (Tasks 5/12), minimized projections/auditing (Task 7), preflight (Task 8), PostgreSQL boundary (Tasks 9/10), SQLite validation (Task 11), rollback/provenance (Tasks 13/15/16), and adversarial verification (Tasks 9/12/16).

**No scope expansion:** No Program/Assessment model, no donor PR merge, no Rule 2202 formula change, no historical migration-anchor reconstruction, no admin-on-behalf-of participant workflow, and no invented retention schedule.

**Important implementation caution:** The database structural invariant for an owned Profile should require a matching `(user, institution)` Membership row, but it should not require that Membership to remain `active`; otherwise suspending/withdrawing a participant would conflict with the approved rule to preserve historical Profile linkage. Active state is an authorization invariant enforced in services/permissions, while matching Membership existence is the database ownership-consistency invariant.
