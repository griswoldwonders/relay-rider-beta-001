# Relay Rider Commuter Client — Current State

**Authority:** This document describes what `griswoldwonders/relay-rider-beta-001` can do at the code and deployment layers. It must be read with `DEPLOYMENT.json` and `docs/CAPABILITY_MANIFEST.json`.

**Product state:** Research beta. Relay Rider is an institution-sponsored commuter coordination and TDM participant client. It is not a taxi, ride-hailing, live dispatch, instant-pickup, or guaranteed transportation service.

## Source hierarchy

1. This repository's `DEPLOYMENT.json` is the deployment contract for the commuter client.
2. `docs/CAPABILITY_MANIFEST.json` is the machine-readable capability classification.
3. The institutional backend contract is owned by `griswoldwonders/relay-mock-v3` and is pinned by commit and live Supabase migration fingerprint in `DEPLOYMENT.json`.
4. `README.md`, product copy, screenshots, demos, and prototype data must not override the deployment contract.

## Audited production baseline

The audited `main` commit is `e04e6867e5faa556f6af11c2f51ceebefe4272d2`.

At that baseline:

- commuter onboarding, EV/hybrid planned-route registration, commute options, match previews, corridor map, wallet, and trip-journey screens are interactive;
- participant route signals, EV participant signals, and Green Route Credits are held in React session memory;
- the commuter application is not yet an authenticated client of the institutional Supabase backend;
- template matches and modeled detour values are prototype data, not live results;
- the repository-local `supabase/migrations/202607270001_security_foundation.sql` is a historical/backend blueprint and is **not** the production database authority.

## Institutional backend contract

The live system of record is the shared Supabase project `Relay-Rider-RD` (`dzrqrqfxcihvufvyctbt`), governed by the institutional repository.

The participant-client backend contract is live and currently includes:

- `accept_organization_invitation` — institution-issued invitation acceptance;
- `get_participant_program_context` — authenticated membership/site/cohort context;
- `submit_participant_commuter_need` — tenant-scoped commuter-need persistence using approximate zones;
- `submit_participant_planned_route` — tenant-scoped registration of an existing planned route;
- `get_participant_match_previews` — participant-safe match and administrative-review read model.

Deterministic match generation remains an institutional reviewer action through `generate_deterministic_match_previews`. The participant client must not trigger matching, approve itself, activate transportation, or bypass administrative review.

The live backend fingerprint pinned by `DEPLOYMENT.json` is the contract boundary. A client build must fail when that fingerprint drifts until the backend change is reviewed and this source of truth is deliberately updated.

## Target vertical slice

The first cross-system proof is deliberately narrow:

`institution invitation → authenticated participant → active program membership → commute profile → commuter need persisted → institutional reviewer generates deterministic Match Preview → administrative review status → participant reads reviewed option`

A "reviewed option" remains a governed commuter option / Match Preview. It is not a guaranteed ride, route activation, payment, or live dispatch event.

## Prototype-only boundary

The following remain `PROTOTYPE_SESSION` until a separately governed backend system exists and is verified:

- Green Route Credits ledger and redemption;
- simulated trip progression / in-transit screens;
- template commuter matches used for visual comparison;
- modeled detour visuals that do not come from a connected routing service;
- sample local-transit bundle and example schedule content.

Prototype-only data must never be written into production institutional tables merely to make the application appear end-to-end.

## Security boundary

The commuter client uses the public Supabase publishable key plus a participant's authenticated access token. Authorization is enforced by backend membership checks, RLS, and participant-specific RPCs. The client contains no service-role key and must never receive one.

Participant write operations are restricted to the authenticated user's own data and active institutional membership. Participant match reads intentionally omit counterparty identity and vehicle details.

## Promotion rule

A capability may move from `IMPLEMENTED_NOT_DEPLOYED` to `LIVE_PERSISTED` only after all of the following are true:

- the implementation is merged to the production branch;
- CI source-of-truth and backend-fingerprint checks pass;
- the hosting deployment is tied to the intended commit;
- a real authenticated institution invitation is accepted;
- a real participant record is persisted under the correct tenant;
- a reviewer-generated Match Preview and administrative review are read back by that participant;
- the evidence is recorded in `DEPLOYMENT.json` without promoting prototype-only capabilities.

## Known unresolved items

- Exact hosting deployment SHA/provenance is not yet verified.
- No real participant browser proof has been executed yet.
- The institutional admin UI still needs an explicit operator path for generating/reviewing the first proof Match Preview if the existing dormant operational UI is not sufficient.
- Live routing/detour calculation is not implemented.
- Incentive ledger/redemption is not implemented.
