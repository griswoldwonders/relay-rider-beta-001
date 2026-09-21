from relay.models import AssessmentAuditEvent, DecisionCard


def build_decision_card(commute_import, rule2202_run, actor=None):
    scores = list(commute_import.records.filter(validation_status='valid', engine_score__isnull=False).values_list('engine_score__score', flat=True))
    high_priority = sum(1 for score in scores if score >= 80)
    evidence = [
        {'label': 'Valid commuter records', 'value': commute_import.valid_rows, 'source': 'imported'},
        {'label': 'Invalid commuter records', 'value': commute_import.invalid_rows, 'source': 'validation'},
        {'label': 'High intervention-opportunity records', 'value': high_priority, 'source': 'modeled'},
    ]

    if rule2202_run.status == 'completed':
        avr = rule2202_run.result_snapshot.get('avr')
        evidence.append({'label': 'Calculated AVR', 'value': avr, 'source': 'Rule 2202 SQL calculation'})
        finding = f'{high_priority} of {commute_import.valid_rows} valid records meet the vertical-slice high opportunity threshold; calculated AVR is {avr}.'
        action = 'Review the corridor/participant segment and confirm program rules before selecting any governed intervention.'
        status = 'ready_for_review'
    else:
        evidence.append({'label': 'Rule 2202 calculation', 'value': rule2202_run.status, 'source': 'system'})
        finding = f'{high_priority} of {commute_import.valid_rows} valid records meet the vertical-slice high opportunity threshold. Rule 2202 output is not available.'
        action = 'Reconcile and verify the PostgreSQL Rule 2202 migration history, then rerun the calculation before using regulatory metrics.'
        status = 'draft'

    card = DecisionCard.objects.create(
        institution=commute_import.institution,
        site=commute_import.site,
        cohort=commute_import.cohort,
        commute_import=commute_import,
        rule2202_run=rule2202_run,
        status=status,
        title=f'{commute_import.site.name} commuter assessment decision card',
        finding=finding,
        evidence=evidence,
        interpretation='This is an institutional assessment preview. Modeled opportunity scores are not guaranteed outcomes, and Rule 2202 calculations are not regulatory certification or approval.',
        recommended_action=action,
        owner_label='Institution mobility program owner [NEEDS FOUNDER INPUT]',
        provenance={
            'commute_import_id': commute_import.id,
            'file_sha256': commute_import.file_sha256,
            'engine_version': 'institutional-opportunity-v1',
            'rule2202_version': rule2202_run.calculation_version,
        },
    )
    AssessmentAuditEvent.objects.create(
        institution=commute_import.institution,
        site=commute_import.site,
        actor=actor,
        action='decision_card.created',
        entity_type='DecisionCard',
        entity_id=str(card.id),
        metadata={'status': card.status, 'rule2202_run_id': rule2202_run.id},
    )
    return card
