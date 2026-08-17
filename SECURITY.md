# Security Policy

Relay Rider is a research-stage, controlled-beta commuter coordination product. It is not approved for live dispatch, instant pickup, guaranteed transportation, or storage of identity documents, insurance records, background-check material, exact home locations, or continuous live-location data.

## Supported security target

- OWASP ASVS 5.0 Level 2 before any controlled real-data pilot
- NIST SP 800-63B-4 for authentication and session design
- NIST SP 800-218 SSDF for the development lifecycle

## Reporting a vulnerability

Do not open a public GitHub issue containing vulnerability details, credentials, personal information, or route data.

Report suspected vulnerabilities privately through GitHub Security Advisories for this repository. Include:

- affected commit or deployment;
- reproduction steps;
- expected and observed behavior;
- impact;
- any safe proof-of-concept material.

Do not test against real users or collect commuter information while reproducing an issue.

## Participant data boundary

The audited production `main` baseline stores prototype participant state in browser memory only. The commuter/backend integration branch adds an authenticated adapter to the shared institutional Supabase system of record, but that integration is not promoted as production-live until the browser proof and deployment gates in `DEPLOYMENT.json` pass.

When an institution program is connected, participant persistence uses:

- the Supabase public publishable key plus the participant's authenticated access token;
- institution-issued invitation acceptance;
- active organization/cohort membership checks;
- row-level security and participant-scoped RPC contracts;
- approximate origin/destination zones rather than exact home locations.

The browser client must never contain or receive a Supabase service-role key.

Green Route Credits, simulated trip progression, template matches, and modeled detour visuals remain `PROTOTYPE_SESSION`; they must not be written into institutional production tables merely to simulate a complete system.

## Database authority

The SQL under this repository's `supabase/migrations/` is historical/backend blueprint material and is not the production database authority.

The production institutional backend is `Relay-Rider-RD`, governed through `griswoldwonders/relay-mock-v3`. This client pins the reviewed institutional contract commit and live database migration fingerprint in `DEPLOYMENT.json`. CI/builds fail closed when that fingerprint drifts.

## Dependency audit policy

Production/runtime dependency vulnerabilities at high severity or above are release-blocking and are checked with:

`npm audit --omit=dev --audit-level=high`

Development-tool dependencies are also reviewed, but a dev-only advisory is not automatically treated as a production-runtime vulnerability. As of this integration work, npm reports a high-severity advisory against the Nano ID 3.x copy nested under PostCSS. PostCSS is a development/build dependency and the currently published PostCSS 8.5.25 depends on Nano ID `^3.3.16`; npm currently lists 3.3.16 as the legacy 3.x release. The finding should be removed as soon as an upstream compatible fixed dependency is published. It must not be represented as remediated while the vulnerable dev-only package remains in the lockfile.

CodeQL, dependency review, type checking, production build, application security configuration checks, and tracked-secret scanning remain separate CI gates.
