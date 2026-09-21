import csv
import hashlib
import io

from django.db import transaction

from relay.models import AssessmentAuditEvent, CommuteImport, CommuterRecord
from relay.services.commute_schema import (
    COMMUTE_IMPORT_SCHEMA,
    REQUIRED_COLUMNS,
    missing_required_columns,
    validate_and_normalize_rows,
)


def _window_order_error(value, field_name):
    """Return a deterministic audit error when a HH:MM-HH:MM window is reversed."""

    raw = str(value or '').strip()
    parts = raw.split('-', 1)
    if len(parts) != 2:
        return None
    start, end = (part.strip() for part in parts)
    if len(start) != 5 or len(end) != 5:
        return None
    try:
        start_hour, start_minute = (int(part) for part in start.split(':', 1))
        end_hour, end_minute = (int(part) for part in end.split(':', 1))
    except (TypeError, ValueError):
        return None
    if not (0 <= start_hour <= 23 and 0 <= end_hour <= 23 and 0 <= start_minute <= 59 and 0 <= end_minute <= 59):
        return None
    if (start_hour, start_minute) >= (end_hour, end_minute):
        return f'{field_name} start must be before end'
    return None


def _additional_import_errors(raw_row):
    """Validate import-level invariants that are not row-shape concerns."""

    errors = []
    for field_name in ('arrival_window', 'departure_window'):
        error = _window_order_error(raw_row.get(field_name), field_name)
        if error:
            errors.append(error)

    mode = str(raw_row.get('current_mode') or '').strip().lower()
    fuel_type = str(raw_row.get('vehicle_fuel_type') or '').strip().lower()
    if mode == 'drive_alone' and fuel_type in {'', 'none', 'unknown'}:
        errors.append('vehicle_fuel_type is required for drive_alone')
    return errors


@transaction.atomic
def import_commute_csv(*, institution, site, cohort, data_source, actor, file_name, content):
    """Validate and persist canonical commuter records with row-level provenance.

    Pandera owns the canonical tabular validation contract. Invalid rows are
    retained with validation evidence so source quality remains auditable. Rows
    that cannot satisfy a canonical database invariant, such as a duplicate
    external ID within one import, are retained in the import validation summary
    rather than inserted as conflicting CommuterRecord rows. Only valid rows are
    eligible for downstream engine/calculation use.
    """

    if cohort.site_id != site.id or site.institution_id != institution.id or cohort.institution_id != institution.id:
        raise ValueError('institution/site/cohort hierarchy is inconsistent')
    if data_source.institution_id != institution.id or (data_source.site_id and data_source.site_id != site.id):
        raise ValueError('data source is outside the requested institution/site')

    encoded = content.encode('utf-8') if isinstance(content, str) else content
    text = encoded.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))
    headers = set(reader.fieldnames or [])
    missing = missing_required_columns(headers)
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

    raw_rows = list(reader)
    validated_rows = validate_and_normalize_rows(raw_rows)

    valid_rows = 0
    invalid_rows = 0
    rejected_rows = []
    seen_external_ids = set()
    for row_number, (raw_row, validation_result) in enumerate(zip(raw_rows, validated_rows), start=2):
        normalized, schema_errors = validation_result
        errors = list(schema_errors)
        errors.extend(_additional_import_errors(raw_row))

        external_id = normalized['external_id']
        duplicate_external_id = bool(external_id) and external_id in seen_external_ids
        if external_id:
            seen_external_ids.add(external_id)
        if duplicate_external_id:
            errors.append('external_id must be unique within import')
            invalid_rows += 1
            rejected_rows.append({
                'source_row_number': row_number,
                'external_id': external_id,
                'validation_errors': errors,
                'source_payload': raw_row,
            })
            continue

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
            source_payload=raw_row,
            **normalized,
        )

    commute_import.total_rows = len(raw_rows)
    commute_import.valid_rows = valid_rows
    commute_import.invalid_rows = invalid_rows
    commute_import.status = 'validated' if invalid_rows == 0 else 'completed'
    commute_import.validation_summary = {
        'required_columns': sorted(REQUIRED_COLUMNS),
        'valid_rows': valid_rows,
        'invalid_rows': invalid_rows,
        'rejected_rows': rejected_rows,
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
            'rejected_rows': len(rejected_rows),
            'source_id': data_source.id,
        },
    )
    return commute_import
