# Relay Rider beta deployment guide

This guide describes how to deploy the Relay Rider beta with its integrated Green Wallet and EV Charge Credit redemption workflow. It assumes the repository’s current architecture: a Vite React frontend and a Django REST Framework API under `backend/`.

> The current application is a research-beta prototype. Deployment makes the site reachable; it does not activate transportation, live charger access, payment processing, or partner-network settlement.

## Deployment architecture

For a pilot, deploy the frontend and API as separate services:

```text
Browser
  ↓
Static React/Vite frontend
  ↓ HTTPS + authenticated API requests
Django REST API
  ↓
PostgreSQL or managed relational database
  ↓
Django admin / program operations
```

The frontend can be hosted by Vercel, Netlify, Cloudflare Pages, GitHub Pages with an API hosted separately, or any static hosting provider. The Django API should run on a managed application service or container platform with HTTPS, environment-managed secrets, a persistent database, and a defined backup policy.

## Pre-deployment checklist

| Area | Required before public pilot |
|---|---|
| Identity | Define how participants and administrators authenticate. Do not deploy the current `AllowAny` REST configuration for real users. |
| Database | Use a persistent database. SQLite is suitable for local development only. |
| Authorization | Restrict credits and redemption requests to the owning participant; restrict review actions to administrators. |
| Secrets | Move Django `SECRET_KEY`, database credentials, allowed origins, and any provider credentials to environment variables. |
| HTTPS | Serve both frontend and API over HTTPS. Configure secure cookies and CSRF protection if using session authentication. |
| Migrations | Apply the Green Wallet migration, including `0002_green_wallet_redemption.py`, in the deployment environment. |
| Operations | Define who reviews requests, what fulfillment means, how denials are handled, and how support issues are escalated. |
| Product rules | Define credit units, expiration, partial redemption, reversal behavior, eligible hubs, and the meaning of `fulfilled`. |
| Legal and safety | Complete privacy, accessibility, security, insurance, program, and partner review before a real-world pilot. |

## Frontend deployment

### Build locally or in CI

From the repository root:

```bash
npm ci
npm run check
npm run build
```

The generated `dist/` directory is the static artifact to publish. The deployment build must fail if TypeScript checking fails.

### Frontend environment variables

Set the following variable in the hosting provider’s build environment when the API is deployed separately:

```bash
VITE_API_BASE_URL=https://api.example.org/api
```

Vite exposes variables prefixed with `VITE_` to browser code. Never place private keys, database passwords, Django secrets, or administrator credentials in `VITE_` variables.

The current adapter defaults to a local API URL when `VITE_API_BASE_URL` is absent. A production build should set the variable explicitly and should not depend on the local fallback.

### SPA routing

If the application later moves from query-based screen previews to browser routes such as `/wallet` and `/wallet/redeem`, configure the static host to rewrite unknown paths to `index.html`. Until then, the current `?screen=wallet` preview convention can be used.

### Example static-host settings

| Provider type | Build command | Publish directory |
|---|---|---|
| Vercel / Netlify / Cloudflare Pages | `npm run build` | `dist` |
| Generic static host | `npm ci && npm run check && npm run build` | `dist` |
| GitHub Pages | Build in CI, publish `dist` | Configure the Vite base path if hosting under a repository subpath |

## Django API deployment

From `backend/`, install the declared dependencies and apply migrations:

```bash
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py check --deploy
```

Run the application behind a production WSGI or ASGI server, not Django’s development server. The exact command depends on the hosting provider. A typical WSGI command is:

```bash
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

Add `gunicorn` to `backend/requirements.txt` if that is the selected deployment server. If the provider uses ASGI, configure its supported ASGI process instead.

### Required production settings

The current `backend/config/settings.py` is local-development configuration. Before deployment, replace hard-coded values with environment-driven settings and configure at least:

```text
DEBUG=False
SECRET_KEY=<managed secret>
ALLOWED_HOSTS=api.example.org
CORS_ALLOWED_ORIGINS=https://app.example.org
CSRF_TRUSTED_ORIGINS=https://app.example.org
DATABASE_URL=<managed database URL>
```

The exact settings implementation should use a reviewed configuration approach rather than copying these values literally. Do not widen CORS to `*`.

### Database and migration sequence

The beta includes durable models for Charging Hubs and Redemption Requests. Apply migrations in order:

```bash
python manage.py showmigrations
python manage.py migrate
python manage.py makemigrations --check --dry-run
```

Use a managed PostgreSQL database for a real pilot. Configure automated backups, restore testing, connection limits, and migration rollback procedures. Keep SQLite for local development and disposable demonstrations only.

## Green Wallet API activation

The frontend adapter is located at `src/lib/greenWalletApi.ts`. It supports:

| Operation | Adapter method |
|---|---|
| List credits | `listCredits(profileId?)` |
| List Charging Hubs | `listChargingHubs()` |
| List participant or admin requests | `listRedemptionRequests(profileId?)` |
| Create a request | `createRedemptionRequest(input)` |
| Review a request | `reviewRedemptionRequest(id, decision, reviewNote)` |

Enable API-backed reads and writes only after authentication and authorization are enforced server-side. Keep the session-memory fixture mode available for demos, but show a clear error when an API request fails. Never silently display a failed request as fulfilled.

Before activation, add server-side support for an idempotency key on request creation. The server must derive participant identity from the authenticated session, validate credit ownership, validate hub eligibility, reject duplicate active requests, and ignore client-supplied reviewer identity and timestamps.

## Security hardening

The current REST framework configuration uses permissive development permissions. Replace it with explicit permissions before public deployment. At minimum:

- Participants may read only their own credits and redemption requests.
- Administrators may review requests and manage hubs through protected operations.
- Review actions require a denial reason when denying a request.
- Credit ownership, request status, and hub eligibility are validated on the server.
- All request creation and review events are recorded in an audit trail.
- Cookies, CSRF, CORS, and trusted origins are configured for the actual production domains.
- Django admin is protected with strong administrator authentication and should not be exposed without access controls. This is already true of the framework default (`/admin/` redirects anonymous and non-staff requests to a login page rather than serving data; see `relay/tests.py::DjangoAdminAuthTests`) -- the operational gap is that no admin account exists until one is provisioned. Provision it with `python manage.py ensure_admin`, which reads `DJANGO_SUPERUSER_USERNAME`/`DJANGO_SUPERUSER_EMAIL`/`DJANGO_SUPERUSER_PASSWORD` from the deploy environment's secrets manager and is safe to re-run on every deploy (a no-op if the account already exists). Never hardcode admin credentials in source or commit them.
- Institution staff (`institution_admin` role) do not get any Django admin access, scoped or otherwise, in this pilot. Admin-site access remains platform-admin/superuser only. Institution-scoped admin tooling is a future consideration, not implemented here.
- Logs must avoid credit identifiers or participant-sensitive data unless there is a documented operational need.

## Verification after deployment

Run the following checks against the deployed environments:

```bash
curl -fsS https://api.example.org/
curl -fsS https://api.example.org/api/
```

Then verify in the browser:

| Test | Expected result |
|---|---|
| Open Wallet | Available, under-review, redeemed, and expired categories render clearly. |
| Open EV Charge Credit | The redemption flow opens inside Relay Rider’s product shell. |
| Select a verified hub | The hub appears with evidence and non-live-availability language. |
| Submit without acknowledgement | Submission remains blocked. |
| Submit with acknowledgement | A request ID and pending-review state appear. |
| Refresh the page | API-backed request history persists; fixture mode is clearly identified if used. |
| Participant access another profile | The API returns `403` or an equivalent filtered result. |
| Administrator review | Only an authorized administrator can fulfill or deny. |
| Denial without a reason | The API rejects the decision. |
| Live charging behavior | No charger reservation, charging session, payment, or partner settlement occurs unless separately implemented and approved. |

## Recommended rollout

Deploy first to a staging environment with seeded non-sensitive data. Run migrations, browser verification, API authorization tests, and restore tests before production. For the first pilot, keep fulfillment as a manually reviewed program decision and do not connect to live charging networks.

After the supervised pilot validates the terminology and workflow, add durable audit events, notification delivery, operational dashboards, and a reviewed partner adapter. Treat live charging-network integration as a separate release with its own security, legal, partner, settlement, and support review.

## Operational references

- Green Wallet architecture: `docs/GREEN_WALLET_INTEGRATION.md`
- API contract: `docs/GREEN_WALLET_API_CONTRACT.md`
- End-to-end simulation: `docs/GREEN_WALLET_E2E_TEST.md`
- Security guidance: `SECURITY.md` and `docs/SECURITY_ARCHITECTURE.md`
