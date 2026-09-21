from decimal import Decimal

from django.db import connection, transaction

from relay.models import AssessmentAuditEvent, Rule2202CalculationRun


CALCULATION_VERSION = 'rule2202-sql-20260902053135'


class Rule2202Unavailable(RuntimeError):
    pass


class DatabaseRule2202Calculator:
    """Calls the canonical PostgreSQL Rule 2202 calculation functions.

    The functions are defined in
    supabase/migrations/20260902053135_rule2202_calculation_functions.sql.
    This adapter never substitutes a second formula implementation. If the
    active database is not PostgreSQL or the functions cannot be verified,
    the assessment is blocked.
    """

    def _scalar(self, sql, params):
        if connection.vendor != 'postgresql':
            raise Rule2202Unavailable('Rule 2202 SQL functions require the canonical PostgreSQL database')
        try:
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                row = cursor.fetchone()
        except Exception as exc:
            raise Rule2202Unavailable(
                'Rule 2202 SQL functions are unavailable; verify '
                '20260902053135_rule2202_calculation_functions.sql before running assessments'
            ) from exc
        return row[0] if row else None

    def vehicle_trip_weight(self, mode, occupants=None):
        return self._scalar('select public.vehicle_trip_weight(%s, %s)', [mode, occupants])

    def calculate_avr(self, employees, vehicle_trips):
        return self._scalar('select public.calculate_avr(%s, %s)', [employees, vehicle_trips])


@transaction.atomic
def run_rule2202(commute_import, actor=None, calculator=None):
    calculator = calculator or DatabaseRule2202Calculator()
    valid_records = list(commute_import.records.filter(validation_status='valid').order_by('id'))

    run = Rule2202CalculationRun.objects.create(
        institution=commute_import.institution,
        site=commute_import.site,
        cohort=commute_import.cohort,
        commute_import=commute_import,
        initiated_by=actor,
        status='pending',
        calculation_version=CALCULATION_VERSION,
        input_snapshot={
            'valid_record_count': len(valid_records),
            'source_import_id': commute_import.id,
            'source_file_sha256': commute_import.file_sha256,
        },
        validation_snapshot={
            'invalid_record_count': commute_import.invalid_rows,
            'source_provenance': commute_import.data_source.provenance_label,
        },
    )

    try:
        weights = [
            Decimal(str(calculator.vehicle_trip_weight(record.current_mode, record.occupants)))
            for record in valid_records
        ]
        vehicle_trips = sum(weights, Decimal('0'))
        avr = calculator.calculate_avr(len(valid_records), vehicle_trips)
    except Rule2202Unavailable as exc:
        run.status = 'blocked'
        run.blocked_reason = str(exc)
        run.save(update_fields=['status', 'blocked_reason', 'updated_at'])
        AssessmentAuditEvent.objects.create(
            institution=commute_import.institution,
            site=commute_import.site,
            actor=actor,
            action='rule2202.blocked',
            entity_type='Rule2202CalculationRun',
            entity_id=str(run.id),
            metadata={'reason': str(exc), 'calculation_version': CALCULATION_VERSION},
        )
        return run
    except Exception as exc:
        run.status = 'failed'
        run.blocked_reason = str(exc)
        run.save(update_fields=['status', 'blocked_reason', 'updated_at'])
        AssessmentAuditEvent.objects.create(
            institution=commute_import.institution,
            site=commute_import.site,
            actor=actor,
            action='rule2202.failed',
            entity_type='Rule2202CalculationRun',
            entity_id=str(run.id),
            metadata={'error_type': exc.__class__.__name__, 'calculation_version': CALCULATION_VERSION},
        )
        return run

    run.status = 'completed'
    run.result_snapshot = {
        'window_employees': len(valid_records),
        'window_vehicle_trips': str(vehicle_trips),
        'avr': str(avr) if avr is not None else None,
        'metric_scope': 'vertical_slice_demo',
        'regulatory_status': 'calculation_output_only_not_certification',
    }
    run.save(update_fields=['status', 'result_snapshot', 'updated_at'])

    AssessmentAuditEvent.objects.create(
        institution=commute_import.institution,
        site=commute_import.site,
        actor=actor,
        action='rule2202.completed',
        entity_type='Rule2202CalculationRun',
        entity_id=str(run.id),
        metadata={'calculation_version': CALCULATION_VERSION, 'avr': run.result_snapshot['avr']},
    )
    return run
