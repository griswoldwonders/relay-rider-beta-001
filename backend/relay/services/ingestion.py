import csv
import hashlib
import io

from django.db import transaction

from relay.models import AssessmentAuditEvent, CommuteImport, CommuterRecord


REQUIRED_COLUMNS = {
    'external_id',
    'origin_zone',
    'destination_zone',
    'commute_days',
    'arrival_window',
    'departure_window',
    'current_mode',
    'consent_confirmed',
}

TRUTHY = {'1', 'true', 'yes', 'y'}
FALSY = {'0', 'false', 'no', 'n', ''}


def _parse_bool(value, field_name, errors):
    normalized = (value or '').strip().lower()
    if normalized in TRUTHY:
        return True
    if normalized in FALSY:
        return False
    errors.append(f'{field_name} must be yes/no or true/false')
    return False


def _parse_nonnegative_int(value, field_name, errors, *, optional=False):
    raw = (value or '').strip()
    if optional and raw == '':
        return None
    try:
        parsed = int(raw or '0')
    except ValueError:
        errors.append(f'{field_name} must be an integer')
        return None if optional else 0
    if parsed < 0:
        errors.append(f'{field_name} must be non-negative')
        return None if optional else 0
    return parsed


def _validate_row(row):
    errors = []
    for field in REQUIRED_COLUMNS:
        if not (row.get(field) or '').strip():
            errors.append(f'{field} is required')

    days = [day.strip() for day in (row.get('commute_days') or '').split('|') if day.strip()]
    flex = _parse_nonnegative_int(row.get('schedule_flex_minutes'), 'schedule_flex_minutes', errors)
    occupants = _parse_nonnegative_int(row.get('occupants'), 'occupants', errors, optional=True)
    ev_interest = _parse_bool(row.get('ev_interest'), 'ev_interest', errors)
    access_point_willing = _parse_bool(row.get('access_point_willing'), 'access_point_willing', errors)
    consent_confirmed = _parse_bool(row.get('consent_confirmed'), 'consent_confirmed', errors)

    mode = (row.get('current_mode') or '').strip().lower()
    if mode in {'carpool', 'vanpool', 'shared_motorcycle'} and not occupants:
        errors.append(f'occupants is required for {mode}')
    if mode == 'carpool' and occupants is not None and not 2 <= occupants <= 6:
        errors.append('carpool occupants must be between 2 and 6')
    if mode == 'vanpool' and occupants is not None and not 7 <= occupants <= 15:
        errors.append('vanpool occupants must be between 7 and 15')

    normalized = {
        'external_id': (row.get('external_id') or '').strip(),
        'origin_zone': (row.get('origin_zone') or '').strip(),
        'destination_zone': (row.get('destination_zone') or '').strip(),
        'commute_days': days,
        'arrival_window': (row.get('arrival_window') or '').strip(),
        'departure_window': (row.get('departure_window') or '').strip(),
        'schedule_flex_minutes': flex,
        'current_mode': mode,
        'occupants': occupants,
        'vehicle_fuel_type': (row.get('vehicle_fuel_type') or '').strip().lower(),
        'parking_difficulty': (row.get('parking_difficulty') or '').strip().lower(),
        'ev_interest': ev_interest,
        'access_point_willing': access_point_willing,
        'consent_confirmed': consent_confirmed,
    }
    return normalized, errors


@transaction.atomic
def import_commute_csv(*, institution, site, cohort, data_source, actor, file_name, content):
    """Validate and persist canonical commuter records with row-level provenance.

    Invalid rows are persisted with validation errors so source quality remains
    auditable. Only valid rows are eligible for downstream engine/calculation use.
    """

    if cohort.site_id != site.id or site.institution_id != institution.id or cohort.institution_id != institution.id:
        raise ValueError('institution/site/cohort hierarchy is inconsistent')
    if data_source.institution_id != institution.id or (data_source.site_id and data_source.site_id != site.id):
        raise ValueError('data source is outside the requested institution/site')

    encoded = content.encode('utf-8') if isinstance(content, str) else content
    text = encoded.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))
    headers = set(reader.fieldnames or [])
    missing = sorted(REQUIRED_COLUMNS - headers)
    if missing:
        raise ValueError(f'missing required CSV columns: {", ".join(missing)}')

    commute_import = CommuteImport.objects.create(
        institution=institution,
        site=site,
        cohort=cohort,
        data_source=data_source,
        imported_by=actor,
        file_name=file_name,
        file_sha256=hashlib.sha256(encoded).hexdigest(),
        status='pending',
    )

    valid_rows = 0
    invalid_rows = 0
    for row_number, row in enumerate(reader, start=2):
        normalized, errors = _validate_row(row)
        validation_status = 'invalid' if errors else 'valid'
        if errors:
            invalid_rows += 1
        else:
            valid_rows += 1

        CommuterRecord.objects.create(
            institution=institution,
            site=site,
            cohort=cohort,
            commute_import=commute_import,
            validation_status=validation_status,
            validation_errors=errors,
            source_row_number=row_number,
            source_payload=row,
            **normalized,
        )

    commute_import.total_rows = valid_rows + invalid_rows
    commute_import.valid_rows = valid_rows
    commute_import.invalid_rows = invalid_rows
    commute_import.status = 'validated' if invalid_rows == 0 else 'completed'
    commute_import.validation_summary = {
        'required_columns': sorted(REQUIRED_COLUMNS),
        'valid_rows': valid_rows,
        'invalid_rows': invalid_rows,
        'provenance_label': data_source.provenance_label,
    }
    commute_import.save(update_fields=[
        'total_rows', 'valid_rows', 'invalid_rows', 'status', 'validation_summary', 'updated_at'
    ])

    AssessmentAuditEvent.objects.create(
        institution=institution,
        site=site,
        actor=actor,
        action='commute_import.completed',
        entity_type='CommuteImport',
        entity_id=str(commute_import.id),
        metadata={
            'file_sha256': commute_import.file_sha256,
            'total_rows': commute_import.total_rows,
            'valid_rows': valid_rows,
            'invalid_rows': invalid_rows,
            'source_id': data_source.id,
        },
    )
    return commute_import
