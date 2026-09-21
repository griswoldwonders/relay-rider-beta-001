from __future__ import annotations

import hashlib
import hmac
import json
import os
from dataclasses import asdict, dataclass, field
from decimal import Decimal

from django.db import connection, transaction

from relay.models import AssessmentAuditEvent, EvidenceProjectionBinding


PROJECTOR_VERSION = 'relay-evidence-v1-20260909'
MOTOR_VEHICLE_MODES = {'drive_alone', 'carpool', 'vanpool'}
MODE_MAP = {
    'drive_alone': 'drive_alone',
    'sov': 'drive_alone',
    'single_occupancy_vehicle': 'drive_alone',
    'carpool': 'carpool',
    'vanpool': 'vanpool',
    'bus': 'bus',
    'public_bus': 'bus',
    'metro_bus': 'bus',
    'rail': 'rail',
    'metro': 'rail',
    'train': 'rail',
    'light_rail': 'rail',
    'walk': 'walk',
    'walking': 'walk',
    'bike': 'bike',
    'bicycle': 'bike',
    'cycling': 'bike',
    'remote': 'remote',
    'telecommute': 'remote',
    'work_from_home': 'remote',
    'wfh': 'remote',
    'compressed_day_off': 'compressed_day_off',
    'worked_offsite': 'worked_offsite',
    'absent': 'absent',
    'other': 'other',
}


class EvidenceProjectionUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class ProjectionIssue:
    code: str
    message: str
    record_id: int | None = None


@dataclass
class ProjectionResult:
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    blocked: int = 0
    issues: list[ProjectionIssue] = field(default_factory=list)

    def to_dict(self):
        return {
            'inserted': self.inserted,
            'updated': self.updated,
            'skipped': self.skipped,
            'blocked': self.blocked,
            'issues': [asdict(issue) for issue in self.issues],
            'projector_version': PROJECTOR_VERSION,
        }


def _participant_key(record, secret: str) -> str:
    payload = f'{record.institution_id}:{record.external_id}'.encode('utf-8')
    digest = hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()
    return f'rr_{digest[:40]}'


def _parking_difficulty(value: str):
    token = (value or '').strip().lower()
    mapped = {'low': 1, 'medium': 3, 'high': 5}
    if token in mapped:
        return mapped[token]
    if token.isdigit() and 1 <= int(token) <= 5:
        return int(token)
    return None


def _ev_hybrid_status(record, mode: str) -> str:
    if mode not in MOTOR_VEHICLE_MODES:
        return 'not_applicable'
    fuel = (record.vehicle_fuel_type or '').strip().lower().replace('-', '_').replace(' ', '_')
    if fuel in {'ev', 'electric', 'bev', 'battery_electric'}:
        return 'ev'
    if fuel in {'phev', 'plug_in_hybrid', 'plugin_hybrid'}:
        return 'plug_in_hybrid'
    if fuel in {'hybrid', 'hev'}:
        return 'hybrid'
    if fuel in {'gasoline', 'gas', 'diesel', 'ice', 'internal_combustion'}:
        return 'ice'
    return 'unknown'


def normalize_record_for_evidence(record, *, participant_key_secret: str):
    """Return a minimal public-evidence row and blocking issues.

    This function never copies the raw source payload and never fabricates an
    observation date or motor-vehicle distance.
    """
    issues: list[ProjectionIssue] = []
    mode_token = (record.current_mode or '').strip().lower().replace('-', '_').replace(' ', '_')
    mode = MODE_MAP.get(mode_token)
    if not mode:
        issues.append(ProjectionIssue('MODE_UNSUPPORTED', f'Unsupported commute mode: {record.current_mode}', record.id))
    if not record.observation_date:
        issues.append(ProjectionIssue('OBSERVATION_DATE_MISSING', 'observation_date is required for evidence projection', record.id))
    if mode in MOTOR_VEHICLE_MODES and record.one_way_miles is None:
        issues.append(ProjectionIssue('DISTANCE_MISSING', 'one_way_miles is required for motor-vehicle evidence', record.id))
    if mode in {'carpool', 'vanpool'} and (record.occupants is None or record.occupants < 2):
        issues.append(ProjectionIssue('OCCUPANCY_INVALID', f'{mode} requires occupancy of at least 2', record.id))
    if issues:
        return None, issues

    occupancy = record.occupants
    if mode == 'drive_alone':
        occupancy = 1

    source = record.commute_import.data_source
    projection_key = f'commuter_record:{record.id}:{PROJECTOR_VERSION}'
    original_payload = {
        'source_system': 'relay_rider',
        'relay_projection_key': projection_key,
        'projector_version': PROJECTOR_VERSION,
        'canonical_import_id': record.commute_import_id,
        'canonical_record_id': record.id,
        'canonical_record_updated_at': record.updated_at.isoformat(),
        'source_file_sha256': record.commute_import.file_sha256,
        'source_row_number': record.source_row_number,
        'source_provenance': source.provenance_label,
    }
    return {
        'participant_key': _participant_key(record, participant_key_secret),
        'observation_date': record.observation_date,
        'origin_zone': record.origin_zone,
        'commute_mode': mode,
        'source_mode': record.current_mode,
        'one_way_miles': record.one_way_miles,
        'vehicle_occupancy': occupancy,
        'reported_to_site': mode not in {'remote', 'compressed_day_off', 'worked_offsite', 'absent'},
        'remote_day': mode == 'remote',
        'ev_hybrid_status': _ev_hybrid_status(record, mode),
        'parking_difficulty': _parking_difficulty(record.parking_difficulty),
        'arrival_window': record.arrival_window,
        'departure_window': record.departure_window,
        'validation_status': 'valid',
        'exclusion_reason': None,
        'source_row_number': record.source_row_number,
        'original_payload': original_payload,
    }, []


def _resolve_secret(explicit_secret):
    secret = explicit_secret or os.environ.get('RELAY_EVIDENCE_PARTICIPANT_KEY_SECRET', '').strip()
    if not secret:
        raise EvidenceProjectionUnavailable('RELAY_EVIDENCE_PARTICIPANT_KEY_SECRET is required for evidence projection')
    return secret


def _resolve_binding(commute_import):
    bindings = list(
        EvidenceProjectionBinding.objects.filter(
            institution=commute_import.institution,
            site=commute_import.site,
            cohort=commute_import.cohort,
            active=True,
        )[:2]
    )
    if len(bindings) != 1:
        raise EvidenceProjectionUnavailable('exactly one active evidence projection binding is required')
    binding = bindings[0]
    binding.full_clean()
    return binding


def _verify_public_identity(cursor, binding):
    cursor.execute('select 1 from public.organizations where id = %s', [str(binding.organization_uuid)])
    if cursor.fetchone() is None:
        raise EvidenceProjectionUnavailable('mapped public organization does not exist')
    cursor.execute(
        'select 1 from public.organization_sites where id = %s and organization_id = %s',
        [str(binding.site_uuid), str(binding.organization_uuid)],
    )
    if cursor.fetchone() is None:
        raise EvidenceProjectionUnavailable('mapped public site is outside the mapped organization or does not exist')
    if binding.cohort_uuid:
        cursor.execute(
            'select 1 from public.cohorts where id = %s and organization_id = %s and (site_id is null or site_id = %s)',
            [str(binding.cohort_uuid), str(binding.organization_uuid), str(binding.site_uuid)],
        )
        if cursor.fetchone() is None:
            raise EvidenceProjectionUnavailable('mapped public cohort is outside the mapped organization/site or does not exist')
    if binding.source_uuid:
        cursor.execute(
            'select 1 from public.data_sources where id = %s and organization_id = %s and (site_id is null or site_id = %s)',
            [str(binding.source_uuid), str(binding.organization_uuid), str(binding.site_uuid)],
        )
        if cursor.fetchone() is None:
            raise EvidenceProjectionUnavailable('mapped public data source is outside the mapped organization/site or does not exist')


def _verify_target(cursor, table: str, target_id, binding):
    if not target_id:
        return
    if table not in {'evidence_baselines', 'evidence_observation_periods'}:
        raise ValueError('unsupported evidence target table')
    cursor.execute(
        f'''select locked_at from public.{table}
            where id = %s and organization_id = %s and site_id = %s''',
        [str(target_id), str(binding.organization_uuid), str(binding.site_uuid)],
    )
    row = cursor.fetchone()
    if row is None:
        raise EvidenceProjectionUnavailable(f'{table} target is outside the mapped tenant or does not exist')
    if row[0] is not None:
        raise EvidenceProjectionUnavailable(f'{table} target is locked')


def _existing_projection(cursor, binding, projection_key):
    cursor.execute(
        '''select id, baseline_id, observation_period_id
           from public.evidence_commute_observations
           where organization_id = %s
             and original_payload->>'relay_projection_key' = %s
           order by created_at asc
           limit 2
           for update''',
        [str(binding.organization_uuid), projection_key],
    )
    rows = cursor.fetchall()
    if len(rows) > 1:
        raise EvidenceProjectionUnavailable('duplicate Relay Rider evidence projections already exist; manual review required')
    return rows[0] if rows else None


def _insert_projection(cursor, binding, row, baseline_id, observation_period_id):
    cursor.execute(
        '''insert into public.evidence_commute_observations (
            organization_id, site_id, cohort_id, baseline_id, observation_period_id, source_id,
            participant_key, observation_date, origin_zone, commute_mode, source_mode, one_way_miles,
            vehicle_occupancy, reported_to_site, remote_day, ev_hybrid_status, parking_difficulty,
            arrival_window, departure_window, validation_status, exclusion_reason, source_row_number,
            original_payload
        ) values (
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb
        ) returning id''',
        [
            str(binding.organization_uuid), str(binding.site_uuid), str(binding.cohort_uuid) if binding.cohort_uuid else None,
            str(baseline_id) if baseline_id else None, str(observation_period_id) if observation_period_id else None,
            str(binding.source_uuid) if binding.source_uuid else None,
            row['participant_key'], row['observation_date'], row['origin_zone'], row['commute_mode'], row['source_mode'],
            row['one_way_miles'], row['vehicle_occupancy'], row['reported_to_site'], row['remote_day'], row['ev_hybrid_status'],
            row['parking_difficulty'], row['arrival_window'], row['departure_window'], row['validation_status'],
            row['exclusion_reason'], row['source_row_number'], json.dumps(row['original_payload'], sort_keys=True),
        ],
    )
    return cursor.fetchone()[0]


def _update_projection(cursor, evidence_id, binding, row, baseline_id, observation_period_id):
    cursor.execute(
        '''update public.evidence_commute_observations set
            site_id=%s, cohort_id=%s, baseline_id=%s, observation_period_id=%s, source_id=%s,
            participant_key=%s, observation_date=%s, origin_zone=%s, commute_mode=%s, source_mode=%s,
            one_way_miles=%s, vehicle_occupancy=%s, reported_to_site=%s, remote_day=%s,
            ev_hybrid_status=%s, parking_difficulty=%s, arrival_window=%s, departure_window=%s,
            validation_status=%s, exclusion_reason=%s, source_row_number=%s, original_payload=%s::jsonb,
            updated_at=now()
           where id=%s and organization_id=%s''',
        [
            str(binding.site_uuid), str(binding.cohort_uuid) if binding.cohort_uuid else None,
            str(baseline_id) if baseline_id else None, str(observation_period_id) if observation_period_id else None,
            str(binding.source_uuid) if binding.source_uuid else None,
            row['participant_key'], row['observation_date'], row['origin_zone'], row['commute_mode'], row['source_mode'],
            row['one_way_miles'], row['vehicle_occupancy'], row['reported_to_site'], row['remote_day'], row['ev_hybrid_status'],
            row['parking_difficulty'], row['arrival_window'], row['departure_window'], row['validation_status'],
            row['exclusion_reason'], row['source_row_number'], json.dumps(row['original_payload'], sort_keys=True),
            str(evidence_id), str(binding.organization_uuid),
        ],
    )


@transaction.atomic
def project_commute_import_to_evidence(
    commute_import,
    *,
    actor=None,
    baseline_id=None,
    observation_period_id=None,
    participant_key_secret=None,
):
    """Project valid canonical commuter records into governed public evidence.

    The operation is intentionally PostgreSQL-only because it crosses from the
    canonical `relay_app` schema into the existing public evidence schema.
    """
    if connection.vendor != 'postgresql':
        raise EvidenceProjectionUnavailable('Evidence projection requires PostgreSQL')
    secret = _resolve_secret(participant_key_secret)
    binding = _resolve_binding(commute_import)
    result = ProjectionResult()

    with connection.cursor() as cursor:
        _verify_public_identity(cursor, binding)
        _verify_target(cursor, 'evidence_baselines', baseline_id, binding)
        _verify_target(cursor, 'evidence_observation_periods', observation_period_id, binding)

        for record in commute_import.records.filter(validation_status='valid').order_by('id'):
            row, issues = normalize_record_for_evidence(record, participant_key_secret=secret)
            if issues:
                result.blocked += 1
                result.issues.extend(issues)
                continue

            projection_key = row['original_payload']['relay_projection_key']
            existing = _existing_projection(cursor, binding, projection_key)
            if existing:
                evidence_id, existing_baseline, existing_period = existing
                _verify_target(cursor, 'evidence_baselines', existing_baseline, binding)
                _verify_target(cursor, 'evidence_observation_periods', existing_period, binding)
                _update_projection(cursor, evidence_id, binding, row, baseline_id or existing_baseline, observation_period_id or existing_period)
                result.updated += 1
            else:
                _insert_projection(cursor, binding, row, baseline_id, observation_period_id)
                result.inserted += 1

    AssessmentAuditEvent.objects.create(
        institution=commute_import.institution,
        site=commute_import.site,
        actor=actor,
        action='evidence_projection.completed',
        entity_type='CommuteImport',
        entity_id=str(commute_import.id),
        metadata=result.to_dict(),
    )
    return result
