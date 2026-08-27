"""Server-side Airtable REST helpers used by Relay Rider sync workflows.

This module is backend-only. Airtable credentials must never be exposed to the
browser bundle. The helpers support the signup proxy and the bulk-sync command.
"""

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)
AIRTABLE_API_BASE = "https://api.airtable.com/v0"


class AirtableSyncError(Exception):
    """Raised when an Airtable request fails after being attempted."""


class AirtableSyncSkipped(Exception):
    """Raised when required Airtable configuration is not present."""


def _get_config():
    api_key = os.environ.get("AIRTABLE_API_KEY", "").strip()
    base_id = os.environ.get("AIRTABLE_BASE_ID", "").strip()
    participants_table_id = os.environ.get("AIRTABLE_PARTICIPANTS_TABLE_ID", "").strip()
    return api_key, base_id, participants_table_id


def get_table_id(resource: str) -> str:
    """Return the configured Airtable table ID for a sync resource."""
    env_name = {
        "participants": "AIRTABLE_PARTICIPANTS_TABLE_ID",
        "credits": "AIRTABLE_CREDITS_TABLE_ID",
        "hubs": "AIRTABLE_CHARGING_HUBS_TABLE_ID",
        "redemptions": "AIRTABLE_REDEMPTION_REQUESTS_TABLE_ID",
    }[resource]
    return os.environ.get(env_name, "").strip()


def is_configured() -> bool:
    api_key, base_id, _ = _get_config()
    return bool(api_key and base_id)


def _require_config(table_id: str):
    api_key, base_id, _ = _get_config()
    if not (api_key and base_id and table_id):
        raise AirtableSyncSkipped(
            "Airtable sync requires AIRTABLE_API_KEY, AIRTABLE_BASE_ID, "
            "and the resource table ID."
        )
    return api_key, base_id


def _request(method: str, table_id: str, *, record_id: str = "", params=None, payload=None, timeout: float = 8.0):
    api_key, base_id = _require_config(table_id)
    suffix = f"/{record_id}" if record_id else ""
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    url = f"{AIRTABLE_API_BASE}/{base_id}/{table_id}{suffix}{query}"
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.warning("Airtable sync HTTP error %s: %s", exc.code, detail)
        raise AirtableSyncError(f"Airtable responded {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        logger.warning("Airtable sync network error: %s", exc)
        raise AirtableSyncError(f"Airtable request failed: {exc}") from exc


def create_record(table_id: str, fields: dict, timeout: float = 8.0) -> dict:
    return _request("POST", table_id, payload={"typecast": True, "fields": fields}, timeout=timeout)


def update_record(table_id: str, record_id: str, fields: dict, timeout: float = 8.0) -> dict:
    return _request("PATCH", table_id, record_id=record_id, payload={"typecast": True, "fields": fields}, timeout=timeout)


def find_record_by_external_id(table_id: str, external_id: str, external_id_field: str = "External ID", timeout: float = 8.0) -> dict | None:
    formula = "{" + external_id_field.replace("}", "\\}") + "}=" + json.dumps(external_id)
    result = _request("GET", table_id, params={"filterByFormula": formula, "maxRecords": 1}, timeout=timeout)
    records = result.get("records", [])
    return records[0] if records else None


def upsert_record(table_id: str, fields: dict, *, external_id: str, external_id_field: str = "External ID", timeout: float = 8.0) -> tuple[str, dict]:
    """Create or update one record using a stable external ID."""
    normalized = {**fields, external_id_field: external_id}
    existing = find_record_by_external_id(table_id, external_id, external_id_field, timeout=timeout)
    if existing:
        return "updated", update_record(table_id, existing["id"], normalized, timeout=timeout)
    return "created", create_record(table_id, normalized, timeout=timeout)


def create_participant_record(fields: dict, timeout: float = 8.0) -> dict:
    """Create one signup record in the configured Participants table."""
    table_id = get_table_id("participants")
    return create_record(table_id, fields, timeout=timeout)
