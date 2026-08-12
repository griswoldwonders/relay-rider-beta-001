import React, { useState } from 'react';
import { ArrowRight, CarFront, ShieldCheck, UsersRound } from 'lucide-react';
import { Header } from '../components/Header';
import { RouteCard } from '../components/RouteCard';
import { useApp } from '../context/AppContext';

interface RoutesScreenProps {
  onViewSignal: (signalId: string) => void;
  onOpenParticipantTripDemo: () => void;
  onOpenDriverTripDemo: () => void;
}

export const RoutesScreen: React.FC<RoutesScreenProps> = ({
  onViewSignal,
  onOpenParticipantTripDemo,
  onOpenDriverTripDemo,
}) => {
  const { routeSignals, evParticipantSignals } = useApp();
  const [activeTab, setActiveTab] = useState<'needs' | 'ev' | 'saved' | 'drafts'>('needs');

  const tabs = [
    { id: 'needs', label: 'Commute needs' },
    { id: 'ev', label: 'Planned EV/Hybrid' },
    { id: 'saved', label: 'Saved options' },
    { id: 'drafts', label: 'Drafts' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-24">
      <Header title="Activity" subtitle="Commute signals, planned routes, and saved options" />

      <div className="container pt-6">
        <section className="rounded-[28px] border border-[rgba(0,68,73,.09)] bg-white p-5 shadow-[0_5px_18px_rgba(0,68,73,.04)]">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.05em] text-iris"><ShieldCheck size={14} /> Coordinated trip demo</span>
            <small className="text-[10px] text-[rgba(0,68,73,.5)]">Prototype states</small>
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-[var(--color-deep-lagoon)]">Confirmed → in progress → arrival</h2>
          <p className="mt-2 text-xs leading-relaxed text-[rgba(0,68,73,.62)]">Preview a governed planned-route workflow. These screens do not represent live dispatch, real-time vehicle tracking, or guaranteed transportation.</p>
          <div className="mt-5 grid gap-3">
            <button type="button" onClick={onOpenParticipantTripDemo} className="flex min-h-[64px] items-center gap-3 rounded-[18px] border border-[rgba(0,68,73,.08)] bg-[#f1ecff] px-4 text-left active:scale-[.98]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-iris"><UsersRound size={18} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-[var(--color-deep-lagoon)]">Commuter view</strong><small className="mt-1 block text-[10px] text-[rgba(0,68,73,.58)]">Meet, travel, arrive, complete</small></span>
              <ArrowRight size={17} className="text-iris" />
            </button>
            <button type="button" onClick={onOpenDriverTripDemo} className="flex min-h-[64px] items-center gap-3 rounded-[18px] border border-[rgba(0,68,73,.08)] bg-[#efffe7] px-4 text-left active:scale-[.98]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#168858]"><CarFront size={18} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-[var(--color-deep-lagoon)]">EV route participant</strong><small className="mt-1 block text-[10px] text-[rgba(0,68,73,.58)]">Access Point, begin route, complete</small></span>
              <ArrowRight size={17} className="text-[#168858]" />
            </button>
          </div>
        </section>
      </div>

      <div className="activity-tab-bar">
        <div className="activity-tab-row">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`activity-chip ${activeTab === tab.id ? 'is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container py-7">
        {activeTab === 'needs' && (
          <div className="space-y-4">
            {routeSignals.length === 0 ? (
              <div className="card text-center py-10">
                <p className="font-semibold text-navy">No commute needs yet</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">Share a commute need to compare planned-route and local transit options.</p>
              </div>
            ) : (
              routeSignals.map(signal => (
                <RouteCard
                  key={signal.id}
                  corridor={signal.corridor}
                  timeWindow={`${signal.daysOfWeek.join(', ')}, ${signal.timeWindow}`}
                  status={signal.status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  routeFit={signal.routeFit}
                  relayZonePreference={signal.relayZoneType[0] || 'Not specified'}
                  greenRouteCredit={signal.greenRouteCredit}
                  onClick={() => onViewSignal(signal.id)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'ev' && (
          <div className="space-y-4">
            {evParticipantSignals.length === 0 ? (
              <div className="card text-center py-10">
                <p className="font-semibold text-navy">No planned EV/hybrid routes yet</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">Register an existing route to help validate low-detour corridor supply.</p>
              </div>
            ) : (
              evParticipantSignals.map(signal => (
                <div key={signal.id} className="card">
                  <div className="mb-4">
                    <h3 className="font-semibold text-navy tracking-wide">{signal.startingArea} → {signal.destinationArea}</h3>
                    <p className="mt-1 text-xs text-gray-600">{signal.travelDays.join(', ')}, {signal.timeWindow}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between gap-3"><span className="text-xs text-gray-600">Vehicle</span><span className="text-xs font-semibold text-navy">{signal.vehicleType.toUpperCase()}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-xs text-gray-600">Max detour</span><span className="text-xs font-semibold text-navy">{signal.maxDetour}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-xs text-gray-600">Status</span><span className="text-xs font-semibold text-iris">{signal.status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'saved' && <div className="card text-center py-10"><p className="font-semibold text-navy">No saved commute options yet</p></div>}
        {activeTab === 'drafts' && <div className="card text-center py-10"><p className="font-semibold text-navy">No draft signals yet</p></div>}
      </div>
    </div>
  );
};
