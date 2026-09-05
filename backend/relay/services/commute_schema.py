"""Canonical commuter-import validation and normalization.

Django models remain the persistence authority. Pandera owns the tabular input
contract; this module converts raw CSV rows into the exact normalized values
already persisted by the institutional vertical slice and retains the legacy
human-readable validation messages for audit continuity.
"""

from __future__ import annotations

from typing import Iterable, Mapping

import pandas as pd
import pandera.pandas as pa


REQUIRED_COLUMNS = (
    'external_id',
    'origin_zone',
    'destination_zone',
    'commute_days',
    'arrival_window',
    'departure_window',
    'current_mode',
    'consent_confirmed',
)

OPTIONAL_COLUMNS = (
    'schedule_flex_minutes',
    'occupants',
    'vehicle_fuel_type',
    'parking_difficulty',
    'ev_interest',
    'access_point_willing',
)

ALL_COLUMNS = REQUIRED_COLUMNS + OPTIONAL_COLUMNS
TRUTHY = {'1', 'true', 'yes', 'y'}
FALSY = {'0', 'false', 'no', 'n', ''}
SHARED_MODES = {'carpool', 'vanpool', 'shared_motorcycle'}


def _raw_text(value) -> str:
    if value is None:
        return ''
    return str(value).strip()


def _lower_text(value) -> str:
    return _raw_text(value).lower()


def _is_present(value) -> bool:
    return bool(_raw_text(value))


def _is_bool_token(value) -> bool:
    return _lower_text(value) in TRUTHY | FALSY


def _is_integer_or_blank(value) -> bool:
    raw = _raw_text(value)
    if raw == '':
        return True
    try:
        int(raw)
    except (TypeError, ValueError):
        return False
    return True


def _is_nonnegative_integer_or_blank(value) -> bool:
    raw = _raw_text(value)
    if raw == '':
        return True
    try:
        return int(raw) >= 0
    except (TypeError, ValueError):
        return True  # integer-format validation reports this separately


def _parse_optional_nonnegative_int(value):
    raw = _raw_text(value)
    if raw == '':
        return None
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _shared_mode_has_occupants(frame: pd.DataFrame):
    modes = frame['current_mode'].map(_lower_text)
    occupants = frame['occupants'].map(_parse_optional_nonnegative_int)
    return [mode not in SHARED_MODES or bool(count) for mode, count in zip(modes, occupants)]


def _carpool_occupancy_in_range(frame: pd.DataFrame):
    modes = frame['current_mode'].map(_lower_text)
    occupants = frame['occupants'].map(_parse_optional_nonnegative_int)
    return [
        mode != 'carpool' or count is None or 2 <= count <= 6
        for mode, count in zip(modes, occupants)
    ]


def _vanpool_occupancy_in_range(frame: pd.DataFrame):
    modes = frame['current_mode'].map(_lower_text)
    occupants = frame['occupants'].map(_parse_optional_nonnegative_int)
    return [
        mode != 'vanpool' or count is None or 7 <= count <= 15
        for mode, count in zip(modes, occupants)
    ]


def _required_column(name: str):
    return pa.Column(
        object,
        checks=pa.Check(
            _is_present,
            element_wise=True,
            ignore_na=False,
            name=f'{name}_required',
        ),
        nullable=True,
        required=True,
    )


COMMUTE_IMPORT_SCHEMA = pa.DataFrameSchema(
    {
        'external_id': _required_column('external_id'),
        'origin_zone': _required_column('origin_zone'),
        'destination_zone': _required_column('destination_zone'),
        'commute_days': _required_column('commute_days'),
        'arrival_window': _required_column('arrival_window'),
        'departure_window': _required_column('departure_window'),
        'current_mode': _required_column('current_mode'),
        'consent_confirmed': pa.Column(
            object,
            checks=[
                pa.Check(_is_present, element_wise=True, ignore_na=False, name='consent_confirmed_required'),
                pa.Check(_is_bool_token, element_wise=True, ignore_na=False, name='consent_confirmed_bool'),
            ],
            nullable=True,
            required=True,
        ),
        'schedule_flex_minutes': pa.Column(
            object,
            checks=[
                pa.Check(_is_integer_or_blank, element_wise=True, ignore_na=False, name='schedule_flex_minutes_integer'),
                pa.Check(_is_nonnegative_integer_or_blank, element_wise=True, ignore_na=False, name='schedule_flex_minutes_nonnegative'),
            ],
            nullable=True,
            required=True,
        ),
        'occupants': pa.Column(
            object,
            checks=[
                pa.Check(_is_integer_or_blank, element_wise=True, ignore_na=False, name='occupants_integer'),
                pa.Check(_is_nonnegative_integer_or_blank, element_wise=True, ignore_na=False, name='occupants_nonnegative'),
            ],
            nullable=True,
            required=True,
        ),
        'vehicle_fuel_type': pa.Column(object, nullable=True, required=True),
        'parking_difficulty': pa.Column(object, nullable=True, required=True),
        'ev_interest': pa.Column(
            object,
            checks=pa.Check(_is_bool_token, element_wise=True, ignore_na=False, name='ev_interest_bool'),
            nullable=True,
            required=True,
        ),
        'access_point_willing': pa.Column(
            object,
            checks=pa.Check(_is_bool_token, element_wise=True, ignore_na=False, name='access_point_willing_bool'),
            nullable=True,
            required=True,
        ),
    },
    checks=[
        pa.Check(_shared_mode_has_occupants, name='shared_mode_occupants_required'),
        pa.Check(_carpool_occupancy_in_range, name='carpool_occupancy_range'),
        pa.Check(_vanpool_occupancy_in_range, name='vanpool_occupancy_range'),
    ],
    strict=False,
    coerce=False,
    name='relay_rider_commute_import_v1',
)


def missing_required_columns(headers: Iterable[str]) -> list[str]:
    """Return missing required headers in deterministic order."""

    available = set(headers)
    return sorted(set(REQUIRED_COLUMNS) - available)


def _parse_bool(value) -> bool:
    return _lower_text(value) in TRUTHY


def _parse_nonnegative_int(value, *, optional=False):
    raw = _raw_text(value)
    if optional and raw == '':
        return None
    try:
        parsed = int(raw or '0')
    except (TypeError, ValueError):
        return None if optional else 0
    if parsed < 0:
        return None if optional else 0
    return parsed


def normalize_commute_row(row: Mapping[str, object]) -> dict:
    """Normalize one raw CSV row to the existing CommuterRecord field contract."""

    return {
        'external_id': _raw_text(row.get('external_id')),
        'origin_zone': _raw_text(row.get('origin_zone')),
        'destination_zone': _raw_text(row.get('destination_zone')),
        'commute_days': [day.strip() for day in _raw_text(row.get('commute_days')).split('|') if day.strip()],
        'arrival_window': _raw_text(row.get('arrival_window')),
        'departure_window': _raw_text(row.get('departure_window')),
        'schedule_flex_minutes': _parse_nonnegative_int(row.get('schedule_flex_minutes')),
        'current_mode': _lower_text(row.get('current_mode')),
        'occupants': _parse_nonnegative_int(row.get('occupants'), optional=True),
        'vehicle_fuel_type': _lower_text(row.get('vehicle_fuel_type')),
        'parking_difficulty': _lower_text(row.get('parking_difficulty')),
        'ev_interest': _parse_bool(row.get('ev_interest')),
        'access_point_willing': _parse_bool(row.get('access_point_willing')),
        'consent_confirmed': _parse_bool(row.get('consent_confirmed')),
    }


def _compatibility_errors(row: Mapping[str, object]) -> list[str]:
    """Preserve the pre-Pandera row-level audit messages exactly.

    Pandera decides whether the row satisfies the canonical schema. This adapter
    only preserves the established human-readable messages retained on
    CommuterRecord.validation_errors so historical/operator expectations do not
    change during the validator swap.
    """

    errors: list[str] = []
    for field in REQUIRED_COLUMNS:
        if not _raw_text(row.get(field)):
            errors.append(f'{field} is required')

    flex_raw = _raw_text(row.get('schedule_flex_minutes'))
    if flex_raw:
        try:
            flex_value = int(flex_raw)
        except ValueError:
            errors.append('schedule_flex_minutes must be an integer')
        else:
            if flex_value < 0:
                errors.append('schedule_flex_minutes must be non-negative')

    occupants_raw = _raw_text(row.get('occupants'))
    occupants = None
    if occupants_raw:
        try:
            occupants_value = int(occupants_raw)
        except ValueError:
            errors.append('occupants must be an integer')
        else:
            if occupants_value < 0:
                errors.append('occupants must be non-negative')
            else:
                occupants = occupants_value

    for field in ('ev_interest', 'access_point_willing', 'consent_confirmed'):
        if not _is_bool_token(row.get(field)):
            errors.append(f'{field} must be yes/no or true/false')

    mode = _lower_text(row.get('current_mode'))
    if mode in SHARED_MODES and not occupants:
        errors.append(f'occupants is required for {mode}')
    if mode == 'carpool' and occupants is not None and not 2 <= occupants <= 6:
        errors.append('carpool occupants must be between 2 and 6')
    if mode == 'vanpool' and occupants is not None and not 7 <= occupants <= 15:
        errors.append('vanpool occupants must be between 7 and 15')
    return errors


def _schema_frame(row: Mapping[str, object]) -> pd.DataFrame:
    validation_row = {column: row.get(column, '') for column in ALL_COLUMNS}
    return pd.DataFrame([validation_row], columns=ALL_COLUMNS, dtype=object)


def validate_and_normalize_rows(rows: Iterable[Mapping[str, object]]) -> list[tuple[dict, list[str]]]:
    """Validate raw rows with Pandera and return normalized rows plus audit errors.

    Rows are intentionally validated independently. The beta import volume is
    small, and row isolation guarantees that every invalid source row is kept
    with its own validation evidence instead of being dropped from a bulk frame.
    """

    results: list[tuple[dict, list[str]]] = []
    for row in rows:
        raw_row = dict(row)
        schema_failed = False
        try:
            COMMUTE_IMPORT_SCHEMA.validate(_schema_frame(raw_row), lazy=True)
        except (pa.errors.SchemaError, pa.errors.SchemaErrors):
            schema_failed = True

        compatibility_errors = _compatibility_errors(raw_row)
        if schema_failed and not compatibility_errors:
            compatibility_errors = ['row failed canonical commute import schema validation']
        elif not schema_failed and compatibility_errors:
            raise RuntimeError(
                'Pandera commute schema accepted a row rejected by the compatibility error adapter; '
                'the validation contract has drifted.'
            )

        results.append((normalize_commute_row(raw_row), compatibility_errors))
    return results
