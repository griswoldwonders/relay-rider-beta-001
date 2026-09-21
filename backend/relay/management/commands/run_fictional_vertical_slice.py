from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from relay.models import Cohort, DataSource, Institution, Membership, Site
from relay.services.exports import dashboard_payload
from relay.services.vertical_slice import run_vertical_slice


class Command(BaseCommand):
    help = 'Run the fictional Pasadena institutional vertical slice using the committed synthetic CSV fixture.'

    def handle(self, *args, **options):
        User = get_user_model()
        user, _ = User.objects.get_or_create(username='fictional-institution-admin', defaults={'email': 'fictional@example.invalid'})
        institution, _ = Institution.objects.get_or_create(
            slug='fictional-pasadena-mobility-demo',
            defaults={'name': 'Fictional Pasadena Mobility Demo', 'status': 'active'},
        )
        Membership.objects.get_or_create(user=user, institution=institution, defaults={'role': 'institution_admin'})
        site, _ = Site.objects.get_or_create(
            institution=institution,
            slug='pasadena-campus-demo',
            defaults={'name': 'Pasadena Campus Demo', 'site_type': 'campus', 'city': 'Pasadena'},
        )
        cohort, _ = Cohort.objects.get_or_create(
            institution=institution,
            site=site,
            slug='fall-demo-cohort',
            defaults={'name': 'Fall Demo Cohort', 'cohort_type': 'synthetic_demo'},
        )
        data_source, _ = DataSource.objects.get_or_create(
            institution=institution,
            site=site,
            name='Fictional Pasadena commute fixture',
            defaults={
                'source_type': 'synthetic',
                'provenance_label': 'synthetic',
                'source_reference': 'backend/relay/fixtures/fictional_pasadena_commute.csv',
                'metadata': {'fictional': True},
            },
        )

        fixture_path = Path(__file__).resolve().parents[2] / 'fixtures' / 'fictional_pasadena_commute.csv'
        result = run_vertical_slice(
            institution=institution,
            site=site,
            cohort=cohort,
            data_source=data_source,
            actor=user,
            file_name=fixture_path.name,
            csv_content=fixture_path.read_text(encoding='utf-8'),
        )
        self.stdout.write(self.style.SUCCESS(
            f"Imported {result['commute_import'].valid_rows} valid rows; "
            f"Rule 2202 status={result['rule2202_run'].status}; "
            f"Decision Card={result['decision_card'].id}"
        ))
        self.stdout.write(str(dashboard_payload(institution)))
        if result['rule2202_run'].status != 'completed':
            self.stdout.write(self.style.WARNING(
                'Rule 2202 is intentionally blocked until the PostgreSQL function migration history is reconciled and verified.'
            ))
