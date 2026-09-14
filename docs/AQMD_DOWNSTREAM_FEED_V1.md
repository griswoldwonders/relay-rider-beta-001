# AQMD downstream feed contract v1

Relay Rider beta is the authoritative source for commuter data. The AQMD module
is a downstream consumer for institutional Rule 2202/TDM analysis.

## Endpoint

`GET /api/institutions/{institution_id}/aqmd-feed/`

The caller must be authenticated and have an active beta
`institution_admin` or `program_staff` membership for the institution.
Platform administrators may access the endpoint. Participants and viewers are
denied.

## Semantics

- Only canonical beta `CommuterRecord` rows with `validation_status=valid`
  are included.
- The response is read-only and uses contract `rr-aqmd-feed-v1`.
- Institution, site, cohort, source import, source row number, source SHA-256,
  provenance label, and timestamps are preserved.
- Origin and destination remain generalized zones.
- Names, emails, exact addresses, and private payload fields are excluded.
- AQMD calculations and reviews do not mutate beta records.
- Rule 2202 output is an institutional assessment/reporting output, not
  regulatory certification or compliance approval.

## Authentication

The initial adapter uses a short-lived authenticated beta API token supplied
by the approved integration runtime. Tokens must not be committed, placed in
browser source, or stored in `VITE_*` variables. A production deployment
requires a reviewed server-side token exchange or gateway.

## Acceptance

A live integration is not operational until a synthetic Pasadena organization
is fetched by AQMD, source hashes and row provenance match, and cross-institution
requests return 403.
