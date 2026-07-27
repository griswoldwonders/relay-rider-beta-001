# Security Policy

Relay Rider is a research-stage, pre-pilot prototype. It is not approved for live transportation operations or storage of identity documents, insurance records, background-check material, exact home locations, or live-location data.

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

## Prototype data boundary

The browser prototype keeps submitted demo state in memory for the current page session. Older local-storage keys are deleted during startup. A production backend is not connected.

The SQL under `supabase/migrations/` is a reviewed implementation blueprint and must not be treated as deployed until it has been applied, tested, and verified in the intended Supabase project.
