# Relay Rider Security Foundation Design

Date: 2026-09-05
Status: Approved design, implementation not started
Branch: `security/foundation-identity-tenancy`

## Objective

Harden Relay Rider's canonical Django/PostgreSQL persistence model after PR #52 without merging PR #53, #29, or #34 and without introducing duplicate Institution, Site, Cohort, Program, Assessment, DecisionCard, Rule2202CalculationRun, or commuter-record models.

This change establishes authenticated participant ownership, active membership semantics, database-enforced tenant consistency, protected membership transitions, explicit platform-admin authority, auditable identity actions, and adversarial verification while preserving the `relay_app` schema boundary, PostgreSQL-only Rule 2202 formulas, and all migration-history provenance warnings.

## Canonical architecture boundary

Current `main` after PR #52 remains the sole persistence authority.

Canonical hierarchy remains:

```text
Institution
   ├── Membership
   └── Site
        └── Cohort
             ├── DataSource
             └── CommuteImport
                    └── CommuterRecord
                           └── EngineScore

CommuteImport
   └── Rule2202CalculationRun
          └── DecisionCard

Everything security-relevant → AssessmentAuditEvent
```

No donor-branch migrations or duplicate domain models may be transplanted.

## Identity model

### Membership lifecycle

Extend the existing `Membership` model with lifecycle state rather than replacing it.

Required states:

- `active`
- `suspended`
- `withdrawn`

Authorization requires both:

```text
Membership.status == active
Institution.status == active
```

Suspended or withdrawn memberships confer no participant or tenant authorization. Membership rows are retained for provenance rather than deleted as part of ordinary suspension/withdrawal.

Recommended fields:

- `status`
- `activated_at`
- `deactivated_at`
- `status_reason`

### Final institution-admin protection

The current role vocabulary has no explicit owner role. The security foundation therefore protects the last active `institution_admin` for an institution.

Reject any transition that would leave an institution with zero active institution administrators, including:

- deletion of the last active institution admin
- suspension of the last active institution admin
- withdrawal of the last active institution admin
- demotion of the last active institution admin
- reassignment of the last active institution admin to another institution

Users may not promote or demote their own Membership directly.

Role-transition authority:

- `institution_admin`: may manage `program_staff` and `viewer`; institution-admin promotion/demotion must pass protected membership service rules
- `program_staff`: cannot mutate membership roles
- `viewer`: cannot mutate membership roles
- participant Profile ownership: gives no membership-management authority

### Platform-admin separation

Global platform authority must no longer be inferred from any tenant Membership row.

Introduce a small global authorization primitive, recommended as `PlatformRole`, with one row per user and explicit active/revoked state.

Recommended fields:

- `user` one-to-one
- `role` with `platform_admin`
- `active`
- `granted_by`
- `granted_at`
- `revoked_at`

Existing `Membership(role='platform_admin')` rows may be migration inputs for creating equivalent `PlatformRole` rows, but after migration global platform authority must be resolved from `PlatformRole`, not Membership.

`platform_admin` must not imply participant impersonation. Platform admins may use explicitly authorized administrative/read workflows but may not create, update, or delete participant-owned records through participant self-service endpoints on another participant's behalf.

## Profile ownership

Add nullable authenticated-user ownership to the existing `Profile` model:

```text
Profile.user → AUTH_USER_MODEL
nullable = true
on_delete = SET_NULL
```

Add conditional uniqueness:

```text
UNIQUE(user_id, institution_id)
WHERE user_id IS NOT NULL
```

This supports at most one authenticated participant Profile per user per institution while preserving historical/unclaimed Profiles.

No existing Profile may be claimed automatically by email, name, phone, or similar matching.

## Profile provisioning

An authenticated user with an active Membership may explicitly provision a new participant Profile for the selected institution if one does not already exist.

The server, not the client, assigns:

- `user = request.user`
- `institution = resolved active institution`

Existing unclaimed Profiles require a separate explicit claim workflow using a single-use claim token or administrator-reviewed linkage. Such a claim flow is outside this security-foundation implementation unless separately approved.

## Participant authorization flow

Participant self-service authorization must enforce both tenant authorization and record ownership.

```text
request.user
   ↓
explicit institution context
   ↓
active Membership in active Institution
   ↓
Profile(user=request.user, institution=selected institution)
   ↓
participant-owned RouteSignal / EVParticipantSignal
```

A small service should resolve participant identity consistently:

```text
resolve_participant_context(user, institution_id) -> ParticipantContext
```

Conceptual result:

```text
user
membership
institution
profile
```

The service must fail closed when:

- user is unauthenticated
- no active Membership exists
- Institution is inactive
- no owned Profile exists outside an explicit provisioning flow
- multiple institution memberships exist and no explicit institution context is provided
- Profile ownership conflicts with Membership

Never use `.first()` membership selection for participant authorization.

## Transactional writes

Participant Profile, RouteSignal, and EVParticipantSignal writes must run transactionally.

Sensitive write sequence:

```text
begin transaction
  lock/read active Membership
  resolve owned Profile
  validate Institution
  save participant-owned record
  write audit event
commit
```

Use row locking where appropriate so membership revocation or ownership changes cannot race a privileged write.

## Participant withdrawal and suspension

Suspension immediately revokes participant and tenant authorization while preserving historical records and Profile linkage.

Withdrawal immediately revokes self-service authorization and new route-interest processing. Historical institutional evidence remains preserved subject to future retention policy.

Do not automatically anonymize or delete historical data in this PR.

`[NEEDS FOUNDER INPUT: participant data-retention/anonymization period after withdrawal]`

## Field-minimized projections

Participant and administrator APIs must use separate projections rather than relying only on queryset tenancy.

Participant projection may expose only the authenticated participant's own Profile, RouteSignal, EVParticipantSignal, participant-safe statuses, and future participant-safe Match Preview fields.

Institution-admin projection should default to the minimum fields needed for TDM administration, including general zones, schedule windows, mode, parking difficulty, EV/hybrid signal, Access Point willingness, and program status.

Institution-admin projections should not automatically expose unnecessary email/identity fields, raw `source_payload`, unnecessary accessibility detail, or internal security/audit metadata.

## Auditability

Reuse `AssessmentAuditEvent`; do not create a second audit model.

Security-relevant event names should include:

- `membership.created`
- `membership.role_changed`
- `membership.suspended`
- `membership.withdrawn`
- `profile.provisioned`
- `profile.ownership_linked`
- `profile.ownership_unlinked`
- `participant.route_signal_created`
- `participant.ev_signal_created`
- `security.cross_tenant_write_rejected`
- `security.participant_ownership_rejected`
- `platform_admin.accessed_tenant_resource`

Audit metadata should contain identifiers and reason codes, not duplicated sensitive commute payloads. Denied-event logging must be rate-conscious and should not become a denial-of-service log amplifier.

## Database tenant invariants

PostgreSQL is the final tenant-integrity boundary for canonical application tables in `relay_app`.

Use trigger-based guards plus matching Django validation. SQLite tests exercise the application layer; PostgreSQL integration tests prove the database layer.

Required invariants:

```text
Cohort.site.institution = Cohort.institution
DataSource.site.institution = DataSource.institution

CommuteImport.institution
 = Site.institution
 = Cohort.institution
 = DataSource.institution

CommuterRecord.institution/site/cohort/import
 all resolve to the same institution

EngineScore.institution/site/cohort
 = CommuterRecord.institution/site/cohort

Rule2202CalculationRun.institution/site/cohort
 = CommuteImport.institution/site/cohort

DecisionCard.institution/site/cohort
 = CommuteImport.institution/site/cohort
 = Rule2202CalculationRun.institution/site/cohort when present

Profile.user requires an active Membership in Profile.institution when user is non-null

RouteSignal.institution = Profile.institution when profile is present
EVParticipantSignal.institution = Profile.institution when profile is present
```

Parent reassignment must fail if it would make descendants cross-tenant. Never silently cascade institution IDs to repair inconsistency.

## PostgreSQL trigger hardening

Tenant-invariant trigger functions must live in `relay_app` and use schema-qualified references.

Prefer:

```sql
SECURITY INVOKER
SET search_path = pg_catalog, relay_app
```

where supported by the migration structure.

Do not grant broad execution rights beyond the application role. Do not alter Rule 2202 SQL functions in `public`.

## Migration strategy

Use two reversible Django migrations within one security PR:

```text
0007_security_identity_foundation
0008_database_tenant_invariants
```

### `0007_security_identity_foundation`

Responsibilities:

- Membership lifecycle fields
- Profile.user nullable FK
- conditional `(user, institution)` uniqueness for owned Profiles
- PlatformRole model
- migration of existing platform-admin authority from Membership to PlatformRole without deleting source rows
- application-level validation hooks needed for SQLite tests

### `0008_database_tenant_invariants`

Responsibilities:

- read-only preflight verification
- PostgreSQL tenant guard functions/triggers in `relay_app`
- parent reassignment protection
- Profile active-membership guard at DB boundary
- RouteSignal/EVParticipantSignal Profile↔institution guards

No Supabase historical recovery anchor may be modified.

## Preflight

Before `0008` installs tenant guards, run a read-only invariant scanner.

Report fields:

- table
- primary key
- invariant name
- expected institution
- actual institution
- related entity

The scanner must:

- report all detected violations
- make no repairs
- omit participant payload content
- exit nonzero if violations exist

`0008` fails closed if preflight does not pass.

## Rollback behavior

Reverse `0008`:

- drop tenant triggers
- drop tenant guard functions
- preserve data

Reverse `0007`:

- remove PlatformRole
- remove Profile.user ownership relation and conditional uniqueness
- remove Membership lifecycle fields
- preserve underlying Profile, Membership, and participant records

The expected information loss on `0007` rollback is only the new ownership/lifecycle/platform-role metadata. No participant record should be deleted merely to make rollback possible.

Verify both migration loops:

```text
0008 → 0007 → 0008
0007 → 0006 → 0007
```

## Delete and cascade policy

Do not broadly redesign current FK deletion behavior in this security PR.

Tests must prove current `CASCADE`, `PROTECT`, and `SET_NULL` behavior does not create cross-tenant or ownership inconsistencies.

If testing reveals a material evidence-destruction problem, stop and report it as a separate schema decision rather than silently expanding this PR.

## Adversarial test requirements

At minimum prove:

- unauthenticated participant write denied
- authenticated non-member write denied
- inactive/suspended/withdrawn Membership denied
- user with multiple memberships must select explicit institution
- Alice cannot create under Bob's Profile
- Alice cannot read/update/delete Bob's participant-private records within same institution
- cross-institution Profile injection denied
- forged `institution` / `profile` client fields ignored or rejected
- same-tenant institution admin cannot impersonate a participant through participant endpoints
- platform admin cannot impersonate a participant through participant endpoints
- direct ORM cross-tenant create rejected by PostgreSQL
- `QuerySet.update()` cross-tenant mutation rejected by PostgreSQL
- `bulk_update()` cross-tenant mutation rejected by PostgreSQL
- FK-ID reassignment rejected by PostgreSQL
- raw SQL cross-tenant insert/update rejected by PostgreSQL
- parent Site institution reassignment rejected when descendants conflict
- final active institution admin cannot be deleted, suspended, withdrawn, demoted, or reassigned
- self-role promotion/demotion rejected
- unauthorized role transition rejected
- membership revocation concurrent with participant write fails safely
- delete/cascade behavior does not create tenant inconsistency
- migration rollback/reapply loops pass
- SQLite application validation suite passes
- PostgreSQL integration invariant suite passes

## Expected implementation footprint

Expected files to modify/create:

```text
backend/relay/models.py
backend/relay/permissions.py
backend/relay/serializers.py
backend/relay/views.py

backend/relay/services/participant_identity.py
backend/relay/services/membership_security.py
backend/relay/services/security_preflight.py

backend/relay/migrations/0007_security_identity_foundation.py
backend/relay/migrations/0008_database_tenant_invariants.py

backend/relay/tests_security_foundation.py
backend/relay/tests_postgres_tenant_invariants.py

docs/SECURITY_FOUNDATION.md
```

CI may require a focused workflow adjustment to run PostgreSQL-specific enforcement tests against a real PostgreSQL service.

## Explicit exclusions

This security foundation must not:

- merge PR #53, #29, or #34
- add Program, Assessment, duplicate DecisionCard, duplicate Rule2202CalculationRun, duplicate Site/Cohort, or duplicate commuter-record models
- duplicate Rule 2202 formulas in Python
- modify Rule 2202 SQL formulas or their PostgreSQL-only execution contract
- modify Supabase historical recovery anchors
- treat migration-version reconciliation as complete migration-provenance recovery
- add admin-on-behalf-of participant impersonation
- invent participant retention/anonymization policy

## Migration-history provenance warning

Historical Supabase recovery anchors reconcile migration version tracking only. They are not proof of complete replayable historical SQL and must not be presented as such. Exact-body archival remains a separate provenance task.

## Acceptance gate

The security foundation passes only when an authenticated participant is uniquely bound to an active institution Membership and owned Profile; another participant cannot read, create, alter, reassign, or delete that participant's private records even within the same institution; tenant-inconsistent canonical relationships cannot be created through Django ORM, bulk operations, or raw PostgreSQL; the final active institution administrator cannot be accidentally removed or demoted; global platform authority is no longer derived from a tenant Membership; platform administrators cannot implicitly impersonate participants; suspension and withdrawal immediately revoke participant authorization while preserving auditable historical evidence; the preflight finds and reports existing inconsistencies without repairing them; and all enforcement remains reversible through verified migrations.