import {
  assessCleanCommuteInterventions,
  type CleanCommuteCommuter,
  type CleanCommuteOptions,
  type CleanCommuteProgramRules,
} from '../lib/interventionRouter';
import { calculateModeledNetVmt } from '../lib/netVmt';

export const pasadenaDemoCommuter: CleanCommuteCommuter = {
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

export const pasadenaDemoOptions: CleanCommuteOptions = {
  plannedEvRoutes: [
    {
      id: 'EVR-12',
      institutionId: 'pasadena-demo',
      originZone: 'Eagle Rock',
      destinationZone: 'Pasadena',
      travelDays: ['Tue', 'Wed', 'Thu'],
      arrivalWindow: [465, 495],
      powertrain: 'BEV',
      availableCapacity: 2,
      incrementalDetourMinutes: 3.1,
      maxDetourMinutes: 8,
      routeOverlapScore: 94,
      scheduleFitScore: 92,
      detourFitScore: 88,
      originDestinationFitScore: 95,
      accessPointFitScore: 84,
      accessPointStatus: 'reviewed',
      accessibilityCompatible: true,
      evidenceState: 'modeled',
      source: 'Synthetic Pasadena planned-route fixture',
    },
  ],
  transit: {
    id: 'TR-180',
    serviceAvailable: true,
    originDestinationFitScore: 74,
    scheduleFitScore: 72,
    travelTimeMinutes: 52,
    maxAcceptableTravelTimeMinutes: 55,
    accessibilityCompatible: true,
    evidenceState: 'modeled',
    source: 'Synthetic Pasadena transit fixture; not live service data',
  },
  activeTransportation: {
    id: 'ACTIVE-1',
    distanceMiles: null,
    maxEligibleMiles: 3,
    accessibilityCompatible: true,
    evidenceState: 'unsupported',
    source: 'No supported distance/access fixture',
  },
};

export const pasadenaDemoProgramRules: CleanCommuteProgramRules = {
  strongThreshold: 80,
  requireReviewedAccessPoint: true,
};

export const pasadenaInterventionAssessment = assessCleanCommuteInterventions(
  pasadenaDemoCommuter,
  pasadenaDemoOptions,
  pasadenaDemoProgramRules,
);

export const pasadenaNetVmtAssessment = calculateModeledNetVmt({
  baselineSovMiles: 10.2,
  incrementalEvDetourMiles: 1.4,
});

export const pasadenaInterventionWhy = [
  'Same institutional destination zone.',
  'Recurring Tue/Wed/Thu travel-day overlap.',
  '94/100 modeled route-overlap factor.',
  'Modeled seat capacity is available.',
  '3.1-minute modeled incremental detour remains within the route limit.',
  'A reviewed Access Point satisfies the demonstration program rule.',
];

export const pasadenaCorridorInterventionSummary = [
  { corridor: 'Eagle Rock → Pasadena', gasolineSov: 42, transitStrong: 8, evRouteStrong: 13, bothCredible: 4, unsupported: 17, modeledNetVmtOpportunityMiles: 106.4 },
  { corridor: 'Glendale → Pasadena', gasolineSov: 51, transitStrong: 12, evRouteStrong: 16, bothCredible: 5, unsupported: 18, modeledNetVmtOpportunityMiles: 129.7 },
  { corridor: 'Highland Park → Pasadena', gasolineSov: 27, transitStrong: 9, evRouteStrong: 5, bothCredible: 3, unsupported: 10, modeledNetVmtOpportunityMiles: 39.2 },
  { corridor: 'Alhambra → Pasadena', gasolineSov: 23, transitStrong: 6, evRouteStrong: 4, bothCredible: 2, unsupported: 11, modeledNetVmtOpportunityMiles: 33.5 },
] as const;
