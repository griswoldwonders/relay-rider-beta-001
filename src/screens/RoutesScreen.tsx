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
    { id: 'needs', label: 'My Commute Needs' },
    { id: 'ev', label: 'Planned EV/Hybrid Routes' },
    { id: 'saved', label: 'Saved Options' },
    { id: 'drafts', label: 'Drafts' },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Activity" subtitle="Your commute signals, planned routes, and saved options" />

      <div className="sticky top-16 bg-white border-b border-gray-200 px-4 py-3 z-10">
        <div className="max-w-md mx-auto flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-mobility-green text-white' : 'bg-soft-gray text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container py-6">
        {activeTab === 'needs' && (
          <div className="space-y-3">
            {routeSignals.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-gray-600 mb-4">No commute needs submitted yet</p>
                <p className="text-xs text-gray-500">Share a commute need to compare planned-route and local transit options.</p>
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
          <div className="space-y-3">
            {evParticipantSignals.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-gray-600 mb-4">No planned EV/hybrid routes registered yet</p>
                <p className="text-xs text-gray-500">Register an existing route to help validate low-detour corridor supply.</p>
              </div>
            ) : (
              evParticipantSignals.map(signal => (
                <div key={signal.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-navy">{signal.startingArea} → {signal.destinationArea}</h3>
                      <p className="text-xs text-gray-600 mt-1">{signal.travelDays.join(', ')}, {signal.timeWindow}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Vehicle</span><span className="text-xs font-medium text-navy">{signal.vehicleType.toUpperCase()}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Max Detour</span><span className="text-xs font-medium text-navy">{signal.maxDetour}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Status</span><span className="text-xs font-medium text-mobility-green">{signal.status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'saved' && <div className="card text-center py-8"><p className="text-gray-600">No saved commute options yet</p></div>}
        {activeTab === 'drafts' && <div className="card text-center py-8"><p className="text-gray-600">No draft signals yet</p></div>}
      </div>
    </div>
  );
};
