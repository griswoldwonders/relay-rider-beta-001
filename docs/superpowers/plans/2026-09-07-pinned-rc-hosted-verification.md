# Pinned RC Hosted Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin the tested Pasadena proof-chain release candidate to an immutable Git ref, verify its hosted frontend deployment, establish whether a hosted Django/PostgreSQL API exists for the same revision, and rerun the end-to-end proof only against a hosted environment that can prove frontend + API + persistence provenance.

**Architecture:** Keep the tested RC SHA unchanged. Use a dedicated RC branch pointing exactly at that commit. Treat Netlify as the static frontend host and require a separately hosted Django REST API with persistent PostgreSQL before calling the hosted proof complete. Record every URL, SHA, deploy identifier, migration state, and verification result.

**Tech Stack:** GitHub, GitHub Actions, Netlify, React/Vite, Django REST Framework, PostgreSQL.

**Spec:** `docs/DEPLOYMENT.md` plus PR #67 Pasadena proof acceptance evidence.

## Global Constraints

- Relay Rider remains a research-beta prototype; deployment does not activate transportation, charger reservation, payment processing, or partner-network settlement.
- Do not merge PR #67 merely to create a deploy.
- Do not modify production data.
- Preserve tenant isolation, authenticated Profile ownership, administrative review, and Rule 2202 non-certification language.
- Do not claim hosted end-to-end proof unless the exact tested SHA is traceable through the deployed frontend and hosted API/database environment.

---

### Task 1: Pin the release candidate

**Files:** none

**Interfaces:**
- Consumes: tested SHA `48e972491e854a1373580f11f0fefb31ba1d392b`
- Produces: Git branch `rc-2026-09-07-pasadena-proof-v1` pointing exactly to that SHA

- [ ] Create the RC branch from the tested SHA.
- [ ] Read the branch ref back and verify it still resolves to that SHA.
- [ ] Do not commit further changes to the RC branch.

### Task 2: Verify hosted frontend provenance

**Files:** none

**Interfaces:**
- Consumes: RC SHA and Netlify project `relay-rider-beta-001`
- Produces: hosted frontend URL plus deploy/commit provenance

- [ ] Verify GitHub commit status reports the Netlify deploy preview ready for the tested SHA.
- [ ] Fetch the hosted URL and confirm HTTP success plus Relay Rider application content.
- [ ] Confirm the Netlify project has an explicit `VITE_API_BASE_URL` before treating browser API calls as hosted API proof.

### Task 3: Establish hosted API readiness

**Files:** `docs/DEPLOYMENT.md`

**Interfaces:**
- Consumes: deployment guide requirements
- Produces: PASS/BLOCKED decision for hosted Django/PostgreSQL proof

- [ ] Confirm a reachable HTTPS Django API URL exists.
- [ ] Confirm a persistent PostgreSQL database is attached.
- [ ] Confirm deployment settings are environment-driven and `DEBUG=False`.
- [ ] Confirm migrations are applied through the current Relay migration graph.
- [ ] If any item is absent, mark hosted proof BLOCKED rather than fabricating a deployment.

### Task 4: Rerun hosted proof

**Files:** none

**Interfaces:**
- Consumes: hosted frontend URL, hosted API URL, seeded synthetic Pasadena cohort
- Produces: hosted evidence for Institution → Site/Cohort → Import → Canonical Records → Core Engine → Rule 2202 boundary → Admin Review → Decision Card → Dashboard/Export

- [ ] Health-check the API root and browsable API root over HTTPS.
- [ ] Execute the synthetic Pasadena proof using non-sensitive demonstration data only.
- [ ] Verify 32 source rows, 28 valid rows, 4 invalid rows, 28 engine scores, reviewed Decision Card, dashboard 200, and export 200.
- [ ] Verify participant/admin authorization and cross-tenant negative cases in the hosted environment.
- [ ] Record deploy URL, API URL, deployed SHA, migration state, timestamps, and rollback procedure.

### Task 5: Release decision

**Files:** none

**Interfaces:**
- Consumes: all prior evidence
- Produces: PASS/PARTIAL/BLOCKED release verdict

- [ ] PASS only if the exact RC SHA is traceable through both hosted frontend and hosted API/database proof.
- [ ] PARTIAL if the frontend is pinned and hosted but the API proof is unavailable.
- [ ] BLOCKED if deployment provenance cannot be established or any security/migration gate fails.
