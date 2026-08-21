import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BatteryCharging,
  CarFront,
  ChevronRight,
  CircleAlert,
  CircleGauge,
  Info,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
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

interface PasadenaAdminScreenProps {
  onBack: () => void;
}

const evidenceClass: Record<EvidenceState, string> = {
  observed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  calculated: 'bg-blue-50 text-blue-700 border-blue-200',
  modeled: 'bg-amber-50 text-amber-800 border-amber-200',
  unsupported: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const PasadenaAdminScreen: React.FC<PasadenaAdminScreenProps> = ({ onBack }) => {
  const [selectedCorridor, setSelectedCorridor] = useState('eagle-rock-pasadena');
  const [showEvidence, setShowEvidence] = useState(false);

  const activeCorridor = useMemo(
    () => pasadenaCorridors.find((corridor) => corridor.id === selectedCorridor) ?? pasadenaCorridors[0],
    [selectedCorridor],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
              aria-label="Back to Relay Rider home"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Relay Rider · institution view</p>
              <h1 className="text-base font-bold sm:text-lg">{pasadenaDemoMeta.title}</h1>
            </div>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Demonstration data</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-200">
                <Sparkles size={14} /> Pasadena SOV-to-EV proof chain
              </p>
              <h2 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">
                Find gasoline solo commutes that can plausibly shift into planned EV routes already moving toward the same institution.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                This admin prototype prioritizes institutional evidence, corridor opportunity, explainable compatibility, and review—not live dispatch or guaranteed transportation.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Methodology</p>
              <p className="mt-1">{pasadenaDemoMeta.methodologyVersion}</p>
              <button
                type="button"
                onClick={() => setShowEvidence((value) => !value)}
                className="mt-4 inline-flex items-center gap-2 font-semibold text-emerald-300 hover:text-emerald-200"
              >
                <Info size={16} /> {showEvidence ? 'Hide evidence rules' : 'Show evidence rules'}
              </button>
            </div>
          </div>
        </section>

        {showEvidence && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold">Evidence-state contract</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(['observed', 'calculated', 'modeled', 'unsupported'] as EvidenceState[]).map((state) => (
                <div key={state} className="rounded-xl border border-slate-200 p-3">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${evidenceClass[state]}`}>{state}</span>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {state === 'observed' && 'Direct participant, institution, or source input.'}
                    {state === 'calculated' && 'Deterministically derived from source inputs.'}
                    {state === 'modeled' && 'Depends on assumptions, thresholds, or scenario settings.'}
                    {state === 'unsupported' && 'Insufficient evidence for a decision or claim.'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Institution overview</p>
              <h2 className="text-xl font-bold">Synthetic Pasadena baseline</h2>
            </div>
            <span className="hidden text-xs text-slate-500 sm:block">City · employer · campus · hospital cohorts</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pasadenaMetrics.map((metric) => (
              <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${evidenceClass[metric.evidence]}`}>{metric.evidence}</span>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight">{metric.value}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{metric.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CircleGauge size={20} className="text-emerald-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conversion funnel</p>
                <h2 className="font-bold">Gasoline SOV → high-fit preview</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {pasadenaFunnel.map((step, index) => {
                const width = Math.max(24, Math.round((step.value / pasadenaFunnel[0].value) * 100));
                return (
                  <div key={step.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{index + 1}. {step.label}</span>
                      <strong>{step.value}</strong>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              <strong>Modeled demo:</strong> a high-fit preview is not a confirmed ride. Administrative review and participant opt-in remain required.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPinned size={20} className="text-emerald-700" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Corridor opportunities</p>
                  <h2 className="font-bold">Where demand overlaps planned EV supply</h2>
                </div>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 font-semibold">Corridor</th>
                    <th className="pb-2 font-semibold">Gas SOV</th>
                    <th className="pb-2 font-semibold">EV routes</th>
                    <th className="pb-2 font-semibold">Seats</th>
                    <th className="pb-2 font-semibold">High-fit</th>
                    <th className="pb-2 font-semibold">Detour</th>
                    <th className="pb-2 font-semibold">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {pasadenaCorridors.map((corridor) => (
                    <tr
                      key={corridor.id}
                      onClick={() => setSelectedCorridor(corridor.id)}
                      className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${selectedCorridor === corridor.id ? 'bg-emerald-50/60' : ''}`}
                    >
                      <td className="py-3 pr-3 font-semibold">{corridor.name}</td>
                      <td className="py-3">{corridor.gasolineSov}</td>
                      <td className="py-3">{corridor.plannedEvRoutes}</td>
                      <td className="py-3">{corridor.availableSeats}</td>
                      <td className="py-3">{corridor.highFitPreviews}</td>
                      <td className="py-3">{corridor.medianDetourMinutes.toFixed(1)} min</td>
                      <td className="py-3"><span className={`rounded-full px-2 py-1 font-semibold ${corridor.priority === 'High' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{corridor.priority}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase text-emerald-800">{activeCorridor.priority} opportunity</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase text-amber-800">Modeled demonstration</span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight">{activeCorridor.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Corridor Decision Card: connects gasoline SOV demand with already-planned BEV/PHEV route supply while keeping compatibility explainable and reviewable.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DecisionStat icon={<CarFront size={18} />} label="Gasoline SOV demand" value={`${activeCorridor.gasolineSov} commuters`} />
                <DecisionStat icon={<BatteryCharging size={18} />} label="Planned EV supply" value={`${activeCorridor.plannedEvRoutes} routes · ${activeCorridor.availableSeats} seats`} />
                <DecisionStat icon={<Route size={18} />} label="Median route overlap" value={`${activeCorridor.medianRouteOverlap}%`} />
                <DecisionStat icon={<Users size={18} />} label="High-fit previews" value={`${activeCorridor.highFitPreviews}`} />
                <DecisionStat icon={<MapPinned size={18} />} label="Access Point compatible" value={`${activeCorridor.accessPointCompatible}`} />
                <DecisionStat icon={<CircleGauge size={18} />} label="Median modeled detour" value={`${activeCorridor.medianDetourMinutes.toFixed(1)} min`} />
              </div>
            </div>

            <aside className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Potential intervention</p>
              <h3 className="mt-2 text-lg font-bold">Institution-sponsored clean-commute cohort</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {activeCorridor.id === 'eagle-rock-pasadena'
                  ? eagleRockDecision.recommendation
                  : `Evaluate a controlled ${activeCorridor.name} cohort using reviewed Access Points and eligible planned BEV/PHEV routes.`}
              </p>
              <div className="mt-5 space-y-2">
                <AdminAction label="Review commuter options" />
                <AdminAction label="Create review task" />
                <AdminAction label="Model incentive scenario" />
                <AdminAction label="Mark insufficient evidence" muted />
              </div>
              <p className="mt-4 text-[11px] leading-5 text-slate-400">Buttons are visual prototype actions only; no route activation occurs.</p>
            </aside>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BatteryCharging size={20} className="text-emerald-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Secondary intervention</p>
                <h2 className="font-bold">Workplace charging readiness</h2>
              </div>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-3xl font-black">{chargingReadiness.signal}</span>
              <span className="mb-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">{chargingReadiness.confidence} confidence</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <MiniStat label="Current BEV/PHEV" value={chargingReadiness.currentBevPhev} />
              <MiniStat label="Limited home charging" value={chargingReadiness.limitedHomeCharging} />
              <MiniStat label="Workplace charging interest" value={chargingReadiness.workplaceChargingInterest} />
              <MiniStat label="Gas SOV + EV purchase interest" value={chargingReadiness.gasolineSovEvPurchaseInterest} />
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Recommended next action: workplace charging feasibility investigation. Relay Rider does not determine charger quantity, electrical capacity, permitting, utility requirements, or installation cost.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Governance</p>
                <h2 className="font-bold">What this prototype refuses to imply</h2>
              </div>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <Guardrail text="No live dispatch, instant pickup, or guaranteed transportation." />
              <Guardrail text="No precise residential location shown during discovery." />
              <Guardrail text="No high score activates a route automatically." />
              <Guardrail text="No modeled match is counted as an actual gasoline trip displaced." />
              <Guardrail text="No charging-demand signal becomes an engineering recommendation." />
            </ul>
          </article>
        </section>

        <footer className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
          <div className="flex gap-2">
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <p><strong>Prototype disclaimer:</strong> {pasadenaDemoMeta.disclaimer}</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

function DecisionStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="mt-2 font-bold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-3"><strong className="text-xl text-slate-950">{value}</strong><p className="mt-1 text-slate-500">{label}</p></div>;
}

function AdminAction({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${muted ? 'bg-white/5 text-slate-300' : 'bg-white/10 text-white hover:bg-white/15'}`}
    >
      {label}<ChevronRight size={16} />
    </button>
  );
}

function Guardrail({ text }: { text: string }) {
  return <li className="flex gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-700" /><span>{text}</span></li>;
}
