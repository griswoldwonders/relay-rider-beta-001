import React from 'react';
import { ArrowRight, BatteryCharging, Gift, MapPinned, Route, Search, ShieldCheck, TrainFront } from 'lucide-react';
import { Header } from '../components/Header';
import { ResearchBetaBanner } from '../components/ResearchBetaBanner';
import { RouteCard } from '../components/RouteCard';
import { useApp } from '../context/AppContext';
import { sampleRouteSignals } from '../data/demoData';

interface HomeScreenProps {
  onStartRouteSignal: () => void;
  onShareEVRoute: () => void;
  onSuggestRelayZone: () => void;
  onBrowseOptions: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartRouteSignal,
  onShareEVRoute,
  onSuggestRelayZone,
  onBrowseOptions,
}) => {
  const { routeSignals, greenRouteCredits } = useApp();
  const totalCredits = greenRouteCredits.reduce((sum, credit) => sum + credit.amount, 0);

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)] pb-28">
      <Header title="Good morning" subtitle="Pasadena–Eagle Rock–Glendale" />

      <div className="container py-5 space-y-6">
        <section className="home-material-hero">
          <div>
            <span className="home-material-hero__label"><ShieldCheck size={15} /> Research Beta</span>
            <h1>Compare planned routes and local transit.</h1>
            <p>See free college-program route previews alongside LA Metro and local transit connections.</p>
          </div>
          <md-filled-button onClick={onBrowseOptions}>
            <Search slot="icon" size={17} />
            Explore commute options
          </md-filled-button>
        </section>

        <ResearchBetaBanner />

        <section className="rounded-xl border border-green-200 bg-light-green p-4">
          <div className="flex items-start gap-3">
            <Gift size={22} className="mt-0.5 flex-shrink-0 text-mobility-green" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-navy">College commuter benefits</h2>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-mobility-green">{totalCredits} credits</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-700">
                Relay Rider planned-route participation is modeled at $0 for eligible college participants. Green Route Credits may recognize eligible research participation, sustainable commute challenges, and Access Point feedback. Credits are promotional and not cash or guaranteed payments.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="material-section-heading">
            <div>
              <h2>What would you like to do?</h2>
              <p>Share your commute, register a planned route, or explore the corridor.</p>
            </div>
          </div>
          <div className="home-action-grid">
            <button onClick={onStartRouteSignal} className="home-action-card home-action-card--primary">
              <span className="home-action-card__icon"><Route size={23} /></span>
              <h3>Share commute need</h3>
              <p>Tell us where and when you travel, which transit you use, and which incentives matter.</p>
              <span className="home-action-card__link">Start commute profile <ArrowRight size={16} /></span>
            </button>

            <button onClick={onShareEVRoute} className="home-action-card">
              <span className="home-action-card__icon"><BatteryCharging size={23} /></span>
              <h3>Register planned route</h3>
              <p>Share an EV/hybrid route you already expect to drive.</p>
              <span className="home-action-card__link">Register route <ArrowRight size={16} /></span>
            </button>

            <button onClick={onBrowseOptions} className="home-action-card home-action-card--wide">
              <span className="home-action-card__icon"><TrainFront size={23} /></span>
              <div>
                <h3>Compare transit and shared-route options</h3>
                <p>Review LA Metro, Pasadena Transit, Glendale Beeline, and compatible Relay Rider previews.</p>
              </div>
              <ArrowRight size={19} />
            </button>

            <button onClick={onSuggestRelayZone} className="home-action-card home-action-card--wide">
              <span className="home-action-card__icon"><MapPinned size={23} /></span>
              <div>
                <h3>Explore Access Points and EV hubs</h3>
                <p>Open the corridor map and suggest a public location for review.</p>
              </div>
              <ArrowRight size={19} />
            </button>
          </div>
        </section>

        {routeSignals.length > 0 && (
          <div>
            <h2 className="section-title">My Commute Signals</h2>
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

        {routeSignals.length === 0 && (
          <div>
            <h2 className="section-title">Example Commute Signals</h2>
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
