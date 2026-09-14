from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from relay.models import CommuteImport
from relay.services.evidence_projection import PROJECTOR_VERSION, project_commute_import_to_evidence


class Command(BaseCommand):
    help = (
        'Project one canonical CommuteImport into public evidence tables using an '
        'explicit EvidenceProjectionBinding. Research-beta calculation output only; '
        'not Rule 2202 certification.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--import-id', type=int, required=True, help='Canonical CommuteImport primary key.')
        parser.add_argument('--baseline-id', default=None, help='Optional public evidence_baselines UUID.')
        parser.add_argument('--observation-period-id', default=None, help='Optional public evidence_observation_periods UUID.')

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError('Evidence projection requires PostgreSQL.')
        commute_import = CommuteImport.objects.select_related(
            'institution', 'site', 'cohort', 'data_source'
        ).filter(pk=options['import_id']).first()
        if commute_import is None:
            raise CommandError(f'CommuteImport {options["import_id"]} was not found.')

        result = project_commute_import_to_evidence(
            commute_import,
            baseline_id=options['baseline_id'],
            observation_period_id=options['observation_period_id'],
        )
        payload = result.to_dict()
        self.stdout.write(self.style.SUCCESS(
            f'canonical_import_id={commute_import.id} '
            f'inserted={payload["inserted"]} updated={payload["updated"]} '
            f'skipped={payload["skipped"]} blocked={payload["blocked"]} '
            f'failed={payload["failed"]} projector={PROJECTOR_VERSION} '
            'regulatory_status=calculation_output_only_not_certification '
            'research_beta=true'
        ))
