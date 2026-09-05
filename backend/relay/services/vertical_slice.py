from django.db import transaction

from relay.services.core_engine import score_import
from relay.services.decisioning import build_decision_card
from relay.services.ingestion import import_commute_csv
from relay.services.rule2202 import run_rule2202


@transaction.atomic
def run_vertical_slice(*, institution, site, cohort, data_source, actor, file_name, csv_content, rule2202_calculator=None):
    commute_import = import_commute_csv(
        institution=institution,
        site=site,
        cohort=cohort,
        data_source=data_source,
        actor=actor,
        file_name=file_name,
        content=csv_content,
    )
    scores = score_import(commute_import, actor=actor)
    rule2202_run = run_rule2202(commute_import, actor=actor, calculator=rule2202_calculator)
    decision_card = build_decision_card(commute_import, rule2202_run, actor=actor)
    return {
        'commute_import': commute_import,
        'scores': scores,
        'rule2202_run': rule2202_run,
        'decision_card': decision_card,
    }
