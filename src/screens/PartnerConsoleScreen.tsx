import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ClipboardCheck,
  FileWarning,
  Gauge,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Layers,
  Loader2,
} from 'lucide-react';
import type { Rule2202Worksite, CommuterResearchRecord } from '../types';
import {
  assessApplicability,
  buildTimeline,
  runAvrVmtWorkbench,
  assessEcrpReadiness,
  collectExceptions,
  buildAuditHistory,
  buildReviewPacket,
  type ApplicabilityReview,
  type TimelineEntry,
  type AvrVmtWorkbenchResult,
  type EcrpReadiness,
  type ExceptionEntry,
  type AuditEntry,
  type ReviewPacket,
} from '../lib/rule2202-evidence-workflow';
import { usePartnerConsole, type PartnerConsoleState } from './PartnerConsoleContext';

// ---- Built-in mock fixtures (fallback when Supabase is not configured) ----

function makeMockWorksite(): Rule2202Worksite {
  return {
    id: 'ws-001',
    institutionId: 'inst-001',
    worksiteName: 'Pasadena Corporate Campus — Building A',
    sixDigitWorksiteId: '123456',
    employerName: 'Pasadena Technology Group',
    facilityDescription: 'Main office building, 4 floors, ~850 employees',
    streetAddress: '123 East Colorado Boulevard',
    city: 'Pasadena',
    state: 'CA',
    zipCode: '91101',
    performanceZone: 2,
    performanceZoneSource: 'AQMD GIS lookup 2026',
    performanceZoneVerifiedAt: '2026-07-15T00:00:00Z',
    reportingMethod: 'survey_avr',
    reportingPeriodStart: '2026-01-01',
    reportingPeriodEnd: '2026-06-30',
    employeeCountMonth1: 840,
    employeeCountMonth2: 845,
    employeeCountMonth3: 850,
    employeeCountMonth4: 838,
    employeeCountMonth5: 852,
    employeeCountMonth6: 847,
    employeeCountNotes: 'Headcount based on payroll records',
    aqrNotificationDate: '2026-03-01',
    aqrSurveyDueDate: '2026-05-15',
    aqrSurveyCompleteDate: '2026-05-10',
    aqrSubmittalDueDate: '2026-07-01',
    aqrSubmittalActualDate: null,
    permanentFilingDueDate: '2026-07-01',
    filingFeeVersion: '2026-07-01',
    businessClassification: 'commercial',
    ecrpCandidateZone: 2,
    ecrpCandidateETC: 'Maria Ortiz, Relay Rider Program',
    ecrpCandidateETCVerifiedAt: '2026-06-20T00:00:00Z',
    ecrpCandidateNotes: 'ETC verified via institutional appointment letter',
    sourceDocumentType: 'AQMD Rule 2202 Application',
    sourceDocumentReference: 'AQMD-2026-0042',
    sourceDocumentDate: '2026-03-01',
    sourceUrl: null,
    sourceNotes: 'Original application filed with SCAQMD',
    reviewState: 'ready_for_review',
    dataCompletenessNotes: 'All required fields populated',
    validationErrors: [],
    reviewStartedAt: '2026-06-20T00:00:00Z',
    reviewedBy: null,
    reviewedAt: null,
    reviewDecision: null,
    reviewDecisionAt: null,
    filingStatus: 'ready_for_review',
    feeVerified: true,
    feeExpected: 250,
    feeSubmitted: 250,
    feeVerificationSource: 'AQMD fee schedule effective 2026-07-01',
    feeVerifiedBy: null,
    feeVerifiedAt: '2026-06-25T00:00:00Z',
    requiredForms: ['Rule 2202 Application', 'Worksite Information Form'],
    completenessNotes: 'All required forms and fee verified',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-06-25T00:00:00Z',
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
  };
}

function makeMockRecords(): CommuterResearchRecord[] {
  return [
    {
      id: 'cr-001',
      institutionId: 'inst-001',
      worksiteId: 'ws-001',
      pseudonymousEmployeeId: 'emp-a1',
      approximateOriginZone: 'Pasadena - East',
      approximateDestinationZone: 'Pasadena - Central',
      arrivalWindowStart: '08:00',
      arrivalWindowEnd: '09:00',
      departureWindowStart: '17:00',
      departureWindowEnd: '18:00',
      commuteMode: 'drive_alone',
      commuteModeSource: 'survey',
      vehicleOccupancy: 1,
      telecommuteDaysPerWeek: 1,
      oneWayDistanceMiles: 8.5,
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
    },
    {
      id: 'cr-002',
      institutionId: 'inst-001',
      worksiteId: 'ws-001',
      pseudonymousEmployeeId: 'emp-b2',
      approximateOriginZone: 'Altadena',
      approximateDestinationZone: 'Pasadena - Central',
      arrivalWindowStart: '07:30',
      arrivalWindowEnd: '08:30',
      departureWindowStart: '16:30',
      departureWindowEnd: '17:30',
      commuteMode: 'carpool',
      commuteModeSource: 'survey',
      vehicleOccupancy: 3,
      telecommuteDaysPerWeek: 0,
      oneWayDistanceMiles: 6.2,
      distanceSource: 'self_reported',
      vehicleClass: 'gasoline_diesel',
      vehicleMake: null,
      vehicleModel: null,
      vehicleYear: null,
      evHybridParticipation: false,
      interestedInEvRoute: false,
      interestedInCarpoolRoute: true,
      interestedInTransitOption: false,
      routeInterestNotes: null,
      surveyPeriodStart: '2026-04-01',
      surveyPeriodEnd: '2026-05-10',
      responseReceivedAt: '2026-04-18T00:00:00Z',
      sourceTemplateVersion: '1.0',
      sourceImportBatchId: null,
      status: 'submitted',
      createdAt: '2026-04-18T00:00:00Z',
      updatedAt: '2026-04-18T00:00:00Z',
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
    },
    {
      id: 'cr-003',
      institutionId: 'inst-001',
      worksiteId: 'ws-001',
      pseudonymousEmployeeId: 'emp-c3',
      approximateOriginZone: 'South Pasadena',
      approximateDestinationZone: 'Pasadena - Central',
      arrivalWindowStart: '08:00',
      arrivalWindowEnd: '09:00',
      departureWindowStart: '17:00',
      departureWindowEnd: '18:00',
      commuteMode: 'transit',
      commuteModeSource: 'survey',
      vehicleOccupancy: null,
      telecommuteDaysPerWeek: 0,
      oneWayDistanceMiles: 4.1,
      distanceSource: 'self_reported',
      vehicleClass: 'no_vehicle',
      vehicleMake: null,
      vehicleModel: null,
      vehicleYear: null,
      evHybridParticipation: false,
      interestedInEvRoute: false,
      interestedInCarpoolRoute: false,
      interestedInTransitOption: true,
      routeInterestNotes: null,
      surveyPeriodStart: '2026-04-01',
      surveyPeriodEnd: '2026-05-10',
      responseReceivedAt: '2026-04-20T00:00:00Z',
      sourceTemplateVersion: '1.0',
      sourceImportBatchId: null,
      status: 'submitted',
      createdAt: '2026-04-20T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
    },
    {
      id: 'cr-004',
      institutionId: 'inst-001',
      worksiteId: 'ws-001',
      pseudonymousEmployeeId: 'emp-d4',
      approximateOriginZone: 'San Marino',
      approximateDestinationZone: 'Pasadena - Central',
      arrivalWindowStart: '08:00',
      arrivalWindowEnd: '09:00',
      departureWindowStart: '17:00',
      departureWindowEnd: '18:00',
      commuteMode: 'telecommute',
      commuteModeSource: 'survey',
      vehicleOccupancy: null,
      telecommuteDaysPerWeek: 3,
      oneWayDistanceMiles: 5.0,
      distanceSource: 'self_reported',
      vehicleClass: 'bev',
      vehicleMake: 'Tesla',
      vehicleModel: 'Model 3',
      vehicleYear: '2023',
      evHybridParticipation: true,
      interestedInEvRoute: true,
      interestedInCarpoolRoute: false,
      interestedInTransitOption: false,
      routeInterestNotes: 'Interested in workplace charging',
      surveyPeriodStart: '2026-04-01',
      surveyPeriodEnd: '2026-05-10',
      responseReceivedAt: '2026-04-22T00:00:00Z',
      sourceTemplateVersion: '1.0',
      sourceImportBatchId: null,
      status: 'submitted',
      createdAt: '2026-04-22T00:00:00Z',
      updatedAt: '2026-04-22T00:00:00Z',
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
    },
    {
      id: 'cr-005',
      institutionId: 'inst-001',
      worksiteId: 'ws-001',
      pseudonymousEmployeeId: 'emp-e5',
      approximateOriginZone: 'Arcadia',
      approximateDestinationZone: 'Pasadena - Central',
      arrivalWindowStart: '08:30',
      arrivalWindowEnd: '09:30',
      departureWindowStart: '17:30',
      departureWindowEnd: '18:30',
      commuteMode: 'vanpool',
      commuteModeSource: 'survey',
      vehicleOccupancy: 10,
      telecommuteDaysPerWeek: 0,
      oneWayDistanceMiles: 12.0,
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
      responseReceivedAt: '2026-04-25T00:00:00Z',
      sourceTemplateVersion: '1.0',
      sourceImportBatchId: null,
      status: 'submitted',
      createdAt: '2026-04-25T00:00:00Z',
      updatedAt: '2026-04-25T00:00:00Z',
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
    },
  ];
}

// ---- UI helpers ----

function StatusBadge({ status, color }: { status: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

function EmptyNote({ message }: { message: string }) {
  return (
    <div className="partner-empty-note !border !border-dashed !border-[rgba(15,41,64,.2)] !bg-[rgba(15,41,64,.03)] !px-4 !py-3 !text-sm">
      {message}
    </div>
  );
}

function DataSourcePill({ state }: { state: PartnerConsoleState }) {
  if (state.dataSource === 'mock') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[rgba(15,41,64,.5)]">
        <Sparkles size={12} />
        demonstration mode (no live data)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700">
      <ShieldCheck size={12} />
      live data ({state.worksites.length} worksites)
    </span>
  );
}

// ---- Overview panel (applicability review) ----

function OverviewPanel({
  worksite,
  applicability,
}: {
  worksite: Rule2202Worksite;
  applicability: ApplicabilityReview;
}) {
  const monthsReported = [1, 2, 3, 4, 5, 6].filter((m) => {
    const key = `employeeCountMonth${m}` as keyof Rule2202Worksite;
    const val = worksite[key];
    return val !== null && val !== undefined;
  }).length;

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Applicability review</span>
          <h2>{worksite.worksiteName}</h2>
        </div>
        <ShieldCheck size={18} />
      </div>

      <div className="grid gap-4 mt-4">
        <div className="flex items-start gap-3">
          <MapPin size={18} className="mt-0.5 shrink-0 text-[rgba(15,41,64,.5)]" />
          <div>
            <p className="font-medium">{worksite.employerName}</p>
            <p className="text-sm text-[rgba(15,41,64,.6)]">
              {worksite.streetAddress && `${worksite.streetAddress}, `}
              {worksite.city || '—'}, {worksite.state || 'CA'}
              {worksite.zipCode ? ` ${worksite.zipCode}` : ''}
            </p>
            {worksite.sixDigitWorksiteId && (
              <p className="text-xs text-[rgba(15,41,64,.4)] mt-0.5">
                Worksite ID: {worksite.sixDigitWorksiteId}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Reporting method</p>
            <p className="mt-0.5 font-medium">
              {worksite.reportingMethod === 'not_determined' ? 'Not determined' : worksite.reportingMethod?.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Business classification</p>
            <p className="mt-0.5 font-medium">
              {worksite.businessClassification?.replace(/_/g, ' ') || 'Other (unclassified)'}
            </p>
          </div>
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Performance zone</p>
            <p className="mt-0.5 font-medium">
              {worksite.performanceZone ? `Zone ${worksite.performanceZone}` : 'Not assigned'}
              {worksite.performanceZone && worksite.performanceZoneSource
                ? ` · ${worksite.performanceZoneSource}`
                : ''}
            </p>
          </div>
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Employee count</p>
            <p className="mt-0.5 font-medium">
              {monthsReported > 0
                ? `${monthsReported} months reported`
                : 'No monthly counts'}
            </p>
          </div>
        </div>

        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-4">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-2">Applicability assessment</p>
          <div className="flex items-start gap-2">
            {applicability.isSubjectToRule2202 === true ? (
              <CheckCircle2 size={16} className="shrink-0 text-green-700 mt-0.5" />
            ) : applicability.isSubjectToRule2202 === false ? (
              <FileWarning size={16} className="shrink-0 text-amber-700 mt-0.5" />
            ) : (
              <Gauge size={16} className="shrink-0 text-[rgba(15,41,64,.5)] mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm">
                {applicability.isSubjectToRule2202 === true
                  ? 'Likely subject to Rule 2202'
                  : applicability.isSubjectToRule2202 === false
                  ? 'Not clearly subject to Rule 2202'
                  : 'Insufficient data to determine'}
              </p>
              {applicability.reason.length > 0 && (
                <ul className="mt-1 text-xs text-[rgba(15,41,64,.7)] list-disc list-inside">
                  {applicability.reason.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {applicability.missingInformation.length > 0 && (
          <div className="bg-red-50 !rounded-lg !p-3 border !border-red-200">
            <p className="text-xs font-medium text-red-800 mb-1">Missing information</p>
            <ul className="text-xs text-red-700 list-disc list-inside">
              {applicability.missingInformation.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-1">Recommended next step</p>
          <p className="text-sm font-medium">{applicability.recommendedNextStep}</p>
        </div>
      </div>
    </section>
  );
}

// ---- Timeline panel ----

function TimelinePanel({ entries }: { entries: TimelineEntry[] }) {
  const typeColors: Record<string, string> = {
    notification: 'bg-blue-100 text-blue-800',
    survey: 'bg-purple-100 text-purple-800',
    submittal: 'bg-amber-100 text-amber-800',
    filing: 'bg-green-100 text-green-800',
    review: 'bg-indigo-100 text-indigo-800',
    milestone: 'bg-gray-100 text-gray-800',
  };

  const statusIcons: Record<TimelineEntry['status'], React.ReactElement> = {
    completed: <CheckCircle2 size={14} className="text-green-600 shrink-0" />,
    current: <Clock size={14} className="text-blue-600 shrink-0" />,
    overdue: <AlertCircle size={14} className="text-red-600 shrink-0" />,
    upcoming: <Clock size={14} className="text-amber-600 shrink-0" />,
  };

  if (entries.length === 0) {
    return <section className="partner-panel !bg-white"><EmptyNote message="No timeline entries available." /></section>;
  }

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Notification, survey & filing timeline</span>
          <h2>Regulatory timeline</h2>
        </div>
        <Calendar size={18} />
      </div>
      <div className="mt-5 space-y-3">
        {entries.map((entry) => (
          <div key={entry.date + entry.event} className="flex gap-3">
            <div className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium ${typeColors[entry.type] || 'bg-gray-100 text-gray-800'}`}>
              {entry.type === 'notification' ? 'N' : entry.type === 'survey' ? 'S' : entry.type === 'submittal' ? 'SB' : entry.type === 'filing' ? 'F' : entry.type === 'review' ? 'R' : 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{entry.event}</p>
              <p className="text-xs text-[rgba(15,41,64,.6)] mt-0.5">
                {entry.date ? `${new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No date'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {statusIcons[entry.status]}
                <span className={`text-xs capitalize ${entry.status === 'overdue' ? 'text-red-700 font-medium' : entry.status === 'upcoming' ? 'text-amber-700' : 'text-[rgba(15,41,64,.6)]'}`}>
                  {entry.status}
                </span>
                {entry.notes && <span className="text-xs text-[rgba(15,41,64,.5)]">· {entry.notes}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- AVR/VMT workbench panel ----

function AvrVmtWorkbenchPanel({ result }: { result: AvrVmtWorkbenchResult | null }) {
  if (!result) {
    return <section className="partner-panel !bg-white"><EmptyNote message="No AVR/VMT calculation result available." /></section>;
  }

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Average Vehicle Ridership & VMT</span>
          <h2>AVR / VMT workbench</h2>
        </div>
        <BarChart3 size={18} />
      </div>
      <div className="mt-5 grid gap-4">
        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-4">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-2">Average Vehicle Ridership (AVR)</p>
          <div className="flex items-baseline gap-2">
            <Gauge size={24} className="text-[rgba(15,41,64,.4)]" />
            <span className="text-2xl font-semibold">{result.avr !== null ? result.avr.toFixed(2) : '—'}</span>
            <span className="text-sm text-[rgba(15,41,64,.6)]">AVR</span>
          </div>
          <p className="text-xs text-[rgba(15,41,64,.5)] mt-1">
            {result.avr !== null && result.avr < 1.5
              ? 'AVR ≤ 1.50 (Zone 1 threshold)'
              : result.avr !== null && result.avr < 1.75
              ? 'AVR ≤ 1.75 (Zone 2 threshold)'
              : result.avr !== null && result.avr < 2.0
              ? 'AVR ≤ 2.00 (Zone 3 threshold)'
              : result.avr !== null
              ? 'AVR exceeds zone threshold — review required'
              : 'Performance zone not assigned or AVR not calculated'}
          </p>
        </div>

        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-4">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-2">Vehicle Trips (weighted)</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[rgba(15,41,64,.5)]">Total vehicle trips</p>
              <p className="text-lg font-semibold">{result.vehicleTrips.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-[rgba(15,41,64,.5)]">Employees (avg)</p>
              <p className="text-lg font-semibold">{result.employees}</p>
            </div>
          </div>
        </div>

        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-4">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-2">Response rate</p>
          <div className="flex items-baseline gap-2">
            <Gauge size={24} className="text-[rgba(15,41,64,.4)]" />
            <span className="text-2xl font-semibold">{result.responseRate !== null ? `${result.responseRate.toFixed(1)}%` : '—'}</span>
            <span className="text-sm text-[rgba(15,41,64,.6)]">of commuter records submitted</span>
          </div>
          {result.surveyValid.reason && (
            <p className="text-xs text-amber-700 mt-1">{result.surveyValid.reason}</p>
          )}
        </div>

        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-4">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-2">VMT Estimate</p>
          <div className="flex items-baseline gap-2">
            <MapPin size={24} className="text-[rgba(15,41,64,.4)]" />
            <span className="text-2xl font-semibold">{result.vmtEstimate !== null ? result.vmtEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</span>
            <span className="text-sm text-[rgba(15,41,64,.6)]">vehicle-miles/year reduced</span>
          </div>
          <p className="text-xs text-[rgba(15,41,64,.5)] mt-1">{result.vmtLabel}</p>
        </div>

        {result.warnings.length > 0 && (
          <div className="bg-amber-50 !rounded-lg !p-3 border !border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-1">Calculation notes</p>
            <ul className="text-xs text-amber-700 list-disc list-inside">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {result.missingInputs.length > 0 && (
          <div className="bg-red-50 !rounded-lg !p-3 border !border-red-200">
            <p className="text-xs font-medium text-red-800 mb-1">Missing inputs</p>
            <ul className="text-xs text-red-700 list-disc list-inside">
              {result.missingInputs.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ---- ECRP readiness panel ----

function EcrpReadinessPanel({ readiness }: { readiness: EcrpReadiness | null }) {
  if (!readiness) {
    return <section className="partner-panel !bg-white"><EmptyNote message="No ECRP readiness assessment available." /></section>;
  }

  const levelColor = readiness.readinessLevel === 'candidate_ready' ? 'text-green-700 bg-green-100' : readiness.readinessLevel === 'candidate_unready' ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-100';
  const levelLabel = readiness.readinessLevel === 'candidate_ready' ? 'Candidate ready' : readiness.readinessLevel === 'candidate_unready' ? 'Partially ready' : 'Not ready';

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Employer-Based Commuter Choice Program</span>
          <h2>ECRP readiness</h2>
        </div>
        <Layers size={18} />
      </div>
      <div className="mt-5 grid gap-4">
        <div className={`!rounded-lg !p-4 ${levelColor.split(' ')[0]} ${levelColor.split(' ').slice(1).join(' ')}`}>
          <p className="text-xs uppercase tracking-wide mb-1">Readiness level</p>
          <p className="text-lg font-semibold">{levelLabel}</p>
        </div>

        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-4">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-2">ECRP Candidate Zone</p>
          <div className="text-sm">
            <p>Zone {readiness.ecrpZone || 'Not assigned'}</p>
            {readiness.etcName && (
              <p className="text-xs text-[rgba(15,41,64,.6)] mt-1">ETC: {readiness.etcName}</p>
            )}
            {readiness.etcAssigned && (
              <p className="text-xs text-green-700 mt-0.5">ETC verified</p>
            )}
          </div>
        </div>

        {readiness.missingForEcrp.length > 0 && (
          <div className="bg-amber-50 !rounded-lg !p-3 border !border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-1">Items to complete</p>
            <ul className="text-xs text-amber-700 list-disc list-inside">
              {readiness.missingForEcrp.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}

        {readiness.missingForEcrp.length === 0 && readiness.etcAssigned && (
          <div className="bg-green-50 !rounded-lg !p-3 border !border-green-200">
            <p className="text-xs font-medium text-green-800 mb-1">ECRP candidate status</p>
            <p className="text-xs text-green-700">Candidate zone assigned and ETC in place</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ---- Exceptions panel ----

function ExceptionsPanel({ exceptions }: { exceptions: ExceptionEntry[] }) {
  if (exceptions.length === 0) {
    return <section className="partner-panel !bg-white"><div className="!rounded-lg !p-4 bg-green-50 !border !border-green-200"><CheckCircle2 size={16} className="text-green-600 shrink-0" /><p className="text-sm text-green-800 ml-2">No exceptions flagged.</p></div></section>;
  }

  const bySeverity = exceptions.reduce((acc, e) => {
    if (!acc[e.severity]) acc[e.severity] = [];
    acc[e.severity].push(e);
    return acc;
  }, {} as Record<string, ExceptionEntry[]>);

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Data quality & compliance exceptions</span>
          <h2>Exceptions</h2>
        </div>
        <FileWarning size={18} />
      </div>
      <div className="mt-5 space-y-3">
        {Object.entries(bySeverity).map(([severity, items]) => (
          <div key={severity} className={`!rounded-lg !p-3 border ${severity === 'error' ? 'bg-red-50 !border-red-200' : severity === 'warning' ? 'bg-amber-50 !border-amber-200' : 'bg-blue-50 !border-blue-200'}`}>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: severity === 'error' ? '#dc2626' : severity === 'warning' ? '#d97706' : '#2563eb' }}>
              {severity} ({items.length})
            </p>
            <ul className="text-sm space-y-1">
              {items.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-xs font-medium capitalize shrink-0" style={{ color: severity === 'error' ? '#dc2626' : severity === 'warning' ? '#d97706' : '#2563eb' }}>{e.type}</span>
                  <span className="text-xs text-[rgba(15,41,64,.7)]">{e.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Audit history panel ----

function AuditHistoryPanel({ history }: { history: AuditEntry[] }) {
  if (history.length === 0) {
    return <section className="partner-panel !bg-white"><EmptyNote message="No audit history available." /></section>;
  }

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Audit history</span>
          <h2>Change log</h2>
        </div>
        <ClipboardCheck size={18} />
      </div>
      <div className="mt-5 space-y-2">
        {history.map((entry) => (
          <div key={entry.timestamp + entry.action} className="flex gap-3 !bg-[rgba(15,41,64,.02)] !rounded-lg !p-3">
            <div className="shrink-0 w-2 h-2 rounded-full bg-[rgba(15,41,64,.2)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{entry.action}</p>
              <p className="text-xs text-[rgba(15,41,64,.6)] mt-0.5">
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown time'}
                {entry.actor ? ` · by ${entry.actor}` : ''}
              </p>
              {entry.notes && <p className="text-xs text-[rgba(15,41,64,.5)] mt-1">{entry.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Review packet export panel ----

function ReviewPacketExportPanel({ packet }: { packet: ReviewPacket | null }) {
  if (!packet) {
    return <section className="partner-panel !bg-white"><EmptyNote message="No review packet available for export." /></section>;
  }

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Review packet for export</span>
          <h2>Export packet</h2>
        </div>
        <Download size={18} />
      </div>
      <div className="mt-5">
        <button
          type="button"
          className="!bg-[rgba(15,41,64,.9)] !text-white !rounded-lg !px-4 !py-2 !text-sm !font-medium hover:!bg-[rgba(15,41,64,1)] !border !border-[rgba(15,41,64,.3)]"
          onClick={() => {
            const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rule2202-packet-${packet.worksite.sixDigitWorksiteId || packet.worksite.id}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={16} className="inline mr-2" />
          Download review packet (JSON)
        </button>
      </div>
      <div className="mt-5 space-y-3">
        <div className="!bg-[rgba(15,41,64,.02)] !rounded-lg !p-3">
          <p className="text-sm font-medium">Worksite</p>
          <p className="text-xs text-[rgba(15,41,64,.6)] mt-0.5">{packet.worksite.worksiteName}</p>
        </div>
        <div className="!bg-[rgba(15,41,64,.02)] !rounded-lg !p-3">
          <p className="text-sm font-medium">Applicability</p>
          <p className="text-xs text-[rgba(15,41,64,.6)] mt-0.5">{packet.applicability.isSubjectToRule2202 === true ? 'Subject to Rule 2202' : packet.applicability.isSubjectToRule2202 === false ? 'Not subject' : 'Undetermined'}</p>
        </div>
        <div className="!bg-[rgba(15,41,64,.02)] !rounded-lg !p-3">
          <p className="text-sm font-medium">Workbench</p>
          <p className="text-xs text-[rgba(15,41,64,.5)] mt-0.5">
            AVR: {packet.workbench.avr !== null ? packet.workbench.avr.toFixed(2) : '—'} · 
            VMT reduced: {packet.workbench.vmtEstimate !== null ? packet.workbench.vmtEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'} vehicle-miles/year
          </p>
        </div>
        <div className="!bg-[rgba(15,41,64,.02)] !rounded-lg !p-3">
          <p className="text-sm font-medium">ECRP Readiness</p>
          <p className="text-xs text-[rgba(15,41,64,.6)] mt-0.5">{packet.ecrpReadiness.readinessLevel.replace(/_/g, ' ')}</p>
        </div>
        <div className="!bg-[rgba(15,41,64,.02)] !rounded-lg !p-3">
          <p className="text-sm font-medium">Exceptions</p>
          <p className="text-xs text-[rgba(15,41,64,.6)] mt-0.5">{packet.exceptions.filter(e => e.severity === 'error').length} errors, {packet.exceptions.filter(e => e.severity === 'warning').length} warnings</p>
        </div>
        <div className="!bg-[rgba(15,41,64,.02)] !rounded-lg !p-3">
          <p className="text-sm font-medium">Audit entries</p>
          <p className="text-xs text-[rgba(15,41,64,.6)] mt-0.5">{packet.auditHistory.length} event(s)</p>
        </div>
        <div className="!bg-[rgba(15,41,64,.02)] !rounded-lg !p-3">
          <p className="text-sm font-medium">Exported at</p>
          <p className="text-xs text-[rgba(15,41,64,.6)] mt-0.5">{new Date(packet.exportTimestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
    </section>
  );
}

// ---- Main screen ----

const navItems = [
  { id: 'overview', label: 'Overview', icon: MapPin },
  { id: 'timeline', label: 'Timeline', icon: Calendar },
  { id: 'workbench', label: 'AVR / VMT', icon: BarChart3 },
  { id: 'ecrp', label: 'ECRP', icon: Layers },
  { id: 'exceptions', label: 'Exceptions', icon: FileWarning },
  { id: 'audit', label: 'Audit', icon: ClipboardCheck },
  { id: 'packet', label: 'Export', icon: Download },
];

interface PartnerConsoleScreenProps {
  onBack: () => void;
}

export const PartnerConsoleScreen: React.FC<PartnerConsoleScreenProps> = ({ onBack }) => {
  const ctx = usePartnerConsole();
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingRefresh, setPendingRefresh] = useState(false);

  const worksite = ctx.state.selectedWorksite;
  const commuterRecords = ctx.state.commuterRecords;

  // Derived values — computed from whatever data source is loaded
  const applicability = useMemo(
    () => worksite ? assessApplicability(worksite) : null,
    [worksite]
  );

  const timeline = useMemo(
    () => worksite ? buildTimeline(worksite) : [],
    [worksite]
  );

  const workbenchResult = useMemo(
    () => worksite && commuterRecords.length > 0
      ? runAvrVmtWorkbench({ worksite, commuterRecords, methodologyId: null })
      : null,
    [worksite, commuterRecords]
  );

  const ecrpReadiness = useMemo(
    () => worksite ? assessEcrpReadiness(worksite) : null,
    [worksite]
  );

  const exceptions = useMemo(
    () => worksite ? collectExceptions(worksite) : [],
    [worksite]
  );

  const auditHistory = useMemo(
    () => worksite ? buildAuditHistory(worksite) : [],
    [worksite]
  );

  const reviewPacket = useMemo(
    () => worksite && commuterRecords.length > 0
      ? buildReviewPacket(worksite, commuterRecords)
      : null,
    [worksite, commuterRecords]
  );

  const handleLoadFromSupabase = async () => {
    setPendingRefresh(true);
    await ctx.refreshFromApi();
    setPendingRefresh(false);
    if (ctx.state.worksites.length > 0 && !ctx.state.selectedWorksite) {
      ctx.selectWorksiteById(ctx.state.worksites[0].id);
    }
  };

  // If no worksite is selected and no loading is happening, fall back to mock
  const effectiveWorksite = worksite ?? (ctx.state.loading ? null : makeMockWorksite());
  const effectiveRecords = commuterRecords.length > 0 ? commuterRecords : (worksite ? makeMockRecords() : []);

  // Re-derive using effective data when falling back to mock
  const finalApplicability = effectiveWorksite ? assessApplicability(effectiveWorksite) : null;
  const finalTimeline = effectiveWorksite ? buildTimeline(effectiveWorksite) : [];
  const finalWorkbench = effectiveWorksite && effectiveRecords.length > 0
    ? runAvrVmtWorkbench({ worksite: effectiveWorksite, commuterRecords: effectiveRecords, methodologyId: null })
    : null;
  const finalEcrp = effectiveWorksite ? assessEcrpReadiness(effectiveWorksite) : null;
  const finalExceptions = effectiveWorksite ? collectExceptions(effectiveWorksite) : [];
  const finalAudit = effectiveWorksite ? buildAuditHistory(effectiveWorksite) : [];
  const finalPacket = effectiveWorksite && effectiveRecords.length > 0
    ? buildReviewPacket(effectiveWorksite, effectiveRecords)
    : null;

  return (
    <div className="partner-workspace-shell">
      <div className="partner-workspace">
        <aside className="partner-sidebar">
          <div className="partner-sidebar__brand">
            <span className="partner-sidebar__mark"><ShieldCheck size={20} /></span>
            <span>RELAY<br />RIDER</span>
          </div>

          <nav aria-label="Rule 2202 evidence workflow">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={activeTab === item.id ? 'is-active' : ''}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={16} /> {item.label}
                </button>
              );
            })}
          </nav>

          <div className="partner-sidebar__foot">
            <DataSourcePill state={ctx.state} />
            <button
              type="button"
              className="mt-3 !px-0 text-xs text-[rgba(15,41,64,.5)] hover:!text-[rgba(15,41,64,.9)]"
              onClick={handleLoadFromSupabase}
              disabled={pendingRefresh || ctx.state.loading}
            >
              {pendingRefresh ? 'Loading…' : ctx.state.dataSource === 'supabase' ? 'Refresh' : 'Load from Supabase'}
            </button>
            <button type="button" className="mt-3 !px-0" onClick={onBack}>
              <ArrowLeft size={14} /> Back to commuter app
            </button>
          </div>
        </aside>

        <main className="partner-main">
          <header className="partner-topbar">
            <div>
              <span className="mobile-section-kicker">Rule 2202 VMT Export Assistant</span>
              <h1>
                {activeTab === 'overview'
                  ? 'Applicability review'
                  : navItems.find((item) => item.id === activeTab)?.label}
              </h1>
              <p>
                Evidence workflow for {effectiveWorksite?.employerName || '—'} — worksite {effectiveWorksite?.sixDigitWorksiteId || effectiveWorksite?.id || '—'}.
                {ctx.state.dataSource === 'mock' ? ' Values are demonstration data.' : ' All values are institution-scoped and reviewed before export.'}
              </p>
            </div>
            {effectiveWorksite && (
              <span className="partner-source-pill">
                <ShieldCheck size={14} />
                {effectiveWorksite.reviewState.replace(/_/g, ' ')}
              </span>
            )}
          </header>

          {ctx.state.loading && (
            <div className="flex items-center gap-2 mt-4 text-sm text-[rgba(15,41,64,.6)]">
              <Loader2 size={16} className="animate-spin" />
              Loading from Supabase…
            </div>
          )}

          {ctx.state.error && (
            <div className="mt-4 !bg-red-50 !rounded-lg !p-3 !border !border-red-200 text-sm text-red-800">
              <AlertCircle size={16} className="inline mr-2 shrink-0" />
              {ctx.state.error}
            </div>
          )}

          <div className="partner-content-grid">
            {activeTab === 'overview' && (
              <>
                <OverviewPanel worksite={effectiveWorksite!} applicability={finalApplicability!} />
                <section className="partner-panel mt-5">
                  <div className="mockup-section-heading">
                    <div>
                      <span className="mobile-section-kicker">Operating spine</span>
                      <h2>Evidence stages</h2>
                    </div>
                    <BarChart3 size={18} />
                  </div>
                  <table className="partner-table mt-2">
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>Capability</th>
                        <th>State</th>
                        <th>Evidence path</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Applicability</strong></td>
                        <td>Worksite classification, zone, reporting method</td>
                        <td>
                          <StatusBadge
                            status={effectiveWorksite && finalApplicability && finalApplicability.isSubjectToRule2202 !== null ? (finalApplicability.isSubjectToRule2202 ? 'subject' : 'not subject') : 'undetermined'}
                            color={effectiveWorksite && finalApplicability && finalApplicability.isSubjectToRule2202 === true ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                          />
                        </td>
                        <td>Worksite record → zone/source → classification → determination</td>
                      </tr>
                      <tr>
                        <td><strong>Timeline</strong></td>
                        <td>Notification, survey, submittal, filing dates</td>
                        <td>
                          <StatusBadge
                            status={finalTimeline.filter((e) => e.status === 'completed').length > 0 ? 'active' : 'waiting'}
                            color="bg-blue-100 text-blue-800"
                          />
                        </td>
                        <td>Date fields → status check → timeline entries</td>
                      </tr>
                      <tr>
                        <td><strong>AVR / VMT</strong></td>
                        <td>Deterministic calculation from survey records</td>
                        <td>
                          <StatusBadge
                            status={finalWorkbench && finalWorkbench.avr !== null ? 'calculated' : 'pending'}
                            color={finalWorkbench && finalWorkbench.avr !== null ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}
                          />
                        </td>
                        <td>Commuter records → weighted vehicle trips → AVR → VMT estimate</td>
                      </tr>
                      <tr>
                        <td><strong>ECRP</strong></td>
                        <td>Candidate zone, ETC assignment, readiness</td>
                        <td>
                          <StatusBadge
                            status={finalEcrp ? finalEcrp.readinessLevel : 'not_assessed'}
                            color={finalEcrp?.readinessLevel === 'candidate_ready' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                          />
                        </td>
                        <td>Worksite zone → ETC → verification → readiness level</td>
                      </tr>
                      <tr>
                        <td><strong>Exceptions</strong></td>
                        <td>Data quality, methodology, filing, fee, review</td>
                        <td>
                          <StatusBadge
                            status={`${finalExceptions.filter((e) => e.severity === 'error').length} errors`}
                            color={finalExceptions.some((e) => e.severity === 'error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}
                          />
                        </td>
                        <td>State checks → validation → exceptions list</td>
                      </tr>
                      <tr>
                        <td><strong>Export</strong></td>
                        <td>Review packet with full provenance</td>
                        <td>
                          <StatusBadge
                            status={finalWorkbench && finalWorkbench.avr !== null ? 'ready' : 'pending data'}
                            color={finalWorkbench && finalWorkbench.avr !== null ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}
                          />
                        </td>
                        <td>Aggregation → packet build → download</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              </>
            )}

            {activeTab === 'timeline' && <TimelinePanel entries={finalTimeline} />}
            {activeTab === 'workbench' && <AvrVmtWorkbenchPanel result={finalWorkbench} />}
            {activeTab === 'ecrp' && <EcrpReadinessPanel readiness={finalEcrp} />}
            {activeTab === 'exceptions' && <ExceptionsPanel exceptions={finalExceptions} />}
            {activeTab === 'audit' && <AuditHistoryPanel history={finalAudit} />}
            {activeTab === 'packet' && <ReviewPacketExportPanel packet={finalPacket} />}
          </div>
        </main>
      </div>
    </div>
  );
};
