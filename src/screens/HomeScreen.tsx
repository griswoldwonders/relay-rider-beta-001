import React from 'react';
import { ArrowRight, BatteryCharging, MapPinned, Route, Search, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Header';
import { ResearchBetaBanner } from '../components/ResearchBetaBanner';
import { RouteCard } from '../components/RouteCard';
import { useApp } from '../context/AppContext';
import { sampleRouteSignals } from '../data/demoData';

interface HomeScreenProps {
  onStartRouteSignal: () => void;
  onShareEVRoute: () => void;
  onSuggestRelayZone: () => void;
  onBrowseMatches: () => void;
  onLearnMore: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartRouteSignal,
  onShareEVRoute,
  onSuggestRelayZone,
  onBrowseMatches,
  onLearnMore,
}) => {
  const { routeSignals } = useApp();

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)] pb-28">
      <Header title="Good morning" subtitle="Pasadena–Eagle Rock–Glendale" />

      <div className="container py-5 space-y-6">
        <section className="home-material-hero">
          <div>
            <span className="home-material-hero__label"><ShieldCheck size={15} /> Research Beta</span>
            <h1>Find planned routes already moving your way.</h1>
            <p>Compare corridor match previews using timing, detour impact, Anchor Points, and EV/hybrid priority.</p>
          </div>
          <md-filled-button onClick={onBrowseMatches}>
            <Search slot="icon" size={17} />
            Browse match previews
          </md-filled-button>
        </section>

        <ResearchBetaBanner />

        <section>
          <div className="material-section-heading">
            <div>
              <h2>What would you like to do?</h2>
              <p>Submit a research signal or explore the corridor.</p>
            </div>
          </div>
          <div className="home-action-grid">

          <button
            onClick={onStartRouteSignal}
            className="home-action-card home-action-card--primary"
          >
            <span className="home-action-card__icon"><Route size={23} /></span>
            <h3>Submit route request</h3>
            <p>Share an area-level corridor need and suggested contribution.</p>
            <span className="home-action-card__link">Start request <ArrowRight size={16} /></span>
          </button>

          <button
            onClick={onShareEVRoute}
            className="home-action-card"
          >
            <span className="home-action-card__icon"><BatteryCharging size={23} /></span>
            <h3>Post planned route</h3>
            <p>Share an EV/hybrid route you already expect to drive.</p>
            <span className="home-action-card__link">Post route <ArrowRight size={16} /></span>
          </button>

          <button
            onClick={onSuggestRelayZone}
            className="home-action-card home-action-card--wide"
          >
            <span className="home-action-card__icon"><MapPinned size={23} /></span>
            <div>
              <h3>Explore Anchor Points and EV hubs</h3>
              <p>Open the verified corridor map and suggest a public location for review.</p>
            </div>
            <ArrowRight size={19} />
          </button>
          </div>
        </section>

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
