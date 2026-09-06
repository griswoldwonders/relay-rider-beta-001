from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from math import isfinite

import h3
from django.conf import settings

from relay.models import Cohort, Institution, Site


TRANSFORMATION_VERSION = 'h3-privacy-geography-v1'
ALLOWED_PROVENANCE_LABELS = frozenset({'synthetic', 'reported', 'imported'})


class PrivacyGeographyError(ValueError):
    pass


@dataclass(frozen=True)
class PrivacyGeographyScope:
    institution: Institution
    site: Site | None = None
    cohort: Cohort | None = None


@dataclass(frozen=True)
class GeographyObservation:
    record_id: str
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    geography_authorized: bool
    provenance_label: str
    institution_id: int | None = None
    site_id: int | None = None
    cohort_id: int | None = None


@dataclass(frozen=True)
class PrivacyGeographyRecord:
    record_id: str
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    origin_h3_cell: str
    destination_h3_cell: str
    h3_resolution: int
    transformation_version: str
    provenance_label: str


@dataclass(frozen=True)
class CorridorAggregate:
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    origin_h3_cell: str
    destination_h3_cell: str
    participant_count: int
    h3_resolution: int
    suppression_threshold: int
    transformation_version: str


@dataclass(frozen=True)
class PrivacyGeographyAuditSummary:
    transformation_version: str
    h3_resolution: int
    suppression_threshold: int
    institution_id: int
    site_id: int | None
    cohort_id: int | None
    provenance_labels: tuple[str, ...]
    total_observations: int
    valid_observations: int
    publishable_corridor_count: int
    suppressed_corridor_group_count: int
    suppressed_contributing_observation_count: int


@dataclass(frozen=True)
class PrivacyGeographyResult:
    publishable_corridors: tuple[CorridorAggregate, ...]
    audit_summary: PrivacyGeographyAuditSummary


def resolve_privacy_geography_scope(
    *,
    institution: Institution,
    site: Site | None = None,
    cohort: Cohort | None = None,
) -> PrivacyGeographyScope:
    if not isinstance(institution, Institution) or institution.pk is None:
        raise PrivacyGeographyError('invalid privacy geography scope')
    if site is not None:
        if not isinstance(site, Site) or site.pk is None:
            raise PrivacyGeographyError('invalid privacy geography scope')
        if site.institution_id != institution.id:
            raise PrivacyGeographyError('site scope mismatch')
    if cohort is not None:
        if not isinstance(cohort, Cohort) or cohort.pk is None:
            raise PrivacyGeographyError('invalid privacy geography scope')
        if site is None:
            raise PrivacyGeographyError('invalid privacy geography scope')
        if cohort.institution_id != institution.id:
            raise PrivacyGeographyError('cohort scope mismatch')
        if cohort.site_id != site.id:
            raise PrivacyGeographyError('cohort scope mismatch')
    return PrivacyGeographyScope(
        institution=institution,
        site=site,
        cohort=cohort,
    )


def _effective_resolution(resolution: int | None) -> int:
    value = settings.RELAY_H3_RESOLUTION if resolution is None else resolution
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 15:
        raise PrivacyGeographyError('invalid H3 resolution')
    return value


def _effective_minimum_publishable_count(value: int | None) -> int:
    threshold = (
        settings.RELAY_H3_MIN_PUBLISHABLE_COUNT
        if value is None
        else value
    )
    if not isinstance(threshold, int) or isinstance(threshold, bool) or threshold < 1:
        raise PrivacyGeographyError('invalid suppression threshold')
    return threshold


def _validate_coordinate(value, *, axis: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise PrivacyGeographyError(f'invalid {axis}') from exc
    if not isfinite(number):
        raise PrivacyGeographyError(f'invalid {axis}')
    if axis == 'latitude' and not -90 <= number <= 90:
        raise PrivacyGeographyError('invalid latitude')
    if axis == 'longitude' and not -180 <= number <= 180:
        raise PrivacyGeographyError('invalid longitude')
    return number


def _validate_observation_scope_and_authorization(
    *,
    scope: PrivacyGeographyScope,
    observation: GeographyObservation,
    seen_ids: set[str],
) -> None:
    if not isinstance(observation, GeographyObservation):
        raise PrivacyGeographyError('invalid observation identifier')
    if not isinstance(observation.record_id, str) or not observation.record_id.strip():
        raise PrivacyGeographyError('invalid observation identifier')
    if observation.geography_authorized is not True:
        raise PrivacyGeographyError('geography authorization required')
    if observation.provenance_label not in ALLOWED_PROVENANCE_LABELS:
        raise PrivacyGeographyError('unsupported geography provenance')
    if (
        observation.institution_id is not None
        and observation.institution_id != scope.institution.id
    ):
        raise PrivacyGeographyError('institution scope mismatch')
    if observation.site_id is not None:
        if scope.site is None or observation.site_id != scope.site.id:
            raise PrivacyGeographyError('site scope mismatch')
    if observation.cohort_id is not None:
        if scope.cohort is None or observation.cohort_id != scope.cohort.id:
            raise PrivacyGeographyError('cohort scope mismatch')
    if observation.record_id in seen_ids:
        raise PrivacyGeographyError('duplicate observation identifier')
    seen_ids.add(observation.record_id)


def transform_observations(
    *,
    scope: PrivacyGeographyScope,
    observations: Iterable[GeographyObservation],
    resolution: int | None = None,
) -> tuple[PrivacyGeographyRecord, ...]:
    if not isinstance(scope, PrivacyGeographyScope):
        raise PrivacyGeographyError('invalid privacy geography scope')

    h3_resolution = _effective_resolution(resolution)
    seen_ids: set[str] = set()
    transformed: list[PrivacyGeographyRecord] = []

    for observation in observations:
        _validate_observation_scope_and_authorization(
            scope=scope,
            observation=observation,
            seen_ids=seen_ids,
        )
        origin_lat = _validate_coordinate(observation.origin_lat, axis='latitude')
        origin_lng = _validate_coordinate(observation.origin_lng, axis='longitude')
        destination_lat = _validate_coordinate(
            observation.destination_lat, axis='latitude'
        )
        destination_lng = _validate_coordinate(
            observation.destination_lng, axis='longitude'
        )

        try:
            origin_cell = h3.latlng_to_cell(origin_lat, origin_lng, h3_resolution)
            destination_cell = h3.latlng_to_cell(
                destination_lat, destination_lng, h3_resolution
            )
        except Exception as exc:
            raise PrivacyGeographyError('H3 transformation failed') from exc

        transformed.append(
            PrivacyGeographyRecord(
                record_id=observation.record_id,
                institution_id=scope.institution.id,
                site_id=scope.site.id if scope.site else None,
                cohort_id=scope.cohort.id if scope.cohort else None,
                origin_h3_cell=origin_cell,
                destination_h3_cell=destination_cell,
                h3_resolution=h3_resolution,
                transformation_version=TRANSFORMATION_VERSION,
                provenance_label=observation.provenance_label,
            )
        )

    return tuple(sorted(transformed, key=lambda item: item.record_id))


def aggregate_corridors(
    *,
    scope: PrivacyGeographyScope,
    observations: Iterable[GeographyObservation],
    resolution: int | None = None,
    minimum_publishable_count: int | None = None,
) -> PrivacyGeographyResult:
    observation_tuple = tuple(observations)
    restricted_records = transform_observations(
        scope=scope,
        observations=observation_tuple,
        resolution=resolution,
    )
    threshold = _effective_minimum_publishable_count(minimum_publishable_count)
    h3_resolution = _effective_resolution(resolution)

    corridor_counts = Counter(
        (record.origin_h3_cell, record.destination_h3_cell)
        for record in restricted_records
    )

    publishable: list[CorridorAggregate] = []
    suppressed_groups = 0
    suppressed_contributors = 0

    for (origin_cell, destination_cell), count in sorted(corridor_counts.items()):
        if count < threshold:
            suppressed_groups += 1
            suppressed_contributors += count
            continue
        publishable.append(
            CorridorAggregate(
                institution_id=scope.institution.id,
                site_id=scope.site.id if scope.site else None,
                cohort_id=scope.cohort.id if scope.cohort else None,
                origin_h3_cell=origin_cell,
                destination_h3_cell=destination_cell,
                participant_count=count,
                h3_resolution=h3_resolution,
                suppression_threshold=threshold,
                transformation_version=TRANSFORMATION_VERSION,
            )
        )

    provenance_labels = tuple(
        sorted({record.provenance_label for record in restricted_records})
    )
    audit_summary = PrivacyGeographyAuditSummary(
        transformation_version=TRANSFORMATION_VERSION,
        h3_resolution=h3_resolution,
        suppression_threshold=threshold,
        institution_id=scope.institution.id,
        site_id=scope.site.id if scope.site else None,
        cohort_id=scope.cohort.id if scope.cohort else None,
        provenance_labels=provenance_labels,
        total_observations=len(observation_tuple),
        valid_observations=len(restricted_records),
        publishable_corridor_count=len(publishable),
        suppressed_corridor_group_count=suppressed_groups,
        suppressed_contributing_observation_count=suppressed_contributors,
    )
    return PrivacyGeographyResult(
        publishable_corridors=tuple(publishable),
        audit_summary=audit_summary,
    )
