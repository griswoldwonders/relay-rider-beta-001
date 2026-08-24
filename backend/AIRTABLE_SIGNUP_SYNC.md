# Relay Rider — Airtable Signup Sync (Local Backend)

This adds a best-effort sync from the app's signup flows (Commuter Onboarding
and EV/Hybrid Route Participant) into the "Relay Rider Beta Operations"
Airtable base, via the local Django backend as a server-side proxy.

## Why a proxy is required

Airtable's API key must never be sent from the browser — anyone could read
it out of the network tab or bundled JS and write/delete records in your
base. `backend/relay/airtable_client.py` and `backend/relay/signup_view.py`
keep that key server-side. The frontend only ever talks to the local Django
API (`src/lib/signupApi.ts`), never to Airtable directly.

## Current status: local development only

**This sync currently only works when you run the app locally.** The Django
backend runs at `127.0.0.1:8877` — your own machine — and the deployed
Netlify site cannot reach `127.0.0.1` on your computer. Signups submitted
on the live Netlify site will complete normally (session-memory UX is
unaffected) but will NOT sync to Airtable until the backend is deployed
somewhere publicly reachable (e.g. Render, Railway, Fly.io) and
`VITE_SIGNUP_API_URL` is set to that deployed URL at build time.

## Running it locally

1. Backend:
   ```bash
   cd backend
   python -m pip install -r requirements.txt
   python manage.py migrate
   export AIRTABLE_API_KEY=pat_your_token_here
   export AIRTABLE_BASE_ID=app9jtYqDweiUkC8e
   export AIRTABLE_PARTICIPANTS_TABLE_ID=tblHPcUGbQ2jmkuKT
   python manage.py runserver 127.0.0.1:8877
   ```
   If the three `AIRTABLE_*` env vars are unset, the endpoint still works —
   it just skips the Airtable sync and reports `airtable.synced: false` with
   a reason. Local Profile/RouteSignal/EVParticipantSignal rows are always
   saved regardless of Airtable configuration.

2. Frontend (separate terminal):
   ```bash
   npm run dev
   ```
   The dev server's CORS origin (`http://localhost:5173` /
   `http://127.0.0.1:5173`) is already allowlisted in
   `backend/config/settings.py`.

3. Complete the Commuter Onboarding or EV Participant flow in the app.
   Both now collect Full Name + Email as required fields at submission and
   POST to `POST /api/signup/` on completion (fire-and-forget — the flow's
   success screen shows regardless of sync outcome).

## What gets synced

Each signup creates one row in the Airtable **Participants** table
(`tblHPcUGbQ2jmkuKT`) with: Participant Name, User ID (local Profile PK),
Role, Email, Corridor, Status (`Lead`), consent checkboxes, and a Notes
field marking it as submitted via the app form.

**Known terminology note:** the Participants table's Role field currently
only offers `Driver`/`Rider` as options — these are the retired terms
flagged in the repo audit. `signup_view.py`'s `ROLE_TO_AIRTABLE` mapping
uses them because that's what the live Airtable schema requires today; this
is a follow-up item, not something this proxy can silently fix without
changing the Airtable base's own field configuration.

## Endpoint contract

`POST /api/signup/`

```json
{
  "role": "commuter" | "ev_participant",
  "name": "string (required)",
  "email": "string (required)",
  "originArea": "string",
  "destinationArea": "string",
  "timeWindow": "string",
  "corridor": "string",
  "vehicleType": "string (ev_participant only)",
  "adultConfirmed": true,
  "researchConsent": true
}
```

Response (`201 Created`):
```json
{
  "profileId": 52,
  "role": "ev_participant",
  "airtable": { "synced": true, "reason": null }
}
```

## Follow-up items (not built yet)

- Deploy the Django backend somewhere reachable from the live Netlify site,
  then set `VITE_SIGNUP_API_URL` at Netlify build time.
- Decide whether Airtable is the long-term system of record, or whether
  this should instead point at the (currently unapplied) Supabase schema
  in `supabase/migrations/` per the repo's architecture audit.
- Resolve the Role field's `Driver`/`Rider` naming against the repo's
  preferred terminology.
