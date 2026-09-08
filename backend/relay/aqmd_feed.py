"""Read-only downstream feed for the AQMD/Rule 2202 module.

The beta Django/PostgreSQL domain is authoritative for commuter records. This
endpoint exposes a versioned, institution-scoped projection for downstream
analysis; it is not a second persistence authority and never accepts writes.
"""

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views import View

from .models import CommuterRecord, Institution, Rule2202CalculationRun
from .permissions import user_is_platform_admin, user_staff_institution_ids


AQMD_FEED_CONTRACT_VERSION = "rr-aqmd-feed-v1"


class InstitutionAqmdFeedView(View):
    """Return validated, field-minimized commuter evidence for AQMD analysis."""

    def get(self, request, institution_id):
        user = request.user
        if not user or not user.is_authenticated:
            return JsonResponse({"detail": "Authentication required."}, status=401)

        if not user_is_platform_admin(user) and institution_id not in user_staff_institution_ids(user):
            return JsonResponse({"detail": "You are not authorized for this institution."}, status=403)

        institution = get_object_or_404(Institution, pk=institution_id)
        imports = list(
            institution.commute_imports.select_related("site", "cohort", "data_source")
            .order_by("id")
        )
        import_by_id = {item.id: item for item in imports}

        records = (
            CommuterRecord.objects.filter(
                institution=institution,
                validation_status="valid",
            )
            .select_related("site", "cohort", "commute_import", "commute_import__data_source")
            .order_by("id")
        )

        rows = []
        for record in records:
            source_import = import_by_id.get(record.commute_import_id) or record.commute_import
            rows.append({
                "record_id": str(record.id),
                "external_id": record.external_id,
                "organization_id": str(institution.id),
                "institution_id": str(institution.id),
                "site_id": str(record.site_id),
                "site_name": record.site.name,
                "cohort_id": str(record.cohort_id),
                "cohort_name": record.cohort.name,
                "origin_zone": record.origin_zone,
                "destination_zone": record.destination_zone,
                "commute_days": record.commute_days,
                "arrival_window": record.arrival_window,
                "departure_window": record.departure_window,
                "schedule_flex_minutes": record.schedule_flex_minutes,
                "commute_mode": record.current_mode,
                "vehicle_occupancy": record.occupants,
                "vehicle_fuel_type": record.vehicle_fuel_type,
                "parking_difficulty": record.parking_difficulty,
                "ev_interest": record.ev_interest,
                "access_point_willing": record.access_point_willing,
                "consent_confirmed": record.consent_confirmed,
                "validation_status": record.validation_status,
                "source_import_id": str(record.commute_import_id),
                "source_row_number": record.source_row_number,
                "source_sha256": source_import.file_sha256,
                "source_provenance": source_import.data_source.provenance_label,
                "source_type": source_import.data_source.source_type,
                "record_created_at": record.created_at.isoformat(),
                "record_updated_at": record.updated_at.isoformat(),
            })

        runs = (
            Rule2202CalculationRun.objects.filter(institution=institution)
            .select_related("site", "cohort", "commute_import")
            .order_by("-created_at")
        )
        run_payload = [{
            "run_id": str(run.id),
            "site_id": str(run.site_id),
            "cohort_id": str(run.cohort_id),
            "source_import_id": str(run.commute_import_id),
            "status": run.status,
            "calculation_version": run.calculation_version,
            "input_snapshot": run.input_snapshot,
            "result_snapshot": run.result_snapshot,
            "validation_snapshot": run.validation_snapshot,
            "blocked_reason": run.blocked_reason,
            "created_at": run.created_at.isoformat(),
            "updated_at": run.updated_at.isoformat(),
        } for run in runs]

        import_payload = [{
            "import_id": str(item.id),
            "site_id": str(item.site_id),
            "cohort_id": str(item.cohort_id),
            "file_name": item.file_name,
            "file_sha256": item.file_sha256,
            "status": item.status,
            "total_rows": item.total_rows,
            "valid_rows": item.valid_rows,
            "invalid_rows": item.invalid_rows,
            "validation_summary": item.validation_summary,
            "source_type": item.data_source.source_type,
            "provenance_label": item.data_source.provenance_label,
            "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat(),
        } for item in imports]

        response = JsonResponse({
            "contract_version": AQMD_FEED_CONTRACT_VERSION,
            "generated_at": __import__("django.utils.timezone", fromlist=["now"]).now().isoformat(),
            "institution": {
                "id": str(institution.id),
                "name": institution.name,
                "slug": institution.slug,
            },
            "guardrails": {
                "source_of_truth": "relay-rider-beta-django",
                "downstream_consumer": "aqmd-module-tool",
                "writes_to_beta": False,
                "rule2202_is_certification": False,
                "records_are_validated_only": True,
            },
            "imports": import_payload,
            "records": rows,
            "rule2202_runs": run_payload,
        })
        response["Cache-Control"] = "no-store"
        response["X-Relay-Rider-Feed-Contract"] = AQMD_FEED_CONTRACT_VERSION
        return response
