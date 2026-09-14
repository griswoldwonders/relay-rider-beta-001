from unittest.mock import patch

from django.test import SimpleTestCase

from config.env import build_databases, database_from_url, require_csv_env, require_env


class DatabaseUrlParsingTests(SimpleTestCase):
    def test_search_path_targets_relay_app_ahead_of_public(self):
        config = database_from_url(
            'postgresql://relay:secret@db.example:6543/postgres',
            schema='relay_app',
        )
        self.assertEqual(config['ENGINE'], 'django.db.backends.postgresql')
        self.assertEqual(config['NAME'], 'postgres')
        self.assertEqual(config['PORT'], '6543')
        self.assertEqual(config['OPTIONS']['sslmode'], 'require')
        self.assertEqual(config['OPTIONS']['options'], '-c search_path=relay_app,public')

    def test_explicit_sslmode_query_is_preserved(self):
        config = database_from_url(
            'postgres://relay:secret@127.0.0.1:5432/relay_rider_ci?sslmode=disable',
            schema='relay_app',
        )
        self.assertEqual(config['OPTIONS']['sslmode'], 'disable')
        self.assertEqual(config['OPTIONS']['options'], '-c search_path=relay_app,public')

    def test_reject_non_postgres_urls(self):
        with self.assertRaises(RuntimeError):
            database_from_url('sqlite:///tmp/db.sqlite3')


class ProductionFailClosedTests(SimpleTestCase):
    def test_debug_false_rejects_missing_database_url(self):
        with patch.dict('os.environ', {'DATABASE_URL': ''}, clear=False):
            with self.assertRaises(RuntimeError) as raised:
                build_databases(debug=False, sqlite_path='unused.sqlite3')
        self.assertIn('DATABASE_URL', str(raised.exception))

    def test_database_url_rejects_postgres_without_schema(self):
        with patch.dict(
            'os.environ',
            {
                'DATABASE_URL': 'postgresql://relay:secret@db.example:5432/postgres',
                'DJANGO_DB_SCHEMA': '',
            },
            clear=False,
        ):
            with self.assertRaises(RuntimeError) as raised:
                build_databases(debug=True, sqlite_path='unused.sqlite3')
        self.assertIn('DJANGO_DB_SCHEMA', str(raised.exception))

    def test_debug_true_allows_sqlite_without_database_url(self):
        with patch.dict('os.environ', {'DATABASE_URL': '', 'DJANGO_DB_SCHEMA': ''}, clear=False):
            config = build_databases(debug=True, sqlite_path='local.sqlite3')
        self.assertEqual(config['default']['ENGINE'], 'django.db.backends.sqlite3')

    def test_required_env_names_do_not_echo_values(self):
        with patch.dict('os.environ', {'DJANGO_SECRET_KEY': ''}, clear=False):
            with self.assertRaises(RuntimeError) as raised:
                require_env('DJANGO_SECRET_KEY')
        self.assertEqual(
            str(raised.exception),
            'DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false',
        )

    def test_wildcard_hosts_are_rejected(self):
        with patch.dict('os.environ', {'DJANGO_ALLOWED_HOSTS': '*'}, clear=False):
            with self.assertRaises(RuntimeError):
                require_csv_env('DJANGO_ALLOWED_HOSTS')

    def test_wildcard_cors_origins_are_rejected(self):
        with patch.dict('os.environ', {'DJANGO_CORS_ALLOWED_ORIGINS': '*'}, clear=False):
            with self.assertRaises(RuntimeError):
                require_csv_env('DJANGO_CORS_ALLOWED_ORIGINS')


class HealthEndpointTests(SimpleTestCase):
    def test_healthz_is_unauthenticated_and_does_not_advertise_admin(self):
        response = self.client.get('/healthz')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['service'], 'relay-rider-api')
        self.assertNotIn('admin', payload)

    def test_root_status_does_not_claim_a_local_only_service(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['service'], 'relay-rider-api')


class GunicornDependencyTests(SimpleTestCase):
    def test_gunicorn_is_importable(self):
        import gunicorn  # noqa: F401

        self.assertTrue(gunicorn.__name__)
