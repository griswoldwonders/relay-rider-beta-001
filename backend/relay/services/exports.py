import csv
import io

from relay.models import DecisionCard


def dashboard_payload(institution):
    latest_card = DecisionCard.objects.filter(institution=institution).select_related(
        'site', 'cohort', 'commute_import', 'rule2202_run'
    ).order_by('-created_at').first()

    payload = {
        'institution': {'id': institution.id, 'name': institution.name, 'slug': institution.slug},
        'summary': {
            'sites': institution.sites.count(),
            'cohorts': institution.cohorts.count(),
            'commuter_records': institution.commuter_records.count(),
            'valid_commuter_records': institution.commuter_records.filter(validation_status='valid').count(),
            'decision_cards': institution.decision_cards.count(),
        },
        'latest_decision_card': None,
        'guardrails': {
            'rule2202_is_certification': False,
            'live_transportation': False,
            'modeled_outputs_must_preserve_provenance': True,
        },
    }
    if latest_card:
        payload['latest_decision_card'] = {
            'id': latest_card.id,
            'status': latest_card.status,
            'title': latest_card.title,
            'finding': latest_card.finding,
            'evidence': latest_card.evidence,
            'interpretation': latest_card.interpretation,
            'recommended_action': latest_card.recommended_action,
            'site': latest_card.site.name,
            'cohort': latest_card.cohort.name,
            'rule2202_status': latest_card.rule2202_run.status if latest_card.rule2202_run else None,
            'provenance': latest_card.provenance,
        }
    return payload


def commuter_records_csv(institution):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        'external_id', 'site', 'cohort', 'origin_zone', 'destination_zone',
        'current_mode', 'vehicle_fuel_type', 'parking_difficulty',
        'engine_score', 'engine_version', 'validation_status', 'source_import_id',
    ])
    records = institution.commuter_records.select_related('site', 'cohort').order_by('id')
    for record in records:
        try:
            engine_score = record.engine_score
        except Exception:
            engine_score = None
        writer.writerow([
            record.external_id,
            record.site.name,
            record.cohort.name,
            record.origin_zone,
            record.destination_zone,
            record.current_mode,
            record.vehicle_fuel_type,
            record.parking_difficulty,
            engine_score.score if engine_score else '',
            engine_score.engine_version if engine_score else '',
            record.validation_status,
            record.commute_import_id,
        ])
    return buffer.getvalue()
