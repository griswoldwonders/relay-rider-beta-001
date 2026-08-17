# Relay Rider — College Commuter Coordination Research Beta

Relay Rider is a mobile-first participant client for comparing **planned shared-route options, local transit, Access Points, EV/hybrid participation, and commuter benefits** inside institution-sponsored mobility programs.

Relay Rider is **not** a taxi, ride-hailing, live dispatch, instant-pickup, or guaranteed transportation service.

## Engineering source of truth

Do not infer production capability from a screen, component, or migration merely existing in this repository.

Use, in order:

1. `DEPLOYMENT.json` — deployment and institutional-backend contract;
2. `CURRENT_STATE.md` — human-readable deployed/current-state authority;
3. `docs/CAPABILITY_MANIFEST.json` — machine-readable capability classifications.

The audited production `main` baseline remains session-memory based until the integration branch is merged, deployed, and its browser proof is recorded.

## Current participant direction

The participant experience has two principal paths:

- **I need a commute option** — submit a commute need, institution context, schedule, transit preferences, Access Point willingness, and EV/hybrid preference.
- **I already drive an EV/hybrid route** — register a route the participant already plans to travel, including recurring schedule and detour comfort.

Inside a connected institution program, the integration branch persists these two records through the shared institutional backend. Without an active institution program, the interface remains a prototype session and does not write participant records into an institutional tenant.

## Governed backend architecture

`relay-rider-beta-001` is the participant/client application.

The shared system of record is the Supabase project `Relay-Rider-RD`, governed through `griswoldwonders/relay-mock-v3`. This repository does **not** own a separate production participant database.

The participant client contract currently covers:

- authenticated account session;
- institution-issued invitation acceptance;
- active organization/site/cohort context;
- commuter-need persistence using approximate zones;
- registration of an existing planned route;
- participant-safe Match Preview and administrative-review reads.

Deterministic Match Preview generation remains an **institutional reviewer action**. A participant cannot self-generate, self-approve, or automatically activate transportation.

The repository-local SQL under `supabase/migrations/` is historical/backend blueprint material and is not the production database authority.

## First end-to-end proof

The promotion target is deliberately narrow:

`institution invitation → authenticated participant → active program membership → commute profile → commuter need persisted → institutional reviewer generates deterministic Match Preview → administrative review → participant reads reviewed option`

The integration must pass the deployment gates in `DEPLOYMENT.json` before it is described as production-live.

## Commute options and matches

The Matches experience separates two evidence classes:

### Governed institutional Match Previews

When an authenticated participant is connected to an active institution program, Relay Rider can read participant-safe Match Preview and administrative-review state from the shared backend. These records include compatibility evidence and may include a reviewed Access Point.

A reviewed option remains a **Match Preview / commuter option**, not a guaranteed ride or live route activation.

### `PROTOTYPE_SESSION` comparison cards

Template matches remain available to demonstrate ranking and interface behavior. Their scores, route-overlap percentages, and detour displays are simulated and are explicitly separated from governed institutional records.

Live routing/detour calculation is not connected.

## Local transit

The prototype includes examples and official-verification prompts for options such as:

- LA Metro Bus Line 180
- LA Metro A Line
- Pasadena Transit
- Glendale Beeline

Transit entries are external transportation options, not Relay Rider-operated services. Schedules, fares, service changes, and student eligibility must be verified with the transit operator.

## Green Route Credits

Green Route Credits remain **`PROTOTYPE_SESSION`** unless and until an institution-funded incentive ledger and redemption system is separately implemented and verified.

They are not cash, wages, fares, guaranteed payments, certified carbon offsets, LCFS credits, or direct charging reimbursements.


## Product inspiration from adjacent open-source projects

Relay Rider's roadmap borrows patterns from a few proven mobility and logistics projects:

- Fleetbase for dispatch-first operations, live tracking, and modular logistics workflows
- openrouteservice for routing intelligence, travel-time matrices, and accessibility planning
- Open Mobility Foundation for standards-first data modeling and interoperability
- awesome-transit for ecosystem discovery and transit tooling references

See `docs/PRODUCT_INSPIRATION.md` for a fuller feature-by-feature roadmap.

## Core screens

- Home
- Institution Program
- Commute Need Intake
- Planned EV/Hybrid Route Registration
- Commuter Matches
- Commute Options
- Corridor Map
- Commute Activity
- Profile / Incentives
- Privacy Center
- Security Center
- Review Gates

Simulated trip-state screens remain prototype-only demonstrations.

## Technology

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Material Web
- Leaflet / OpenStreetMap
- Framer Motion
- React Hook Form + Zod
- Supabase Auth/PostgREST through a narrow authenticated participant adapter

## Deployment

Deployment instructions for the React frontend, Django API, Green Wallet API adapter, database migrations, environment variables, production security settings, and post-deploy verification are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). The current app remains a research-beta prototype: deployment does not activate live transportation, charger reservation, payment processing, or charging-network settlement.

## Local development

Frontend:

```bash
npm install
npm run check:deployment
npm run check
npm run build
npm run dev
```

`npm run check:deployment` validates the commuter source-of-truth files and verifies that the live institutional backend migration fingerprint still matches the reviewed contract pinned in `DEPLOYMENT.json`.

Local Django API backend:

```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8877
```

Health checks:

- `http://127.0.0.1:8877/` returns a JSON status payload.
- `http://127.0.0.1:8877/api/` exposes the browsable API root.
- `http://127.0.0.1:8877/admin/` exposes the Django admin login.

The backend is a local development API scaffold for Relay Rider research-beta data: profiles, route-interest signals, EV/hybrid planned-route signals, relay zones, corridors, and Green Route Credits.

## Research-beta guardrails

The product must not imply:

- guaranteed transportation;
- live dispatch or instant pickup;
- automatic route activation;
- automatic payment or driver earnings;
- public ride-hailing;
- unreviewed school transportation;
- guaranteed safety;
- guaranteed parking, VMT, or emissions reductions.

Future operational activation requires legal, insurance, privacy, accessibility, safety, program-rule, and operational review.

## Security

The participant application uses a Supabase **public publishable key plus the participant's authenticated access token**. It does not contain a service-role key. Tenant access is enforced by active institution membership checks, row-level security, and participant-scoped backend contracts.

See `SECURITY.md` and `docs/SECURITY_ARCHITECTURE.md` for the security foundation.

## License

Repository licensing and public-source status should be reviewed before production use. Common Pathways Technologies retains responsibility for product, legal, regulatory, and operational decisions.
