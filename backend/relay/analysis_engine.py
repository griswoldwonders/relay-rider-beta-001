import hashlib
import json
from collections import Counter

from django.db import transaction
from django.utils import timezone

from .models import AnalysisMetric, AnalysisRun, CanonicalCommuterRecord

ENGINE_VERSION = "core-v1"
CONFIGURATION_VERSION = "default-v1"
CODE_VERSION = "relay-rider-beta-001"


def _stable_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sha256(value):
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _time_text(value):
    return value.isoformat(timespec="minutes") if value else None


def _canonical_payload(record):
    return {
        "participant_key": record.participant_key,
        "origin_zone": record.origin_zone,
        "destination_zone": record.destination_zone,
        "commute_days": sorted(record.commute_days or []),
        "arrival_window_start": _time_text(record.arrival_window_start),
        "arrival_window_end": _time_text(record.arrival_window_end),
        "departure_window_start": _time_text(record.departure_window_start),
        "departure_window_end": _time_text(record.departure_window_end),
        "flexibility_minutes": record.flexibility_minutes,
        "current_mode": record.current_mode,
        "vehicle_classification": record.vehicle_classification,
        "commute_distance_miles": str(record.commute_distance_miles) if record.commute_distance_miles is not None else None,
        "commute_time_minutes": record.commute_time_minutes,
        "parking_difficulty": record.parking_difficulty,
        "ev_hybrid_signal": record.ev_hybrid_signal,
        "canonicalization_version": record.canonicalization_version,
    }


def _schedule_bucket(record):
    value = record.arrival_window_start
    if value is None:
        return "unknown"
    if value.hour < 10:
        return "morning"
    if value.hour < 15:
        return "midday"
    return "evening"


def _source_manifest(batch, record_count):
    return {
        "import_batch_id": batch.pk,
        "file_sha256": batch.file_sha256,
        "schema_version": batch.schema_version,
        "canonical_record_count": record_count,
    }


def _metric(*, run, key, evidence_class, value, unit="", method, source_manifest, confidence="", caveat="", wording=""):
    return AnalysisMetric.objects.create(
        institution=run.institution,
        analysis_run=run,
        metric_key=key,
        evidence_class=evidence_class,
        value=value,
        unit=unit,
        source_manifest=source_manifest,
        method_identifier=method,
        confidence=confidence,
        privacy_treatment="aggregated_approximate_zones",
        caveat=caveat,
        partner_wording=wording,
    )


def run_core_analysis(*, batch, requested_by):
    records = list(
        CanonicalCommuterRecord.objects.filter(source_row__batch=batch).order_by("participant_key", "pk")
    )
    canonical_payload = [_canonical_payload(record) for record in records]
    canonical_fingerprint = _sha256(canonical_payload)
    reproducibility_fingerprint = _sha256(
        {
            "source_file_sha256": batch.file_sha256,
            "schema_version": batch.schema_version,
            "canonical_dataset_fingerprint": canonical_fingerprint,
            "engine_version": ENGINE_VERSION,
            "configuration_version": CONFIGURATION_VERSION,
            "code_version": CODE_VERSION,
        }
    )

    run = AnalysisRun(
        institution=batch.institution,
        site=batch.site,
        cohort=batch.cohort,
        source_batch=batch,
        requested_by=requested_by,
        engine_version=ENGINE_VERSION,
        configuration_version=CONFIGURATION_VERSION,
        code_version=CODE_VERSION,
        canonical_dataset_fingerprint=canonical_fingerprint,
        reproducibility_fingerprint=reproducibility_fingerprint,
        status="running",
        started_at=timezone.now(),
    )
    run.full_clean()
    run.save()

    try:
        with transaction.atomic():
            source_manifest = _source_manifest(batch, len(records))
            modes = Counter(record.current_mode or "unknown" for record in records)
            origins = Counter(record.origin_zone for record in records)
            schedules = Counter(_schedule_bucket(record) for record in records)
            gasoline_sov_count = sum(
                1
                for record in records
                if record.current_mode == "drive_alone" and record.vehicle_classification in {"gasoline", "diesel"}
            )
            parking_pressure_count = sum(
                1 for record in records if record.parking_difficulty in {"high", "difficult", "severe"}
            )
            ev_hybrid_count = sum(
                1
                for record in records
                if record.vehicle_classification in {"ev", "zev", "phev", "hybrid"} or bool(record.ev_hybrid_signal)
            )
            top_origins = sorted(origins.items(), key=lambda item: (-item[1], item[0]))[:5]

            _metric(
                run=run,
                key="record_count_accepted",
                evidence_class="observed",
                value=batch.accepted_rows,
                unit="records",
                method=f"{ENGINE_VERSION}:accepted_rows",
                source_manifest=source_manifest,
                wording="Accepted commuter records in the supplied dataset.",
            )
            _metric(
                run=run,
                key="record_count_rejected",
                evidence_class="observed",
                value=batch.rejected_rows,
                unit="records",
                method=f"{ENGINE_VERSION}:rejected_rows",
                source_manifest=source_manifest,
                wording="Rejected commuter rows in the supplied dataset.",
            )
            _metric(
                run=run,
                key="mode_distribution",
                evidence_class="calculated",
                value=dict(sorted(modes.items())),
                unit="records",
                method=f"{ENGINE_VERSION}:mode_distribution",
                source_manifest=source_manifest,
                wording="Commute mode distribution calculated from accepted records.",
            )
            _metric(
                run=run,
                key="gasoline_sov_count",
                evidence_class="calculated",
                value=gasoline_sov_count,
                unit="records",
                method=f"{ENGINE_VERSION}:gasoline_sov_count",
                source_manifest=source_manifest,
                caveat="Counts accepted records classified as drive-alone with gasoline or diesel vehicles; it does not prove behavior change potential.",
                wording="Gasoline/diesel drive-alone records identified in the accepted dataset.",
            )
            _metric(
                run=run,
                key="origin_zone_concentration",
                evidence_class="calculated",
                value=dict(sorted(origins.items())),
                unit="records",
                method=f"{ENGINE_VERSION}:origin_zone_concentration",
                source_manifest=source_manifest,
                caveat="Uses participant-supplied approximate origin zones, not precise residential locations.",
                wording="Accepted commuter records grouped by approximate origin zone.",
            )
            _metric(
                run=run,
                key="schedule_cluster_counts",
                evidence_class="calculated",
                value=dict(sorted(schedules.items())),
                unit="records",
                method=f"{ENGINE_VERSION}:schedule_clusters",
                source_manifest=source_manifest,
                caveat="Time bands are deterministic analytical buckets, not service availability or route commitments.",
                wording="Accepted records grouped into broad arrival-time bands.",
            )
            _metric(
                run=run,
                key="parking_pressure_signal",
                evidence_class="modeled",
                value={"high_difficulty_records": parking_pressure_count, "accepted_records": len(records)},
                unit="records",
                method=f"{ENGINE_VERSION}:parking_pressure_signal",
                source_manifest=source_manifest,
                confidence="directional",
                caveat="Based on submitted parking-difficulty signals; it is not observed parking occupancy.",
                wording="Modeled parking-pressure signal from submitted commuter records.",
            )
            _metric(
                run=run,
                key="ev_hybrid_signal_count",
                evidence_class="calculated",
                value=ev_hybrid_count,
                unit="records",
                method=f"{ENGINE_VERSION}:ev_hybrid_signal_count",
                source_manifest=source_manifest,
                caveat="Vehicle classification or EV/hybrid interest is participant-supplied unless separately verified.",
                wording="Accepted records with EV/hybrid vehicle or participation signals.",
            )
            _metric(
                run=run,
                key="corridor_opportunity",
                evidence_class="modeled",
                value={
                    "gasoline_sov_count": gasoline_sov_count,
                    "high_parking_difficulty_count": parking_pressure_count,
                    "top_origin_zones": [[zone, count] for zone, count in top_origins],
                },
                method=f"{ENGINE_VERSION}:corridor_opportunity",
                source_manifest=source_manifest,
                confidence="modeled",
                caveat="A prioritization signal only. It does not guarantee route density, transportation availability, parking reduction, emissions reduction, or participant conversion.",
                wording="Modeled corridor opportunity for administrative investigation.",
            )

            run.status = "completed"
            run.completed_at = timezone.now()
            run.save(update_fields=["status", "completed_at", "updated_at"])
    except Exception as exc:
        run.status = "failed"
        run.completed_at = timezone.now()
        run.error_code = exc.__class__.__name__
        run.error_detail = str(exc)[:2000]
        run.save(update_fields=["status", "completed_at", "error_code", "error_detail", "updated_at"])
        raise

    return run
