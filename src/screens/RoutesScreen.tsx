import React, { useState } from 'react';
import { Header } from '../components/Header';
import { RouteCard } from '../components/RouteCard';
import { useApp } from '../context/AppContext';

interface RoutesScreenProps {
  onViewSignal: (signalId: string) => void;
}

export const RoutesScreen: React.FC<RoutesScreenProps> = ({ onViewSignal }) => {
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
