import json

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from relay.models import Cohort, DataSource, Institution, Membership, Program, Site
from relay.vertical_slice import (
    build_decision_card,
    dashboard_output,
    export_decision_card,
    import_commute_csv,
    run_core_engine,
    run_rule2202,
)


DEMO_CSV = """participant_ref,origin_zone,destination_zone,commute_mode,days_per_week,arrival_time,departure_time,vehicle_type,ev_hybrid
P001,Eagle Rock,Pasadena,drive_alone,5,08:00,17:00,gasoline,false
P002,Eagle Rock,Pasadena,drive_alone,4,08:15,17:10,gasoline,false
P003,Eagle Rock,Pasadena,zev,5,08:10,17:15,bev,true
P004,Glendale,Pasadena,drive_alone,5,08:30,17:30,gasoline,false
P005,Glendale,Pasadena,zev,4,08:20,17:20,phev,true
P006,Highland Park,Pasadena,transit,5,08:00,17:00,,false
"""


class Command(BaseCommand):
    help = (
        'Build one fictional, local institutional vertical slice. '
        'Uses reference-simulation Rule 2202 mode unless --verified-rule2202 is supplied. '
        'This command does not alter Supabase migration history or deploy production schema.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--verified-rule2202', action='store_true')

    def handle(self, *args, **options):
        User = get_user_model()
        user, _ = User.objects.get_or_create(username='relay-demo-admin', defaults={'email': 'demo@example.invalid'})
        institution, _ = Institution.objects.get_or_create(
            slug='fictional-pasadena-institution',
            defaults={'name': 'Fictional Pasadena Institution', 'status': 'active'},
        )
        Membership.objects.update_or_create(
            user=user,
            institution=institution,
            defaults={'role': 'institution_admin'},
        )
        program, _ = Program.objects.get_or_create(
            institution=institution,
            slug='commute-readiness-demo',
            defaults={'name': 'Commute Readiness Demonstration', 'status': 'draft'},
        )
        site, _ = Site.objects.get_or_create(
            program=program,
            slug='pasadena-campus',
            defaults={'name': 'Pasadena Campus', 'general_location': 'Pasadena, CA'},
        )
        cohort, _ = Cohort.objects.get_or_create(
            site=site,
            slug='weekday-commuters',
            defaults={'name': 'Weekday Commuters', 'description': 'Synthetic demonstration cohort.'},
        )
        source, _ = DataSource.objects.get_or_create(
            institution=institution,
            site=site,
            name='Synthetic CSV demonstration',
            defaults={
                'source_type': 'csv',
                'provenance_note': 'Fictional synthetic data for architecture verification only.',
            },
        )

        batch = import_commute_csv(
            actor=user,
            site=site,
            cohort=cohort,
            data_source=source,
            filename='fictional_pasadena_commute.csv',
            csv_text=DEMO_CSV,
        )
        analysis = run_core_engine(actor=user, import_batch=batch)
        rule_mode = 'database_functions' if options['verified_rule2202'] else 'reference_simulation'
        rule_run = run_rule2202(actor=user, analysis_run=analysis, execution_mode=rule_mode)
        card = build_decision_card(actor=user, analysis_run=analysis)
        json_export = export_decision_card(actor=user, decision_card=card, format='json')
        csv_export = export_decision_card(actor=user, decision_card=card, format='csv')

        self.stdout.write(json.dumps(dashboard_output(card), indent=2))
        self.stdout.write(self.style.SUCCESS(
            f'Created import batch {batch.id}, analysis run {analysis.id}, Rule 2202 run {rule_run.id}, '
            f'Decision Card {card.id}, exports {json_export.filename} and {csv_export.filename}.'
        ))
        if not rule_run.deployment_verified:
            self.stdout.write(self.style.WARNING(
                'Rule 2202 result is REFERENCE SIMULATION ONLY. Migration deployment remains unverified.'
            ))
