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


@transaction.atomic
def import_commute_csv(*, institution, site, cohort, data_source, actor, file_name, content):
    """Validate and persist canonical commuter records with row-level provenance.

    Pandera owns the canonical tabular validation contract. Invalid rows are
    still persisted with retained validation errors so source quality remains
    auditable. Only valid rows are eligible for downstream engine/calculation
    use.
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
    for row_number, (raw_row, validation_result) in enumerate(zip(raw_rows, validated_rows), start=2):
        normalized, errors = validation_result
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
