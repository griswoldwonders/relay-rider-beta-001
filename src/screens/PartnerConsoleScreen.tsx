import React, { useMemo, useState } from 'react';
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

// ---- UI helpers ----

function StatusBadge({ status, color }: { status: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

function emptyNote(message: string) {
  return (
    <div className="partner-empty-note !border !border-dashed !border-[rgba(15,41,64,.2)] !bg-[rgba(15,41,64,.03)] !px-4 !py-3 !text-sm">
      {message}
    </div>
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
  const monthlyFields = [
    'employeeCountMonth1',
    'employeeCountMonth2',
    'employeeCountMonth3',
    'employeeCountMonth4',
    'employeeCountMonth5',
    'employeeCountMonth6',
  ] as const;

  // Access selected fields directly instead of via Record<string, unknown>
  const monthsReported = [1, 2, 3, 4, 5, 6].filter((m) => {
    const key = `employeeCountMonth${m}` as const;
    const val = (worksite as unknown as Record<string, number | null>)[key];
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

  const statusIcons = {
    upcoming: Clock,
    current: AlertCircle,
    completed: CheckCircle2,
    overdue: FileWarning,
  };

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Timeline</span>
          <h2>Filing and review timeline</h2>
        </div>
        <Calendar size={18} />
      </div>

      {entries.length === 0 ? (
        emptyNote('No timeline entries yet. Set notification, survey, submittal, or filing dates to populate the timeline.')
      ) : (
        <div className="mt-4 space-y-2">
          {entries.map((entry, i) => {
            const Icon = statusIcons[entry.status];
            return (
              <div key={i} className="flex items-start gap-3 !rounded-lg !bg-[rgba(15,41,64,.02)] !px-3 !py-2">
                <div className={`shrink-0 w-16 text-right text-xs font-mono text-[rgba(15,41,64,.6)]`}>
                  {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 !rounded ${typeColors[entry.type] || 'bg-gray-100 text-gray-700'}`}>
                      {entry.type}
                    </span>
                    <p className="text-sm font-medium truncate">{entry.event}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Icon size={12} className={`shrink-0 ${
                      entry.status === 'overdue' ? 'text-red-600' :
                      entry.status === 'completed' ? 'text-green-600' :
                      entry.status === 'current' ? 'text-amber-600' :
                      'text-[rgba(15,41,64,.4)]'
                    }`} />
                    <span className={`text-xs ${
                      entry.status === 'overdue' ? 'text-red-600 font-medium' :
                      entry.status === 'completed' ? 'text-green-700' :
                      entry.status === 'current' ? 'text-amber-700' :
                      'text-[rgba(15,41,64,.5)]'
                    }`}>
                      {entry.status}
                    </span>
                    {entry.notes && (
                      <span className="text-xs text-[rgba(15,41,64,.5)] truncate ml-2">{entry.notes}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---- AVR/VMT workbench panel ----

function AvrVmtWorkbenchPanel({
  result,
}: {
  result: AvrVmtWorkbenchResult;
}) {
  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">AVR / VMT workbench</span>
          <h2>Deterministic calculation preview</h2>
        </div>
        <BarChart3 size={18} />
      </div>

      <div className="grid gap-4 mt-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Employees</p>
            <p className="mt-1 text-xl font-bold text-[rgba(15,41,64,.8)]">
              {result.employees || '—'}
            </p>
          </div>
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Vehicle trips</p>
            <p className="mt-1 text-xl font-bold text-[rgba(15,41,64,.8)]">
              {result.vehicleTrips.toFixed(2)}
            </p>
          </div>
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Response rate</p>
            <p className="mt-1 text-xl font-bold text-[rgba(15,41,64,.8)]">
              {result.responseRate !== null ? `${result.responseRate}%` : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">AVR</p>
            <p className={`mt-1 text-2xl font-bold ${
              result.avr !== null
                ? result.avr >= 1.3
                  ? 'text-green-700'
                  : 'text-amber-700'
                : 'text-[rgba(15,41,64,.4)]'
            }`}>
              {result.avr !== null ? result.avr.toFixed(2) : 'Not calculated'}
            </p>
            {result.avr !== null && (
              <p className="text-xs text-[rgba(15,41,64,.5)] mt-0.5">
                vehicle trips weighted per Rule 2202 ECRP Guidelines
              </p>
            )}
          </div>
          <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">VMT estimate</p>
            <p className="mt-1 text-lg font-medium text-[rgba(15,41,64,.8)]">
              {result.vmtLabel}
            </p>
            <p className="text-[10px] text-amber-700 mt-1">Modeled estimate — not certified</p>
          </div>
        </div>

        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-2">Survey validity</p>
          <div className="flex items-center gap-2">
            {result.surveyValid.isValid ? (
              <CheckCircle2 size={14} className="text-green-700 shrink-0" />
            ) : (
              <FileWarning size={14} className="text-amber-700 shrink-0" />
            )}
            <span className="text-sm">
              {result.surveyValid.isValid
                ? 'Survey meets minimum validity thresholds'
                : result.surveyValid.reason || 'Not valid'}
            </span>
          </div>
        </div>

        {result.missingInputs.length > 0 && (
          <div className="bg-amber-50 !rounded-lg !p-3 border !border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-1">Missing inputs</p>
            <ul className="text-xs text-amber-700 list-disc list-inside">
              {result.missingInputs.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Calculation notes</p>
            {result.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[rgba(15,41,64,.7)] !bg-white !rounded !px-2 !py-1.5 border !border-[rgba(15,41,64,.08)]">
                <Sparkles size={12} className="shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---- ECRP readiness panel ----

function EcrpReadinessPanel({ readiness }: { readiness: EcrpReadiness }) {
  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">ECRP readiness</span>
          <h2>Employee Commuter Reduction Program</h2>
        </div>
        <Layers size={18} />
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2">
          {readiness.isEcrpCandidate ? (
            <CheckCircle2 size={16} className="text-green-700 shrink-0" />
          ) : (
            <Gauge size={16} className="text-[rgba(15,41,64,.5)] shrink-0" />
          )}
          <span className="text-sm font-medium">
            {readiness.isEcrpCandidate
              ? `ECRP candidate (Zone ${readiness.ecrpZone})`
              : 'Not designated as ECRP candidate'}
          </span>
        </div>

        {readiness.etcAssigned && (
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck size={14} className="text-green-700 shrink-0" />
            <span>ETC: {readiness.etcName} (verified)</span>
          </div>
        )}

        {readiness.missingForEcrp.length > 0 && (
          <div className="bg-amber-50 !rounded-lg !p-3 border !border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-1">Outstanding for ECRP readiness</p>
            <ul className="text-xs text-amber-700 list-disc list-inside">
              {readiness.missingForEcrp.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)] mb-1">Readiness level</p>
          <p className="font-medium capitalize">{readiness.readinessLevel.replace(/_/g, ' ')}</p>
        </div>
      </div>
    </section>
  );
}

// ---- Exceptions panel ----

function ExceptionsPanel({ exceptions }: { exceptions: ExceptionEntry[] }) {
  const sevColors = {
    error: 'text-red-700 bg-red-50 border-red-200',
    warning: 'text-amber-700 bg-amber-50 border-amber-200',
    info: 'text-[rgba(15,41,64,.6)] bg-[rgba(15,41,64,.04)] border-[rgba(15,41,64,.1)]',
  };

  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Exceptions</span>
          <h2>Open items and warnings</h2>
        </div>
        <FileWarning size={18} />
      </div>

      {exceptions.length === 0 ? (
        emptyNote('No open exceptions. All data quality, methodology, filing, fee, and review items are resolved.')
      ) : (
        <div className="mt-4 space-y-2">
          {exceptions.map((ex, i) => (
            <div key={i} className={`!rounded-lg !p-3 border ${sevColors[ex.severity]}`}>
              <div className="flex items-start gap-2">
                {ex.severity === 'error' ? (
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                ) : ex.severity === 'warning' ? (
                  <FileWarning size={14} className="shrink-0 mt-0.5" />
                ) : (
                  <ClipboardCheck size={14} className="shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium capitalize">{ex.type.replace(/_/g, ' ')}</p>
                  <p className="text-sm mt-0.5">{ex.description}</p>
                  <p className="text-xs mt-1 opacity-70">Suggested action: {ex.suggestedAction}</p>
                  {ex.worksiteField && (
                    <p className="text-[10px] opacity-50 mt-0.5">Field: {ex.worksiteField}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Audit history panel ----

function AuditHistoryPanel({ history }: { history: AuditEntry[] }) {
  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Audit history</span>
          <h2>Change log</h2>
        </div>
        <ClipboardCheck size={18} />
      </div>

      {history.length === 0 ? (
        emptyNote('No audit entries yet.')
      ) : (
        <div className="mt-4 space-y-2 !text-sm">
          {history.map((entry, i) => (
            <div key={i} className="!rounded !bg-[rgba(15,41,64,.02)] !px-3 !py-2 !border !border-[rgba(15,41,64,.06)]">
              <div className="flex items-center gap-2 text-xs text-[rgba(15,41,64,.5)]">
                <Clock size={12} />
                {new Date(entry.timestamp).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <p className="mt-0.5 text-sm">
                <span className="font-medium text-[rgba(15,41,64,.7)]">{entry.action.replace(/_/g, ' ')}</span>
                {entry.field && (
                  <span className="text-[rgba(15,41,64,.4)]"> — {entry.field}</span>
                )}
              </p>
              {(entry.previousValue || entry.newValue) && (
                <p className="text-xs text-[rgba(15,41,64,.5)] mt-0.5">
                  {entry.previousValue ? `Previous: ${entry.previousValue}` : ''}
                  {entry.previousValue && entry.newValue ? ' → ' : ''}
                  {entry.newValue ? `New: ${entry.newValue}` : ''}
                </p>
              )}
              {entry.notes && (
                <p className="text-xs text-[rgba(15,41,64,.4)] mt-0.5 italic">{entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Review packet export panel ----

function ReviewPacketExportPanel({
  packet,
}: {
  packet: ReviewPacket;
}) {
  return (
    <section className="partner-panel !bg-white">
      <div className="mockup-section-heading">
        <div>
          <span className="mobile-section-kicker">Review packet</span>
          <h2>Export-ready evidence package</h2>
        </div>
        <Download size={18} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Worksite</p>
          <p className="mt-0.5 font-medium text-[rgba(15,41,64,.8)] text-sm truncate">{packet.worksite.worksiteName}</p>
        </div>
        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Export timestamp</p>
          <p className="mt-0.5 text-xs font-mono text-[rgba(15,41,64,.6)]">
            {new Date(packet.exportTimestamp).toLocaleString()}
          </p>
        </div>
        <div className="bg-[rgba(15,41,64,.03)] !rounded-lg !p-3 col-span-2">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(15,41,64,.5)]">Contents</p>
          <ul className="mt-1 text-xs text-[rgba(15,41,64,.7)] list-disc list-inside space-y-0.5">
            <li>Applicability review — {packet.applicability.isSubjectToRule2202 !== null ? (packet.applicability.isSubjectToRule2202 ? 'subject' : 'not subject') : 'undetermined'}</li>
            <li>Timeline — {packet.timeline.length} entries</li>
            <li>AVR/VMT workbench — AVR {packet.workbench.avr !== null ? packet.workbench.avr.toFixed(2) : 'not calculated'}</li>
            <li>ECRP readiness — {packet.ecrpReadiness.readinessLevel.replace(/_/g, ' ')}</li>
            <li>Exceptions — {packet.exceptions.length} open</li>
            <li>Audit history — {packet.auditHistory.length} entries</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 bg-[rgba(15,41,64,.03)] !rounded-lg !p-3 text-xs text-[rgba(15,41,64,.6)]">
        <p className="font-medium text-[rgba(15,41,64,.8)] mb-1">Export note</p>
        <p>{packet.exportNote}</p>
      </div>

      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 !px-4 !py-2 !bg-[rgba(15,41,64,.9)] !text-white !rounded-lg !text-sm hover:!bg-[rgba(15,41,64,1)] transition"
        onClick={() => {
          const json = JSON.stringify(packet, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rule2202-review-packet-${packet.worksite.sixDigitWorksiteId || packet.worksite.id}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
      >
        <Download size={14} />
        Download review packet
      </button>
    </section>
  );
}

// ---- Partner console screen ----

interface PartnerConsoleScreenProps {
  onBack: () => void;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: MapPin },
  { id: 'timeline', label: 'Timeline', icon: Calendar },
  { id: 'workbench', label: 'AVR / VMT', icon: BarChart3 },
  { id: 'ecrp', label: 'ECRP', icon: Layers },
  { id: 'exceptions', label: 'Exceptions', icon: FileWarning },
  { id: 'audit', label: 'Audit', icon: ClipboardCheck },
  { id: 'packet', label: 'Export', icon: Download },
];

export const PartnerConsoleScreen: React.FC<PartnerConsoleScreenProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Mock worksite for demonstration
  const mockWorksite: Rule2202Worksite = useMemo(
    () => ({
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
    }),
    []
  );

  // Mock commuter records for AVR calculation
  const mockRecords: CommuterResearchRecord[] = useMemo(
    () => [
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
    ],
    []
  );

  // Computed values
  const applicability = useMemo(
    () => assessApplicability(mockWorksite),
    [mockWorksite]
  );

  const timeline = useMemo(
    () => buildTimeline(mockWorksite),
    [mockWorksite]
  );

  const workbenchResult = useMemo(
    () => runAvrVmtWorkbench({ worksite: mockWorksite, commuterRecords: mockRecords, methodologyId: null }),
    [mockWorksite, mockRecords]
  );

  const ecrpReadiness = useMemo(
    () => assessEcrpReadiness(mockWorksite),
    [mockWorksite]
  );

  const exceptions = useMemo(
    () => collectExceptions(mockWorksite),
    [mockWorksite]
  );

  const auditHistory = useMemo(
    () => buildAuditHistory(mockWorksite),
    [mockWorksite]
  );

  const reviewPacket = useMemo(
    () => buildReviewPacket(mockWorksite, mockRecords),
    [mockWorksite, mockRecords]
  );

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
            <strong>Rule 2202 evidence</strong><br />
            Applicability → Timeline → Workbench → ECRP → Exceptions → Audit → Export
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
                Evidence workflow for {mockWorksite.employerName} — worksite {mockWorksite.sixDigitWorksiteId || mockWorksite.id}.
                All values are institution-scoped and reviewed before export.
              </p>
            </div>
            <span className="partner-source-pill">
              <ShieldCheck size={14} />
              {mockWorksite.reviewState.replace(/_/g, ' ')}
            </span>
          </header>

          <div className="partner-content-grid">
            {activeTab === 'overview' && (
              <>
                <OverviewPanel worksite={mockWorksite} applicability={applicability} />
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
                            status={applicability.isSubjectToRule2202 !== null ? (applicability.isSubjectToRule2202 ? 'subject' : 'not subject') : 'undetermined'}
                            color={applicability.isSubjectToRule2202 === true ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                          />
                        </td>
                        <td>Worksite record → zone/source → classification → determination</td>
                      </tr>
                      <tr>
                        <td><strong>Timeline</strong></td>
                        <td>Notification, survey, submittal, filing dates</td>
                        <td>
                          <StatusBadge
                            status={timeline.filter((e) => e.status === 'completed').length > 0 ? 'active' : 'waiting'}
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
                            status={workbenchResult.avr !== null ? 'calculated' : 'pending'}
                            color={workbenchResult.avr !== null ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}
                          />
                        </td>
                        <td>Commuter records → weighted vehicle trips → AVR → VMT estimate</td>
                      </tr>
                      <tr>
                        <td><strong>ECRP</strong></td>
                        <td>Candidate zone, ETC assignment, readiness</td>
                        <td>
                          <StatusBadge
                            status={ecrpReadiness.readinessLevel}
                            color={ecrpReadiness.readinessLevel === 'candidate_ready' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                          />
                        </td>
                        <td>Worksite zone → ETC → verification → readiness level</td>
                      </tr>
                      <tr>
                        <td><strong>Exceptions</strong></td>
                        <td>Data quality, methodology, filing, fee, review</td>
                        <td>
                          <StatusBadge
                            status={`${exceptions.filter((e) => e.severity === 'error').length} errors`}
                            color={exceptions.some((e) => e.severity === 'error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}
                          />
                        </td>
                        <td>State checks → validation → exceptions list</td>
                      </tr>
                      <tr>
                        <td><strong>Export</strong></td>
                        <td>Review packet with full provenance</td>
                        <td>
                          <StatusBadge
                            status={workbenchResult.avr !== null ? 'ready' : 'pending data'}
                            color={workbenchResult.avr !== null ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}
                          />
                        </td>
                        <td>Aggregation → packet build → download</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              </>
            )}

            {activeTab === 'timeline' && <TimelinePanel entries={timeline} />}
            {activeTab === 'workbench' && <AvrVmtWorkbenchPanel result={workbenchResult} />}
            {activeTab === 'ecrp' && <EcrpReadinessPanel readiness={ecrpReadiness} />}
            {activeTab === 'exceptions' && <ExceptionsPanel exceptions={exceptions} />}
            {activeTab === 'audit' && <AuditHistoryPanel history={auditHistory} />}
            {activeTab === 'packet' && <ReviewPacketExportPanel packet={reviewPacket} />}
          </div>
        </main>
      </div>
    </div>
  );
};
