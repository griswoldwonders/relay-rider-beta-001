from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction


MIGRATION_VERSION = '20260902053135'
MIGRATION_NAME = 'rule2202_calculation_functions'


class Command(BaseCommand):
    help = 'Install and verify the canonical Rule 2202 PostgreSQL calculation functions.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--verify-only',
            action='store_true',
            help='Verify the expected functions without executing the migration SQL.',
        )

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError('Rule 2202 functions require PostgreSQL; refusing to install on a non-PostgreSQL database.')

        migration_path = (
            Path(__file__).resolve().parents[4]
            / 'supabase'
            / 'migrations'
            / f'{MIGRATION_VERSION}_{MIGRATION_NAME}.sql'
        )
        if not migration_path.exists():
            raise CommandError(f'Canonical Rule 2202 migration not found: {migration_path}')

        if not options['verify_only']:
            sql = migration_path.read_text(encoding='utf-8')
            with transaction.atomic():
                with connection.cursor() as cursor:
                    # Django's canonical connection normally uses
                    # search_path=relay_app,public. The historical Rule 2202
                    # migration contains unqualified CREATE FUNCTION names,
                    # so pin this transaction to public to reproduce the
                    # deployed Supabase location rather than creating a
                    # second relay_app copy.
                    cursor.execute('set local search_path = public')
                    cursor.execute(sql)
            self.stdout.write(self.style.SUCCESS(f'Installed Rule 2202 SQL from {migration_path.name} into public schema'))

        checks = [
            ('calculate_avr', 'select public.calculate_avr(%s::integer, %s::numeric)', [100, 80], '1.25'),
            ('vehicle_trip_weight', "select public.vehicle_trip_weight('carpool'::text, %s::integer)", [2], '0.500000'),
            ('get_avr_zone_target', 'select public.get_avr_zone_target(%s::integer)', [1], '1.75'),
        ]
        for label, sql, params, expected in checks:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(sql, params)
                    value = cursor.fetchone()[0]
            except Exception as exc:
                raise CommandError(f'{label} function is unavailable to the configured Django database role') from exc
            if str(value) != expected:
                raise CommandError(f'{label} verification failed: expected {expected}, got {value}')

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "select is_valid, reason from public.validate_avr_survey(%s::numeric, %s::date, %s::date)",
                    [0.60, '2026-01-01', '2026-06-01'],
                )
                is_valid, reason = cursor.fetchone()
        except Exception as exc:
            raise CommandError('validate_avr_survey is unavailable to the configured Django database role') from exc
        if is_valid is not True or reason is not None:
            raise CommandError(f'validate_avr_survey verification failed: is_valid={is_valid}, reason={reason}')

        self.stdout.write(self.style.SUCCESS(
            f'Rule 2202 calculation functions verified ({MIGRATION_VERSION}_{MIGRATION_NAME}).'
        ))
