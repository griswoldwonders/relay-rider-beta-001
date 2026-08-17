# Relay Rider backend (Django)

A Django + Django REST Framework API for the Relay Rider prototype, replacing the
never-deployed `supabase/migrations` blueprint at the repository root. It models
the same domain the frontend already uses in `src/types.ts` (route signals, EV
participant signals, Relay Zones, corridor summaries, Green Route Credits, user
profiles) and the roles/review statuses from
`supabase/migrations/202607270001_security_foundation.sql`.

This is prototype/research-beta infrastructure. It is **not** reviewed for real
participant data, payments, or production traffic — see the guardrails in the
repository root `README.md` and `SECURITY.md`.

## Stack

- Django 6.1
- Django REST Framework
- django-cors-headers (for the Vite dev server on `http://localhost:5173`)
- SQLite for local development (swap `DATABASES` in `config/settings.py` for a
  real environment)

## Local development

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser   # for /admin/
python manage.py runserver
```

The API is served at `http://127.0.0.1:8000/api/`, admin at
`http://127.0.0.1:8000/admin/`.

## Endpoints

Standard DRF `ModelViewSet` CRUD + pagination at:

- `/api/profiles/`
- `/api/route-signals/`
- `/api/ev-participant-signals/`
- `/api/relay-zones/`
- `/api/corridors/`
- `/api/green-route-credits/`

## Configuration

Environment variables (all optional, sane local defaults):

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG` (`True`/`False`)
- `DJANGO_ALLOWED_HOSTS` (comma-separated)
- `DJANGO_CORS_ALLOWED_ORIGINS` (comma-separated, defaults to the Vite dev
  server on port 5173)

## Not yet done

- No authentication/authorization wired up yet (DRF views are open in this
  scaffold) — the `AppRole`/`ReviewStatus` choices exist on the models but
  request-level permission checks still need to be added before any real data
  flows through this.
- Frontend (`src/`) still holds all prototype state in session memory and does
  not call this API yet — wiring that up is a separate follow-up.
- No production deployment config (WSGI/ASGI server, Postgres, secrets
  management) — this is local-dev scaffolding only.
