from dataclasses import asdict
from math import inf, nan

from django.test import TestCase, override_settings

from relay.models import Cohort, Institution, Site
from relay.services.privacy_geography import (
    TRANSFORMATION_VERSION,
    CorridorAggregate,
    GeographyObservation,
    PrivacyGeographyError,
    PrivacyGeographyRecord,
    aggregate_corridors,
    resolve_privacy_geography_scope,
    transform_observations,
)


ORIGIN = (34.1500, -118.1400)
DESTINATION = (34.1400, -118.1300)
ALT_ORIGIN = (34.1800, -118.1700)
ALT_DESTINATION = (34.1700, -118.1600)


def make_observation(record_id, *, origin=ORIGIN, destination=DESTINATION, **overrides):
    values = {
        'record_id': record_id,
        'origin_lat': origin[0],
        'origin_lng': origin[1],
        'destination_lat': destination[0],
        'destination_lng': destination[1],
        'geography_authorized': True,
        'provenance_label': 'synthetic',
    }
    values.update(overrides)
    return GeographyObservation(**values)


class PrivacyGeographyTests(TestCase):
    def setUp(self):
        self.institution = Institution.objects.create(
            name='Synthetic Institution',
            slug='synthetic-institution',
            status='active',
        )
        self.site = Site.objects.create(
            institution=self.institution,
            name='Synthetic Site',
            slug='synthetic-site',
            site_type='campus',
        )
        self.cohort = Cohort.objects.create(
            institution=self.institution,
            site=self.site,
            name='Synthetic Cohort',
            slug='synthetic-cohort',
        )
        self.scope = resolve_privacy_geography_scope(
            institution=self.institution,
            site=self.site,
            cohort=self.cohort,
        )

    def test_scope_rejects_site_from_another_institution(self):
        other = Institution.objects.create(name='Other', slug='other')
        other_site = Site.objects.create(
            institution=other,
            name='Other Site',
            slug='other-site',
        )
        with self.assertRaisesMessage(PrivacyGeographyError, 'site scope mismatch'):
            resolve_privacy_geography_scope(
                institution=self.institution,
                site=other_site,
            )

    def test_scope_rejects_cohort_from_another_institution(self):
        other = Institution.objects.create(name='Other 2', slug='other-2')
        other_site = Site.objects.create(
            institution=other,
            name='Other Site 2',
            slug='other-site-2',
        )
        other_cohort = Cohort.objects.create(
            institution=other,
            site=other_site,
            name='Other Cohort',
            slug='other-cohort',
        )
        with self.assertRaisesMessage(PrivacyGeographyError, 'cohort scope mismatch'):
            resolve_privacy_geography_scope(
                institution=self.institution,
                site=self.site,
                cohort=other_cohort,
            )

    def test_scope_rejects_cohort_from_different_site_same_institution(self):
        other_site = Site.objects.create(
            institution=self.institution,
            name='Synthetic Site 2',
            slug='synthetic-site-2',
        )
        other_cohort = Cohort.objects.create(
            institution=self.institution,
            site=other_site,
            name='Synthetic Cohort 2',
            slug='synthetic-cohort-2',
        )
        with self.assertRaisesMessage(PrivacyGeographyError, 'cohort scope mismatch'):
            resolve_privacy_geography_scope(
                institution=self.institution,
                site=self.site,
                cohort=other_cohort,
            )

    def test_scope_rejects_cohort_without_site(self):
        with self.assertRaisesMessage(PrivacyGeographyError, 'invalid privacy geography scope'):
            resolve_privacy_geography_scope(
                institution=self.institution,
                cohort=self.cohort,
            )

    def test_transform_requires_resolved_scope(self):
        with self.assertRaisesMessage(PrivacyGeographyError, 'invalid privacy geography scope'):
            transform_observations(
                scope=self.institution,
                observations=[make_observation('R1')],
            )

    def test_geography_authorization_is_required(self):
        observation = make_observation('R1', geography_authorized=False)
        with self.assertRaisesMessage(PrivacyGeographyError, 'geography authorization required'):
            transform_observations(scope=self.scope, observations=[observation])

    def test_modeled_provenance_is_rejected(self):
        observation = make_observation('R1', provenance_label='modeled')
        with self.assertRaisesMessage(PrivacyGeographyError, 'unsupported geography provenance'):
            transform_observations(scope=self.scope, observations=[observation])

    def test_synthetic_authorized_observation_is_accepted(self):
        observation = make_observation(
            'R1', geography_authorized=True, provenance_label='synthetic'
        )
        result = transform_observations(scope=self.scope, observations=[observation])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].provenance_label, 'synthetic')

    def _assert_private_coordinate_failure(self, **overrides):
        observation = make_observation('R1', **overrides)
        raw_values = [str(value) for value in overrides.values()]
        try:
            transform_observations(scope=self.scope, observations=[observation])
        except PrivacyGeographyError as exc:
            message = str(exc)
            for value in raw_values:
                self.assertNotIn(value, message)
            return message
        self.fail('Expected PrivacyGeographyError')

    def test_invalid_latitudes_fail_without_echoing_values(self):
        self.assertEqual(
            self._assert_private_coordinate_failure(origin_lat=91.25),
            'invalid latitude',
        )
        self.assertEqual(
            self._assert_private_coordinate_failure(destination_lat=-91.25),
            'invalid latitude',
        )

    def test_invalid_longitudes_fail_without_echoing_values(self):
        self.assertEqual(
            self._assert_private_coordinate_failure(origin_lng=181.25),
            'invalid longitude',
        )
        self.assertEqual(
            self._assert_private_coordinate_failure(destination_lng=-181.25),
            'invalid longitude',
        )

    def test_nan_and_infinity_fail_without_echoing_values(self):
        for field, value, expected in (
            ('origin_lat', nan, 'invalid latitude'),
            ('origin_lng', inf, 'invalid longitude'),
            ('destination_lat', -inf, 'invalid latitude'),
        ):
            with self.subTest(field=field, value=value):
                self.assertEqual(
                    self._assert_private_coordinate_failure(**{field: value}),
                    expected,
                )

    @override_settings(RELAY_H3_RESOLUTION=7)
    def test_same_coordinates_produce_same_cells(self):
        first = transform_observations(
            scope=self.scope,
            observations=[make_observation('R1')],
        )[0]
        second = transform_observations(
            scope=self.scope,
            observations=[make_observation('R1')],
        )[0]
        self.assertEqual(first.origin_h3_cell, second.origin_h3_cell)
        self.assertEqual(first.destination_h3_cell, second.destination_h3_cell)
        self.assertEqual(first.h3_resolution, 7)
        self.assertEqual(first.transformation_version, TRANSFORMATION_VERSION)

    @override_settings(RELAY_H3_RESOLUTION=6)
    def test_configured_resolution_is_recorded(self):
        record = transform_observations(
            scope=self.scope,
            observations=[make_observation('R1')],
        )[0]
        self.assertEqual(record.h3_resolution, 6)

    def test_restricted_record_contains_no_raw_coordinates(self):
        record = transform_observations(
            scope=self.scope,
            observations=[make_observation('R1')],
        )[0]
        self.assertIsInstance(record, PrivacyGeographyRecord)
        keys = set(asdict(record))
        self.assertFalse(
            {'origin_lat', 'origin_lng', 'destination_lat', 'destination_lng'} & keys
        )

    def test_declared_institution_mismatch_fails_complete_request(self):
        observation = make_observation(
            'R1', institution_id=self.institution.id + 999
        )
        with self.assertRaisesMessage(PrivacyGeographyError, 'institution scope mismatch'):
            transform_observations(scope=self.scope, observations=[observation])

    def test_declared_site_mismatch_fails_complete_request(self):
        observation = make_observation('R1', site_id=self.site.id + 999)
        with self.assertRaisesMessage(PrivacyGeographyError, 'site scope mismatch'):
            transform_observations(scope=self.scope, observations=[observation])

    def test_declared_cohort_mismatch_fails_complete_request(self):
        observation = make_observation('R1', cohort_id=self.cohort.id + 999)
        with self.assertRaisesMessage(PrivacyGeographyError, 'cohort scope mismatch'):
            transform_observations(scope=self.scope, observations=[observation])

    def test_duplicate_observation_identifier_fails_request(self):
        with self.assertRaisesMessage(PrivacyGeographyError, 'duplicate observation identifier'):
            aggregate_corridors(
                scope=self.scope,
                observations=[make_observation('R1'), make_observation('R1')],
            )

    @override_settings(RELAY_H3_MIN_PUBLISHABLE_COUNT=5)
    def test_five_observations_publish_one_corridor(self):
        result = aggregate_corridors(
            scope=self.scope,
            observations=[make_observation(f'R{i}') for i in range(5)],
        )
        self.assertEqual(len(result.publishable_corridors), 1)
        self.assertIsInstance(result.publishable_corridors[0], CorridorAggregate)
        self.assertEqual(result.publishable_corridors[0].participant_count, 5)
        self.assertEqual(result.audit_summary.suppressed_corridor_group_count, 0)

    @override_settings(RELAY_H3_MIN_PUBLISHABLE_COUNT=5)
    def test_four_observations_are_suppressed(self):
        result = aggregate_corridors(
            scope=self.scope,
            observations=[make_observation(f'R{i}') for i in range(4)],
        )
        self.assertEqual(result.publishable_corridors, ())
        self.assertEqual(result.audit_summary.suppressed_corridor_group_count, 1)
        self.assertEqual(result.audit_summary.suppressed_contributing_observation_count, 4)

    @override_settings(RELAY_H3_MIN_PUBLISHABLE_COUNT=5)
    def test_two_publishable_corridors_aggregate_independently(self):
        observations = [make_observation(f'A{i}') for i in range(5)]
        observations += [
            make_observation(f'B{i}', origin=ALT_ORIGIN, destination=ALT_DESTINATION)
            for i in range(5)
        ]
        result = aggregate_corridors(scope=self.scope, observations=observations)
        self.assertEqual(len(result.publishable_corridors), 2)
        self.assertEqual(
            [corridor.participant_count for corridor in result.publishable_corridors],
            [5, 5],
        )

    @override_settings(RELAY_H3_MIN_PUBLISHABLE_COUNT=5)
    def test_same_h3_cells_do_not_mix_across_institutions(self):
        other = Institution.objects.create(
            name='Other Institution', slug='other-institution', status='active'
        )
        other_site = Site.objects.create(
            institution=other,
            name='Other Site',
            slug='other-site-privacy',
        )
        other_cohort = Cohort.objects.create(
            institution=other,
            site=other_site,
            name='Other Cohort',
            slug='other-cohort-privacy',
        )
        other_scope = resolve_privacy_geography_scope(
            institution=other,
            site=other_site,
            cohort=other_cohort,
        )
        own = aggregate_corridors(
            scope=self.scope,
            observations=[make_observation(f'A{i}') for i in range(5)],
        )
        other_result = aggregate_corridors(
            scope=other_scope,
            observations=[make_observation(f'B{i}') for i in range(5)],
        )
        self.assertEqual(own.publishable_corridors[0].participant_count, 5)
        self.assertEqual(other_result.publishable_corridors[0].participant_count, 5)
        self.assertNotEqual(
            own.publishable_corridors[0].institution_id,
            other_result.publishable_corridors[0].institution_id,
        )

    def test_audit_summary_never_contains_suppressed_cells(self):
        result = aggregate_corridors(
            scope=self.scope,
            observations=[make_observation(f'R{i}') for i in range(4)],
        )
        keys = set(asdict(result.audit_summary))
        self.assertNotIn('origin_h3_cell', keys)
        self.assertNotIn('destination_h3_cell', keys)

    def test_publishable_corridor_has_aggregate_fields_only(self):
        result = aggregate_corridors(
            scope=self.scope,
            observations=[make_observation(f'R{i}') for i in range(5)],
        )
        keys = set(asdict(result.publishable_corridors[0]))
        self.assertEqual(
            keys,
            {
                'institution_id',
                'site_id',
                'cohort_id',
                'origin_h3_cell',
                'destination_h3_cell',
                'participant_count',
                'h3_resolution',
                'suppression_threshold',
                'transformation_version',
            },
        )

    def test_commuter_record_schema_does_not_gain_h3_fields(self):
        from relay.models import CommuterRecord

        field_names = {field.name for field in CommuterRecord._meta.get_fields()}
        self.assertNotIn('origin_h3', field_names)
        self.assertNotIn('destination_h3', field_names)
        self.assertNotIn('origin_h3_cell', field_names)
        self.assertNotIn('destination_h3_cell', field_names)
