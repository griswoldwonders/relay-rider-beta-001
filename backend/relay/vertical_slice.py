from __future__ import annotations

import csv
import hashlib
import io
import json
import os
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import connection, transaction

from .models import (
    AnalysisRun,
    Cohort,
    CommuterRecord,
    CorridorScore,
    DataSource,
    DecisionCard,
    ImportBatch,
    Membership,
    ReportExport,
    Rule2202CalculationRun,
    Rule2202Result,
    Site,
    SourceRecord,
    ValidationIssue,
)

REQUIRED_CSV_FIELDS = {
    'origin_zone',
    'destination_zone',
    'commute_mode',
    'days_per_week',
    'arrival_time',
    'departure_time',
    'vehicle_type',
    'ev_hybrid',
}

ALLOWED_MODES = {
    'drive_alone', 'carpool', 'vanpool', 'shared_motorcycle', 'transit',
    'bus_pool', 'bicycle', 'walk', 'telecommute', 'cww_day_off', 'zev',
    'non_commuting',
}


def _require_institution_staff(actor, institution_id):
    if not actor or not actor.is_authenticated:
        raise PermissionDenied('Authenticated institutional staff membership is required.')
    membership = Membership.objects.filter(user=actor, institution_id=institution_id).first()
    if membership and membership.role in {'institution_admin', 'program_staff'}:
        return membership
    if Membership.objects.filter(user=actor, role='platform_admin').exists():
        return None
    raise PermissionDenied('Institution admin or program staff membership is required.')


def _parse_time(value):
    value = (value or '').strip()
    if not value:
        return None
    for pattern in ('%H:%M', '%I:%M %p'):
        try:
            return datetime.strptime(value, pattern).time()
        except ValueError:
            pass
    raise ValueError('time must be HH:MM or h:mm AM/PM')


def _parse_bool(value):
    normalized = (value or '').strip().lower()
    if normalized in {'1', 'true', 'yes', 'y'}:
        return True
    if normalized in {'0', 'false', 'no', 'n', ''}:
        return False
    raise ValueError('ev_hybrid must be yes/no or true/false')


@transaction.atomic
def import_commute_csv(*, actor, site: Site, cohort: Cohort, data_source: DataSource, filename: str, csv_text: str) -> ImportBatch:
    """Persist source evidence, validation issues, and canonical commuter records.

    Exact home addresses are intentionally unsupported. The import schema only
    accepts general origin/destination zones.
    """
    institution = site.program.institution
    _require_institution_staff(actor, institution.id)
    if cohort.site_id != site.id:
        raise ValidationError('Cohort must belong to the selected site.')
    if data_source.institution_id != institution.id or data_source.site_id != site.id:
        raise ValidationError('Data source must belong to the selected institution and site.')

    digest = hashlib.sha256(csv_text.encode('utf-8')).hexdigest()
    batch = ImportBatch.objects.create(
        institution=institution,
        site=site,
        cohort=cohort,
        data_source=data_source,
        filename=filename,
        sha256=digest,
        status='received',
    )

    reader = csv.DictReader(io.StringIO(csv_text))
    headers = set(reader.fieldnames or [])
    missing_headers = sorted(REQUIRED_CSV_FIELDS - headers)
    if missing_headers:
        batch.status = 'failed'
        batch.save(update_fields=['status', 'updated_at'])
        raise ValidationError(f'Missing required CSV fields: {", ".join(missing_headers)}')

    total = valid = invalid = 0
    for row_number, raw in enumerate(reader, start=2):
        total += 1
        normalized = {key: (value.strip() if isinstance(value, str) else value) for key, value in raw.items()}
        record = SourceRecord.objects.create(
            import_batch=batch,
            row_number=row_number,
            raw_payload=raw,
            normalized_payload=normalized,
            is_valid=False,
        )
        issues = []

        for field in ('origin_zone', 'destination_zone', 'commute_mode'):
            if not normalized.get(field):
                issues.append((field, 'required', f'{field} is required'))

        mode = normalized.get('commute_mode', '').lower()
        if mode and mode not in ALLOWED_MODES:
            issues.append(('commute_mode', 'unsupported_mode', f'unsupported commute_mode: {mode}'))

        try:
            days = int(normalized.get('days_per_week') or 0)
            if days < 1 or days > 7:
                raise ValueError
        except ValueError:
            days = 0
            issues.append(('days_per_week', 'invalid_range', 'days_per_week must be an integer from 1 to 7'))

        try:
            arrival_time = _parse_time(normalized.get('arrival_time'))
        except ValueError as exc:
            arrival_time = None
            issues.append(('arrival_time', 'invalid_time', str(exc)))

        try:
            departure_time = _parse_time(normalized.get('departure_time'))
        except ValueError as exc:
            departure_time = None
            issues.append(('departure_time', 'invalid_time', str(exc)))

        try:
            ev_hybrid = _parse_bool(normalized.get('ev_hybrid'))
        except ValueError as exc:
            ev_hybrid = False
            issues.append(('ev_hybrid', 'invalid_boolean', str(exc)))

        if issues:
            invalid += 1
            ValidationIssue.objects.bulk_create([
                ValidationIssue(source_record=record, field=field, code=code, message=message)
                for field, code, message in issues
            ])
            continue

        record.is_valid = True
        record.save(update_fields=['is_valid', 'updated_at'])
        CommuterRecord.objects.create(
            institution=institution,
            site=site,
            cohort=cohort,
            source_record=record,
            participant_ref=normalized.get('participant_ref', ''),
            origin_zone=normalized['origin_zone'],
            destination_zone=normalized['destination_zone'],
            commute_mode=mode,
            days_per_week=days,
            arrival_time=arrival_time,
            departure_time=departure_time,
            vehicle_type=normalized.get('vehicle_type', ''),
            ev_hybrid=ev_hybrid,
        )
        valid += 1

    batch.row_count = total
    batch.valid_row_count = valid
    batch.invalid_row_count = invalid
    batch.status = 'completed' if valid else 'failed'
    batch.save(update_fields=['row_count', 'valid_row_count', 'invalid_row_count', 'status', 'updated_at'])
    return batch


def _time_band(record):
    if not record.arrival_time:
        return 'unknown'
    hour = record.arrival_time.hour
    if 5 <= hour < 10:
        return 'am_peak'
    if 15 <= hour < 19:
        return 'pm_peak'
    return 'off_peak'


@transaction.atomic
def run_core_engine(*, actor, import_batch: ImportBatch) -> AnalysisRun:
    """Create an auditable prototype corridor-opportunity scoring run.

    The score is an explainable prototype heuristic, not a transportation
    guarantee: 50% corridor demand concentration + 30% gasoline-SOV share +
    20% EV/hybrid overlap signal.
    """
    _require_institution_staff(actor, import_batch.institution_id)
    records = list(CommuterRecord.objects.filter(source_record__import_batch=import_batch))
    input_snapshot = {
        'import_batch_id': import_batch.id,
        'import_sha256': import_batch.sha256,
        'canonical_record_ids': [record.id for record in records],
        'record_count': len(records),
    }
    run = AnalysisRun.objects.create(
        institution=import_batch.institution,
        site=import_batch.site,
        cohort=import_batch.cohort,
        import_batch=import_batch,
        method_version='core-v1-prototype',
        status='draft',
        input_snapshot=input_snapshot,
    )

    grouped = defaultdict(list)
    for record in records:
        grouped[(record.origin_zone, record.destination_zone)].append(record)

    total_records = max(len(records), 1)
    for (origin, destination), corridor_records in grouped.items():
        commuter_count = len(corridor_records)
        sov_count = sum(1 for r in corridor_records if r.commute_mode == 'drive_alone' and not r.ev_hybrid)
        ev_count = sum(1 for r in corridor_records if r.ev_hybrid or r.commute_mode == 'zev')
        demand_concentration = Decimal(commuter_count) / Decimal(total_records)
        sov_share = Decimal(sov_count) / Decimal(commuter_count)
        ev_overlap = Decimal(ev_count) / Decimal(commuter_count)
        score = (demand_concentration * Decimal('50')) + (sov_share * Decimal('30')) + (ev_overlap * Decimal('20'))
        score = score.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        CorridorScore.objects.create(
            analysis_run=run,
            origin_zone=origin,
            destination_zone=destination,
            commuter_count=commuter_count,
            sov_count=sov_count,
            ev_hybrid_count=ev_count,
            compatibility_score=score,
            score_explanation={
                'method': 'prototype corridor opportunity heuristic',
                'demand_concentration': str(demand_concentration.quantize(Decimal('0.0001'))),
                'gasoline_sov_share': str(sov_share.quantize(Decimal('0.0001'))),
                'ev_hybrid_overlap_signal': str(ev_overlap.quantize(Decimal('0.0001'))),
                'weights': {'demand': 50, 'gasoline_sov': 30, 'ev_hybrid_overlap': 20},
                'time_bands': sorted({_time_band(r) for r in corridor_records}),
            },
        )

    run.status = 'completed'
    run.save(update_fields=['status', 'updated_at'])
    return run


class Rule2202Gateway:
    """Adapter around the existing PostgreSQL Rule 2202 SQL functions.

    Database execution is fail-closed until migration history is reconciled
    and RULE2202_DB_FUNCTIONS_VERIFIED=true is explicitly configured.
    """

    def _assert_verified(self):
        if os.environ.get('RULE2202_DB_FUNCTIONS_VERIFIED', '').lower() != 'true':
            raise RuntimeError('Rule 2202 database functions are not marked deployed/verified.')
        if connection.vendor != 'postgresql':
            raise RuntimeError('Verified Rule 2202 database mode requires PostgreSQL.')

    def vehicle_trip_weight(self, mode, occupants=None):
        self._assert_verified()
        with connection.cursor() as cursor:
            cursor.execute('SELECT vehicle_trip_weight(%s, %s)', [mode, occupants])
            return Decimal(cursor.fetchone()[0])

    def calculate_avr(self, employees, vehicle_trips):
        self._assert_verified()
        with connection.cursor() as cursor:
            cursor.execute('SELECT calculate_avr(%s, %s)', [employees, vehicle_trips])
            value = cursor.fetchone()[0]
            return Decimal(value) if value is not None else None


class ReferenceRule2202Evaluator:
    """Development-only reference simulation mirroring the SQL contract.

    This is intentionally labeled simulation. It is not evidence that the
    Supabase migration has been deployed and is not regulatory certification.
    """

    ZERO_MODES = {'transit', 'bus_pool', 'bicycle', 'walk', 'telecommute', 'cww_day_off', 'zev', 'non_commuting'}

    def vehicle_trip_weight(self, mode, occupants=None):
        if mode in self.ZERO_MODES:
            return Decimal('0')
        if mode in {'carpool', 'vanpool', 'shared_motorcycle'} and occupants:
            return Decimal('1') / Decimal(occupants)
        return Decimal('1')

    def calculate_avr(self, employees, vehicle_trips):
        if not vehicle_trips:
            return None
        return (Decimal(employees) / Decimal(vehicle_trips)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


@transaction.atomic
def run_rule2202(*, actor, analysis_run: AnalysisRun, execution_mode='reference_simulation') -> Rule2202CalculationRun:
    _require_institution_staff(actor, analysis_run.institution_id)
    records = list(CommuterRecord.objects.filter(source_record__import_batch=analysis_run.import_batch))
    evaluator = Rule2202Gateway() if execution_mode == 'database_functions' else ReferenceRule2202Evaluator()
    deployment_verified = execution_mode == 'database_functions'
    source_note = (
        'Executed against verified deployed PostgreSQL functions from 202609020001.'
        if deployment_verified
        else 'Reference simulation only. Supabase migration history remains unreconciled; this does not establish deployed Rule 2202 functionality.'
    )
    run = Rule2202CalculationRun.objects.create(
        analysis_run=analysis_run,
        execution_mode=execution_mode,
        status='completed',
        deployment_verified=deployment_verified,
        source_note=source_note,
        input_snapshot={
            'canonical_record_ids': [record.id for record in records],
            'record_count': len(records),
            'execution_mode': execution_mode,
        },
    )

    weights = []
    for record in records:
        # Occupancy is deliberately not inferred. Until an occupancy field is
        # imported, carpool/vanpool rows fall back to one vehicle trip in the
        # reference simulation; verified DB mode will reject invalid occupancy
        # if its SQL contract requires it.
        weights.append(evaluator.vehicle_trip_weight(record.commute_mode, None))
    vehicle_trips = sum(weights, Decimal('0'))
    avr = evaluator.calculate_avr(len(records), vehicle_trips)
    Rule2202Result.objects.create(
        calculation_run=run,
        metric='employee_count',
        value=Decimal(len(records)),
        unit='employees',
        explanation='Canonical valid commuter records included in this assessment run.',
    )
    Rule2202Result.objects.create(
        calculation_run=run,
        metric='weighted_vehicle_trips',
        value=vehicle_trips,
        unit='vehicle_trips',
        explanation='Vehicle-trip weights applied using the selected Rule 2202 execution mode.',
    )
    Rule2202Result.objects.create(
        calculation_run=run,
        metric='avr',
        value=avr,
        unit='persons_per_vehicle',
        explanation='Average Vehicle Ridership result for this demonstration assessment input.',
    )
    return run


@transaction.atomic
def build_decision_card(*, actor, analysis_run: AnalysisRun) -> DecisionCard:
    _require_institution_staff(actor, analysis_run.institution_id)
    top = analysis_run.corridor_scores.order_by('-compatibility_score', '-commuter_count').first()
    rule_run = getattr(analysis_run, 'rule2202_run', None)
    avr_result = None
    if rule_run:
        avr_result = rule_run.results.filter(metric='avr').first()

    if top:
        summary = (
            f'{top.origin_zone} → {top.destination_zone} is the highest-scoring corridor in this '
            f'prototype assessment, based on {top.commuter_count} canonical commuter records.'
        )
        action = (
            'Review this corridor for a controlled institution-sponsored intervention: validate schedule overlap, '
            'review candidate Access Points, and test an EV/hybrid-forward commuter option with administrative review.'
        )
        corridor = {
            'origin_zone': top.origin_zone,
            'destination_zone': top.destination_zone,
            'compatibility_score': str(top.compatibility_score),
            'commuter_count': top.commuter_count,
            'gasoline_sov_count': top.sov_count,
            'ev_hybrid_count': top.ev_hybrid_count,
        }
    else:
        summary = 'No valid commuter corridor could be scored from the imported evidence.'
        action = 'Resolve source-data validation issues before selecting a corridor intervention.'
        corridor = None

    findings = {
        'source_import': {
            'batch_id': analysis_run.import_batch_id,
            'sha256': analysis_run.import_batch.sha256,
            'valid_rows': analysis_run.import_batch.valid_row_count,
            'invalid_rows': analysis_run.import_batch.invalid_row_count,
        },
        'top_corridor': corridor,
        'rule2202': {
            'run_id': rule_run.id if rule_run else None,
            'execution_mode': rule_run.execution_mode if rule_run else None,
            'deployment_verified': rule_run.deployment_verified if rule_run else False,
            'avr': str(avr_result.value) if avr_result and avr_result.value is not None else None,
        },
    }
    caveats = [
        'Corridor compatibility is an estimated prototype score, not a guaranteed commuter option.',
        'Access Points require institutional/field review before program use.',
        'This Decision Card is administrative decision support, not regulatory certification or compliance approval.',
    ]
    if not rule_run or not rule_run.deployment_verified:
        caveats.append('Rule 2202 output is a reference simulation until Supabase migration history is reconciled and database deployment is verified.')

    return DecisionCard.objects.create(
        institution=analysis_run.institution,
        site=analysis_run.site,
        analysis_run=analysis_run,
        title=f'{analysis_run.site.name} TDM Decision Card',
        status='draft',
        summary=summary,
        findings=findings,
        recommended_action=action,
        caveats=caveats,
    )


def dashboard_output(decision_card: DecisionCard):
    """Backend dashboard contract; intentionally no new UI in this slice."""
    scores = decision_card.analysis_run.corridor_scores.order_by('-compatibility_score')
    return {
        'institution': decision_card.institution.name,
        'site': decision_card.site.name,
        'decision_card_id': decision_card.id,
        'status': decision_card.status,
        'summary': decision_card.summary,
        'recommended_action': decision_card.recommended_action,
        'findings': decision_card.findings,
        'caveats': decision_card.caveats,
        'corridors': [
            {
                'origin_zone': score.origin_zone,
                'destination_zone': score.destination_zone,
                'compatibility_score': str(score.compatibility_score),
                'commuter_count': score.commuter_count,
                'gasoline_sov_count': score.sov_count,
                'ev_hybrid_count': score.ev_hybrid_count,
                'explanation': score.score_explanation,
            }
            for score in scores
        ],
    }


@transaction.atomic
def export_decision_card(*, actor, decision_card: DecisionCard, format='json') -> ReportExport:
    _require_institution_staff(actor, decision_card.institution_id)
    payload = dashboard_output(decision_card)
    if format == 'json':
        content = json.dumps(payload, indent=2, sort_keys=True)
        filename = f'decision-card-{decision_card.id}.json'
    elif format == 'csv':
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['origin_zone', 'destination_zone', 'compatibility_score', 'commuter_count', 'gasoline_sov_count', 'ev_hybrid_count'])
        for corridor in payload['corridors']:
            writer.writerow([
                corridor['origin_zone'], corridor['destination_zone'], corridor['compatibility_score'],
                corridor['commuter_count'], corridor['gasoline_sov_count'], corridor['ev_hybrid_count'],
            ])
        content = output.getvalue()
        filename = f'decision-card-{decision_card.id}-corridors.csv'
    else:
        raise ValidationError('Export format must be json or csv.')

    return ReportExport.objects.create(
        decision_card=decision_card,
        format=format,
        filename=filename,
        content=content,
        sha256=hashlib.sha256(content.encode('utf-8')).hexdigest(),
    )
