"""Minimal Airtable REST client used to sync research-beta signup data.

This module never runs client-side: it is called only from Django views,
so the Airtable API key stays server-side and is never exposed in the
browser bundle. Failures here must never break the signup flow for the
user -- callers should treat sync as best-effort and log/report failures
without raising back to the HTTP response.
"""

import json
import logging
import os
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

AIRTABLE_API_BASE = "https://api.airtable.com/v0"


class AirtableSyncError(Exception):
    """Raised when a sync call to Airtable fails after being attempted."""


class AirtableSyncSkipped(Exception):
    """Raised when sync is skipped because configuration is incomplete.

    Distinct from AirtableSyncError so callers/tests can tell "not configured"
    apart from "attempted and failed" -- the former is expected in local dev
    without an Airtable key set, the latter is a real error worth surfacing.
    """


def _get_config():
    api_key = os.environ.get("AIRTABLE_API_KEY", "").strip()
    base_id = os.environ.get("AIRTABLE_BASE_ID", "").strip()
    table_id = os.environ.get("AIRTABLE_PARTICIPANTS_TABLE_ID", "").strip()
    return api_key, base_id, table_id


def is_configured() -> bool:
    api_key, base_id, table_id = _get_config()
    return bool(api_key and base_id and table_id)


def create_participant_record(fields: dict, timeout: float = 8.0) -> dict:
    """Create one record in the Airtable Participants table.

    fields must already match the Participants table schema exactly
    (Participant Name, User ID, Role, Email, Corridor, Status, etc.).
    Uses typecast=True so new single-select option values are accepted
    rather than rejected outright, since research-beta corridor/role
    values may evolve faster than the Airtable schema is updated.
    """
    api_key, base_id, table_id = _get_config()
    if not (api_key and base_id and table_id):
        raise AirtableSyncSkipped(
            "Airtable sync is not configured: set AIRTABLE_API_KEY, "
            "AIRTABLE_BASE_ID, and AIRTABLE_PARTICIPANTS_TABLE_ID."
        )

    url = f"{AIRTABLE_API_BASE}/{base_id}/{table_id}"
    payload = json.dumps({"typecast": True, "fields": fields}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.warning("Airtable sync HTTP error %s: %s", exc.code, detail)
        raise AirtableSyncError(f"Airtable responded {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        logger.warning("Airtable sync network error: %s", exc)
        raise AirtableSyncError(f"Airtable request failed: {exc}") from exc
