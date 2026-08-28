from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse

from relay.airtable_client import AirtableSyncError
from rest_framework import status
from rest_framework.test import APITestCase

from config.settings import database_from_url
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Profile, RedemptionRequest, RouteSignal


class HealthEndpointTests(TestCase):
    def test_healthz_is_live(self):
        response = self.client.get(reverse("healthz"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_readyz_checks_the_database(self):
        response = self.client.get(reverse("readyz"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "ready"})


class DatabaseConfigurationTests(TestCase):
    def test_postgres_url_is_translated_to_django_database_config(self):
        with patch.dict("os.environ", {"DATABASE_SSL_REQUIRE": "true"}):
            config = database_from_url("postgresql://pilot_user:secret@example.test:5433/relay_rider")
        self.assertEqual(config["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(config["NAME"], "relay_rider")
        self.assertEqual(config["USER"], "pilot_user")
        self.assertEqual(config["HOST"], "example.test")
        self.assertEqual(config["PORT"], "5433")
        self.assertEqual(config["OPTIONS"], {"sslmode": "require"})

    def test_non_postgres_url_is_rejected(self):
        with self.assertRaises(ValueError):
            database_from_url("mysql://user:password@example.test/db")


class SignupApiTests(APITestCase):
    @patch("relay.signup_view.create_participant_record")
    def test_commuter_signup_persists_profile_and_route(self, airtable_create):
        response = self.client.post(
            reverse("signup"),
            {
                "name": "Ari Pilot",
                "email": "ari@example.com",
                "role": "commuter",
                "originArea": "Hollywood",
                "destinationArea": "Pasadena",
                "timeWindow": "7:30 AM",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        profile = Profile.objects.get(email="ari@example.com")
        self.assertEqual(profile.name, "Ari Pilot")
        self.assertEqual(profile.role, "commuter")
        self.assertEqual(RouteSignal.objects.get(profile=profile).departure_window, "7:30 AM")
        airtable_create.assert_called_once()

    @patch("relay.signup_view.create_participant_record", side_effect=AirtableSyncError("unavailable"))
    def test_airtable_failure_preserves_local_signup_and_reports_pending_sync(self, airtable_create):
        response = self.client.post(
            reverse("signup"),
            {"name": "EV Pilot", "email": "ev@example.com", "role": "ev_participant"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.json()["airtable"]["synced"])
        self.assertEqual(response.json()["airtable"]["reason"], "Airtable sync failed; see server logs.")
        self.assertEqual(Profile.objects.filter(email="ev@example.com").count(), 1)
        airtable_create.assert_called_once()

    def test_missing_role_and_identity_are_rejected(self):
        response = self.client.post(reverse("signup"), {"name": "", "email": ""}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Profile.objects.count(), 0)


class ResourceApiTests(APITestCase):
    def setUp(self):
        self.profile = Profile.objects.create(
            name="Participant One",
            email="one@example.com",
            role="ev_participant",
            home_zone="Hollywood",
            destination_zone="Pasadena",
        )
        self.other_profile = Profile.objects.create(name="Participant Two", email="two@example.com")
        self.corridor = Corridor.objects.create(name="Hollywood to Pasadena")
        self.credit = GreenRouteCredit.objects.create(
            profile=self.profile,
            corridor=self.corridor,
            estimated_miles_reduced="12.50",
            estimated_co2_lbs_reduced="20.00",
            note="Pilot route activity",
        )
        self.hub = ChargingHub.objects.create(
            name="Pilot Charging Hub",
            network="Pilot Network",
            city="Pasadena",
            stalls=8,
            connector_types=["CCS", "J1772"],
            status="verified",
            evidence_label="verified",
        )

    def test_resource_lists_return_persisted_records(self):
        response = self.client.get(reverse("greenroutecredit-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["profile"], self.profile.pk)

        hub_response = self.client.get(reverse("charginghub-list"))
        self.assertEqual(hub_response.status_code, status.HTTP_200_OK)
        self.assertEqual(hub_response.json()[0]["connector_types"], ["CCS", "J1772"])

    def test_redemption_request_can_be_created_and_reviewed(self):
        response = self.client.post(
            reverse("redemptionrequest-list"),
            {
                "credit": self.credit.pk,
                "profile": self.profile.pk,
                "charging_hub": self.hub.pk,
                "requested_units": "5.00",
                "unit_label": "kWh-equivalent",
                "status": "requested",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        request_id = response.json()["id"]
        review = self.client.patch(
            reverse("redemptionrequest-detail", args=[request_id]),
            {"status": "fulfilled", "review_note": "Approved for pilot"},
            format="json",
        )
        self.assertEqual(review.status_code, status.HTTP_200_OK)
        self.assertEqual(review.json()["status"], "fulfilled")
        self.assertEqual(RedemptionRequest.objects.get(pk=request_id).review_note, "Approved for pilot")

    def test_profile_create_and_update_round_trip(self):
        response = self.client.post(
            reverse("profile-list"),
            {"name": "New Participant", "email": "new@example.com", "role": "commuter"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        profile_id = response.json()["id"]
        update = self.client.patch(
            reverse("profile-detail", args=[profile_id]),
            {"destination_zone": "Glendale"},
            format="json",
        )
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(update.json()["destination_zone"], "Glendale")
