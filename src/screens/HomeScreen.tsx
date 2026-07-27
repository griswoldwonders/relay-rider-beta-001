import React from 'react';
import { MapPin, Zap, MapPinPlus, ChevronRight } from 'lucide-react';
import { Header } from '../components/Header';
import { ResearchBetaBanner } from '../components/ResearchBetaBanner';
import { RouteCard } from '../components/RouteCard';
import { useApp } from '../context/AppContext';
import { sampleRouteSignals } from '../data/demoData';

interface HomeScreenProps {
  onStartRouteSignal: () => void;
  onShareEVRoute: () => void;
  onSuggestRelayZone: () => void;
  onLearnMore: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartRouteSignal,
  onShareEVRoute,
  onSuggestRelayZone,
  onLearnMore,
}) => {
  const { routeSignals } = useApp();

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Welcome to Relay Rider" subtitle="Research beta for cleaner planned corridors." />

      <div className="container py-6 space-y-6">
        {/* Research Beta Banner */}
        <ResearchBetaBanner />

        {/* Main CTA Cards */}
        <div className="space-y-3">
          <h2 className="section-title">Get Started</h2>

          {/* Share a Route Need */}
          <button
            onClick={onStartRouteSignal}
            className="card text-left hover:shadow-md transition-shadow w-full group"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-light-green rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} className="text-mobility-green" />
                </div>
                <div>
                  <h3 className="font-bold text-navy">Share a Route Need</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Tell us where you need to go, when, and what Relay Zones work for you.
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-navy transition-colors" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold text-mobility-green">Start Route Signal →</span>
            </div>
          </button>

          {/* Share an EV/Hybrid Route */}
          <button
            onClick={onShareEVRoute}
            className="card text-left hover:shadow-md transition-shadow w-full group"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-light-blue rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-navy">Share an EV/Hybrid Route</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Already travel a corridor? Help validate low-detour EV/hybrid route supply.
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-navy transition-colors" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold text-blue-600">Share Route Pattern →</span>
            </div>
          </button>

          {/* Suggest a Relay Zone */}
          <button
            onClick={onSuggestRelayZone}
            className="card text-left hover:shadow-md transition-shadow w-full group"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-soft-gray rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPinPlus size={20} className="text-navy" />
                </div>
                <div>
                  <h3 className="font-bold text-navy">Suggest a Relay Zone</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Recommend public, visible, route-compatible Access Points.
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-navy transition-colors" />
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold text-gray-600">Suggest Location →</span>
            </div>
          </button>
        </div>

        {/* My Research Signals */}
        {routeSignals.length > 0 && (
          <div>
            <h2 className="section-title">My Research Signals</h2>
            <div className="space-y-3">
              {routeSignals.map(signal => (
                <RouteCard
                  key={signal.id}
                  corridor={signal.corridor}
                  timeWindow={`${signal.daysOfWeek.join(', ')}, ${signal.timeWindow}`}
                  status={signal.status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  routeFit={signal.routeFit}
                  relayZonePreference={signal.relayZoneType[0] || 'Not specified'}
                  greenRouteCredit={signal.greenRouteCredit}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sample Signals (if no real signals) */}
        {routeSignals.length === 0 && (
          <div>
            <h2 className="section-title">Example Research Signals</h2>
            <div className="space-y-3">
              {sampleRouteSignals.map((signal, idx) => (
                <RouteCard
                  key={idx}
                  corridor={signal.corridor}
                  timeWindow={signal.timeWindow}
                  status={signal.status}
                  routeFit={signal.routeFit}
                  relayZonePreference={signal.relayZonePreference}
                  greenRouteCredit={signal.greenRouteCredit}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
