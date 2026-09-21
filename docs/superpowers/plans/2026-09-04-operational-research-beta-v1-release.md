# Relay Rider Operational Research Beta v1 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare `relay-rider-beta-001` as a pinned Operational Research Beta v1 release candidate and prove the institutional workflow without adding features or Charging Intelligence domains.

**Architecture:** Keep Django ORM/PostgreSQL as the canonical application persistence path. Integrate the institutional vertical slice after the canonical Green Wallet contract and governed manual-pilot ledger, then gate promotion on migration reversibility, complete backend/frontend/security verification, tenant isolation, fictional Pasadena acceptance evidence, and a pinned deployment SHA.

**Tech Stack:** Django/DRF, PostgreSQL/Supabase, TypeScript/Vite/Vitest, GitHub Actions, Netlify.

**Spec:** Approved release design in the 2026-09-04 founder release operation.

## Global Constraints

- Do not add Charging Intelligence domains or functionality.
- Do not merge OCPI/live charging work into this release.
- Preserve research-beta language, tenant isolation, administrative review, and planned-route boundaries.
- Do not claim Rule 2202 certification or compliance approval.
- Do not call the release operational unless every gate below passes.
- Green Wallet canonical semantics on `main` remain authoritative.

---

### Task 1: Integrate the institutional vertical slice onto current main

**Files:** existing PR #52 changes plus current `main`; no unrelated feature files.

- [ ] Bring current `main` into `codex/institutional-vertical-slice` so PR #56 is present.
- [ ] Confirm the Django migration graph remains `0001 → 0002 → 0003 → 0004_green_wallet_contract → 0005_institutional_vertical_slice`.
- [ ] Confirm no Charging Intelligence/OCPI domains are introduced.
- [ ] Require fresh CI and security workflows on the integrated head.

### Task 2: Verify migrations and complete suites

**Files:** `.github/workflows/ci.yml`, backend migrations/tests, frontend package scripts.

- [ ] Verify `0003 → 0004 → 0005` forward migration.
- [ ] Verify rollback `0005 → 0004`, rollback/reapply coverage for `0004`, then reapply `0005`.
- [ ] Run Django system checks and missing-migration detection.
- [ ] Run the complete backend suite including Green Wallet, RBAC, tenant-isolation, and vertical-slice tests.
- [ ] Run frontend typecheck, tests, security config validation, and production build.
- [ ] Run dependency review, CodeQL, and tracked-secret checks.

### Task 3: Review security and cross-tenant gates

**Files:** `backend/relay/permissions.py`, `backend/relay/views.py`, related tests.

- [ ] Confirm participant/admin role separation.
- [ ] Confirm same-tenant access succeeds and cross-tenant reads/writes fail.
- [ ] Confirm redemption review is institution-scoped.
- [ ] Confirm final-owner/role-transition/database-boundary invariants covered by the current hardened tests.
- [ ] Treat any tenant escape as a release blocker.

### Task 4: Prove the fictional Pasadena institutional chain

**Files:** `backend/relay/fixtures/fictional_pasadena_commute.csv`, `backend/relay/management/commands/run_fictional_vertical_slice.py`, services/tests.

- [ ] Run the labeled synthetic Pasadena cohort only in test/research-beta context.
- [ ] Prove `Institution → Program/Site/Cohort → DataSource/import → canonical CommuterRecord → Core Engine score → Rule 2202 boundary → administrative review → dashboard/export → Decision Card`.
- [ ] Record source provenance, validation results, scoring version, modeled/observed labels, and export evidence.
- [ ] Do not present synthetic records as real participants.

### Task 5: Execute two-user acceptance test

- [ ] Create or use two test identities with different roles for the fictional Pasadena institution.
- [ ] Verify participant authentication/session behavior available in this release candidate.
- [ ] Verify the participant can only access participant-safe institution-scoped data.
- [ ] Verify the administrator can review the institutional output and cannot cross tenant boundaries.
- [ ] Verify participant readback after administrative review where the implemented contract supports it.
- [ ] If a required browser/auth flow is not implemented, record it as a blocker and keep status NOT OPERATIONAL.

### Task 6: Pin deployment and produce release evidence

- [ ] Merge PR #52 only after all integrated-head checks pass.
- [ ] Record the resulting `main` SHA.
- [ ] Verify the Netlify deployment is tied to that exact SHA.
- [ ] Do not run production Django schema migration unless the protected production deployment gate is explicitly safe and authorized.
- [ ] Record migration state, workflow run IDs, test results, synthetic proof evidence, acceptance results, rollback procedure, and remaining blockers.
- [ ] Mark release `OPERATIONAL RESEARCH BETA v1` only if every gate passes; otherwise mark `NOT OPERATIONAL` with blockers.

## Rollback Procedure

1. Preserve the pre-release `main` SHA (`28549c0316dd8e3aeeb4e458f49dcdd9418ab74d`) as the frontend/application rollback point before integration.
2. If the release merge causes a regression, redeploy the prior known-good frontend SHA rather than rewriting history.
3. If Django migration `0005` has been applied in a non-production verification database, roll back to `relay 0004`, validate canonical Green Wallet state, then reapply only after the defect is corrected.
4. Do not rewrite Supabase historical migration records as a rollback mechanism.
5. Any production PostgreSQL rollback requires a separate explicit deployment decision and evidence that data loss will not occur.
