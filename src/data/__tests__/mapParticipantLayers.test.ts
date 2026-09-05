import { describe, expect, it } from 'vitest';
import { sessionDemandZones, sessionPlannedRoutes } from '../mapParticipantLayers';
import type { EVParticipantSignal, RouteSignal } from '../../types';

function makeRouteSignal(overrides: Partial<RouteSignal>): RouteSignal {
  return {
    id: 'sig-1',
    corridor: 'test-corridor',
    startingArea: 'Pasadena',
    destinationArea: 'Glendale',
    campusAffiliation: 'PCC',
    daysOfWeek: [],
    timeWindow: '',
    routeType: 'recurring',
    relayZoneType: [],
    transitOptions: [],
    studentTransitPass: 'not-sure',
    incentiveInterests: [],
    evPreference: 'any',
    maxWalkingDistance: '',
    privacyPreference: '',
    status: 'submitted',
    routeFit: 'moderate',
    greenRouteCredit: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeEvSignal(overrides: Partial<EVParticipantSignal>): EVParticipantSignal {
  return {
    id: 'ev-1',
    vehicleType: 'ev',
    vehicleMake: 'Test',
    vehicleModel: 'Model',
    vehicleYear: '2024',
    startingArea: 'Pasadena',
    destinationArea: 'Glendale',
    travelDays: [],
    timeWindow: '',
    maxDetour: '',
    relayZoneTypes: [],
    feedbackCallWilling: false,
    reviewsAccepted: [],
    status: 'submitted',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sessionDemandZones', () => {
  it('never echoes an unresolved raw destination address in topDestinations', () => {
    const signal = makeRouteSignal({
      startingArea: 'Pasadena',
      destinationArea: '4821 N. Private Residence Ct, Apt 2',
    });

    const [zone] = sessionDemandZones([signal]);

    expect(zone.topDestinations).not.toContain('4821 N. Private Residence Ct, Apt 2');
    expect(zone.topDestinations.join(' ')).not.toMatch(/4821/);
  });

  it('uses a generalized destination label when the destination area resolves', () => {
    const signal = makeRouteSignal({ startingArea: 'Pasadena', destinationArea: 'Glendale' });

    const [zone] = sessionDemandZones([signal]);

    expect(zone.topDestinations).toEqual(['Glendale']);
  });

  it('omits the session zone entirely when the starting area cannot be resolved', () => {
    const signal = makeRouteSignal({ startingArea: '123 Unresolvable Ln', destinationArea: 'Glendale' });

    expect(sessionDemandZones([signal])).toEqual([]);
  });
});

describe('sessionPlannedRoutes', () => {
  it('omits the session route entirely when either area cannot be resolved (no raw text leak)', () => {
    const signal = makeEvSignal({ startingArea: 'Pasadena', destinationArea: '789 Secret Ave' });

    expect(sessionPlannedRoutes([signal])).toEqual([]);
  });

  it('builds a route from generalized area labels when both areas resolve', () => {
    const signal = makeEvSignal({ startingArea: 'Pasadena', destinationArea: 'Glendale' });

    const [route] = sessionPlannedRoutes([signal]);

    expect(route.name).toBe('Pasadena → Glendale · your session route');
  });
});
