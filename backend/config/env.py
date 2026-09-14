"""Environment parsing for Django settings.

Local/debug keeps zero-secret SQLite defaults. Production (DJANGO_DEBUG=false)
fails closed: no SQLite fallback, no default SECRET_KEY, and no wildcard hosts
or CORS origins.
"""

from __future__ import annotations

import os
import re
from urllib.parse import parse_qs, unquote, urlparse

_SCHEMA_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


def env_flag(name: str, default: str) -> bool:
    return os.environ.get(name, default).strip().lower() in ('1', 'true', 'yes')


def parse_csv_env(name: str, default: str = '') -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(',') if item.strip()]


def require_env(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if not value:
        raise RuntimeError(f'{name} is required when DJANGO_DEBUG is false')
    return value


def require_csv_env(name: str) -> list[str]:
    values = parse_csv_env(name)
    if not values:
        raise RuntimeError(f'{name} is required when DJANGO_DEBUG is false')
    if any(value == '*' for value in values):
        raise RuntimeError(f'{name} must not include *')
    return values


def database_from_url(database_url: str, *, schema: str = '', conn_max_age: int = 60) -> dict:
    """Translate a PostgreSQL DATABASE_URL into Django database settings.

    When schema is set (production canonical value: relay_app), libpq search_path
    is `{schema},public`. Unqualified Django DDL then lands in that schema and
    does not create or replace public.evidence_* / public.rule2202_* objects.
    public remains on the path so evidence projection can read/write the
    existing public evidence contract by qualified name.
    """
    parsed = urlparse(database_url)
    if parsed.scheme not in ('postgres', 'postgresql'):
        raise RuntimeError('DATABASE_URL must use postgres:// or postgresql://')

    query = parse_qs(parsed.query)
    options = {
        'sslmode': query.get('sslmode', ['require'])[0],
        'connect_timeout': int(query.get('connect_timeout', ['10'])[0]),
    }
    if schema:
        if not _SCHEMA_RE.fullmatch(schema):
            raise RuntimeError('DJANGO_DB_SCHEMA must be a simple PostgreSQL identifier')
        options['options'] = f'-c search_path={schema},public'

    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': unquote(parsed.path.lstrip('/')),
        'USER': unquote(parsed.username or ''),
        'PASSWORD': unquote(parsed.password or ''),
        'HOST': parsed.hostname or '',
        'PORT': str(parsed.port or 5432),
        'CONN_MAX_AGE': conn_max_age,
        'OPTIONS': options,
    }


def build_databases(*, debug: bool, sqlite_path, conn_max_age: int | None = None) -> dict:
    database_url = os.environ.get('DATABASE_URL', '').strip()
    schema = os.environ.get('DJANGO_DB_SCHEMA', '').strip()
    if conn_max_age is None:
        conn_max_age = int(os.environ.get('DJANGO_DB_CONN_MAX_AGE', '60'))

    if database_url:
        if not schema:
            raise RuntimeError('DJANGO_DB_SCHEMA is required when DATABASE_URL is set')
        return {'default': database_from_url(database_url, schema=schema, conn_max_age=conn_max_age)}

    if debug:
        return {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': sqlite_path}}

    raise RuntimeError('DATABASE_URL is required when DJANGO_DEBUG is false')
