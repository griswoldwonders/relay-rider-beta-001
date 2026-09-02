// ============================================================================
// Relay Rider — shared types
// ============================================================================

export type UserRole = 'route-need' | 'ev-participant' | null;

export interface RouteSignal {
  id: string;
  corridor: string;
  startingArea: string;
  destinationArea: string;
  campusAffiliation: string;
  daysOfWeek: string[];
  timeWindow: string;
  routeType: 'recurring' | 'occasional' | 'event' | 'medical' | 'campus' | 'other';
  relayZoneType: string[];
  transitOptions: string[];
  studentTransitPass: 'yes' | 'no' | 'not-sure';
  incentiveInterests: string[];
  evPreference: 'ev-only' | 'hybrid-ev' | 'any';
  maxWalkingDistance: string;
  privacyPreference: string;
  status: 'draft' | 'submitted' | 'in-research' | 'needs-signals' | 'needs-participant' | 'partner-review' | 'legal-review' | 'not-active';
  routeFit: 'high' | 'moderate' | 'low';
  greenRouteCredit: number;
  createdAt: string;
  modeled?: {
    overlapPotential: 'high' | 'medium' | 'low';
    timeCompatibility: 'strong' | 'moderate' | 'needs-data';
    relayZoneFit: 'strong' | 'moderate' | 'needs-review';
    evHybridSupply: 'available' | 'needs-more';
    parkingPressure: 'low' | 'medium' | 'high';
    pilotReadiness: 'research-only' | 'partner-review' | 'not-ready';
  };
}

export interface EVParticipantSignal {
  id: string;
  vehicleType: 'ev' | 'phev' | 'hybrid' | 'other';
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  startingArea: string;
  destinationArea: string;
  travelDays: string[];
  timeWindow: string;
  maxDetour: string;
  relayZoneTypes: string[];
  feedbackCallWilling: boolean;
  reviewsAccepted: string[];
  status: 'submitted' | 'in-review' | 'approved' | 'rejected';
  createdAt: string;
}

export interface RelayZone {
  id: string;
  name: string;
  type: string;
  corridor: string;
  address: string;
  reviewStatus: 'candidate' | 'needs-partner' | 'needs-safety' | 'needs-property' | 'needs-legal' | 'not-approved';
  suggestedByCount: number;
  partnerReviewNeeded: boolean;
  safetyReviewNeeded: boolean;
  propertyReviewNeeded: boolean;
  notes: string;
}

export interface CorridorData {
  id: string;
  name: string;
  routeSignals: number;
  evParticipants: number;
  relayZones: number;
  parkingPressure: 'low' | 'medium-high' | 'high';
  pilotReadiness: 'research' | 'partner-review' | 'needs-legal' | 'future';
}

export interface GreenRouteCredit {
  id: string;
  activity: string;
  amount: number;
  status: 'pending' | 'approved' | 'redeemed' | 'expired';
  date: string;
}

export type RedemptionRequestStatus = 'requested' | 'under-review' | 'fulfilled' | 'denied';

export interface ChargingHub {
  id: string;
  name: string;
  network: string;
  city: string;
  stalls: number;
  connectorTypes: string[];
  status: 'candidate' | 'verified' | 'active';
  evidenceLabel: 'synthetic' | 'modeled' | 'verified';
}

export interface RedemptionRequest {
  id: string;
  creditId: string;
  participantId: string;
  chargingHubId: string;
  requestedUnits: number;
  unitLabel: string;
  status: RedemptionRequestStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  adultConfirmed: boolean;
  researchConsentGiven: boolean;
  preferredCorridor: string;
  preferredRelayZoneType: string;
  evHybridPreference: string;
  privacyPreference: string;
  notificationPreference: boolean;
}

// ============================================================================
// Rule 2202 Domain Model — TypeScript types
// Build order step 2: worksites, commuter research, methodology registry
// ============================================================================

// ---- Worksite enums ----

export type Rule2202BusinessClassification =
  | 'other'
  | 'commercial'
  | 'commercial_with_mfg'
  | 'mfg_unclassified'
  | 'mfg_1_250_employees'
  | 'mfg_251_500_employees'
  | 'mfg_501_1000_employees'
  | 'mfg_1001_3000_employees'
  | 'mfg_over_3000_employees'
  | 'education'
  | 'healthcare'
  | 'public_sector'
  | 'nonprofit';

export type Rule2202ReviewState =
  | 'draft'
  | 'data_incomplete'
  | 'validation_failed'
  | 'ready_for_review'
  | 'approved_for_export'
  | 'exported'
  | 'filed_externally'
  | 'superseded';

export type Rule2202FilingStatus =
  | 'draft'
  | 'incomplete'
  | 'ready_for_review'
  | 'submitted'
  | 'returned'
  | 'complete';

export type Rule2202MeasurementMethod =
  | 'survey_avr'
  | 'zip_code'
  | 'default_factors'
  | 'not_determined';

// ---- Commuter research enums ----

export type CommuterResearchMode =
  | 'drive_alone'
  | 'carpool'
  | 'vanpool'
  | 'shared_motorcycle'
  | 'transit'
  | 'bus_pool'
  | 'bicycle'
  | 'walk'
  | 'telecommute'
  | 'cww_day_off'
  | 'zev'
  | 'non_commuting'
  | 'not_specified';

export type CommuterResearchVehicleClass =
  | 'bev'
  | 'phev'
  | 'hybrid'
  | 'gasoline_diesel'
  | 'no_vehicle'
  | 'prefer_not_to_say';

export type DistanceSource =
  | 'self_reported'
  | 'zip_to_zip'
  | 'route_estimated'
  | 'gps_derived'
  | 'not_specified';

// ---- Rule 2202 Worksite ----

export interface Rule2202Worksite {
  id: string;
  institutionId: string;
  worksiteName: string;
  sixDigitWorksiteId: string | null;
  employerName: string;
  facilityDescription: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string;
  zipCode: string | null;
  // Performance zone (1, 2, or 3)
  performanceZone: number | null;
  performanceZoneSource: string | null;
  performanceZoneVerifiedAt: string | null;
  reportingMethod: Rule2202MeasurementMethod;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  // Six monthly employee counts
  employeeCountMonth1: number | null;
  employeeCountMonth2: number | null;
  employeeCountMonth3: number | null;
  employeeCountMonth4: number | null;
  employeeCountMonth5: number | null;
  employeeCountMonth6: number | null;
  employeeCountNotes: string | null;
  // Notification and due dates
  aqrNotificationDate: string | null;
  aqrSurveyDueDate: string | null;
  aqrSurveyCompleteDate: string | null;
  aqrSubmittalDueDate: string | null;
  aqrSubmittalActualDate: string | null;
  permanentFilingDueDate: string | null;
  // Filing fee
  filingFeeVersion: string | null;
  // Classification
  businessClassification: Rule2202BusinessClassification;
  // ECRP candidate
  ecrpCandidateZone: number | null;
  ecrpCandidateETC: string | null;
  ecrpCandidateETCVerifiedAt: string | null;
  ecrpCandidateNotes: string | null;
  // Source documents
  sourceDocumentType: string | null;
  sourceDocumentReference: string | null;
  sourceDocumentDate: string | null;
  sourceUrl: string | null;
  sourceNotes: string | null;
  // Review state
  reviewState: Rule2202ReviewState;
  dataCompletenessNotes: string | null;
  validationErrors: ValidationError[];
  reviewStartedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewDecision: string | null;
  reviewDecisionAt: string | null;
  // Filing completeness
  filingStatus: Rule2202FilingStatus;
  feeVerified: boolean;
  feeExpected: number | null;
  feeSubmitted: number | null;
  feeVerificationSource: string | null;
  feeVerifiedBy: string | null;
  feeVerifiedAt: string | null;
  requiredForms: string[];
  completenessNotes: string | null;
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// ---- Commuter Research Record ----

export interface CommuterResearchRecord {
  id: string;
  institutionId: string;
  worksiteId: string;
  pseudonymousEmployeeId: string;
  // Approximate geography (zone-based)
  approximateOriginZone: string | null;
  approximateDestinationZone: string | null;
  // Arrival/departure windows
  arrivalWindowStart: string | null;
  arrivalWindowEnd: string | null;
  departureWindowStart: string | null;
  departureWindowEnd: string | null;
  // Commute mode
  commuteMode: CommuterResearchMode;
  commuteModeSource: string | null;
  // Occupancy
  vehicleOccupancy: number | null;
  // Telecommute frequency
  telecommuteDaysPerWeek: number | null;
  // One-way distance
  oneWayDistanceMiles: number | null;
  distanceSource: DistanceSource;
  // EV / hybrid
  vehicleClass: CommuterResearchVehicleClass;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  evHybridParticipation: boolean;
  // Route interest signals
  interestedInEvRoute: boolean;
  interestedInCarpoolRoute: boolean;
  interestedInTransitOption: boolean;
  routeInterestNotes: string | null;
  // Survey metadata
  surveyPeriodStart: string | null;
  surveyPeriodEnd: string | null;
  responseReceivedAt: string | null;
  sourceTemplateVersion: string | null;
  sourceImportBatchId: string | null;
  // Status
  status: string;
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
}

// ---- Methodology Registry ----

export type MethodologyMetricType =
  | 'avr'
  | 'vmt'
  | 'ert_voc'
  | 'ert_nox'
  | 'ert_co'
  | 'vtec_peak'
  | 'vtec_other'
  | 'vtec_offpeak_avr'
  | 'reduced_staffing_avr'
  | 'inter_pollutant_credit';

export interface Rule2202Methodology {
  id: string;
  institutionId: string;
  methodologyName: string;
  methodologyType: string;
  metricType: MethodologyMetricType;
  applicablePollutants: string[];
  factorYear: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourcePublicationDate: string | null;
  formulaText: string | null;
  resultUnits: string;
  assumptions: string[];
  isActive: boolean;
  version: string;
  supersedesMethodologyId: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  deletedAt: string | null;
}

// ---- Calculation Result (audit trail) ----

export interface Rule2202CalculationResult {
  id: string;
  institutionId: string;
  methodologyId: string;
  worksiteId: string;
  calculationType: string;
  inputParameters: Record<string, unknown>;
  resultValue: number | null;
  resultUnit: string | null;
  calculationTimestamp: string;
  calculatedBy: string | null;
  warnings: string[];
  notes: string | null;
  createdAt: string;
  deletedAt: string | null;
}

// ---- AVR Zone Targets (from existing calculation functions) ----

export const AVR_ZONE_TARGETS: Record<number, number> = {
  1: 1.75,
  2: 1.5,
  3: 1.3,
};

// ---- Filing-fee status values (from Rule 2202 VMT Export System v2) ----

export const FILING_STATUS_VALUES: Rule2202FilingStatus[] = [
  'draft',
  'incomplete',
  'ready_for_review',
  'submitted',
  'returned',
  'complete',
];

export const REVIEW_STATE_VALUES: Rule2202ReviewState[] = [
  'draft',
  'data_incomplete',
  'validation_failed',
  'ready_for_review',
  'approved_for_export',
  'exported',
  'filed_externally',
  'superseded',
];

// ---- worksite helper: total employees across six months ----

export function totalEmployeeCount(ws: Rule2202Worksite): number {
  return [
    ws.employeeCountMonth1,
    ws.employeeCountMonth2,
    ws.employeeCountMonth3,
    ws.employeeCountMonth4,
    ws.employeeCountMonth5,
    ws.employeeCountMonth6,
  ].filter((n): n is number => n !== null).reduce((a, b) => a + b, 0);
}

// ---- worksite helper: AVR zone target lookup ----

export function getAvrZoneTarget(zone: number | null): number | null {
  if (zone === null || zone < 1 || zone > 3) return null;
  return AVR_ZONE_TARGETS[zone];
}

// ---- worksite helper: next filing milestone ----

export interface FilingMilestone {
  label: string;
  dueDate: string | null;
  daysRemaining: number | null;
  isOverdue: boolean;
}

export function nextFilingMilestones(ws: Rule2202Worksite): FilingMilestone[] {
  const now = new Date();
  const milestones: FilingMilestone[] = [];

  const push = (label: string, due: string | null) => {
    if (!due) {
      milestones.push({ label, dueDate: null, daysRemaining: null, isOverdue: false });
      return;
    }
    const dueDate = new Date(due);
    const diff = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    milestones.push({
      label,
      dueDate: due,
      daysRemaining: diff,
      isOverdue: diff < 0,
    });
  };

  push('AQR notification date', ws.aqrNotificationDate);
  push('AQR survey due date', ws.aqrSurveyDueDate);
  push('AQR survey complete date', ws.aqrSurveyCompleteDate);
  push('AQR submittal due date', ws.aqrSubmittalDueDate);
  push('Permanent filing due date', ws.permanentFilingDueDate);

  return milestones;
}
