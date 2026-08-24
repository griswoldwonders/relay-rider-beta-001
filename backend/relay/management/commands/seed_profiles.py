"""Seed the local Profile table with mock research-beta commuter profiles.

Generates deterministic, clearly-fake demonstration data for local
development and screenshots. Not for use against any production database.

Usage:
    python manage.py seed_profiles --count 50
    python manage.py seed_profiles --count 50 --clear   # wipe existing Profile rows first
"""

import random

from django.core.management.base import BaseCommand

from relay.models import Profile

FIRST_NAMES = [
    "Ava", "Liam", "Maya", "Noah", "Zoe", "Ethan", "Priya", "Diego", "Grace",
    "Kai", "Layla", "Mateo", "Nina", "Oscar", "Ruby", "Sofia", "Theo", "Uma",
    "Victor", "Wren", "Amir", "Bianca", "Caleb", "Dana", "Eli", "Farah",
    "Gabe", "Hana", "Ivan", "Jade", "Kenji", "Lucia", "Milo", "Nadia",
    "Owen", "Paloma", "Quinn", "Rosa", "Sam", "Talia", "Uriel", "Vera",
    "Wyatt", "Xochitl", "Yara", "Zane", "Aiden", "Bella", "Carlos", "Dahlia",
]

LAST_INITIALS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

CAMPUS_ZONES = [
    "Pasadena City College", "Caltech", "Occidental College",
    "Glendale Community College", "Cal State LA", "PCC Foothill Campus",
    "Eagle Rock", "ArtCenter College of Design",
]

DESTINATION_ZONES = [
    "Downtown Pasadena", "Old Town Pasadena", "Eagle Rock Plaza",
    "Glendale Galleria", "South Pasadena Metro", "Highland Park",
    "Atwater Village", "JPL Corridor",
]

ROLES = ["commuter", "ev_participant"]


class Command(BaseCommand):
    help = "Seed mock research-beta commuter Profile records for local development."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count", type=int, default=50,
            help="Number of mock profiles to create (default: 50).",
        )
        parser.add_argument(
            "--clear", action="store_true",
            help="Delete existing Profile rows tagged as mock data before seeding.",
        )

    def handle(self, *args, **options):
        count = options["count"]
        clear = options["clear"]

        if clear:
            deleted, _ = Profile.objects.filter(email__endswith="@relayrider-demo.test").delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing mock profile(s)."))

        rng = random.Random(42)  # deterministic output across runs
        created = 0

        for i in range(1, count + 1):
            first = rng.choice(FIRST_NAMES)
            last_initial = rng.choice(LAST_INITIALS)
            name = f"{first} {last_initial}."
            email = f"{first.lower()}.{last_initial.lower()}{i:03d}@relayrider-demo.test"
            role = rng.choice(ROLES)
            home_zone = rng.choice(CAMPUS_ZONES)
            destination_zone = rng.choice(DESTINATION_ZONES)

            _, was_created = Profile.objects.update_or_create(
                email=email,
                defaults={
                    "name": name,
                    "role": role,
                    "home_zone": home_zone,
                    "destination_zone": destination_zone,
                },
            )
            if was_created:
                created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {count} mock commuter profile(s) ({created} newly created). "
                "All emails use the @relayrider-demo.test placeholder domain."
            )
        )
