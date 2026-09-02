import csv
import hashlib
from io import StringIO

from django.core.exceptions import ValidationError
from django.db import transaction

from .import_schema import REQUIRED_HEADERS, SCHEMA_VERSION, normalize_and_validate_row
from .models import CanonicalCommuterRecord, ImportBatch, ImportRow


def _canonical_record_from_row(*, row, normalized):
    record = CanonicalCommuterRecord(
        institution=row.institution,
        site=row.site,
        cohort=row.cohort,
        source_row=row,
        participant_key=normalized["participant_key"],
        origin_zone=normalized["origin_zone"],
        destination_zone=normalized["destination_zone"],
        commute_days=normalized.get("commute_days", []),
        arrival_window_start=normalized.get("arrival_window_start") or None,
        arrival_window_end=normalized.get("arrival_window_end") or None,
        departure_window_start=normalized.get("departure_window_start") or None,
        departure_window_end=normalized.get("departure_window_end") or None,
        flexibility_minutes=normalized.get("flexibility_minutes", 0),
        current_mode=normalized.get("current_mode", ""),
        vehicle_classification=normalized.get("vehicle_classification", ""),
        commute_distance_miles=normalized.get("commute_distance_miles") or None,
        commute_time_minutes=normalized.get("commute_time_minutes"),
        parking_difficulty=normalized.get("parking_difficulty", ""),
        ev_hybrid_signal=normalized.get("ev_hybrid_signal", ""),
        canonicalization_version=SCHEMA_VERSION,
    )
    record.full_clean(exclude=["commute_days"])
    record.save()
    return record


def ingest_commuter_csv(*, file_obj, filename, institution, site, cohort, uploaded_by):
    raw_bytes = file_obj.read()
    if isinstance(raw_bytes, str):
        raw_bytes = raw_bytes.encode("utf-8")
    file_sha256 = hashlib.sha256(raw_bytes).hexdigest()

    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        ImportBatch.objects.create(
            institution=institution,
            site=site,
            cohort=cohort,
            uploaded_by=uploaded_by,
            original_filename=filename,
            file_sha256=file_sha256,
            schema_version=SCHEMA_VERSION,
            status="failed",
        )
        raise ValidationError({"file": "CSV must be UTF-8 encoded."}) from exc

    with transaction.atomic():
        batch = ImportBatch(
            institution=institution,
            site=site,
            cohort=cohort,
            uploaded_by=uploaded_by,
            original_filename=filename,
            file_sha256=file_sha256,
            schema_version=SCHEMA_VERSION,
            status="uploaded",
        )
        batch.full_clean()
        batch.save()

        reader = csv.DictReader(StringIO(text))
        headers = tuple(reader.fieldnames or ())
        missing_headers = [header for header in REQUIRED_HEADERS if header not in headers]
        if missing_headers:
            batch.status = "failed"
            batch.save(update_fields=["status", "updated_at"])
            raise ValidationError({"headers": f"Missing required headers: {', '.join(missing_headers)}"})

        seen_participants = set()
        accepted_count = 0
        rejected_count = 0
        total_count = 0

        for row_number, raw in enumerate(reader, start=1):
            total_count += 1
            raw_payload = {str(key): (value if value is not None else "") for key, value in raw.items() if key is not None}
            normalized, errors, warnings = normalize_and_validate_row(raw_payload)
            participant_key = normalized.get("participant_key", "")
            if participant_key:
                if participant_key in seen_participants:
                    errors = sorted(set(errors + ["duplicate_participant_key"]))
                else:
                    seen_participants.add(participant_key)

            validation_status = "rejected" if errors else "accepted"
            import_row = ImportRow(
                institution=institution,
                site=site,
                cohort=cohort,
                batch=batch,
                row_number=row_number,
                raw_payload=raw_payload,
                normalized_payload=normalized,
                validation_status=validation_status,
                error_codes=errors,
                warning_codes=warnings,
            )
            import_row.full_clean(exclude=["error_codes", "warning_codes"])
            import_row.save()

            if validation_status == "accepted":
                _canonical_record_from_row(row=import_row, normalized=normalized)
                accepted_count += 1
            else:
                rejected_count += 1

        batch.total_rows = total_count
        batch.accepted_rows = accepted_count
        batch.rejected_rows = rejected_count
        batch.status = "validated"
        batch.save(
            update_fields=[
                "total_rows",
                "accepted_rows",
                "rejected_rows",
                "status",
                "updated_at",
            ]
        )
        return batch
