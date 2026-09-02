// ============================================================================
// Rule 2202 Partner Console — evidence workflow service
// Applicability review, timeline, AVR/VMT workbench, ECRP readiness,
// exceptions, audit history, review packet export
// ============================================================================

import type {
  Rule2202Worksite,
  CommuterResearchRecord,
  Rule2202Methodology,
  Rule2202CalculationResult,
  Rule2202ReviewState,
  Rule2202FilingStatus,
  ValidationError,
} from '../types';

// ---- Mock data (replace with Supabase client calls) ----

export interface PartnerConsoleState {
  worksites: Rule2202Worksite[];
  selectedWorksite: Rule2202Worksite | null;
  commuterRecords: CommuterResearchRecord[];
  methodologies: Rule2202Methodology[];
  calculationResults: Rule2202CalculationResult[];
  loading: boolean;
  error: string | null;
}

export function createInitialState(): PartnerConsoleState {
  return {
    worksites: [],
    selectedWorksite: null,
    commuterRecords: [],
    methodologies: [],
    calculationResults: [],
    loading: false,
    error: null,
  };
}

// ---- Applicability review ----

export interface ApplicabilityReview {
  worksite: Rule2202Worksite;
  isSubjectToRule2202: boolean | null;
  reason: string[];
  missingInformation: string[];
  recommendedNextStep: string;
}

export function assessApplicability(ws: Rule2202Worksite): ApplicabilityReview {
  const missing: string[] = [];
  const reasons: string[] = [];

  if (!ws.sixDigitWorksiteId) missing.push('Six-digit worksite ID');
  if (!ws.employerName || ws.employerName === '') missing.push('Employer name');
  if (!ws.performanceZone) missing.push('Performance zone');
  if (!ws.reportingMethod || ws.reportingMethod === 'not_determined') missing.push('Reporting method');
  if (!ws.businessClassification || ws.businessClassification === 'other') missing.push('Business classification');
  if (!ws.aqrSurveyDueDate) missing.push('AQR survey due date');
  if (!ws.aqrSubmittalDueDate) missing.push('AQR submittal due date');

  // Performance zone is the primary applicability signal
  if (ws.performanceZone && ws.performanceZone >= 1 && ws.performanceZone <= 3) {
    reasons.push(
      `Worksite is in Performance Zone ${ws.performanceZone}; AVR target is ${ws.performanceZone === 1 ? 1.75 : ws.performanceZone === 2 ? 1.5 : 1.3}`
    );
  }

  if (ws.businessClassification && ws.businessClassification !== 'other') {
    reasons.push(`Business classified as ${ws.businessClassification.replace(/_/g, ' ')}`);
  }

  if (ws.ecrpCandidateZone) {
    reasons.push(
      `ECRP candidate zone ${ws.ecrpCandidateZone} identified; ${ws.ecrpCandidateETC || 'ETC not yet assigned'}`
    );
  }

  const hasCriticalMissing = missing.some(
    (m) => !['Business classified as', 'Employer name'].includes(m) || ws.reviewState === 'data_incomplete'
  );

  return {
    worksite: ws,
    isSubjectToRule2202: ws.performanceZone ? true : null,
    reason: reasons,
    missingInformation: missing,
    recommendedNextStep: missing.length === 0
      ? 'Proceed to AVR/VMT workbench'
      : 'Complete missing worksite fields before AVR/VMT calculation',
  };
}

// ---- Timeline ----

export interface TimelineEntry {
  date: string;
  event: string;
  type: 'notification' | 'survey' | 'submittal' | 'filing' | 'review' | 'milestone';
  status: 'upcoming' | 'current' | 'completed' | 'overdue';
  notes: string | null;
}

export function buildTimeline(ws: Rule2202Worksite): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const now = new Date();

  const push = (
    date: string | null,
    event: string,
    type: TimelineEntry['type'],
    statusOverride?: TimelineEntry['status']
  ) => {
    if (!date) return;
    const d = new Date(date);
    const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
    let status: TimelineEntry['status'] = 'upcoming';
    if (statusOverride) {
      status = statusOverride;
    } else if (diff < 0) {
      status = 'overdue';
    } else if (diff === 0) {
      status = 'current';
    }
    // Check if the corresponding "actual" date is set (for survey/submittal)
    if (type === 'survey' && ws.aqrSurveyCompleteDate && new Date(ws.aqrSurveyCompleteDate) <= d) {
      status = 'completed';
    }
    if (type === 'submittal' && ws.aqrSubmittalActualDate && new Date(ws.aqrSubmittalActualDate) <= d) {
      status = 'completed';
    }
    entries.push({ date, event, type, status, notes: null });
  };

  push(ws.aqrNotificationDate, 'AQR notification received', 'notification');
  push(ws.aqrSurveyDueDate, 'AQR survey due', 'survey');
  push(ws.aqrSurveyCompleteDate, 'AQR survey completed', 'survey', 'completed');
  push(ws.aqrSubmittalDueDate, 'AQR submittal due', 'submittal');
  push(ws.aqrSubmittalActualDate, 'AQR submittal completed', 'submittal', 'completed');
  push(ws.permanentFilingDueDate, 'Permanent annual filing due', 'filing');

  if (ws.reviewStartedAt) {
    entries.push({
      date: ws.reviewStartedAt,
      event: 'Review started',
      type: 'review',
      status: ws.reviewState === 'approved_for_export' ? 'completed' : 'current',
      notes: ws.reviewDecision,
    });
  }

  // Sort by date
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return entries;
}

// ---- AVR/VMT workbench ----

export interface AvrVmtWorkbenchInput {
  worksite: Rule2202Worksite;
  commuterRecords: CommuterResearchRecord[];
  methodologyId: string | null;
}

export interface AvrVmtWorkbenchResult {
  avr: number | null;
  vehicleTrips: number;
  employees: number;
  responseRate: number | null;
  surveyValid: { isValid: boolean; reason: string | null };
  vmtEstimate: number | null;
  vmtLabel: string;
  warnings: string[];
  missingInputs: string[];
}

export function runAvrVmtWorkbench(input: AvrVmtWorkbenchInput): AvrVmtWorkbenchResult {
  const { worksite, commuterRecords, methodologyId } = input;
  const warnings: string[] = [];
  const missing: string[] = [];

  // Employee count: use the most recent monthly count or sum
  const monthlyCounts = [
    worksite.employeeCountMonth1,
    worksite.employeeCountMonth2,
    worksite.employeeCountMonth3,
    worksite.employeeCountMonth4,
    worksite.employeeCountMonth5,
    worksite.employeeCountMonth6,
  ].filter((n): n is number => n !== null);

  const employees = monthlyCounts.length > 0
    ? Math.round(monthlyCounts.reduce((a, b) => a + b, 0) / monthlyCounts.length)
    : 0;

  if (employees === 0) missing.push('Employee count (six monthly counts or average)');

  // Vehicle trips from commuter research records
  let vehicleTrips = 0;
  let responses = 0;

  for (const rec of commuterRecords) {
    if (rec.status !== 'submitted') continue;
    responses++;
    const mode = rec.commuteMode;
    const occ = rec.vehicleOccupancy;

    // Vehicle trip weight (matches calculate_avr logic)
    let weight = 1; // default = drive_alone
    if (mode === 'transit' || mode === 'bus_pool' || mode === 'bicycle' || mode === 'walk' || mode === 'telecommute' || mode === 'cww_day_off' || mode === 'zev' || mode === 'non_commuting') {
      weight = 0;
    } else if (mode === 'carpool') {
      weight = occ && occ >= 2 && occ <= 6 ? 1 / occ : 1;
    } else if (mode === 'vanpool') {
      weight = occ && occ >= 7 && occ <= 15 ? 1 / occ : 1;
    } else if (mode === 'shared_motorcycle') {
      weight = occ && occ >= 1 ? 1 / occ : 1;
    } else if (mode === 'not_specified' || mode === null || mode === undefined) {
      weight = 1; // non-response defaults to drive-alone
    }

    vehicleTrips += weight;
  }

  if (commuterRecords.length === 0) missing.push('Commuter survey records');
  if (responses === 0) missing.push('No submitted survey responses');

  // Response rate
  const responseRate = commuterRecords.length > 0 ? responses / commuterRecords.length : null;
  if (responseRate !== null && responseRate < 0.60) {
    warnings.push('Response rate below 60% minimum (AVR survey validity threshold)');
  }

  // AVR = employees / vehicleTrips
  const avr = vehicleTrips > 0 && employees > 0 ? Number((employees / vehicleTrips).toFixed(2)) : null;

  // Check against zone target
  if (avr !== null && worksite.performanceZone) {
    const target = worksite.performanceZone === 1 ? 1.75 : worksite.performanceZone === 2 ? 1.5 : 1.3;
    if (avr < target) {
      warnings.push(
        `AVR ${avr} is below Performance Zone ${worksite.performanceZone} target of ${target}`
      );
    } else {
      warnings.push(`AVR ${avr} meets Performance Zone ${worksite.performanceZone} target of ${target}`);
    }
  }

  // VMT estimate: one-way distance * 2 (round trip) * vehicle trips * work days/year (approx 250)
  let vmtEstimate = null;
  let vmtLabel = 'Not available';
  const avgDistance = commuterRecords
    .filter((r) => r.oneWayDistanceMiles !== null && r.oneWayDistanceMiles !== undefined)
    .reduce((acc, r) => acc + (r.oneWayDistanceMiles ?? 0), 0);

  if (avgDistance > 0 && vehicleTrips > 0) {
    const avgOneWay = avgDistance / commuterRecords.length;
    const roundTripMiles = avgOneWay * 2;
    vmtEstimate = Number((roundTripMiles * vehicleTrips * 250).toFixed(0));
    vmtLabel = `${vmtEstimate.toLocaleString()} estimated annual VMT (modeled)`;
    warnings.push(
      'VMT is a modeled estimate based on self-reported distances and vehicle-trip weighting; not a certified figure'
    );
  } else {
    missing.push('Distance data for VMT estimation');
  }

  // Survey validity (mirrors validate_avr_survey)
  const surveyValid = {
    isValid: responseRate !== null && responseRate >= 0.60 && !missing.includes('Commuter survey records'),
    reason: responseRate !== null && responseRate < 0.60
      ? 'Response rate below 60% minimum'
      : null,
  };

  return {
    avr,
    vehicleTrips: Number(vehicleTrips.toFixed(2)),
    employees,
    responseRate: responseRate !== null ? Number((responseRate * 100).toFixed(1)) : null,
    surveyValid,
    vmtEstimate,
    vmtLabel,
    warnings,
    missingInputs: missing,
  };
}

// ---- ECRP readiness ----

export interface EcrpReadiness {
  worksite: Rule2202Worksite;
  isEcrpCandidate: boolean;
  ecrpZone: number | null;
  etcAssigned: boolean;
  etcName: string | null;
  missingForEcrp: string[];
  readinessLevel: 'not_candidate' | 'candidate_unready' | 'candidate_ready' | 'needs_review';
}

export function assessEcrpReadiness(ws: Rule2202Worksite): EcrpReadiness {
  const missing: string[] = [];

  if (!ws.ecrpCandidateZone) {
    return {
      worksite: ws,
      isEcrpCandidate: false,
      ecrpZone: null,
      etcAssigned: false,
      etcName: null,
      missingForEcrp: ['ECRP candidate zone not assigned'],
      readinessLevel: 'not_candidate',
    };
  }

  if (ws.ecrpCandidateZone < 1 || ws.ecrpCandidateZone > 3) {
    missing.push('ECRP candidate zone out of valid range (1-3)');
  }

  if (!ws.ecrpCandidateETC) {
    missing.push('ETC not assigned');
  }

  if (!ws.ecrpCandidateETCVerifiedAt) {
    missing.push('ETC verification not timestamped');
  }

  const etcAssigned = !!ws.ecrpCandidateETC && !!ws.ecrpCandidateETCVerifiedAt;

  return {
    worksite: ws,
    isEcrpCandidate: true,
    ecrpZone: ws.ecrpCandidateZone,
    etcAssigned,
    etcName: ws.ecrpCandidateETC,
    missingForEcrp: missing,
    readinessLevel: etcAssigned && missing.length === 0 ? 'candidate_ready' : 'candidate_unready',
  };
}

// ---- Exceptions ----

export interface ExceptionEntry {
  type: 'data_quality' | 'methodology' | 'filing' | 'fee' | 'review';
  severity: 'error' | 'warning' | 'info';
  description: string;
  worksiteField: string | null;
  suggestedAction: string;
  timestamp: string | null;
}

export function collectExceptions(ws: Rule2202Worksite): ExceptionEntry[] {
  const exceptions: ExceptionEntry[] = [];

  if (ws.reviewState === 'data_incomplete') {
    exceptions.push({
      type: 'data_quality',
      severity: 'error',
      description: 'Worksite marked as data incomplete',
      worksiteField: 'review_state',
      suggestedAction: 'Complete missing worksite fields',
      timestamp: ws.updatedAt,
    });
  }

  if (ws.reviewState === 'validation_failed') {
    exceptions.push({
      type: 'data_quality',
      severity: 'error',
      description: 'Worksite validation failed',
      worksiteField: 'review_state',
      suggestedAction: 'Resolve validation errors before review',
      timestamp: ws.updatedAt,
    });
  }

  if (ws.filingStatus === 'incomplete') {
    exceptions.push({
      type: 'filing',
      severity: 'warning',
      description: 'Filing marked as incomplete',
      worksiteField: 'filing_status',
      suggestedAction: 'Resolve completeness checklist items',
      timestamp: ws.updatedAt,
    });
  }

  if (!ws.feeVerified && ws.filingStatus !== 'draft') {
    exceptions.push({
      type: 'fee',
      severity: 'warning',
      description: 'Filing fee not verified',
      worksiteField: 'fee_verified',
      suggestedAction: 'Verify fee against applicable AQMD schedule',
      timestamp: null,
    });
  }

  if (ws.validationErrors && ws.validationErrors.length > 0) {
    for (const ve of ws.validationErrors) {
      exceptions.push({
        type: 'data_quality',
        severity: ve.severity,
        description: `${ve.field}: ${ve.message}`,
        worksiteField: ve.field,
        suggestedAction: ve.severity === 'error' ? 'Fix before proceeding' : 'Review and document',
        timestamp: ws.updatedAt,
      });
    }
  }

  if (ws.ecrpCandidateZone && !ws.ecrpCandidateETC) {
    exceptions.push({
      type: 'review',
      severity: 'warning',
      description: 'ECRP candidate zone assigned but ETC not designated',
      worksiteField: 'ecrp_candidate_etal',
      suggestedAction: 'Assign and verify ETC',
      timestamp: null,
    });
  }

  return exceptions;
}

// ---- Audit history ----

export interface AuditEntry {
  timestamp: string;
  actor: string | null;
  action: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  notes: string | null;
}

export function buildAuditHistory(ws: Rule2202Worksite): AuditEntry[] {
  const history: AuditEntry[] = [];

  // Created
  history.push({
    timestamp: ws.createdAt,
    actor: ws.createdBy,
    action: 'created',
    field: null,
    previousValue: null,
    newValue: 'Worksite record created',
    notes: null,
  });

  // Review state changes
  if (ws.reviewState !== 'draft') {
    history.push({
      timestamp: ws.updatedAt,
      actor: ws.updatedBy,
      action: 'review_state_changed',
      field: 'review_state',
      previousValue: 'draft',
      newValue: ws.reviewState,
      notes: ws.reviewDecision,
    });
  }

  // Filing status changes
  if (ws.filingStatus !== 'draft') {
    history.push({
      timestamp: ws.updatedAt,
      actor: ws.updatedBy,
      action: 'filing_status_changed',
      field: 'filing_status',
      previousValue: 'draft',
      newValue: ws.filingStatus,
      notes: ws.completenessNotes,
    });
  }

  // Fee verification
  if (ws.feeVerified) {
    history.push({
      timestamp: ws.feeVerifiedAt || ws.updatedAt,
      actor: ws.feeVerifiedBy,
      action: 'fee_verified',
      field: 'fee_verified',
      previousValue: 'false',
      newValue: 'true',
      notes: `Expected: $${ws.feeExpected?.toFixed(2) ?? 'unknown'}; Submitted: $${ws.feeSubmitted?.toFixed(2) ?? 'unknown'}; Source: ${ws.feeVerificationSource}`,
    });
  }

  // ECRP candidate
  if (ws.ecrpCandidateZone) {
    history.push({
      timestamp: ws.updatedAt,
      actor: ws.updatedBy,
      action: 'ecrp_candidate_set',
      field: 'ecrp_candidate_zone',
      previousValue: null,
      newValue: String(ws.ecrpCandidateZone),
      notes: ws.ecrpCandidateNotes,
    });
  }

  return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ---- Review packet export ----

export interface ReviewPacket {
  worksite: Rule2202Worksite;
  applicability: ApplicabilityReview;
  timeline: TimelineEntry[];
  workbench: AvrVmtWorkbenchResult;
  ecrpReadiness: EcrpReadiness;
  exceptions: ExceptionEntry[];
  auditHistory: AuditEntry[];
  exportTimestamp: string;
  exportNote: string;
}

export function buildReviewPacket(ws: Rule2202Worksite, records: CommuterResearchRecord[]): ReviewPacket {
  const applicability = assessApplicability(ws);
  const timeline = buildTimeline(ws);
  const workbench = runAvrVmtWorkbench({ worksite: ws, commuterRecords: records, methodologyId: null });
  const ecrpReadiness = assessEcrpReadiness(ws);
  const exceptions = collectExceptions(ws);
  const auditHistory = buildAuditHistory(ws);

  return {
    worksite: ws,
    applicability,
    timeline,
    workbench,
    ecrpReadiness,
    exceptions,
    auditHistory,
    exportTimestamp: new Date().toISOString(),
    exportNote:
      'Relay Rider organizes employer commute data and generates export-ready files based on published South Coast AQMD templates. Employers and their designated ETC remain responsible for reviewing survey methodology, worksite information, commute classifications, calculations, and final regulatory submissions. South Coast AQMD acceptance is not guaranteed.',
  };
}
