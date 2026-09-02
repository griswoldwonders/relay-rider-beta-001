// ============================================================================
// Supabase client for relay-rider-beta-001
// Rule 2202 domain model + existing security_foundation + calculation_functions
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Rule2202Worksite,
  CommuterResearchRecord,
  Rule2202Methodology,
  Rule2202CalculationResult,
} from '../types';

// ---- env-gated client ----

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null =
  isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
      })
    : null;

// ---- typed helpers ----

/** Map Supabase snake_case row to Rule2202Worksite camelCase domain object. */
export function worksiteFromRow(row: Record<string, unknown>): Rule2202Worksite {
  return {
    id: String(row.id ?? ''),
    institutionId: String(row.institution_id ?? ''),
    worksiteName: String(row.worksite_name ?? ''),
    sixDigitWorksiteId: row.six_digit_worksite_id as string | null,
    employerName: String(row.employer_name ?? ''),
    facilityDescription: row.facility_description as string | null,
    streetAddress: row.street_address as string | null,
    city: row.city as string | null,
    state: String(row.state ?? 'CA'),
    zipCode: row.zip_code as string | null,
    performanceZone: row.performance_zone as number | null,
    performanceZoneSource: row.performance_zone_source as string | null,
    performanceZoneVerifiedAt: row.performance_zone_verified_at as string | null,
    reportingMethod: row.reporting_method as Rule2202Worksite['reportingMethod'],
    reportingPeriodStart: row.reporting_period_start as string | null,
    reportingPeriodEnd: row.reporting_period_end as string | null,
    employeeCountMonth1: row.employee_count_month_1 as number | null,
    employeeCountMonth2: row.employee_count_month_2 as number | null,
    employeeCountMonth3: row.employee_count_month_3 as number | null,
    employeeCountMonth4: row.employee_count_month_4 as number | null,
    employeeCountMonth5: row.employee_count_month_5 as number | null,
    employeeCountMonth6: row.employee_count_month_6 as number | null,
    employeeCountNotes: row.employee_count_notes as string | null,
    aqrNotificationDate: row.aqr_notification_date as string | null,
    aqrSurveyDueDate: row.aqr_survey_due_date as string | null,
    aqrSurveyCompleteDate: row.aqr_survey_complete_date as string | null,
    aqrSubmittalDueDate: row.aqr_submittal_due_date as string | null,
    aqrSubmittalActualDate: row.aqr_submittal_actual_date as string | null,
    permanentFilingDueDate: row.permanent_filing_due_date as string | null,
    filingFeeVersion: row.filing_fee_version as string | null,
    businessClassification: row.business_classification as Rule2202Worksite['businessClassification'],
    ecrpCandidateZone: row.ecrp_candidate_zone as number | null,
    ecrpCandidateETC: row.ecrp_candidate_e_t_c as string | null,
    ecrpCandidateETCVerifiedAt: row.ecrp_candidate_e_t_c_verified_at as string | null,
    ecrpCandidateNotes: row.ecrp_candidate_notes as string | null,
    sourceDocumentType: row.source_document_type as string | null,
    sourceDocumentReference: row.source_document_reference as string | null,
    sourceDocumentDate: row.source_document_date as string | null,
    sourceUrl: row.source_url as string | null,
    sourceNotes: row.source_notes as string | null,
    reviewState: row.review_state as Rule2202Worksite['reviewState'],
    dataCompletenessNotes: row.data_completeness_notes as string | null,
    validationErrors: (row.validation_errors as unknown) as Rule2202Worksite['validationErrors'],
    reviewStartedAt: row.review_started_at as string | null,
    reviewedBy: row.reviewed_by as string | null,
    reviewedAt: row.reviewed_at as string | null,
    reviewDecision: row.review_decision as string | null,
    reviewDecisionAt: row.review_decision_at as string | null,
    filingStatus: row.filing_status as Rule2202Worksite['filingStatus'],
    feeVerified: Boolean(row.fee_verified),
    feeExpected: row.fee_expected as number | null,
    feeSubmitted: row.fee_submitted as number | null,
    feeVerificationSource: row.fee_verification_source as string | null,
    feeVerifiedBy: row.fee_verified_by as string | null,
    feeVerifiedAt: row.fee_verified_at as string | null,
    requiredForms: (row.required_forms as unknown) as string[],
    completenessNotes: row.completeness_notes as string | null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    createdBy: row.created_by as string | null,
    updatedBy: row.updated_by as string | null,
    deletedAt: row.deleted_at as string | null,
  };
}

/** Map Supabase snake_case row to CommuterResearchRecord camelCase domain object. */
export function commuterRecordFromRow(row: Record<string, unknown>): CommuterResearchRecord {
  return {
    id: String(row.id ?? ''),
    institutionId: String(row.institution_id ?? ''),
    worksiteId: String(row.worksite_id ?? ''),
    pseudonymousEmployeeId: String(row.pseudonymous_employee_id ?? ''),
    approximateOriginZone: row.approximate_origin_zone as string | null,
    approximateDestinationZone: row.approximate_destination_zone as string | null,
    arrivalWindowStart: row.arrival_window_start as string | null,
    arrivalWindowEnd: row.arrival_window_end as string | null,
    departureWindowStart: row.departure_window_start as string | null,
    departureWindowEnd: row.departure_window_end as string | null,
    commuteMode: row.commute_mode as CommuterResearchRecord['commuteMode'],
    commuteModeSource: row.commute_mode_source as string | null,
    vehicleOccupancy: row.vehicle_occupancy as number | null,
    telecommuteDaysPerWeek: row.telecommute_days_per_week as number | null,
    oneWayDistanceMiles: row.one_way_distance_miles as number | null,
    distanceSource: row.distance_source as CommuterResearchRecord['distanceSource'],
    vehicleClass: row.vehicle_class as CommuterResearchRecord['vehicleClass'],
    vehicleMake: row.vehicle_make as string | null,
    vehicleModel: row.vehicle_model as string | null,
    vehicleYear: row.vehicle_year as string | null,
    evHybridParticipation: Boolean(row.ev_hybrid_participation),
    interestedInEvRoute: Boolean(row.interested_in_ev_route),
    interestedInCarpoolRoute: Boolean(row.interested_in_carpool_route),
    interestedInTransitOption: Boolean(row.interested_in_transit_option),
    routeInterestNotes: row.route_interest_notes as string | null,
    surveyPeriodStart: row.survey_period_start as string | null,
    surveyPeriodEnd: row.survey_period_end as string | null,
    responseReceivedAt: row.response_received_at as string | null,
    sourceTemplateVersion: row.source_template_version as string | null,
    sourceImportBatchId: row.source_import_batch_id as string | null,
    status: String(row.status ?? 'submitted'),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    createdBy: row.created_by as string | null,
    updatedBy: row.updated_by as string | null,
    deletedAt: row.deleted_at as string | null,
  };
}

/** Map Supabase snake_case row to Rule2202Methodology domain object. */
export function methodologyFromRow(row: Record<string, unknown>): Rule2202Methodology {
  return {
    id: String(row.id ?? ''),
    institutionId: String(row.institution_id ?? ''),
    methodologyName: String(row.methodology_name ?? ''),
    methodologyType: String(row.methodology_type ?? ''),
    metricType: row.metric_type as Rule2202Methodology['metricType'],
    applicablePollutants: (row.applicable_pollutants as unknown) as string[],
    factorYear: row.factor_year as number | null,
    sourceName: row.source_name as string | null,
    sourceUrl: row.source_url as string | null,
    sourcePublicationDate: row.source_publication_date as string | null,
    formulaText: row.formula_text as string | null,
    resultUnits: String(row.result_units ?? 'lbs/year'),
    assumptions: (row.assumptions as unknown) as string[],
    isActive: Boolean(row.is_active),
    version: String(row.version ?? '1.0.0'),
    supersedesMethodologyId: row.supersedes_methodology_id as string | null,
    createdAt: String(row.created_at ?? ''),
    createdBy: row.created_by as string | null,
    updatedAt: String(row.updated_at ?? ''),
    updatedBy: row.updated_by as string | null,
    deletedAt: row.deleted_at as string | null,
  };
}
