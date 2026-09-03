from django.db import transaction

from relay.models import AssessmentAuditEvent, EngineScore


ENGINE_VERSION = 'institutional-opportunity-v1'


def score_commuter_record(record):
    """Return a transparent intervention-opportunity signal, not a ride offer.

    This score is intentionally narrow for the vertical slice. It prioritizes
    gasoline drive-alone records with reported parking friction plus flexibility
    or Access Point willingness. It is not a regulatory, safety, or route-match
    certification and must not be presented as one.
    """

    factors = {
        'drive_alone': 35 if record.current_mode == 'drive_alone' else 0,
        'gasoline_vehicle': 25 if record.vehicle_fuel_type in {'gasoline', 'gas', 'ice'} else 0,
        'parking_pressure': 20 if record.parking_difficulty in {'high', 'very_high', 'very high'} else 10 if record.parking_difficulty == 'medium' else 0,
        'access_point_willing': 10 if record.access_point_willing else 0,
        'schedule_flexibility': 10 if record.schedule_flex_minutes >= 15 else 5 if record.schedule_flex_minutes > 0 else 0,
    }
    score = min(100, sum(factors.values()))

    reasons = []
    if factors['drive_alone']:
        reasons.append('current mode is drive-alone')
    if factors['gasoline_vehicle']:
        reasons.append('vehicle is reported as gasoline/ICE')
    if factors['parking_pressure']:
        reasons.append(f'parking difficulty is reported as {record.parking_difficulty or "unknown"}')
    if factors['access_point_willing']:
        reasons.append('participant is willing to use a reviewed Access Point')
    if factors['schedule_flexibility']:
        reasons.append(f'{record.schedule_flex_minutes} minutes of schedule flexibility is reported')
    explanation = '; '.join(reasons) if reasons else 'No high-priority intervention factors were present in this record.'
    return score, factors, explanation


@transaction.atomic
def score_import(commute_import, actor=None):
    scores = []
    for record in commute_import.records.filter(validation_status='valid').order_by('id'):
        score, factors, explanation = score_commuter_record(record)
        engine_score, _ = EngineScore.objects.update_or_create(
            commuter_record=record,
            defaults={
                'institution': commute_import.institution,
                'site': commute_import.site,
                'cohort': commute_import.cohort,
                'score_type': 'intervention_opportunity',
                'score': score,
                'factors': factors,
                'explanation': explanation,
                'engine_version': ENGINE_VERSION,
            },
        )
        scores.append(engine_score)

    AssessmentAuditEvent.objects.create(
        institution=commute_import.institution,
        site=commute_import.site,
        actor=actor,
        action='core_engine.scored',
        entity_type='CommuteImport',
        entity_id=str(commute_import.id),
        metadata={'records_scored': len(scores), 'engine_version': ENGINE_VERSION},
    )
    return scores
