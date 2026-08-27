# CI/CD with Netlify

Relay Rider now has GitHub Actions workflows for frontend build validation, Django backend validation, and production frontend deployment to Netlify.

## Workflow behavior

| Workflow | Trigger | Purpose |
|---|---|---|
| `CI` | Pull requests to `main`, pushes to `main`, manual dispatch | Runs frontend type checking, security validation, production build, Django checks, migrations, and migration-drift validation. |
| `Deploy frontend to Netlify` | Pushes to `main`, manual dispatch | Rebuilds the frontend and publishes `dist` to the production Netlify site. The deployment job runs automatically only for pushes to `main`; manual dispatch runs the build job but does not publish. |
| `Security checks` | Existing repository workflow | Runs dependency audit, frontend checks, credential-pattern scanning, dependency review, and CodeQL. |

Both CI and deployment workflows use concurrency controls so obsolete runs are cancelled where safe and production deployments are serialized.

## Netlify project configuration

The root `netlify.toml` configures:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

It also adds an SPA fallback from every route to `/index.html`, which is required for client-side routing, and pins the build runtime to Node.js 22.

## GitHub configuration

Create a GitHub Actions environment named `production`. Add the following environment secrets:

| Secret | Meaning |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify personal access token or team token allowed to deploy the site. |
| `NETLIFY_SITE_ID` | Netlify site ID for the production frontend. |

Add these environment variables as GitHub repository or `production` environment variables:

| Variable | Meaning |
|---|---|
| `NETLIFY_SITE_URL` | Public Netlify URL shown on the deployment record. |
| `VITE_API_BASE_URL` | Public HTTPS base URL of the deployed Django API, if the Green Wallet adapter uses it. |
| `VITE_SIGNUP_API_URL` | Public HTTPS signup endpoint, for example `https://api.example.org/api/signup/`. |

Do not put Airtable credentials in Vite variables. `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, and Airtable table IDs belong only in the Django backend environment.

## First-time Netlify setup

Create a Netlify site and connect it to the repository, or create an empty site in the Netlify dashboard. Copy its Site ID. Generate a Netlify token with deployment permission. Add the token and Site ID to the GitHub `production` environment. Add the public API URL variables, then push a small change to `main` or manually dispatch the CI workflow to validate the build. A push to `main` will run CI and then the production deployment workflow.

The deployment workflow uses the Netlify CLI directly and publishes the already-built `dist` directory. Netlify should not receive the Airtable token, Django secret key, database URL, or any other backend secret.

## Backend deployment boundary

Netlify hosts the Vite frontend only. It does not replace the Django API service or its database. The Django API must be deployed separately to a service that supports Python/Django and managed PostgreSQL. Configure its production settings with `DEBUG=False`, a managed `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` containing the Netlify URL, `CSRF_TRUSTED_ORIGINS` containing the Netlify URL, and the Airtable variables. Run migrations as part of that backend’s deployment process before serving traffic.

Before enabling Green Wallet API-backed persistence, complete the authorization and idempotency requirements in `docs/DEPLOYMENT.md` and `docs/GREEN_WALLET_API_CONTRACT.md`.

## Recommended rollout

Use a Netlify deploy preview for pull requests and production deploys only from `main`. Keep the Django API in staging until CORS, CSRF, authentication, participant filtering, migration behavior, and Airtable sync have been verified. After the first successful production frontend deploy, verify the Netlify URL, call the API health endpoint, and complete the browser checks listed in `docs/DEPLOYMENT.md`.
