from decimal import Decimal, InvalidOperation

SCHEMA_VERSION = "commuter-v1"

REQUIRED_HEADERS = (
    "participant_key",
    "origin_zone",
    "destination_zone",
    "current_mode",
    "vehicle_classification",
)

OPTIONAL_HEADERS = (
    "commute_days",
    "arrival_window_start",
    "arrival_window_end",
    "departure_window_start",
    "departure_window_end",
    "flexibility_minutes",
    "commute_distance_miles",
    "commute_time_minutes",
    "parking_difficulty",
    "ev_hybrid_signal",
)


def _text(value):
    return " ".join((value or "").strip().split())


def _enum(value):
    return _text(value).lower().replace(" ", "_").replace("-", "_")


def _time(value, field, errors):
    value = _text(value)
    if not value:
        return ""
    pieces = value.split(":")
    if len(pieces) != 2:
        errors.append(f"invalid_{field}")
        return value
    try:
        hour, minute = (int(piece) for piece in pieces)
    except ValueError:
        errors.append(f"invalid_{field}")
        return value
    if hour not in range(24) or minute not in range(60):
        errors.append(f"invalid_{field}")
        return value
    return f"{hour:02d}:{minute:02d}"


def _nonnegative_int(value, field, errors, *, allow_blank=True):
    value = _text(value)
    if not value and allow_blank:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        errors.append(f"invalid_{field}")
        return None
    if parsed < 0:
        errors.append(f"invalid_{field}")
        return None
    return parsed


def _nonnegative_decimal(value, errors):
    value = _text(value)
    if not value:
        return ""
    try:
        parsed = Decimal(value)
    except InvalidOperation:
        errors.append("invalid_distance")
        return value
    if parsed < 0:
        errors.append("invalid_distance")
        return value
    return format(parsed.quantize(Decimal("0.01")), "f")


def normalize_and_validate_row(raw):
    errors = []
    warnings = []
    normalized = {
        "participant_key": _text(raw.get("participant_key")),
        "origin_zone": _text(raw.get("origin_zone")),
        "destination_zone": _text(raw.get("destination_zone")),
        "current_mode": _enum(raw.get("current_mode")),
        "vehicle_classification": _enum(raw.get("vehicle_classification")),
        "commute_days": [item.strip().lower() for item in _text(raw.get("commute_days")).split("|") if item.strip()],
        "parking_difficulty": _enum(raw.get("parking_difficulty")),
        "ev_hybrid_signal": _enum(raw.get("ev_hybrid_signal")),
    }

    if not normalized["participant_key"]:
        errors.append("missing_participant_key")
    if not normalized["origin_zone"]:
        errors.append("missing_origin_zone")
    if not normalized["destination_zone"]:
        errors.append("missing_destination_zone")
    if not normalized["current_mode"]:
        errors.append("missing_current_mode")
    if not normalized["vehicle_classification"]:
        errors.append("missing_vehicle_classification")

    for field in (
        "arrival_window_start",
        "arrival_window_end",
        "departure_window_start",
        "departure_window_end",
    ):
        normalized[field] = _time(raw.get(field), field, errors)

    normalized["flexibility_minutes"] = _nonnegative_int(raw.get("flexibility_minutes"), "flexibility_minutes", errors) or 0
    normalized["commute_time_minutes"] = _nonnegative_int(raw.get("commute_time_minutes"), "commute_time_minutes", errors)
    normalized["commute_distance_miles"] = _nonnegative_decimal(raw.get("commute_distance_miles"), errors)

    for prefix in ("arrival_window", "departure_window"):
        start = normalized[f"{prefix}_start"]
        end = normalized[f"{prefix}_end"]
        if start and end and start > end:
            errors.append("invalid_time_window")

    mode = normalized["current_mode"]
    vehicle = normalized["vehicle_classification"]
    non_vehicle_modes = {"walk", "bike", "bicycle", "transit", "telecommute", "remote"}
    vehicle_classes = {"gasoline", "diesel", "hybrid", "phev", "ev", "zev"}
    if mode in non_vehicle_modes and vehicle in vehicle_classes:
        errors.append("mode_vehicle_conflict")

    return normalized, sorted(set(errors)), sorted(set(warnings))
