import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BatteryCharging,
  Bike,
  CircleGauge,
  Info,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
  TrainFront,
} from 'lucide-react';
import {
  chargingReadiness,
  eagleRockDecision,
  pasadenaCorridors,
  pasadenaDemoMeta,
  pasadenaFunnel,
  pasadenaMetrics,
  type EvidenceState,
} from '../data/pasadenaEvCommuterDemo';
import {
  pasadenaCorridorInterventionSummary,
  pasadenaDemoCommuter,
  pasadenaInterventionAssessment,
  pasadenaInterventionWhy,
  pasadenaNetVmtAssessment,
} from '../data/pasadenaCleanCommuteDemo';
import type { InterventionResult } from '../lib/interventionRouter';

interface PasadenaAdminScreenProps {
  onBack: () => void;
}

const evidenceClass: Record<EvidenceState, string> = {
  observed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  calculated: 'border-blue-200 bg-blue-50 text-blue-700',
  modeled: 'border-amber-200 bg-amber-50 text-amber-800',
  unsupported: 'border-slate-200 bg-slate-100 text-slate-600',
};

const classificationLabel = pasadenaInterventionAssessment.classification.replace(/_/g, ' ').toUpperCase();

export const PasadenaAdminScreen: React.FC<PasadenaAdminScreenProps> = ({ onBack }) => {
  const [selectedCorridor, setSelectedCorridor] = useState('eagle-rock-pasadena');
  const [showEvidence, setShowEvidence] = useState(false);
  const activeCorridor = useMemo(
    () => pasadenaCorridors.find(corridor => corridor.id === selectedCorridor) ?? pasadenaCorridors[0],
    [selectedCorridor],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} aria-label="Back to Relay Rider home" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Relay Rider · institution view</p>
              <h1 className="text-base font-bold sm:text-lg">{pasadenaDemoMeta.title}</h1>
            </div>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">SYNTHETIC DEMONSTRATION DATA</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-200"><Sparkles size={14} /> Clean commute opportunity</p>
              <h2 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">Identify which gasoline SOV trips are addressable, by which clean intervention, and with what evidence.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">Compare supported alternatives first, then apply deeper planned-BEV/PHEV compatibility and modeled net-VMT analysis when eligible.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Methodology</p>
              <p className="mt-1">{pasadenaDemoMeta.methodologyVersion}</p>
              <button type="button" onClick={() => setShowEvidence(value => !value)} className="mt-4 inline-flex items-center gap-2 font-semibold text-emerald-300"><Info size={16} /> {showEvidence ? 'Hide evidence rules' : 'Show evidence rules'}</button>
            </div>
          </div>
        </section>

        {showEvidence && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold">Evidence-state contract</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(['observed', 'calculated', 'modeled', 'unsupported'] as EvidenceState[]).map(state => (
                <div key={state} className="rounded-xl border border-slate-200 p-3">
                  <EvidenceBadge state={state} />
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {state === 'observed' && 'Direct participant, institution, or source input.'}
                    {state === 'calculated' && 'Deterministically derived from source inputs.'}
                    {state === 'modeled' && 'Depends on explicit assumptions, thresholds, or scenarios.'}
                    {state === 'unsupported' && 'Insufficient evidence for a decision or claim.'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Institution overview</p><h2 className="text-xl font-bold">Synthetic Pasadena baseline</h2></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pasadenaMetrics.map(metric => (
              <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-slate-600">{metric.label}</p><EvidenceBadge state={metric.evidence} /></div>
                <p className="mt-3 text-3xl font-black tracking-tight">{metric.value}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{metric.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><CircleGauge size={20} className="text-emerald-700" /><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Opportunity funnel</p><h2 className="font-bold">Gasoline SOV → high-fit EV preview</h2></div></div>
            <div className="mt-5 space-y-3">
              {pasadenaFunnel.map((step, index) => {
                const width = Math.max(24, Math.round((step.value / pasadenaFunnel[0].value) * 100));
                return <div key={step.label}><div className="mb-1 flex justify-between text-xs"><span>{index + 1}. {step.label}</span><strong>{step.value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} /></div></div>;
              })}
            </div>
            <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">A high-fit preview is not a confirmed trip. Participant opt-in and program review remain required.</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><MapPinned size={20} className="text-emerald-700" /><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Corridor intelligence</p><h2 className="font-bold">Demand overlapping planned EV supply</h2></div></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="text-slate-500"><tr className="border-b border-slate-200"><th className="pb-2">Corridor</th><th>Gas SOV</th><th>EV routes</th><th>Seats</th><th>High-fit</th><th>Detour</th><th>Priority</th></tr></thead><tbody>{pasadenaCorridors.map(corridor => <tr key={corridor.id} onClick={() => setSelectedCorridor(corridor.id)} className={`cursor-pointer border-b border-slate-100 ${selectedCorridor === corridor.id ? 'bg-emerald-50/70' : ''}`}><td className="py-3 font-semibold">{corridor.name}</td><td>{corridor.gasolineSov}</td><td>{corridor.plannedEvRoutes}</td><td>{corridor.availableSeats}</td><td>{corridor.highFitPreviews}</td><td>{corridor.medianDetourMinutes.toFixed(1)} min</td><td>{corridor.priority}</td></tr>)}</tbody></table></div>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="intervention-heading">
          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Intervention Assessment</p><h2 id="intervention-heading" className="mt-1 text-2xl font-black">{pasadenaDemoCommuter.id} · Eagle Rock → Pasadena</h2><p className="mt-1 text-sm text-slate-600">Baseline: gasoline single-occupancy commute · Tue/Wed/Thu · generalized zones only</p></div>
            <span className="self-start rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">SYNTHETIC DEMONSTRATION DATA</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InterventionCard icon={<BatteryCharging size={20} />} title="Planned EV route" result={pasadenaInterventionAssessment.plannedEvRoute} />
            <InterventionCard icon={<TrainFront size={20} />} title="Transit" result={pasadenaInterventionAssessment.transit} />
            <InterventionCard icon={<Bike size={20} />} title="Active transportation" result={pasadenaInterventionAssessment.activeTransportation} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Recommended intervention</p>
              <h3 className="mt-2 text-xl font-black">{classificationLabel}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{pasadenaInterventionAssessment.explanation}</p>
              <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-slate-200">{pasadenaInterventionWhy.map(reason => <li key={reason}>• {reason}</li>)}</ul>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Route size={20} className="text-emerald-800" /><h3 className="font-bold">Modeled net-VMT opportunity</h3></div><EvidenceBadge state={pasadenaNetVmtAssessment.evidenceState} /></div>
              <div className="mt-4 grid grid-cols-3 gap-2"><MiniStat label="Baseline SOV" value={`${pasadenaNetVmtAssessment.baselineSovMiles?.toFixed(1)} mi`} /><MiniStat label="EV detour" value={`${pasadenaNetVmtAssessment.incrementalEvDetourMiles?.toFixed(1)} mi`} /><MiniStat label="Net VMT" value={`${pasadenaNetVmtAssessment.modeledNetVmtAvoided?.toFixed(1)} mi`} /></div>
              <p className="mt-4 text-xs leading-5 text-slate-700">Assumption: the gasoline SOV trip is fully displaced and the planned EV route would have occurred without Relay Rider. This is not a verified emissions reduction.</p>
              <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3 text-xs font-semibold text-slate-700"><ShieldCheck size={15} className="mr-1 inline text-emerald-700" /> Administrative review required</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Corridor intervention mix</p><h2 className="text-xl font-bold">Clean-option classification by corridor</h2></div><EvidenceBadge state="modeled" /></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-500"><tr className="border-b border-slate-200"><th className="pb-2">Corridor</th><th>Gas SOV</th><th>Transit strong</th><th>EV-route strong</th><th>Both credible</th><th>Unsupported</th><th>Modeled net VMT</th></tr></thead><tbody>{pasadenaCorridorInterventionSummary.map(row => <tr key={row.corridor} className="border-b border-slate-100"><td className="py-3 font-semibold">{row.corridor}</td><td>{row.gasolineSov}</td><td>{row.transitStrong}</td><td>{row.evRouteStrong}</td><td>{row.bothCredible}</td><td>{row.unsupported}</td><td>{row.modeledNetVmtOpportunityMiles.toFixed(1)} mi</td></tr>)}</tbody></table></div>
          <p className="mt-3 text-xs text-slate-500">Synthetic scenario aggregates for interface testing, not empirical Pasadena findings or forecasts.</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><BatteryCharging size={20} className="text-emerald-700" /><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Secondary intervention</p><h2 className="font-bold">Charging & EV-adoption readiness</h2></div></div>
            <div className="mt-4 flex items-end gap-3"><span className="text-3xl font-black">{chargingReadiness.signal}</span><span className="mb-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">{chargingReadiness.confidence} confidence</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><MiniStat label="Current BEV/PHEV" value={String(chargingReadiness.currentBevPhev)} /><MiniStat label="Limited home charging" value={String(chargingReadiness.limitedHomeCharging)} /><MiniStat label="Workplace interest" value={String(chargingReadiness.workplaceChargingInterest)} /><MiniStat label="Gas SOV + EV interest" value={String(chargingReadiness.gasolineSovEvPurchaseInterest)} /></div>
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Workplace charging feasibility investigation warranted.</p>
            <p className="mt-3 text-xs leading-5 text-slate-600">Relay Rider does not evaluate electrical capacity, final charger quantity, permitting, utility feasibility, installation design, or final infrastructure cost.</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><MapPinned size={20} className="text-emerald-700" /><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected Decision Card</p><h2 className="font-bold">{activeCorridor.name}</h2></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><MiniStat label="Gasoline SOV" value={String(activeCorridor.gasolineSov)} /><MiniStat label="Planned EV routes" value={String(activeCorridor.plannedEvRoutes)} /><MiniStat label="Available seats" value={String(activeCorridor.availableSeats)} /><MiniStat label="Median detour" value={`${activeCorridor.medianDetourMinutes.toFixed(1)} min`} /></div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{activeCorridor.id === 'eagle-rock-pasadena' ? eagleRockDecision.recommendation : `Evaluate a controlled ${activeCorridor.name} cohort using reviewed Access Points and eligible planned BEV/PHEV routes.`}</p>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Potential intervention only. Participant acceptance, program rules, and institution review determine whether any controlled program action proceeds.</p>
          </article>
        </section>

        <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600"><strong>Research-beta guardrail:</strong> {pasadenaDemoMeta.disclaimer} No live dispatch, route activation, guaranteed transportation, or certified environmental outcome is represented here.</footer>
      </main>
    </div>
  );
};

function EvidenceBadge({ state }: { state: EvidenceState }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${evidenceClass[state]}`}>{state}</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-base font-black text-slate-900">{value}</p></div>;
}

function InterventionCard({ icon, title, result }: { icon: React.ReactNode; title: string; result: InterventionResult }) {
  return <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm">{icon}</span><EvidenceBadge state={result.evidenceState} /></div><h3 className="mt-3 font-bold">{title}</h3><div className="mt-2 flex items-end justify-between gap-2"><span className="text-xs font-bold uppercase text-slate-500">{result.strength}</span><strong className="text-xl">{result.score === null ? '—' : `${result.score} / 100`}</strong></div><p className="mt-2 text-xs leading-5 text-slate-600">{result.eligibilityStatus === 'eligible' ? result.reasons[0] : result.limitingFactors[0]}</p></article>;
}
