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
    <div className="min-h-screen bg-[var(--color-parchment)] pb-28">
      <Header title="Your commute" subtitle="Pasadena · Eagle Rock · Glendale" />

      <div className="container py-6 space-y-8">
        <section className="home-material-hero">
          <div>
            <span className="home-material-hero__label"><ShieldCheck size={15} /> Research Beta</span>
            <h1>Better ways to <span className="accent-word">campus.</span></h1>
            <p>Compare planned shared routes with Metro and local transit using your school, schedule, walking tolerance, and commute preferences.</p>
          </div>
          <md-filled-button onClick={onBrowseOptions}>
            <Search slot="icon" size={17} />
            Explore commute options
          </md-filled-button>
        </section>

        <ResearchBetaBanner />

        <section className="card-highlight">
          <div className="flex items-start gap-3">
            <Gift size={22} className="mt-0.5 flex-shrink-0 text-navy" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-navy tracking-wide">College commuter benefits</h2>
                <span className="rounded-full border border-lagoon/20 bg-parchment px-3 py-1 text-xs font-semibold text-navy">{totalCredits} credits</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-700">
                Relay Rider planned-route participation is modeled at $0 for eligible college participants. Green Route Credits may recognize eligible research participation, sustainable commute challenges, and Access Point feedback. Credits are promotional and not cash or guaranteed payments.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="material-section-heading">
            <div>
              <h2>Build your commute</h2>
              <p>Start with your need, then compare compatible options.</p>
            </div>
          </div>

          <div className="home-action-grid">
            <button onClick={onStartRouteSignal} className="home-action-card home-action-card--primary">
              <span className="home-action-card__icon"><Route size={22} /></span>
              <h3>Share commute need</h3>
              <p>Tell us your school, origin, destination, travel window, transit preferences, and incentive interests.</p>
              <span className="home-action-card__link">Start profile <ArrowRight size={16} /></span>
            </button>

            <button onClick={onShareEVRoute} className="home-action-card">
              <span className="home-action-card__icon"><BatteryCharging size={22} /></span>
              <h3>Register planned route</h3>
              <p>Share an EV/hybrid route you already intend to travel and your acceptable detour range.</p>
              <span className="home-action-card__link">Register route <ArrowRight size={16} /></span>
            </button>

            <button onClick={onBrowseOptions} className="home-action-card home-action-card--wide">
              <span className="home-action-card__icon"><TrainFront size={22} /></span>
              <div className="min-w-0 flex-1">
                <h3>Compare commute options</h3>
                <p>See ranked Metro, local transit, and Relay Rider planned-route previews side by side.</p>
              </div>
              <ArrowRight size={19} />
            </button>

            <button onClick={onSuggestRelayZone} className="home-action-card home-action-card--wide">
              <span className="home-action-card__icon"><MapPinned size={22} /></span>
              <div className="min-w-0 flex-1">
                <h3>Explore Access Points</h3>
                <p>Review public transit hubs, candidate coordination points, and EV charging locations.</p>
              </div>
              <ArrowRight size={19} />
            </button>
          </div>
        </section>

        {routeSignals.length > 0 && (
          <section>
            <h2 className="section-title">My commute signals</h2>
            <div className="space-y-4">
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
          </section>
        )}

        {routeSignals.length === 0 && (
          <section>
            <h2 className="section-title">Example commute signals</h2>
            <div className="space-y-4">
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
          </section>
        )}
      </div>
    </div>
  );
};
