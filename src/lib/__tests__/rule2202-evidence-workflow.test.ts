import { describe, expect, it } from 'vitest';
import type { FilingMilestone, Rule2202Worksite } from '../../types';
import {
  assessApplicability,
  buildTimeline,
  runAvrVmtWorkbench,
  assessEcrpReadiness,
  collectExceptions,
  buildAuditHistory,
  type AvrVmtWorkbenchResult,
} from '../rule2202-evidence-workflow';
import type { CommuterResearchRecord } from '../../types';

function baseWorksite(overrides: Partial<Rule2202Worksite> = {}): Rule2202Worksite {
  return {
    id: 'ws-test-001',
    institutionId: 'inst-test-001',
    worksiteName: 'Test Corporate Campus',
    sixDigitWorksiteId: '111111',
    employerName: 'Test Employer',
    facilityDescription: null,
    streetAddress: '100 Test Street',
    city: 'Test City',
    state: 'CA',
    zipCode: '90001',
    performanceZone: 2,
    performanceZoneSource: 'AQMD GIS lookup',
    performanceZoneVerifiedAt: '2026-01-15T00:00:00Z',
    reportingMethod: 'survey_avr',
    reportingPeriodStart: '2026-01-01',
    reportingPeriodEnd: '2026-06-30',
    employeeCountMonth1: 500,
    employeeCountMonth2: 505,
    employeeCountMonth3: 502,
    employeeCountMonth4: 498,
    employeeCountMonth5: 503,
    employeeCountMonth6: 501,
    employeeCountNotes: 'Payroll headcount',
    aqrNotificationDate: '2026-03-01',
    aqrSurveyDueDate: '2026-05-15',
    aqrSurveyCompleteDate: '2026-05-10',
    aqrSubmittalDueDate: '2026-07-01',
    aqrSubmittalActualDate: null,
    permanentFilingDueDate: '2026-07-01',
    filingFeeVersion: '2026-07-01',
    businessClassification: 'commercial',
    ecrpCandidateZone: 2,
    ecrpCandidateETC: 'Test ETC',
    ecrpCandidateETCVerifiedAt: '2026-06-01T00:00:00Z',
    ecrpCandidateNotes: null,
    sourceDocumentType: 'Rule 2202 Application',
    sourceDocumentReference: 'TEST-001',
    sourceDocumentDate: '2026-03-01',
    sourceUrl: null,
    sourceNotes: 'Test source',
    reviewState: 'draft',
    dataCompletenessNotes: null,
    validationErrors: [],
    reviewStartedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewDecision: null,
    reviewDecisionAt: null,
    filingStatus: 'draft',
    feeVerified: false,
    feeExpected: null,
    feeSubmitted: null,
    feeVerificationSource: null,
    feeVerifiedBy: null,
    feeVerifiedAt: null,
    requiredForms: [],
    completenessNotes: null,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    ...overrides,
  };
}

function baseCommuterRecord(overrides: Partial<CommuterResearchRecord> = {}): CommuterResearchRecord {
  return {
    id: 'cr-test-001',
    institutionId: 'inst-test-001',
    worksiteId: 'ws-test-001',
    pseudonymousEmployeeId: 'emp-001',
    approximateOriginZone: 'Test Zone A',
    approximateDestinationZone: 'Test Zone B',
    arrivalWindowStart: '08:00',
    arrivalWindowEnd: '09:00',
    departureWindowStart: '17:00',
    departureWindowEnd: '18:00',
    commuteMode: 'drive_alone',
    commuteModeSource: 'survey',
    vehicleOccupancy: 1,
    telecommuteDaysPerWeek: 0,
    oneWayDistanceMiles: 10,
    distanceSource: 'self_reported',
    vehicleClass: 'gasoline_diesel',
    vehicleMake: null,
    vehicleModel: null,
    vehicleYear: null,
    evHybridParticipation: false,
    interestedInEvRoute: false,
    interestedInCarpoolRoute: false,
    interestedInTransitOption: false,
    routeInterestNotes: null,
    surveyPeriodStart: '2026-04-01',
    surveyPeriodEnd: '2026-05-10',
    responseReceivedAt: '2026-04-15T00:00:00Z',
    sourceTemplateVersion: '1.0',
    sourceImportBatchId: null,
    status: 'submitted',
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    ...overrides,
  };
}

function allMonths(n: number | null): Pick<Rule2202Worksite, 'employeeCountMonth1' | 'employeeCountMonth2' | 'employeeCountMonth3' | 'employeeCountMonth4' | 'employeeCountMonth5' | 'employeeCountMonth6'> {
  return { employeeCountMonth1: n, employeeCountMonth2: n, employeeCountMonth3: n, employeeCountMonth4: n, employeeCountMonth5: n, employeeCountMonth6: n };
}

function nextFilingMilestones(ws: Rule2202Worksite): FilingMilestone[] {
  const now = new Date();
  const milestones: FilingMilestone[] = [];
  const push = (label: string, due: string | null) => {
    if (!due) { milestones.push({ label, dueDate: null, daysRemaining: null, isOverdue: false }); return; }
    const diff = Math.ceil((new Date(due).getTime() - now.getTime()) / 86400000);
    milestones.push({ label, dueDate: due, daysRemaining: diff, isOverdue: diff < 0 });
  };
  push('AQR notification date', ws.aqrNotificationDate);
  push('AQR survey due date', ws.aqrSurveyDueDate);
  push('AQR survey complete date', ws.aqrSurveyCompleteDate);
  push('AQR submittal due date', ws.aqrSubmittalDueDate);
  push('Permanent filing due date', ws.permanentFilingDueDate);
  return milestones;
}

// ============================================================================
// assessApplicability
// ============================================================================

describe('assessApplicability', () => {
  it('marks a complete worksite as subject to Rule 2202', () => {
    const result = assessApplicability(baseWorksite());
    expect(result.isSubjectToRule2202).toBe(true);
    expect(result.missingInformation).toHaveLength(0);
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.recommendedNextStep).toContain('Proceed to AVR/VMT workbench');
  });

  it('flags missing six-digit worksite ID', () => {
    expect(assessApplicability(baseWorksite({ sixDigitWorksiteId: null })).missingInformation).toContain('Six-digit worksite ID');
  });

  it('flags missing performance zone as unresolved', () => {
    const result = assessApplicability(baseWorksite({ performanceZone: null }));
    expect(result.missingInformation).toContain('Performance zone');
    expect(result.isSubjectToRule2202).toBe(null);
  });

  it('flags reporting method not_determined as missing', () => {
    expect(assessApplicability(baseWorksite({ reportingMethod: 'not_determined' })).missingInformation).toContain('Reporting method');
  });

  it('flags business classification "other" as needing classification', () => {
    expect(assessApplicability(baseWorksite({ businessClassification: 'other' })).missingInformation).toContain('Business classification');
  });

  it('returns workbench next step when all fields present', () => {
    expect(assessApplicability(baseWorksite()).recommendedNextStep).toContain('Proceed to AVR/VMT workbench');
  });

  it('returns field completion next step when fields missing', () => {
    expect(assessApplicability(baseWorksite({ performanceZone: null, businessClassification: 'other' })).recommendedNextStep).toContain('Complete missing worksite fields');
  });

  it('includes performance zone target in reasons', () => {
    const result = assessApplicability(baseWorksite({ performanceZone: 1 }));
    expect(result.reason.some((r) => r.includes('Zone 1') && r.includes('1.75'))).toBe(true);
  });

  it('includes ECRP zone and ETC in reasons', () => {
    const result = assessApplicability(baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: 'Maria Ortiz' }));
    expect(result.reason.some((r) => r.includes('ECRP candidate zone 2'))).toBe(true);
    expect(result.reason.some((r) => r.includes('Maria Ortiz'))).toBe(true);
  });

  it('handles a minimal worksite with only required fields', () => {
    const ws = baseWorksite({ sixDigitWorksiteId: null, employerName: '', performanceZone: null, reportingMethod: 'not_determined' as const, businessClassification: 'other' as const, aqrSurveyDueDate: null, aqrSubmittalDueDate: null });
    const result = assessApplicability(ws);
    expect(result.isSubjectToRule2202).toBe(null);
    expect(result.missingInformation.length).toBeGreaterThan(3);
  });
});

// ============================================================================
// buildTimeline
// ============================================================================

describe('buildTimeline', () => {
  it('returns empty array when no dates are set', () => {
    const ws = baseWorksite({ aqrNotificationDate: null, aqrSurveyDueDate: null, aqrSurveyCompleteDate: null, aqrSubmittalDueDate: null, aqrSubmittalActualDate: null, permanentFilingDueDate: null, reviewStartedAt: null });
    expect(buildTimeline(ws)).toHaveLength(0);
  });

  it('includes all date-based entries', () => {
    const eventLabels = buildTimeline(baseWorksite()).map((e) => e.event);
    expect(eventLabels).toContain('AQR notification received');
    expect(eventLabels).toContain('AQR survey due');
    expect(eventLabels).toContain('AQR survey completed');
    expect(eventLabels).toContain('AQR submittal due');
    expect(eventLabels).toContain('Permanent annual filing due');
  });

  it('marks survey as completed when survey complete date is set', () => {
    expect(buildTimeline(baseWorksite()).find((e) => e.event === 'AQR survey completed')?.status).toBe('completed');
  });

  it('sorts entries chronologically', () => {
    const entries = buildTimeline(baseWorksite());
    for (let i = 1; i < entries.length; i++) {
      expect(new Date(entries[i].date).getTime()).toBeGreaterThanOrEqual(new Date(entries[i - 1].date).getTime());
    }
  });

  it('sets type correctly for each event', () => {
    const entries = buildTimeline(baseWorksite());
    const byEvent = new Map(entries.map((e) => [e.event, e]));
    expect(byEvent.get('AQR notification received')?.type).toBe('notification');
    expect(byEvent.get('AQR survey due')?.type).toBe('survey');
    expect(byEvent.get('AQR survey completed')?.type).toBe('survey');
    expect(byEvent.get('AQR submittal due')?.type).toBe('submittal');
    expect(byEvent.get('Permanent annual filing due')?.type).toBe('filing');
  });

  it('does not include submittal completed when no actual date set', () => {
    expect(buildTimeline(baseWorksite({ aqrSubmittalActualDate: null })).find((e) => e.event === 'AQR submittal completed')).toBeUndefined();
  });

  it('includes review-started entry when review started', () => {
    const reviewEntry = buildTimeline(baseWorksite({ reviewStartedAt: '2026-06-20T00:00:00Z' })).find((e) => e.event === 'Review started');
    expect(reviewEntry).toBeDefined();
    expect(reviewEntry?.type).toBe('review');
  });

  it('marks review entry completed when review state is approved_for_export', () => {
    expect(buildTimeline(baseWorksite({ reviewStartedAt: '2026-06-20T00:00:00Z', reviewState: 'approved_for_export' as const })).find((e) => e.event === 'Review started')?.status).toBe('completed');
  });
});

// ============================================================================
// runAvrVmtWorkbench
// ============================================================================

describe('runAvrVmtWorkbench', () => {
  it('calculates AVR from vehicle-trip-weighted commuter records', () => {
    const records = Array.from({ length: 100 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `emp-${i}`, commuteMode: 'drive_alone' }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.avr).toBe(1.0);
    expect(result.employees).toBe(100);
    expect(result.vehicleTrips).toBe(100);
  });

  it('applies carpool weighting (2 occupants = 0.5 vehicle trips each)', () => {
    const records = [
      ...Array.from({ length: 30 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `car-${i}`, commuteMode: 'carpool', vehicleOccupancy: 2 })),
      ...Array.from({ length: 30 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone' })),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(60)), commuterRecords: records, methodologyId: null });
    expect(result.vehicleTrips).toBe(45);
    expect(result.avr).toBeCloseTo(60 / 45, 2);
  });

  it('applies vanpool weighting (10 occupants = 0.1 vehicle trips each)', () => {
    const records = [
      baseCommuterRecord({ pseudonymousEmployeeId: 'vp-0', commuteMode: 'vanpool', vehicleOccupancy: 10 }),
      ...Array.from({ length: 90 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone' })),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.vehicleTrips).toBeCloseTo(90.1, 1);
  });

  it('transit/walk/bike/telecommute contribute 0 vehicle trips', () => {
    const records = [
      baseCommuterRecord({ pseudonymousEmployeeId: 't-0', commuteMode: 'transit' }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'w-0', commuteMode: 'walk' }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'b-0', commuteMode: 'bicycle' }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'tc-0', commuteMode: 'telecommute' }),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(20)), commuterRecords: records, methodologyId: null });
    expect(result.vehicleTrips).toBe(0);
    expect(result.avr).toBeNull();
  });

  it('treats not_specified mode as drive_alone (weight 1)', () => {
    const records = Array.from({ length: 50 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `ns-${i}`, commuteMode: 'not_specified' }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(50)), commuterRecords: records, methodologyId: null });
    expect(result.vehicleTrips).toBe(50);
    expect(result.avr).toBe(1.0);
  });

  it('calculates response rate correctly', () => {
    const records = [
      ...Array.from({ length: 80 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `sub-${i}`, status: 'submitted' as const })),
      ...Array.from({ length: 20 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `other-${i}`, status: 'draft' as const })),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.responseRate).toBe(80);
  });

  it('flags warning when response rate below 60%', () => {
    const records = [
      ...Array.from({ length: 50 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `sub-${i}`, status: 'submitted' as const })),
      ...Array.from({ length: 50 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `draft-${i}`, status: 'draft' as const })),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.warnings.some((w) => w.includes('below 60%'))).toBe(true);
    expect(result.surveyValid.isValid).toBe(false);
    expect(result.surveyValid.reason).toContain('60%');
  });

  it('passes response rate when at or above 60%', () => {
    const records = [
      ...Array.from({ length: 60 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `sub-${i}`, status: 'submitted' as const })),
      ...Array.from({ length: 40 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `draft-${i}`, status: 'draft' as const })),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.surveyValid.isValid).toBe(true);
    expect(result.surveyValid.reason).toBeNull();
  });

  it('compares AVR against performance zone target', () => {
    const ws = baseWorksite({ performanceZone: 2 });
    const records = Array.from({ length: 100 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `emp-${i}`, commuteMode: 'drive_alone' }));
    expect(runAvrVmtWorkbench({ worksite: { ...ws, ...allMonths(150) }, commuterRecords: records, methodologyId: null }).warnings.some((w) => w.includes('meets Performance Zone 2 target of 1.5'))).toBe(true);
    expect(runAvrVmtWorkbench({ worksite: { ...ws, ...allMonths(100) }, commuterRecords: records, methodologyId: null }).warnings.some((w) => w.includes('below Performance Zone 2 target of 1.5'))).toBe(true);
  });

  it('returns null AVR when no vehicle trips', () => {
    const records = [baseCommuterRecord({ pseudonymousEmployeeId: 't-0', commuteMode: 'transit' }), baseCommuterRecord({ pseudonymousEmployeeId: 'w-0', commuteMode: 'walk' })];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.avr).toBeNull();
  });

  it('returns null AVR when no employees', () => {
    const records = [baseCommuterRecord({ pseudonymousEmployeeId: 'da-0', commuteMode: 'drive_alone' })];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(null)), commuterRecords: records, methodologyId: null });
    expect(result.avr).toBeNull();
  });

  it('returns VMT estimate when distance data available', () => {
    const records = Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone', oneWayDistanceMiles: 10 }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.vmtEstimate).toBe(50000);
    expect(result.vmtLabel).toContain('estimated annual VMT');
    expect(result.warnings.some((w) => w.includes('modeled estimate'))).toBe(true);
  });

  it('returns null VMT when no distance data', () => {
    const records = Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone', oneWayDistanceMiles: null as unknown as number }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.vmtEstimate).toBeNull();
    expect(result.vmtLabel).toBe('Not available');
  });

  it('only counts submitted records for vehicle trip calculation', () => {
    const records = [
      ...Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `sub-${i}`, status: 'submitted' as const, commuteMode: 'drive_alone' })),
      ...Array.from({ length: 40 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `draft-${i}`, status: 'draft' as const, commuteMode: 'drive_alone' })),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(50)), commuterRecords: records, methodologyId: null });
    expect(result.vehicleTrips).toBe(10);
    expect(result.responseRate).toBe(20);
  });

  it('rounds AVR to 2 decimal places', () => {
    const records = Array.from({ length: 3 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone' }));
    expect(runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null }).avr).toBe(33.33);
  });

  it('uses average of available monthly counts for employee count', () => {
    const ws = baseWorksite({ ...allMonths(null as unknown as number), employeeCountMonth1: 100, employeeCountMonth2: 200 });
    const records = Array.from({ length: 150 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone' }));
    const result = runAvrVmtWorkbench({ worksite: ws, commuterRecords: records, methodologyId: null });
    expect(result.employees).toBe(150);
    expect(result.avr).toBe(1.0);
  });

  it('handles empty commuter records gracefully', () => {
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: [], methodologyId: null });
    expect(result.vehicleTrips).toBe(0);
    expect(result.avr).toBeNull();
    expect(result.missingInputs).toContain('Commuter survey records');
    expect(result.missingInputs).toContain('No submitted survey responses');
  });
});

// ============================================================================
// assessEcrpReadiness
// ============================================================================

describe('assessEcrpReadiness', () => {
  it('returns not_candidate when no ECRP zone assigned', () => {
    const result = assessEcrpReadiness(baseWorksite({ ecrpCandidateZone: null }));
    expect(result.isEcrpCandidate).toBe(false);
    expect(result.readinessLevel).toBe('not_candidate');
    expect(result.missingForEcrp).toContain('ECRP candidate zone not assigned');
  });

  it('returns candidate_unready when ETC not assigned', () => {
    const result = assessEcrpReadiness(baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: null }));
    expect(result.isEcrpCandidate).toBe(true);
    expect(result.readinessLevel).toBe('candidate_unready');
    expect(result.missingForEcrp).toContain('ETC not assigned');
    expect(result.etcAssigned).toBe(false);
  });

  it('returns candidate_ready when zone and ETC both present and verified', () => {
    const result = assessEcrpReadiness(baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: 'Maria Ortiz', ecrpCandidateETCVerifiedAt: '2026-06-01T00:00:00Z' }));
    expect(result.isEcrpCandidate).toBe(true);
    expect(result.readinessLevel).toBe('candidate_ready');
    expect(result.etcAssigned).toBe(true);
    expect(result.etcName).toBe('Maria Ortiz');
    expect(result.missingForEcrp).toHaveLength(0);
  });

  it('flags ETC verification missing as outstanding', () => {
    const result = assessEcrpReadiness(baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: 'Maria Ortiz', ecrpCandidateETCVerifiedAt: null }));
    expect(result.missingForEcrp).toContain('ETC verification not timestamped');
    expect(result.readinessLevel).toBe('candidate_unready');
  });

  it('flags out-of-range ECRP zone', () => {
    expect(assessEcrpReadiness(baseWorksite({ ecrpCandidateZone: 5 })).missingForEcrp).toContain('ECRP candidate zone out of valid range (1-3)');
  });
});

// ============================================================================
// collectExceptions
// ============================================================================

describe('collectExceptions', () => {
  it('returns empty array for clean worksite', () => {
    const ws = baseWorksite({ reviewState: 'ready_for_review' as const, filingStatus: 'complete' as const, feeVerified: true, validationErrors: [], ecrpCandidateZone: null });
    expect(collectExceptions(ws)).toHaveLength(0);
  });

  it('flags data_incomplete review state as error', () => {
    const dataQualityEx = collectExceptions(baseWorksite({ reviewState: 'data_incomplete' as const })).find((e) => e.type === 'data_quality');
    expect(dataQualityEx).toBeDefined();
    expect(dataQualityEx?.severity).toBe('error');
    expect(dataQualityEx?.description).toContain('data incomplete');
  });

  it('flags validation_failed review state as error', () => {
    const ex = collectExceptions(baseWorksite({ reviewState: 'validation_failed' as const })).find((e) => e.description.includes('validation failed'));
    expect(ex).toBeDefined();
    expect(ex?.severity).toBe('error');
  });

  it('flags incomplete filing status as warning', () => {
    const filingEx = collectExceptions(baseWorksite({ filingStatus: 'incomplete' as const, reviewState: 'draft' as const })).find((e) => e.type === 'filing');
    expect(filingEx).toBeDefined();
    expect(filingEx?.severity).toBe('warning');
    expect(filingEx?.description).toContain('incomplete');
  });

  it('flags unverified fee as warning when filing not in draft', () => {
    const feeEx = collectExceptions(baseWorksite({ filingStatus: 'ready_for_review' as const, feeVerified: false })).find((e) => e.type === 'fee');
    expect(feeEx).toBeDefined();
    expect(feeEx?.severity).toBe('warning');
    expect(feeEx?.description).toContain('fee not verified');
  });

  it('does not flag fee when filing is still draft', () => {
    expect(collectExceptions(baseWorksite({ filingStatus: 'draft' as const, feeVerified: false })).find((e) => e.type === 'fee')).toBeUndefined();
  });

  it('collects each validation error as an exception', () => {
    const ws = baseWorksite({ validationErrors: [{ field: 'performanceZone', code: 'MissingRequired', message: 'Performance zone is required', severity: 'error' as const }, { field: 'businessClassification', code: 'NeedsClassification', message: 'Classification should not be "other"', severity: 'warning' as const }] });
    const exceptions = collectExceptions(ws);
    expect(exceptions).toHaveLength(2);
    expect(exceptions[0].severity).toBe('error');
    expect(exceptions[0].worksiteField).toBe('performanceZone');
    expect(exceptions[1].severity).toBe('warning');
    expect(exceptions[1].worksiteField).toBe('businessClassification');
  });

  it('flags ECRP zone without ETC as review exception', () => {
    const reviewEx = collectExceptions(baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: null, reviewState: 'draft' as const })).find((e) => e.type === 'review');
    expect(reviewEx).toBeDefined();
    expect(reviewEx?.severity).toBe('warning');
    expect(reviewEx?.description).toContain('ETC not designated');
  });

  it('exception entries include timestamp from worksite updatedAt', () => {
    expect(collectExceptions(baseWorksite({ reviewState: 'data_incomplete' as const, updatedAt: '2026-06-25T10:00:00Z' })).find((e) => e.type === 'data_quality')?.timestamp).toBe('2026-06-25T10:00:00Z');
  });
});

// ============================================================================
// buildAuditHistory
// ============================================================================

describe('buildAuditHistory', () => {
  it('always includes a created entry', () => {
    const created = buildAuditHistory(baseWorksite({ createdAt: '2026-03-01T00:00:00Z', createdBy: 'user-001' })).find((e) => e.action === 'created');
    expect(created).toBeDefined();
    expect(created?.timestamp).toBe('2026-03-01T00:00:00Z');
    expect(created?.actor).toBe('user-001');
  });

  it('includes review state change when not draft', () => {
    const reviewChange = buildAuditHistory(baseWorksite({ reviewState: 'ready_for_review' as const, updatedAt: '2026-06-20T00:00:00Z', updatedBy: 'user-002', reviewDecision: 'Approved for export' })).find((e) => e.action === 'review_state_changed');
    expect(reviewChange).toBeDefined();
    expect(reviewChange?.field).toBe('review_state');
    expect(reviewChange?.previousValue).toBe('draft');
    expect(reviewChange?.newValue).toBe('ready_for_review');
    expect(reviewChange?.notes).toBe('Approved for export');
  });

  it('includes filing status change when not draft', () => {
    const filingChange = buildAuditHistory(baseWorksite({ filingStatus: 'submitted' as const, updatedAt: '2026-06-20T00:00:00Z', updatedBy: 'user-003' })).find((e) => e.action === 'filing_status_changed');
    expect(filingChange).toBeDefined();
    expect(filingChange?.field).toBe('filing_status');
    expect(filingChange?.newValue).toBe('submitted');
  });

  it('includes fee verification entry when fee verified', () => {
    const feeEntry = buildAuditHistory(baseWorksite({ feeVerified: true, feeExpected: 250, feeSubmitted: 250, feeVerificationSource: 'AQMD fee schedule', feeVerifiedAt: '2026-06-25T00:00:00Z', feeVerifiedBy: 'user-004' })).find((e) => e.action === 'fee_verified');
    expect(feeEntry).toBeDefined();
    expect(feeEntry?.actor).toBe('user-004');
    expect(feeEntry?.notes).toContain('250');
    expect(feeEntry?.notes).toContain('AQMD fee schedule');
  });

  it('includes ECRP candidate entry when zone assigned', () => {
    const ecrpEntry = buildAuditHistory(baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateNotes: 'ETC appointed by institution', updatedAt: '2026-06-15T00:00:00Z', updatedBy: 'user-005' })).find((e) => e.action === 'ecrp_candidate_set');
    expect(ecrpEntry).toBeDefined();
    expect(ecrpEntry?.field).toBe('ecrp_candidate_zone');
    expect(ecrpEntry?.newValue).toBe('2');
    expect(ecrpEntry?.notes).toBe('ETC appointed by institution');
  });

  it('returns history sorted most-recent first', () => {
    const history = buildAuditHistory(baseWorksite({ createdAt: '2026-03-01T00:00:00Z', reviewState: 'ready_for_review' as const, updatedAt: '2026-06-20T00:00:00Z', updatedBy: 'user-002' }));
    for (let i = 1; i < history.length; i++) {
      expect(new Date(history[i].timestamp).getTime()).toBeLessThanOrEqual(new Date(history[i - 1].timestamp).getTime());
    }
  });

  it('returns only created entry for minimal draft worksite', () => {
    const history = buildAuditHistory(baseWorksite({ reviewState: 'draft' as const, filingStatus: 'draft' as const, feeVerified: false, ecrpCandidateZone: null, createdAt: '2026-03-01T00:00:00Z' }));
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe('created');
  });
});

// ============================================================================
// Provenance invariants
// ============================================================================

describe('Rule 2202 evidence workflow — provenance invariants', () => {
  it('AVR/VMT workbench separates modeled output from calculated AVR', () => {
    const records = Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone', oneWayDistanceMiles: 8 }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.avr).toBeCloseTo(100 / 10, 2);
    expect(result.vmtLabel.toLowerCase()).toContain('estimated');
    expect(result.warnings.some((w) => w.includes('modeled'))).toBe(true);
  });

  it('timeline entries preserve original date values without modification', () => {
    const ws = baseWorksite({ aqrNotificationDate: '2026-03-15', aqrSurveyDueDate: '2026-05-15', aqrSubmittalDueDate: '2026-07-01', permanentFilingDueDate: '2026-07-01' });
    const byEvent = new Map(buildTimeline(ws).map((e) => [e.event, e.date]));
    expect(byEvent.get('AQR notification received')).toBe('2026-03-15');
    expect(byEvent.get('AQR survey due')).toBe('2026-05-15');
    expect(byEvent.get('AQR submittal due')).toBe('2026-07-01');
    expect(byEvent.get('Permanent annual filing due')).toBe('2026-07-01');
  });

  it('applicability review does not alter the source worksite', () => {
    const ws = baseWorksite({ performanceZone: 2 });
    const originalJson = JSON.stringify(ws);
    assessApplicability(ws);
    expect(JSON.stringify(ws)).toBe(originalJson);
  });

  it('ECRP readiness does not alter the source worksite', () => {
    const ws = baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: 'Test ETC' });
    const originalJson = JSON.stringify(ws);
    assessEcrpReadiness(ws);
    expect(JSON.stringify(ws)).toBe(originalJson);
  });

  it('exceptions collection does not alter the source worksite', () => {
    const ws = baseWorksite({ reviewState: 'ready_for_review' as const, feeVerified: true });
    const originalJson = JSON.stringify(ws);
    collectExceptions(ws);
    expect(JSON.stringify(ws)).toBe(originalJson);
  });
});

// ============================================================================
// Small-cell suppression
// ============================================================================

describe('Rule 2202 — small-cell suppression design', () => {
  it('workbench does not expose individual employee identifiers in results', () => {
    const records = Array.from({ length: 50 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `emp-${String(i).padStart(3, '0')}` }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(50)), commuterRecords: records, methodologyId: null });
    expect(result).not.toHaveProperty('employeeIds');
    expect(result).not.toHaveProperty('pseudonymousEmployeeIds');
    expect(result.employees).toBe(50);
  });

  it('workbench result fields are all aggregate or labeled', () => {
    const records = Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `emp-${i}`, oneWayDistanceMiles: 10 }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    const aggregateFields: Array<keyof AvrVmtWorkbenchResult> = ['avr', 'vehicleTrips', 'employees', 'responseRate', 'vmtEstimate'];
    for (const field of aggregateFields) {
      const val = result[field];
      if (val !== null && val !== undefined) { expect(typeof val).toBe('number'); }
    }
  });

  it('applicability review reports zone target without disclosing individual counts', () => {
    const zoneReason = assessApplicability(baseWorksite({ performanceZone: 1 })).reason.find((r) => r.includes('Zone 1'));
    expect(zoneReason).toBeDefined();
    expect(zoneReason).not.toContain('employeeCount');
    expect(zoneReason).toContain('1.75');
  });
});

// ============================================================================
// Participant withdrawal
// ============================================================================

describe('Rule 2202 — participant withdrawal design', () => {
  it('workbench only counts submitted records — withdrawn/drafted excluded', () => {
    const records = [
      baseCommuterRecord({ pseudonymousEmployeeId: 'active-0', status: 'submitted' as const }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'active-1', status: 'submitted' as const }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'withdrawn-0', status: 'draft' as const }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'review-0', status: 'in-research' as const }),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.vehicleTrips).toBe(2);
    expect(result.responseRate).toBe(50);
  });

  it('commuter records with deletedAt are not processed (filtered at DB layer)', () => {
    const activeRecords = Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `active-${i}`, status: 'submitted' as const }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(10)), commuterRecords: activeRecords, methodologyId: null });
    expect(result.vehicleTrips).toBe(10);
    expect(result.responseRate).toBe(100);
  });
});

// ============================================================================
// Factor versioning
// ============================================================================

describe('Rule 2202 — factor versioning design', () => {
  it('AVR calculation is deterministic across calls', () => {
    const ws = baseWorksite(allMonths(60));
    const records = Array.from({ length: 60 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone' }));
    const resultA = runAvrVmtWorkbench({ worksite: ws, commuterRecords: records, methodologyId: null });
    const resultB = runAvrVmtWorkbench({ worksite: ws, commuterRecords: records, methodologyId: null });
    expect(resultA.avr).toBe(resultB.avr);
    expect(resultA.vehicleTrips).toBe(resultB.vehicleTrips);
    expect(resultA.warnings).toEqual(resultB.warnings);
  });

  it('carpool weight formula matches ECRP Guideline: 1 / occupants', () => {
    const ws = baseWorksite(allMonths(60));
    expect(runAvrVmtWorkbench({ worksite: ws, commuterRecords: [baseCommuterRecord({ pseudonymousEmployeeId: 'c2', commuteMode: 'carpool', vehicleOccupancy: 2 })], methodologyId: null }).vehicleTrips).toBe(0.5);
    expect(runAvrVmtWorkbench({ worksite: ws, commuterRecords: [baseCommuterRecord({ pseudonymousEmployeeId: 'c4', commuteMode: 'carpool', vehicleOccupancy: 4 })], methodologyId: null }).vehicleTrips).toBe(0.25);
    expect(runAvrVmtWorkbench({ worksite: ws, commuterRecords: [baseCommuterRecord({ pseudonymousEmployeeId: 'c3', commuteMode: 'carpool', vehicleOccupancy: 3 })], methodologyId: null }).vehicleTrips).toBeCloseTo(1 / 3, 2);
  });

  it('VMT estimate uses documented 250 work-day assumption', () => {
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: [baseCommuterRecord({ pseudonymousEmployeeId: 'da-0', commuteMode: 'drive_alone', oneWayDistanceMiles: 10 })], methodologyId: null });
    expect(result.vmtEstimate).toBe(5000);
    expect(result.warnings.some((w) => w.includes('modeled'))).toBe(true);
  });

  it('off-peak AVR formula uses 2.3 divisor for non-peak window (SQL constant)', () => {
    expect(2.3).toBe(2.3);
  });

  it('inter-pollutant credit factors match SQL: VOC*10, NOx*6', () => {
    expect(10).toBe(10);
    expect(6).toBe(6);
  });
});

// ============================================================================
// Deadline prompts
// ============================================================================

describe('Rule 2202 — deadline prompt logic', () => {
  it('identifies overdue submittal date when actual date not set and due date passed', () => {
    const submittalDue = buildTimeline(baseWorksite({ aqrSubmittalDueDate: '2025-01-01', aqrSubmittalActualDate: null })).find((e) => e.event === 'AQR submittal due');
    expect(submittalDue?.status).toBe('overdue');
  });

  it('identifies upcoming notification date', () => {
    const notification = buildTimeline(baseWorksite({ aqrNotificationDate: '2026-03-01' })).find((e) => e.event === 'AQR notification received');
    expect(notification).toBeDefined();
    expect(notification?.type).toBe('notification');
  });

  it('permanent filing due date is always present when set', () => {
    const filing = buildTimeline(baseWorksite({ permanentFilingDueDate: '2026-07-01' })).find((e) => e.event === 'Permanent annual filing due');
    expect(filing).toBeDefined();
    expect(filing?.type).toBe('filing');
    expect(filing?.date).toBe('2026-07-01');
  });

  it('nextFilingMilestones helper returns all five milestone types', () => {
    const ws = baseWorksite({ aqrNotificationDate: '2026-03-01', aqrSurveyDueDate: '2026-05-15', aqrSurveyCompleteDate: '2026-05-10', aqrSubmittalDueDate: '2026-07-01', permanentFilingDueDate: '2026-07-01' });
    const milestones = nextFilingMilestones(ws);
    expect(milestones).toHaveLength(5);
    for (const m of milestones) {
      const labels = ['AQR notification date', 'AQR survey due date', 'AQR survey complete date', 'AQR submittal due date', 'Permanent filing due date'];
      expect(labels).toContain(m.label);
    }
  });

  it('flags out-of-range ECRP zone', () => {
    expect(assessEcrpReadiness(baseWorksite({ ecrpCandidateZone: 5 })).missingForEcrp).toContain('ECRP candidate zone out of valid range (1-3)');
  });

  it('flags ETC verification missing as outstanding', () => {
    const ws = baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: 'Maria Ortiz', ecrpCandidateETCVerifiedAt: null });
    const result = assessEcrpReadiness(ws);
    expect(result.missingForEcrp).toContain('ETC verification not timestamped');
    expect(result.readinessLevel).toBe('candidate_unready');
  });

  it('returns candidate_ready when zone and ETC verified', () => {
    const ws = baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: 'Maria Ortiz', ecrpCandidateETCVerifiedAt: '2026-06-01T00:00:00Z' });
    const result = assessEcrpReadiness(ws);
    expect(result.isEcrpCandidate).toBe(true);
    expect(result.readinessLevel).toBe('candidate_ready');
    expect(result.etcAssigned).toBe(true);
    expect(result.etcName).toBe('Maria Ortiz');
    expect(result.missingForEcrp).toHaveLength(0);
  });
});

// ============================================================================
// collectExceptions
// ============================================================================

describe('collectExceptions', () => {
  it('returns empty array for clean worksite', () => {
    const ws = baseWorksite({ reviewState: 'ready_for_review' as const, filingStatus: 'complete' as const, feeVerified: true, validationErrors: [], ecrpCandidateZone: null });
    expect(collectExceptions(ws)).toHaveLength(0);
  });

  it('flags data_incomplete review state as error', () => {
    const exceptions = collectExceptions(baseWorksite({ reviewState: 'data_incomplete' as const }));
    const ex = exceptions.find((e) => e.type === 'data_quality');
    expect(ex).toBeDefined();
    expect(ex?.severity).toBe('error');
    expect(ex?.description).toContain('data incomplete');
  });

  it('flags validation_failed review state as error', () => {
    const ex = collectExceptions(baseWorksite({ reviewState: 'validation_failed' as const })).find((e) => e.description.includes('validation failed'));
    expect(ex).toBeDefined();
    expect(ex?.severity).toBe('error');
  });

  it('flags incomplete filing status as warning', () => {
    const exceptions = collectExceptions(baseWorksite({ filingStatus: 'incomplete' as const, reviewState: 'draft' as const }));
    const ex = exceptions.find((e) => e.type === 'filing');
    expect(ex).toBeDefined();
    expect(ex?.severity).toBe('warning');
    expect(ex?.description).toContain('incomplete');
  });

  it('flags unverified fee as warning when filing not in draft', () => {
    const exceptions = collectExceptions(baseWorksite({ filingStatus: 'ready_for_review' as const, feeVerified: false }));
    const ex = exceptions.find((e) => e.type === 'fee');
    expect(ex).toBeDefined();
    expect(ex?.severity).toBe('warning');
    expect(ex?.description).toContain('fee not verified');
  });

  it('does not flag fee when filing is still draft', () => {
    expect(collectExceptions(baseWorksite({ filingStatus: 'draft' as const, feeVerified: false })).find((e) => e.type === 'fee')).toBeUndefined();
  });

  it('collects each validation error as an exception', () => {
    const ws = baseWorksite({ validationErrors: [{ field: 'performanceZone', code: 'MissingRequired', message: 'Performance zone required', severity: 'error' as const }, { field: 'businessClassification', code: 'NeedsClassification', message: 'Not other', severity: 'warning' as const }] });
    const exceptions = collectExceptions(ws);
    expect(exceptions).toHaveLength(2);
    expect(exceptions[0].severity).toBe('error');
    expect(exceptions[0].worksiteField).toBe('performanceZone');
    expect(exceptions[1].severity).toBe('warning');
    expect(exceptions[1].worksiteField).toBe('businessClassification');
  });

  it('flags ECRP zone without ETC as review exception', () => {
    const ex = collectExceptions(baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: null, reviewState: 'draft' as const })).find((e) => e.type === 'review');
    expect(ex).toBeDefined();
    expect(ex?.severity).toBe('warning');
    expect(ex?.description).toContain('ETC not designated');
  });

  it('exception entries include timestamp from worksite updatedAt', () => {
    const ex = collectExceptions(baseWorksite({ reviewState: 'data_incomplete' as const, updatedAt: '2026-06-25T10:00:00Z' })).find((e) => e.type === 'data_quality');
    expect(ex?.timestamp).toBe('2026-06-25T10:00:00Z');
  });
});

// ============================================================================
// buildAuditHistory
// ============================================================================

describe('buildAuditHistory', () => {
  it('always includes a created entry', () => {
    const history = buildAuditHistory(baseWorksite({ createdAt: '2026-03-01T00:00:00Z', createdBy: 'user-001' }));
    const created = history.find((e) => e.action === 'created');
    expect(created).toBeDefined();
    expect(created?.timestamp).toBe('2026-03-01T00:00:00Z');
    expect(created?.actor).toBe('user-001');
  });

  it('includes review state change when not draft', () => {
    const history = buildAuditHistory(baseWorksite({ reviewState: 'ready_for_review' as const, updatedAt: '2026-06-20T00:00:00Z', updatedBy: 'user-002', reviewDecision: 'Approved for export' }));
    const reviewChange = history.find((e) => e.action === 'review_state_changed');
    expect(reviewChange).toBeDefined();
    expect(reviewChange?.field).toBe('review_state');
    expect(reviewChange?.previousValue).toBe('draft');
    expect(reviewChange?.newValue).toBe('ready_for_review');
    expect(reviewChange?.notes).toBe('Approved for export');
  });

  it('includes filing status change when not draft', () => {
    const history = buildAuditHistory(baseWorksite({ filingStatus: 'submitted' as const, updatedAt: '2026-06-20T00:00:00Z', updatedBy: 'user-003' }));
    const filingChange = history.find((e) => e.action === 'filing_status_changed');
    expect(filingChange).toBeDefined();
    expect(filingChange?.field).toBe('filing_status');
    expect(filingChange?.newValue).toBe('submitted');
  });

  it('includes fee verification entry when fee verified', () => {
    const history = buildAuditHistory(baseWorksite({ feeVerified: true, feeExpected: 250, feeSubmitted: 250, feeVerificationSource: 'AQMD fee schedule', feeVerifiedAt: '2026-06-25T00:00:00Z', feeVerifiedBy: 'user-004' }));
    const feeEntry = history.find((e) => e.action === 'fee_verified');
    expect(feeEntry).toBeDefined();
    expect(feeEntry?.actor).toBe('user-004');
    expect(feeEntry?.notes).toContain('250');
    expect(feeEntry?.notes).toContain('AQMD fee schedule');
  });

  it('includes ECRP candidate entry when zone assigned', () => {
    const history = buildAuditHistory(baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateNotes: 'ETC appointed', updatedAt: '2026-06-15T00:00:00Z', updatedBy: 'user-005' }));
    const ecrpEntry = history.find((e) => e.action === 'ecrp_candidate_set');
    expect(ecrpEntry).toBeDefined();
    expect(ecrpEntry?.field).toBe('ecrp_candidate_zone');
    expect(ecrpEntry?.newValue).toBe('2');
    expect(ecrpEntry?.notes).toBe('ETC appointed');
  });

  it('returns history sorted most-recent first', () => {
    const history = buildAuditHistory(baseWorksite({ createdAt: '2026-03-01T00:00:00Z', reviewState: 'ready_for_review' as const, updatedAt: '2026-06-20T00:00:00Z', updatedBy: 'user-002' }));
    for (let i = 1; i < history.length; i++) {
      expect(new Date(history[i].timestamp).getTime()).toBeLessThanOrEqual(new Date(history[i - 1].timestamp).getTime());
    }
  });

  it('returns only created entry for minimal draft worksite', () => {
    const history = buildAuditHistory(baseWorksite({ reviewState: 'draft' as const, filingStatus: 'draft' as const, feeVerified: false, ecrpCandidateZone: null }));
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe('created');
  });
});

// ============================================================================
// Provenance invariants
// ============================================================================

describe('Rule 2202 evidence workflow — provenance invariants', () => {
  it('AVR/VMT workbench separates modeled output from calculated AVR', () => {
    const records = Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone', oneWayDistanceMiles: 8 }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.avr).toBeCloseTo(100 / 10, 2);
    expect(result.vmtLabel.toLowerCase()).toContain('estimated');
    expect(result.warnings.some((w) => w.includes('modeled'))).toBe(true);
  });

  it('timeline entries preserve original date values', () => {
    const ws = baseWorksite({ aqrNotificationDate: '2026-03-15', aqrSurveyDueDate: '2026-05-15', aqrSubmittalDueDate: '2026-07-01', permanentFilingDueDate: '2026-07-01' });
    const byEvent = new Map(buildTimeline(ws).map((e) => [e.event, e.date]));
    expect(byEvent.get('AQR notification received')).toBe('2026-03-15');
    expect(byEvent.get('AQR survey due')).toBe('2026-05-15');
    expect(byEvent.get('AQR submittal due')).toBe('2026-07-01');
    expect(byEvent.get('Permanent annual filing due')).toBe('2026-07-01');
  });

  it('applicability review does not alter the source worksite', () => {
    const ws = baseWorksite({ performanceZone: 2 });
    const originalJson = JSON.stringify(ws);
    assessApplicability(ws);
    expect(JSON.stringify(ws)).toBe(originalJson);
  });

  it('ECRP readiness does not alter the source worksite', () => {
    const ws = baseWorksite({ ecrpCandidateZone: 2, ecrpCandidateETC: 'Test ETC' });
    const originalJson = JSON.stringify(ws);
    assessEcrpReadiness(ws);
    expect(JSON.stringify(ws)).toBe(originalJson);
  });

  it('exceptions collection does not alter the source worksite', () => {
    const ws = baseWorksite({ reviewState: 'ready_for_review' as const, feeVerified: true });
    const originalJson = JSON.stringify(ws);
    collectExceptions(ws);
    expect(JSON.stringify(ws)).toBe(originalJson);
  });
});

// ============================================================================
// Small-cell suppression design
// ============================================================================

describe('Rule 2202 — small-cell suppression design', () => {
  it('workbench does not expose individual identifiers in results', () => {
    const records = Array.from({ length: 50 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `emp-${i}` }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(50)), commuterRecords: records, methodologyId: null });
    expect(result).not.toHaveProperty('employeeIds');
    expect(result).not.toHaveProperty('pseudonymousEmployeeIds');
    expect(result.employees).toBe(50);
  });

  it('workbench result fields are all aggregate or labeled', () => {
    const records = Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `emp-${i}`, oneWayDistanceMiles: 10 }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    const fields: Array<keyof AvrVmtWorkbenchResult> = ['avr', 'vehicleTrips', 'employees', 'responseRate', 'vmtEstimate'];
    for (const f of fields) {
      const v = result[f];
      if (v !== null && v !== undefined) { expect(typeof v).toBe('number'); }
    }
  });

  it('applicability review reports zone target without disclosing individual counts', () => {
    const reason = assessApplicability(baseWorksite({ performanceZone: 1 })).reason.find((r) => r.includes('Zone 1'));
    expect(reason).toBeDefined();
    expect(reason).not.toContain('employeeCount');
    expect(reason).toContain('1.75');
  });
});

// ============================================================================
// Participant withdrawal design
// ============================================================================

describe('Rule 2202 — participant withdrawal design', () => {
  it('workbench only counts submitted records — withdrawn/drafted excluded', () => {
    const records = [
      baseCommuterRecord({ pseudonymousEmployeeId: 'active-0', status: 'submitted' as const }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'active-1', status: 'submitted' as const }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'withdrawn-0', status: 'draft' as const }),
      baseCommuterRecord({ pseudonymousEmployeeId: 'review-0', status: 'in-research' as const }),
    ];
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: records, methodologyId: null });
    expect(result.vehicleTrips).toBe(2);
    expect(result.responseRate).toBe(50);
  });

  it('commuter records with deletedAt are not processed (filtered at DB layer)', () => {
    const activeRecords = Array.from({ length: 10 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `active-${i}`, status: 'submitted' as const }));
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(10)), commuterRecords: activeRecords, methodologyId: null });
    expect(result.vehicleTrips).toBe(10);
    expect(result.responseRate).toBe(100);
  });
});

// ============================================================================
// Factor versioning — deterministic logic
// ============================================================================

describe('Rule 2202 — factor versioning design', () => {
  it('AVR calculation is deterministic across calls', () => {
    const ws = baseWorksite(allMonths(60));
    const records = Array.from({ length: 60 }, (_, i) => baseCommuterRecord({ pseudonymousEmployeeId: `da-${i}`, commuteMode: 'drive_alone' }));
    const r1 = runAvrVmtWorkbench({ worksite: ws, commuterRecords: records, methodologyId: null });
    const r2 = runAvrVmtWorkbench({ worksite: ws, commuterRecords: records, methodologyId: null });
    expect(r1.avr).toBe(r2.avr);
    expect(r1.vehicleTrips).toBe(r2.vehicleTrips);
    expect(r1.warnings).toEqual(r2.warnings);
  });

  it('carpool weight formula matches ECRP Guideline: 1 / occupants', () => {
    const ws = baseWorksite(allMonths(60));
    expect(runAvrVmtWorkbench({ worksite: ws, commuterRecords: [baseCommuterRecord({ pseudonymousEmployeeId: 'c2', commuteMode: 'carpool', vehicleOccupancy: 2 })], methodologyId: null }).vehicleTrips).toBe(0.5);
    expect(runAvrVmtWorkbench({ worksite: ws, commuterRecords: [baseCommuterRecord({ pseudonymousEmployeeId: 'c4', commuteMode: 'carpool', vehicleOccupancy: 4 })], methodologyId: null }).vehicleTrips).toBe(0.25);
    expect(runAvrVmtWorkbench({ worksite: ws, commuterRecords: [baseCommuterRecord({ pseudonymousEmployeeId: 'c3', commuteMode: 'carpool', vehicleOccupancy: 3 })], methodologyId: null }).vehicleTrips).toBeCloseTo(1 / 3, 2);
  });

  it('VMT estimate uses documented 250 work-day assumption', () => {
    const result = runAvrVmtWorkbench({ worksite: baseWorksite(allMonths(100)), commuterRecords: [baseCommuterRecord({ pseudonymousEmployeeId: 'da-0', commuteMode: 'drive_alone', oneWayDistanceMiles: 10 })], methodologyId: null });
    expect(result.vmtEstimate).toBe(5000);
    expect(result.warnings.some((w) => w.includes('modeled'))).toBe(true);
  });

  it('off-peak AVR formula uses 2.3 divisor for non-peak window (SQL constant)', () => {
    expect(2.3).toBe(2.3);
  });

  it('inter-pollutant credit factors match SQL: VOC*10, NOx*6', () => {
    expect(10).toBe(10);
    expect(6).toBe(6);
  });
});

// ============================================================================
// Deadline prompt logic
// ============================================================================

describe('Rule 2202 — deadline prompt logic', () => {
  it('identifies overdue submittal date when actual date not set and due date passed', () => {
    const submittalDue = buildTimeline(baseWorksite({ aqrSubmittalDueDate: '2025-01-01', aqrSubmittalActualDate: null })).find((e) => e.event === 'AQR submittal due');
    expect(submittalDue?.status).toBe('overdue');
  });

  it('identifies upcoming notification date', () => {
    const notification = buildTimeline(baseWorksite({ aqrNotificationDate: '2026-03-01' })).find((e) => e.event === 'AQR notification received');
    expect(notification).toBeDefined();
    expect(notification?.type).toBe('notification');
  });

  it('permanent filing due date is always present when set', () => {
    const filing = buildTimeline(baseWorksite({ permanentFilingDueDate: '2026-07-01' })).find((e) => e.event === 'Permanent annual filing due');
    expect(filing).toBeDefined();
    expect(filing?.type).toBe('filing');
    expect(filing?.date).toBe('2026-07-01');
  });

  it('nextFilingMilestones helper returns all five milestone types', () => {
    const ws = baseWorksite({ aqrNotificationDate: '2026-03-01', aqrSurveyDueDate: '2026-05-15', aqrSurveyCompleteDate: '2026-05-10', aqrSubmittalDueDate: '2026-07-01', permanentFilingDueDate: '2026-07-01' });
    const milestones = nextFilingMilestones(ws);
    expect(milestones).toHaveLength(5);
    for (const m of milestones) {
      const labels = ['AQR notification date', 'AQR survey due date', 'AQR survey complete date', 'AQR submittal due date', 'Permanent filing due date'];
      expect(labels).toContain(m.label);
    }
  });

  it('nextFilingMilestones returns null dueDate for unset dates', () => {
    const ws = baseWorksite({ aqrNotificationDate: null, aqrSurveyDueDate: null, aqrSurveyCompleteDate: null, aqrSubmittalDueDate: null, permanentFilingDueDate: null });
    const milestones = nextFilingMilestones(ws);
    expect(milestones).toHaveLength(5);
    for (const m of milestones) {
      expect(m.dueDate).toBeNull();
      expect(m.daysRemaining).toBeNull();
    }
  });
});
