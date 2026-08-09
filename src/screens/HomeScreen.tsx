import React from 'react';
import { ArrowRight, BatteryCharging, BusFront, Clock3, Gift, ListChecks, MapPinned, ShieldCheck, Sparkles, TrainFront, UsersRound } from 'lucide-react';
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
  onBrowseMatches: () => void;
  onBrowseActivity: () => void;
  onOpenGreenWallet: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartRouteSignal,
  onShareEVRoute,
  onSuggestRelayZone,
  onBrowseOptions,
  onBrowseMatches,
  onBrowseActivity,
  onOpenGreenWallet,
}) => {
  const { routeSignals, greenRouteCredits } = useApp();
  const totalCredits = greenRouteCredits.reduce((sum, credit) => sum + credit.amount, 0);
  const latestSignal = routeSignals.length > 0 ? routeSignals[routeSignals.length - 1] : null;
  const origin = latestSignal?.startingArea || 'Eagle Rock';
  const destination = latestSignal?.destinationArea || 'Pasadena City College';
  const timeWindow = latestSignal?.timeWindow || 'Arrive around 8:00 AM';
  const school = latestSignal?.campusAffiliation || 'PCC demo profile';

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-32">
      <Header title="Your commute" subtitle="Plan, compare, and browse compatible campus options." />

      <div className="container mobile-dashboard-shell">
        <section className="commute-planner-card">
          <div className="commute-planner-card__topline">
            <span><Sparkles size={15} /> Plan my commute</span>
            <span className="compact-status-pill"><ShieldCheck size={12} /> Research beta</span>
          </div>
          <h1>{origin} <span>→</span> {destination}</h1>
          <p>Set your school, travel window, walking tolerance, transit preferences, and program interests. Relay Rider will rank a commute bundle and compatible planned-route previews around your inputs.</p>

          <div className="commute-input-pills" aria-label="Current commute profile summary">
            <span><TrainFront size={14} /> {school}</span>
            <span><Clock3 size={14} /> {timeWindow}</span>
            <span><BusFront size={14} /> Transit + planned routes</span>
          </div>

          <button type="button" className="commute-primary-action" onClick={onStartRouteSignal}>
            <Sparkles size={18} />
            <span>{latestSignal ? 'Update commute profile' : 'Set up my commute'}</span>
          </button>
        </section>

        <ResearchBetaBanner />

        <section>
          <div className="mobile-section-heading">
            <div>
              <span className="mobile-section-kicker">Today</span>
              <h2>Your commute snapshot</h2>
            </div>
            <button type="button" className="text-link-button" onClick={onBrowseMatches}>See matches <ArrowRight size={14} /></button>
          </div>

          <div className="commute-metric-grid">
            <button type="button" className="commute-metric-card commute-metric-card--violet" onClick={onBrowseMatches}>
              <span className="commute-metric-card__icon"><UsersRound size={18} /></span>
              <strong>4</strong>
              <small>commuter match previews</small>
            </button>
            <button type="button" className="commute-metric-card commute-metric-card--yellow" onClick={onBrowseOptions}>
              <span className="commute-metric-card__icon"><TrainFront size={18} /></span>
              <strong>Ranked</strong>
              <small>multimodal options</small>
            </button>
            <button type="button" className="commute-metric-card commute-metric-card--mint" onClick={onSuggestRelayZone}>
              <span className="commute-metric-card__icon"><MapPinned size={18} /></span>
              <strong>Access</strong>
              <small>points + transit hubs</small>
            </button>
            <div className="commute-metric-card commute-metric-card--peach">
              <span className="commute-metric-card__icon"><Gift size={18} /></span>
              <strong>{totalCredits}</strong>
              <small>Green Route Credits</small>
            </div>
          </div>
          <p className="micro-disclaimer">Commuter matches are modeled previews only. Swiping or saving does not accept, activate, or guarantee transportation.</p>
        </section>

        <button type="button" className="benefit-dashboard-card w-full text-left" onClick={onOpenGreenWallet}>
          <div className="benefit-dashboard-card__header">
            <div>
              <span className="mobile-section-kicker">Benefits</span>
              <h2>College commute program</h2>
            </div>
            <span className="benefit-credit-pill"><Gift size={14} /> {totalCredits} credits</span>
          </div>
          <div className="benefit-progress-row">
            <div><strong>Transit participation</strong><span>Preference-aware</span></div>
            <div><strong>Clean-route activity</strong><span>Program dependent</span></div>
            <div><strong>Access Point feedback</strong><span>Eligible research signal</span></div>
          </div>
          <p>Green Route Credits are capped promotional participation benefits. They are not cash, fares, wages, or guaranteed payments.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-iris">Open Green Route Wallet <ArrowRight size={14} /></span>
        </button>

        <section>
          <div className="mobile-section-heading">
            <div>
              <span className="mobile-section-kicker">Shortcuts</span>
              <h2>What do you want to do?</h2>
            </div>
          </div>

          <div className="compact-action-grid">
            <button type="button" onClick={onBrowseMatches} className="compact-action-card compact-action-card--lavender">
              <span><UsersRound size={20} /></span>
              <strong>Browse matches</strong>
              <small>Swipe through compatible planned-route previews.</small>
            </button>
            <button type="button" onClick={onBrowseOptions} className="compact-action-card compact-action-card--mint">
              <span><TrainFront size={20} /></span>
              <strong>Compare options</strong>
              <small>Rank Metro, local transit, and Relay Rider previews.</small>
            </button>
            <button type="button" onClick={onShareEVRoute} className="compact-action-card compact-action-card--peach">
              <span><BatteryCharging size={20} /></span>
              <strong>Planned EV route</strong>
              <small>Register a route you already intend to drive.</small>
            </button>
            <button type="button" onClick={onBrowseActivity} className="compact-action-card compact-action-card--lavender">
              <span><ListChecks size={20} /></span>
              <strong>Activity</strong>
              <small>Review commute signals and planned routes.</small>
            </button>
            <button type="button" onClick={onSuggestRelayZone} className="compact-action-card compact-action-card--peach compact-action-card--wide">
              <span><MapPinned size={20} /></span>
              <div><strong>Explore the corridor map</strong><small>Transit hubs, candidate Access Points, and EV charging locations.</small></div>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {routeSignals.length > 0 && (
          <section>
            <div className="mobile-section-heading"><div><span className="mobile-section-kicker">Activity</span><h2>My commute signals</h2></div></div>
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
            <div className="mobile-section-heading"><div><span className="mobile-section-kicker">Preview</span><h2>Example commute signals</h2></div></div>
            <div className="space-y-4">
              {sampleRouteSignals.slice(0, 2).map((signal, idx) => (
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
