import { describe, expect, it } from 'vitest';
import {
  assessCleanCommuteInterventions,
  type CleanCommuteCommuter,
  type CleanCommuteOptions,
  type CleanCommuteProgramRules,
} from '../interventionRouter';

const commuter: CleanCommuteCommuter = {
  id: 'C-1042',
  institutionId: 'pasadena-demo',
  originZone: 'Eagle Rock',
  destinationZone: 'Pasadena',
  travelDays: ['Tue', 'Wed', 'Thu'],
  arrivalWindow: [470, 490],
  currentMode: 'drive_alone',
  vehiclePowertrain: 'gasoline_diesel',
  consentForOptionAnalysis: true,
};

const rules: CleanCommuteProgramRules = {
  strongThreshold: 80,
  requireReviewedAccessPoint: true,
};

const strongEvRoute = {
  id: 'EVR-12',
  institutionId: 'pasadena-demo',
  originZone: 'Eagle Rock',
  destinationZone: 'Pasadena',
  travelDays: ['Tue', 'Wed', 'Thu'],
  arrivalWindow: [465, 495] as [number, number],
  powertrain: 'BEV' as const,
  availableCapacity: 2,
  incrementalDetourMinutes: 3.1,
  maxDetourMinutes: 8,
  routeOverlapScore: 94,
  scheduleFitScore: 92,
  detourFitScore: 88,
  originDestinationFitScore: 95,
  accessPointFitScore: 84,
  accessPointStatus: 'reviewed' as const,
  accessibilityCompatible: true,
  evidenceState: 'modeled' as const,
  source: 'Synthetic Pasadena planned-route fixture',
};

const moderateTransit = {
  id: 'TR-180',
  serviceAvailable: true,
  originDestinationFitScore: 74,
  scheduleFitScore: 72,
  travelTimeMinutes: 52,
  maxAcceptableTravelTimeMinutes: 55,
  accessibilityCompatible: true,
  evidenceState: 'modeled' as const,
  source: 'Synthetic Pasadena transit fixture',
};

const unsupportedActive = {
  id: 'ACTIVE-1',
  distanceMiles: null,
  maxEligibleMiles: 3,
  accessibilityCompatible: true,
  evidenceState: 'unsupported' as const,
  source: 'No supported distance fixture',
};

const baseOptions: CleanCommuteOptions = {
  plannedEvRoutes: [strongEvRoute],
  transit: moderateTransit,
  activeTransportation: unsupportedActive,
};

describe('assessCleanCommuteInterventions', () => {
  it('selects a strong planned EV route after hard gates pass', () => {
    const result = assessCleanCommuteInterventions(commuter, baseOptions, rules);

    expect(result.classification).toBe('planned_ev_route_stronger');
    expect(result.plannedEvRoute.eligibilityStatus).toBe('eligible');
    expect(result.plannedEvRoute.score).toBe(91);
    expect(result.plannedEvRoute.reasons.join(' ')).toContain('planned BEV/PHEV');
  });

  it('selects transit when transit is strong and EV route fit is weak', () => {
    const result = assessCleanCommuteInterventions(
      commuter,
      {
        ...baseOptions,
        plannedEvRoutes: [{ ...strongEvRoute, routeOverlapScore: 55, scheduleFitScore: 60, detourFitScore: 60, originDestinationFitScore: 65, accessPointFitScore: 65 }],
        transit: { ...moderateTransit, originDestinationFitScore: 94, scheduleFitScore: 92, travelTimeMinutes: 36 },
      },
      rules,
    );

    expect(result.classification).toBe('transit_stronger');
    expect(result.transit.strength).toBe('strong');
  });

  it('returns both_credible when transit and planned EV route both meet the strong threshold', () => {
    const result = assessCleanCommuteInterventions(
      commuter,
      { ...baseOptions, transit: { ...moderateTransit, originDestinationFitScore: 90, scheduleFitScore: 90, travelTimeMinutes: 38 } },
      rules,
    );

    expect(result.classification).toBe('both_credible');
  });

  it('suppresses planned EV route when modeled capacity is unavailable', () => {
    const result = assessCleanCommuteInterventions(
      commuter,
      { ...baseOptions, plannedEvRoutes: [{ ...strongEvRoute, availableCapacity: 0 }] },
      rules,
    );

    expect(result.plannedEvRoute.eligibilityStatus).toBe('ineligible');
    expect(result.plannedEvRoute.limitingFactors).toContain('No modeled seat capacity is available.');
  });

  it('suppresses planned EV route when incremental detour exceeds participant limit', () => {
    const result = assessCleanCommuteInterventions(
      commuter,
      { ...baseOptions, plannedEvRoutes: [{ ...strongEvRoute, incrementalDetourMinutes: 12 }] },
      rules,
    );

    expect(result.plannedEvRoute.limitingFactors.join(' ')).toContain('detour');
  });

  it('suppresses planned EV route when schedule windows do not overlap', () => {
    const result = assessCleanCommuteInterventions(
      commuter,
      { ...baseOptions, plannedEvRoutes: [{ ...strongEvRoute, arrivalWindow: [540, 570] }] },
      rules,
    );

    expect(result.plannedEvRoute.limitingFactors).toContain('Schedule windows do not overlap.');
  });

  it('suppresses commuter-option analysis when privacy consent is absent', () => {
    const result = assessCleanCommuteInterventions(
      { ...commuter, consentForOptionAnalysis: false },
      baseOptions,
      rules,
    );

    expect(result.plannedEvRoute.limitingFactors).toContain('Participant consent does not permit commuter-option analysis.');
    expect(result.transit.eligibilityStatus).toBe('ineligible');
  });

  it('returns no_supported_alternative when every intervention is unsupported or ineligible', () => {
    const result = assessCleanCommuteInterventions(
      commuter,
      {
        plannedEvRoutes: [],
        transit: { ...moderateTransit, evidenceState: 'unsupported', serviceAvailable: false },
        activeTransportation: unsupportedActive,
      },
      rules,
    );

    expect(result.classification).toBe('no_supported_alternative');
    expect(result.explanation).toContain('No currently supported clean commute alternative');
  });
});
