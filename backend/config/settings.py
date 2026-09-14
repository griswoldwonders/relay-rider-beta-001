import os
from pathlib import Path

from .env import (
    build_databases,
    env_flag,
    parse_csv_env,
    require_csv_env,
    require_env,
)

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = env_flag('DJANGO_DEBUG', 'true')

if DEBUG:
    SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-only-relay-rider-local-key')
    ALLOWED_HOSTS = parse_csv_env('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost')
    CORS_ALLOWED_ORIGINS = parse_csv_env(
        'DJANGO_CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173',
    )
    RELAY_EVIDENCE_PARTICIPANT_KEY_SECRET = os.environ.get(
        'RELAY_EVIDENCE_PARTICIPANT_KEY_SECRET',
        '',
    ).strip()
else:
    SECRET_KEY = require_env('DJANGO_SECRET_KEY')
    ALLOWED_HOSTS = require_csv_env('DJANGO_ALLOWED_HOSTS')
    CORS_ALLOWED_ORIGINS = require_csv_env('DJANGO_CORS_ALLOWED_ORIGINS')
    RELAY_EVIDENCE_PARTICIPANT_KEY_SECRET = require_env(
        'RELAY_EVIDENCE_PARTICIPANT_KEY_SECRET'
    )

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'relay',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CSRF_TRUSTED_ORIGINS = parse_csv_env('DJANGO_CSRF_TRUSTED_ORIGINS') or list(CORS_ALLOWED_ORIGINS)

ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = build_databases(debug=DEBUG, sqlite_path=BASE_DIR / 'db.sqlite3')

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/Los_Angeles'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
if not DEBUG:
    STORAGES = {
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
        },
    }
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    # Do not enable SECURE_SSL_REDIRECT. Render health checks hit the
    # container over HTTP; TLS is terminated at the proxy.

RELAY_H3_RESOLUTION = int(os.environ.get('RELAY_H3_RESOLUTION', '7'))
RELAY_H3_MIN_PUBLISHABLE_COUNT = int(
    os.environ.get('RELAY_H3_MIN_PUBLISHABLE_COUNT', '5')
)

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
}
