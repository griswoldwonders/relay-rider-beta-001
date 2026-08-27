from __future__ import annotations

import time
from dataclasses import dataclass
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from relay.airtable_client import (
    AirtableSyncError,
    AirtableSyncSkipped,
    get_table_id,
    is_configured,
    upsert_record,
)
from relay.models import (
    ChargingHub,
    EVParticipantSignal,
    GreenRouteCredit,
    Profile,
    RedemptionRequest,
    RouteSignal,
)


@dataclass
class SyncStats:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0

    def record(self, action: str):
        if action == "created":
            self.created += 1
        elif action == "updated":
            self.updated += 1
        elif action == "skipped":
            self.skipped += 1
        else:
            self.failed += 1

    @property
    def total(self):
        return self.created + self.updated + self.skipped + self.failed


class Command(BaseCommand):
    help = "Bulk-sync authorized local Relay Rider records to Airtable."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Print records without sending them to Airtable.")
        parser.add_argument("--profile-id", type=int, help="Sync one profile and its related records only.")
        parser.add_argument("--limit", type=int, help="Limit records per resource for a controlled pilot run.")
        parser.add_argument("--resource", choices=["all", "participants", "credits", "hubs", "redemptions"], default="all")
        parser.add_argument("--retries", type=int, default=3, help="Retries for transient Airtable failures (default: 3).")
        parser.add_argument("--retry-delay", type=float, default=1.0, help="Seconds between retries (default: 1).")
        parser.add_argument("--fail-fast", action="store_true", help="Stop on the first sync failure.")

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]
        self.profile_id = options.get("profile_id")
        self.limit = options.get("limit")
        self.retries = max(0, options["retries"])
        self.retry_delay = max(0.0, options["retry_delay"])
        self.fail_fast = options["fail_fast"]
        self.stats = SyncStats()
        resource = options["resource"]

        if not self.dry_run and not is_configured():
            raise CommandError("Airtable is not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID, or use --dry-run.")

        resources = ["participants", "credits", "hubs", "redemptions"] if resource == "all" else [resource]
        for item in resources:
            table_id = get_table_id(item)
            if not table_id:
                self.stdout.write(self.style.WARNING(f"Skipping {item}: its Airtable table ID is not configured."))
                continue
            getattr(self, f"sync_{item}")(table_id)

        self.stdout.write(
            self.style.SUCCESS(
                f"Sync complete: {self.stats.created} created, {self.stats.updated} updated, "
                f"{self.stats.skipped} skipped, {self.stats.failed} failed."
            )
        )
        if self.stats.failed:
            raise CommandError("One or more Airtable records failed to sync.")

    def _limited(self, queryset):
        if self.limit:
            return queryset[: self.limit]
        return queryset

    def _profile_filter(self, queryset, field="profile_id"):
        return queryset.filter(**{field: self.profile_id}) if self.profile_id else queryset

    def _sync(self, resource: str, external_id: str, fields: dict, table_id: str):
        prefix = f"{resource}:{external_id}"
        if self.dry_run:
            self.stdout.write(f"DRY RUN {prefix}: {fields}")
            self.stats.record("skipped")
            return

        for attempt in range(self.retries + 1):
            try:
                action, _ = upsert_record(table_id, fields, external_id=external_id)
                self.stdout.write(f"{action.upper()} {prefix}")
                self.stats.record(action)
                return
            except (AirtableSyncError, AirtableSyncSkipped) as exc:
                if attempt >= self.retries:
                    self.stats.record("failed")
                    self.stderr.write(self.style.ERROR(f"FAILED {prefix}: {exc}"))
                    if self.fail_fast:
                        raise CommandError(str(exc)) from exc
                    return
                time.sleep(self.retry_delay * (attempt + 1))

    def sync_participants(self, table_id: str):
        profiles = self._limited(Profile.objects.all().order_by("pk"))
        for profile in profiles:
            latest_route = RouteSignal.objects.filter(profile=profile).order_by("-created_at").first()
            latest_ev = EVParticipantSignal.objects.filter(profile=profile).order_by("-created_at").first()
            role = profile.role or ("ev_participant" if latest_ev else "commuter")
            fields = {
                "Participant Name": profile.name,
                "User ID": str(profile.pk),
                "Role": "Driver" if role == "ev_participant" else "Rider",
                "Email": profile.email,
                "Home Zone": profile.home_zone,
                "Destination Zone": profile.destination_zone,
                "Corridor": latest_ev.corridor if latest_ev else "",
                "Status": "Lead",
                "Verification Status": "Not Started",
                "Notes": "Bulk-synced from Relay Rider local database.",
            }
            self._sync("participant", str(profile.pk), fields, table_id)

    def sync_credits(self, table_id: str):
        credits = self._profile_filter(GreenRouteCredit.objects.select_related("profile", "corridor").order_by("pk"))
        for credit in self._limited(credits):
            self._sync(
                "credit",
                str(credit.pk),
                {
                    "External ID": f"credit:{credit.pk}",
                    "Credit ID": str(credit.pk),
                    "User ID": str(credit.profile_id or ""),
                    "Participant Name": credit.profile.name if credit.profile else "",
                    "Corridor": credit.corridor.name if credit.corridor else "",
                    "Estimated Miles Reduced": float(credit.estimated_miles_reduced),
                    "Estimated CO2 Lbs Reduced": float(credit.estimated_co2_lbs_reduced),
                    "Unit Basis": "kWh-equivalent",
                    "Note": credit.note,
                    "Issued At": credit.created_at.isoformat(),
                },
                table_id,
            )

    def sync_hubs(self, table_id: str):
        for hub in self._limited(ChargingHub.objects.all().order_by("pk")):
            self._sync(
                "hub",
                str(hub.pk),
                {
                    "External ID": f"hub:{hub.pk}",
                    "Hub ID": str(hub.pk),
                    "Name": hub.name,
                    "Network": hub.network,
                    "City": hub.city,
                    "Stalls": hub.stalls,
                    "Connector Types": ", ".join(hub.connector_types or []),
                    "Status": hub.status,
                    "Evidence Label": hub.evidence_label,
                },
                table_id,
            )

    def sync_redemptions(self, table_id: str):
        requests = self._profile_filter(
            RedemptionRequest.objects.select_related("credit", "profile", "charging_hub").order_by("pk")
        )
        for request in self._limited(requests):
            self._sync(
                "redemption",
                str(request.pk),
                {
                    "External ID": f"redemption:{request.pk}",
                    "Request ID": str(request.pk),
                    "Credit ID": str(request.credit_id),
                    "User ID": str(request.profile_id or ""),
                    "Participant Name": request.profile.name if request.profile else "",
                    "Charging Hub": request.charging_hub.name,
                    "Requested Amount": float(request.requested_units),
                    "Unit Basis": request.unit_label,
                    "Status": request.status,
                    "Requested At": request.requested_at.isoformat(),
                    "Reviewed At": request.reviewed_at.isoformat() if request.reviewed_at else "",
                    "Reviewed By": request.reviewed_by,
                    "Review Note": request.review_note,
                },
                table_id,
            )
