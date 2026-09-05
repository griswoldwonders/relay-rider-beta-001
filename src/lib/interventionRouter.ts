export type CleanCommuteEvidenceState = 'observed' | 'calculated' | 'modeled' | 'unsupported';
export type InterventionClassification =
  | 'transit_stronger'
  | 'planned_ev_route_stronger'
  | 'both_credible'
  | 'active_transportation_stronger'
  | 'no_supported_alternative';
export type InterventionEligibilityStatus = 'eligible' | 'ineligible' | 'unsupported';
export type InterventionStrength = 'strong' | 'moderate' | 'weak' | 'unsupported';

export interface CleanCommuteCommuter {
  id: string;
  institutionId: string;
  originZone: string;
  destinationZone: string;
  travelDays: string[];
  arrivalWindow: [number, number];
  currentMode: 'drive_alone' | 'carpool' | 'transit' | 'walk' | 'bike' | 'remote' | 'other';
  vehiclePowertrain: 'gasoline_diesel' | 'hybrid' | 'PHEV' | 'BEV' | 'unknown';
  consentForOptionAnalysis: boolean;
}

export interface PlannedEvRouteOption {
  id: string;
  institutionId: string;
  originZone: string;
  destinationZone: string;
  travelDays: string[];
  arrivalWindow: [number, number];
  powertrain: 'BEV' | 'PHEV' | 'hybrid' | 'gasoline_diesel' | 'unknown';
  availableCapacity: number;
  incrementalDetourMinutes: number;
  maxDetourMinutes: number;
  routeOverlapScore: number;
  scheduleFitScore: number;
  detourFitScore: number;
  originDestinationFitScore: number;
  accessPointFitScore: number;
  accessPointStatus: 'reviewed' | 'unresolved' | 'not_required';
  accessibilityCompatible: boolean;
  evidenceState: CleanCommuteEvidenceState;
  source: string;
}

export interface TransitInterventionOption {
  id: string;
  serviceAvailable: boolean;
  originDestinationFitScore: number;
  scheduleFitScore: number;
  travelTimeMinutes: number;
  maxAcceptableTravelTimeMinutes: number;
  accessibilityCompatible: boolean;
  evidenceState: CleanCommuteEvidenceState;
  source: string;
}

export interface ActiveTransportationOption {
  id: string;
  distanceMiles: number | null;
  maxEligibleMiles: number;
  accessibilityCompatible: boolean;
  evidenceState: CleanCommuteEvidenceState;
  source: string;
}

export interface CleanCommuteOptions {
  plannedEvRoutes: PlannedEvRouteOption[];
  transit?: TransitInterventionOption;
  activeTransportation?: ActiveTransportationOption;
}

export interface CleanCommuteProgramRules {
  strongThreshold?: number;
  requireReviewedAccessPoint?: boolean;
}

export interface InterventionResult {
  type: 'planned_ev_route' | 'transit' | 'active_transportation';
  eligibilityStatus: InterventionEligibilityStatus;
  score: number | null;
  strength: InterventionStrength;
  evidenceState: CleanCommuteEvidenceState;
  reasons: string[];
  limitingFactors: string[];
  estimatedTravelTimeMinutes?: number;
  estimatedIncrementalMinutes?: number;
  source?: string;
  methodologyVersion: string;
  optionId?: string;
}

export interface CleanCommuteAssessment {
  commuterId: string;
  classification: InterventionClassification;
  explanation: string;
  plannedEvRoute: InterventionResult;
  transit: InterventionResult;
  activeTransportation: InterventionResult;
  methodologyVersion: string;
}

const INTERVENTION_METHOD_VERSION = 'Clean commute intervention router v0.1';
const EV_METHOD_VERSION = 'Modeled compatibility v0.1';

const normalize = (value: string) => value.trim().toLowerCase();
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const windowsOverlap = (a: [number, number], b: [number, number]) => Math.max(a[0], b[0]) <= Math.min(a[1], b[1]);
const daysOverlap = (a: string[], b: string[]) => {
  const right = new Set(b.map(normalize));
  return a.some(day => right.has(normalize(day)));
};
const strengthFor = (score: number | null, threshold: number): InterventionStrength => {
  if (score === null) return 'unsupported';
  if (score >= threshold) return 'strong';
  if (score >= 60) return 'moderate';
  return 'weak';
};

function commonConsentFailure(commuter: CleanCommuteCommuter): string | null {
  return commuter.consentForOptionAnalysis ? null : 'Participant consent does not permit commuter-option analysis.';
}

function assessPlannedEvRoute(
  commuter: CleanCommuteCommuter,
  route: PlannedEvRouteOption,
  rules: Required<CleanCommuteProgramRules>,
): InterventionResult {
  const limitingFactors: string[] = [];

  if (commuter.currentMode !== 'drive_alone' || commuter.vehiclePowertrain !== 'gasoline_diesel') {
    limitingFactors.push('Commuter is not currently eligible for the gasoline SOV conversion target.');
  }
  if (route.powertrain !== 'BEV' && route.powertrain !== 'PHEV') {
    limitingFactors.push('Planned-route supply must be BEV or PHEV for this zero-emission substitution analysis.');
  }
  if (normalize(route.institutionId) !== normalize(commuter.institutionId)) {
    limitingFactors.push('Planned route is outside the commuter institution.');
  }
  if (normalize(route.destinationZone) !== normalize(commuter.destinationZone)) {
    limitingFactors.push('Planned route does not serve the same destination zone.');
  }
  if (!daysOverlap(route.travelDays, commuter.travelDays)) {
    limitingFactors.push('Travel days do not overlap.');
  }
  if (!windowsOverlap(route.arrivalWindow, commuter.arrivalWindow)) {
    limitingFactors.push('Schedule windows do not overlap.');
  }
  if (route.availableCapacity <= 0) {
    limitingFactors.push('No modeled seat capacity is available.');
  }
  if (route.incrementalDetourMinutes > route.maxDetourMinutes) {
    limitingFactors.push('Modeled detour exceeds the planned-route participant limit.');
  }
  if (!route.accessibilityCompatible) {
    limitingFactors.push('Accessibility requirements are not compatible with this planned route.');
  }
  const consentFailure = commonConsentFailure(commuter);
  if (consentFailure) limitingFactors.push(consentFailure);
  if (rules.requireReviewedAccessPoint && route.accessPointStatus !== 'reviewed') {
    limitingFactors.push('No reviewed Access Point currently satisfies program requirements.');
  }

  if (limitingFactors.length > 0) {
    return {
      type: 'planned_ev_route',
      eligibilityStatus: 'ineligible',
      score: null,
      strength: 'unsupported',
      evidenceState: route.evidenceState === 'unsupported' ? 'unsupported' : 'modeled',
      reasons: [],
      limitingFactors,
      estimatedIncrementalMinutes: route.incrementalDetourMinutes,
      source: route.source,
      methodologyVersion: EV_METHOD_VERSION,
      optionId: route.id,
    };
  }

  const score = Math.round(clamp(
    route.routeOverlapScore * 0.30
      + route.scheduleFitScore * 0.25
      + route.detourFitScore * 0.20
      + route.originDestinationFitScore * 0.15
      + route.accessPointFitScore * 0.10,
  ));

  return {
    type: 'planned_ev_route',
    eligibilityStatus: 'eligible',
    score,
    strength: strengthFor(score, rules.strongThreshold),
    evidenceState: route.evidenceState,
    reasons: [
      'Eligible planned BEV/PHEV route serves the same institution and destination.',
      'Recurring travel days and arrival windows overlap.',
      `Modeled incremental detour is ${route.incrementalDetourMinutes.toFixed(1)} minutes and remains within the route participant limit.`,
      'Modeled capacity and reviewed Access Point requirements are satisfied.',
    ],
    limitingFactors: [],
    estimatedIncrementalMinutes: route.incrementalDetourMinutes,
    source: route.source,
    methodologyVersion: EV_METHOD_VERSION,
    optionId: route.id,
  };
}

function noPlannedEvRoute(): InterventionResult {
  return {
    type: 'planned_ev_route',
    eligibilityStatus: 'unsupported',
    score: null,
    strength: 'unsupported',
    evidenceState: 'unsupported',
    reasons: [],
    limitingFactors: ['No planned BEV/PHEV route fixture is available for this commuter.'],
    methodologyVersion: EV_METHOD_VERSION,
  };
}

function assessTransit(
  commuter: CleanCommuteCommuter,
  option: TransitInterventionOption | undefined,
  rules: Required<CleanCommuteProgramRules>,
): InterventionResult {
  if (!option) {
    return {
      type: 'transit', eligibilityStatus: 'unsupported', score: null, strength: 'unsupported', evidenceState: 'unsupported', reasons: [],
      limitingFactors: ['No supported transit fixture is available.'], methodologyVersion: INTERVENTION_METHOD_VERSION,
    };
  }

  const limitingFactors: string[] = [];
  const consentFailure = commonConsentFailure(commuter);
  if (consentFailure) limitingFactors.push(consentFailure);
  if (option.evidenceState === 'unsupported') limitingFactors.push('Transit evidence is insufficient for a supported assessment.');
  if (!option.serviceAvailable) limitingFactors.push('Transit service is not available in the supplied fixture.');
  if (!option.accessibilityCompatible) limitingFactors.push('Transit accessibility requirements are not satisfied by the supplied fixture.');
  if (option.travelTimeMinutes > option.maxAcceptableTravelTimeMinutes) {
    limitingFactors.push('Transit travel time exceeds the configured reasonableness threshold.');
  }

  if (limitingFactors.length > 0) {
    return {
      type: 'transit', eligibilityStatus: 'ineligible', score: null, strength: 'unsupported', evidenceState: option.evidenceState,
      reasons: [], limitingFactors, estimatedTravelTimeMinutes: option.travelTimeMinutes, source: option.source,
      methodologyVersion: INTERVENTION_METHOD_VERSION, optionId: option.id,
    };
  }

  const score = Math.round(clamp(option.originDestinationFitScore * 0.5 + option.scheduleFitScore * 0.5));
  return {
    type: 'transit', eligibilityStatus: 'eligible', score, strength: strengthFor(score, rules.strongThreshold), evidenceState: option.evidenceState,
    reasons: [
      'Transit fixture serves the modeled origin/destination pair.',
      'Schedule compatibility and travel-time reasonableness meet the configured demonstration thresholds.',
    ],
    limitingFactors: [], estimatedTravelTimeMinutes: option.travelTimeMinutes, source: option.source,
    methodologyVersion: INTERVENTION_METHOD_VERSION, optionId: option.id,
  };
}

function assessActiveTransportation(
  commuter: CleanCommuteCommuter,
  option: ActiveTransportationOption | undefined,
  rules: Required<CleanCommuteProgramRules>,
): InterventionResult {
  if (!option) {
    return {
      type: 'active_transportation', eligibilityStatus: 'unsupported', score: null, strength: 'unsupported', evidenceState: 'unsupported', reasons: [],
      limitingFactors: ['No supported active-transportation fixture is available.'], methodologyVersion: INTERVENTION_METHOD_VERSION,
    };
  }

  const limitingFactors: string[] = [];
  const consentFailure = commonConsentFailure(commuter);
  if (consentFailure) limitingFactors.push(consentFailure);
  if (option.evidenceState === 'unsupported' || option.distanceMiles === null) {
    limitingFactors.push('Distance/access evidence is insufficient for an active-transportation recommendation.');
  }
  if (!option.accessibilityCompatible) limitingFactors.push('Accessibility requirements are not compatible with this active-transportation fixture.');
  if (option.distanceMiles !== null && option.distanceMiles > option.maxEligibleMiles) {
    limitingFactors.push('Modeled distance exceeds the conservative active-transportation threshold.');
  }

  if (limitingFactors.length > 0) {
    return {
      type: 'active_transportation', eligibilityStatus: option.evidenceState === 'unsupported' ? 'unsupported' : 'ineligible', score: null,
      strength: 'unsupported', evidenceState: option.evidenceState, reasons: [], limitingFactors, source: option.source,
      methodologyVersion: INTERVENTION_METHOD_VERSION, optionId: option.id,
    };
  }

  const score = Math.round(clamp(100 - ((option.distanceMiles ?? option.maxEligibleMiles) / option.maxEligibleMiles) * 20));
  return {
    type: 'active_transportation', eligibilityStatus: 'eligible', score, strength: strengthFor(score, rules.strongThreshold), evidenceState: option.evidenceState,
    reasons: ['Supported fixture distance falls within the conservative active-transportation threshold.'], limitingFactors: [],
    source: option.source, methodologyVersion: INTERVENTION_METHOD_VERSION, optionId: option.id,
  };
}

export function assessCleanCommuteInterventions(
  commuter: CleanCommuteCommuter,
  availableOptions: CleanCommuteOptions,
  programRules: CleanCommuteProgramRules = {},
): CleanCommuteAssessment {
  const rules: Required<CleanCommuteProgramRules> = {
    strongThreshold: programRules.strongThreshold ?? 80,
    requireReviewedAccessPoint: programRules.requireReviewedAccessPoint ?? true,
  };

  const assessedRoutes = availableOptions.plannedEvRoutes.map(route => assessPlannedEvRoute(commuter, route, rules));
  const plannedEvRoute = assessedRoutes
    .filter(result => result.eligibilityStatus === 'eligible')
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0]
    ?? assessedRoutes[0]
    ?? noPlannedEvRoute();
  const transit = assessTransit(commuter, availableOptions.transit, rules);
  const activeTransportation = assessActiveTransportation(commuter, availableOptions.activeTransportation, rules);

  const evStrong = plannedEvRoute.eligibilityStatus === 'eligible' && plannedEvRoute.strength === 'strong';
  const transitStrong = transit.eligibilityStatus === 'eligible' && transit.strength === 'strong';
  const activeStrong = activeTransportation.eligibilityStatus === 'eligible' && activeTransportation.strength === 'strong';

  let classification: InterventionClassification = 'no_supported_alternative';
  if (evStrong && transitStrong) classification = 'both_credible';
  else if (evStrong) classification = 'planned_ev_route_stronger';
  else if (transitStrong) classification = 'transit_stronger';
  else if (activeStrong) classification = 'active_transportation_stronger';

  const explanation = classification === 'both_credible'
    ? 'Transit and a planned BEV/PHEV route both meet the configured strong threshold; administrative review should compare program fit before selecting an intervention.'
    : classification === 'planned_ev_route_stronger'
      ? `Planned EV route stronger because ${plannedEvRoute.reasons.join(' ').toLowerCase()}`
      : classification === 'transit_stronger'
        ? 'Transit is the strongest currently supported clean commute intervention in the supplied evidence; the planned EV option is weaker, ineligible, or unsupported.'
        : classification === 'active_transportation_stronger'
          ? 'Active transportation is the strongest currently supported intervention in the supplied evidence and conservative distance/access thresholds.'
          : 'No currently supported clean commute alternative passes the configured evidence and eligibility thresholds.';

  return {
    commuterId: commuter.id,
    classification,
    explanation,
    plannedEvRoute,
    transit,
    activeTransportation,
    methodologyVersion: INTERVENTION_METHOD_VERSION,
  };
}
