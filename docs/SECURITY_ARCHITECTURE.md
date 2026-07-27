# Relay Rider Security Foundation

## Current boundary

The current application is a static Research Beta prototype. It has no production identity provider, server session, protected API, or connected commuter database.

Active controls:

- sensitive demo records remain in React memory for the page session;
- legacy profile and route records are removed from browser local storage;
- production hosting headers define content, framing, permissions, transport, and referrer policies;
- security and dependency checks run in GitHub Actions;
- data classifications and audit-event contracts are centralized in source.

## Required backend boundary

Before accepting real commuter data, deploy an authenticated backend with:

1. passkey-capable identity and secure recovery;
2. phishing-resistant MFA for reviewers and administrators;
3. `HttpOnly`, `Secure`, `SameSite` server sessions;
4. database row-level security for every private table;
5. server-side authorization for every record transition;
6. append-only audit events written only by trusted server code;
7. managed encryption, backups, retention, and deletion workflows;
8. rate limiting and abuse controls at authentication and submission endpoints.

The migration in `supabase/migrations/202607270001_security_foundation.sql` defines the initial table and RLS boundary. Applying it is a separate production change.

## Roles

| Role | Allowed scope |
|---|---|
| Commuter | Own profile and own route requests; involved match previews only |
| Route participant | Own profile and own planned routes; involved match previews only |
| Reviewer | Records queued for pilot review; cannot manage infrastructure credentials |
| Administrator | Role assignment, incident response, and approved operational administration |

Role claims must be assigned through trusted server administration. Users must never be able to promote themselves by changing a profile record.

## Data rules

- Public: sourced Anchor Point candidates and public EV hubs.
- Internal: synthetic demand counts and prototype configuration.
- Sensitive: area-level route patterns, schedules, accessibility, and privacy preferences.
- Restricted: identity documents, insurance records, and background-check artifacts. These remain outside the commuter app.

Exact home addresses and live-location history are out of scope.

## Audit rules

Audit events capture actor, action, record type, record identifier, time, and minimal security metadata. They must not contain:

- authentication tokens;
- raw IP addresses when a protected hash is sufficient;
- exact route or location details;
- identity documents;
- free-form personal information.

## Release gates

Real-data collection remains blocked until:

- backend authentication and RLS tests pass;
- secrets are stored outside source and browser bundles;
- retention and deletion are exercised;
- backup restoration is tested;
- incident ownership is assigned;
- an OWASP ASVS 5.0 Level 2 assessment and independent penetration test are complete.
