from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

ENV_USERNAME = 'DJANGO_SUPERUSER_USERNAME'
ENV_EMAIL = 'DJANGO_SUPERUSER_EMAIL'
ENV_PASSWORD = 'DJANGO_SUPERUSER_PASSWORD'


class Command(BaseCommand):
    """Idempotently provision the pilot's Django admin superuser.

    Reads credentials from DJANGO_SUPERUSER_USERNAME/EMAIL/PASSWORD so no
    password is ever hardcoded in source or committed to the repo. Safe to
    run on every deploy: if a user with that username already exists, this
    is a no-op rather than an error, unlike `createsuperuser --noinput`.
    """

    help = "Create the pilot's Django admin superuser from env vars if it doesn't already exist."

    def handle(self, *args, **options):
        username = os.environ.get(ENV_USERNAME)
        email = os.environ.get(ENV_EMAIL)
        password = os.environ.get(ENV_PASSWORD)

        missing = [name for name, value in (
            (ENV_USERNAME, username),
            (ENV_EMAIL, email),
            (ENV_PASSWORD, password),
        ) if not value]
        if missing:
            raise CommandError(
                'Refusing to provision an admin user: missing required environment '
                f'variable(s) {", ".join(missing)}. Set them (e.g. in your deploy '
                'secrets manager) and re-run this command; no default credentials '
                'are used.'
            )

        User = get_user_model()
        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(
                f'Admin user "{username}" already exists; leaving it unchanged.'
            ))
            return

        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f'Created admin superuser "{username}".'))
