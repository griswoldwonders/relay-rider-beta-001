import logging

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .airtable_client import AirtableSyncError, AirtableSyncSkipped, create_participant_record
from .models import EVParticipantSignal, Profile, RouteSignal

logger = logging.getLogger(__name__)

# Maps the frontend's internal role values to the Airtable Participants
# table's existing "Role" single-select options. Those options are
# currently named "Driver"/"Rider" in the Airtable base itself -- flagged
# as a terminology follow-up (see repo audit), not something this proxy
# can silently rename without changing the live Airtable field schema.
ROLE_TO_AIRTABLE = {
    "commuter": "Rider",
    "ev_participant": "Driver",
}

DEFAULT_CORRIDOR = "Hollywood / East Hollywood \u2192 Glendale / Pasadena"


class SignupView(APIView):
    """Accepts a research-beta signup submission from the frontend.

    Persists a local Profile + RouteSignal/EVParticipantSignal (source of
    record for this prototype), then makes a best-effort attempt to also
    create a matching row in the Airtable Participants table for
    operations/matching visibility. The Airtable call is fire-and-forget:
    its failure is reported back in the response but never blocks or
    rolls back the local save, so a signup never silently fails just
    because Airtable is unreachable or misconfigured.
    """

    def post(self, request):
        data = request.data
        role = data.get("role")
        if role not in ("commuter", "ev_participant"):
            return Response(
                {"error": "role must be 'commuter' or 'ev_participant'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip()
        origin_zone = (data.get("originArea") or data.get("startingArea") or "").strip()
        destination_zone = (data.get("destinationArea") or "").strip()

        if not name or not email:
            return Response(
                {"error": "name and email are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            profile, _ = Profile.objects.update_or_create(
                email=email,
                defaults={
                    "name": name,
                    "role": role,
                    "home_zone": origin_zone,
                    "destination_zone": destination_zone,
                },
            )

            if role == "commuter":
                RouteSignal.objects.create(
                    profile=profile,
                    origin_zone=origin_zone,
                    destination_zone=destination_zone,
                    departure_window=(data.get("timeWindow") or "").strip(),
                    status="submitted",
                )
            else:
                EVParticipantSignal.objects.create(
                    profile=profile,
                    vehicle_type=(data.get("vehicleType") or "").strip(),
                    corridor=(data.get("corridor") or DEFAULT_CORRIDOR).strip(),
                    seats_available=int(data.get("seatsAvailable") or 0),
                    max_detour_minutes=int(data.get("maxDetourMinutes") or 10),
                    status="submitted",
                )

        airtable_result = {"synced": False, "reason": None}
        try:
            airtable_fields = {
                "Participant Name": name,
                "User ID": str(profile.pk),
                "Role": ROLE_TO_AIRTABLE[role],
                "Email": email,
                "Corridor": (data.get("corridor") or DEFAULT_CORRIDOR),
                "Status": "Lead",
                "Adult 18+ Confirmed": bool(data.get("adultConfirmed")),
                "Beta Consent Accepted": bool(data.get("researchConsent") or data.get("consentAccepted")),
                "Verification Status": "Not Started",
                "Safe Anchor Preference": "Unknown",
                "Notes": "Submitted via app signup form (research beta).",
            }
            create_participant_record(airtable_fields)
            airtable_result = {"synced": True, "reason": None}
        except AirtableSyncSkipped as exc:
            # Expected in local dev when Airtable env vars aren't set.
            airtable_result = {"synced": False, "reason": str(exc)}
        except AirtableSyncError as exc:
            logger.warning("Airtable sync failed for profile %s: %s", profile.pk, exc)
            airtable_result = {"synced": False, "reason": "Airtable sync failed; see server logs."}

        return Response(
            {
                "profileId": profile.pk,
                "role": role,
                "airtable": airtable_result,
            },
            status=status.HTTP_201_CREATED,
        )
