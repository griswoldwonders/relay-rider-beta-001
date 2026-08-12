import React from 'react';
import {
  ArrowRight,
  BatteryCharging,
  BusFront,
  CalendarDays,
  CarFront,
  ChevronRight,
  Coins,
  FlaskConical,
  Gift,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
  TrainFront,
} from 'lucide-react';
import { HomeCampusIllustration } from '../components/HomeCampusIllustration';
import { useApp } from '../context/AppContext';
import { commuteOptions } from '../data/commuteOptionsData';
import { commuterMatchTemplates } from '../data/commuterMatchesData';

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
  const isFirstVisit = !latestSignal;

  const origin = latestSignal?.startingArea || 'Eagle Rock';
  const destination = latestSignal?.destinationArea || 'Pasadena City College';
  const timeWindow = latestSignal?.timeWindow || 'Arrive around 8:00 AM';
  const days = latestSignal?.daysOfWeek?.length ? latestSignal.daysOfWeek.join(' · ') : 'Mon · Wed · Fri';

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-32">
      <main className="container home-entry-shell">
        <header className="home-entry-header">
          <div>
            <span className="home-entry-kicker">Relay Rider</span>
            <h1>Campus commute</h1>
          </div>
          <span className="home-entry-beta"><FlaskConical size={15} /> Research beta</span>
        </header>

        {isFirstVisit ? (
          <>
            <section className="home-entry-hero" aria-labelledby="home-entry-title">
              <div className="home-entry-hero__copy">
                <span className="home-entry-kicker">Start here</span>
                <h2 id="home-entry-title">Find a better way to campus</h2>
                <p>Compare transit, planned commuter routes, Access Points, and mobility benefits around your schedule.</p>
              </div>

              <HomeCampusIllustration />

              <button type="button" className="home-entry-primary" onClick={onStartRouteSignal}>
                <Sparkles size={20} /> Set up my commute
              </button>
              <button type="button" className="home-entry-secondary" onClick={onShareEVRoute}>
                Register a planned EV/hybrid route <ArrowRight size={17} />
              </button>
            </section>

            <section className="home-entry-feature-list" aria-label="What Relay Rider helps you do">
              <button type="button" className="home-entry-feature home-entry-feature--plan" onClick={onStartRouteSignal}>
                <span className="home-entry-feature__visual"><TrainFront size={29} /></span>
                <span className="home-entry-feature__number">1</span>
                <span className="home-entry-feature__copy"><strong>Plan</strong><small>Compare transit and commute options that fit your schedule.</small></span>
                <ChevronRight size={22} />
              </button>

              <button type="button" className="home-entry-feature home-entry-feature--matches" onClick={onBrowseMatches}>
                <span className="home-entry-feature__visual"><CarFront size={29} /></span>
                <span className="home-entry-feature__number">2</span>
                <span className="home-entry-feature__copy"><strong>Matches</strong><small>Browse compatible planned-route previews around your commute.</small></span>
                <ChevronRight size={22} />
              </button>

              <button type="button" className="home-entry-feature home-entry-feature--benefits" onClick={onOpenGreenWallet}>
                <span className="home-entry-feature__visual"><Gift size={29} /></span>
                <span className="home-entry-feature__number">3</span>
                <span className="home-entry-feature__copy"><strong>Benefits</strong><small>See eligible Green Route Credits and institution-sponsored benefits.</small></span>
                <ChevronRight size={22} />
              </button>
            </section>

            <section className="home-entry-trust" aria-label="Prototype guardrails">
              <span><ShieldCheck size={15} /> Approximate areas first</span>
              <span>Research beta</span>
              <span>No guaranteed transportation</span>
            </section>
          </>
        ) : (
          <>
            <section className="home-returning-hero">
              <div className="home-returning-hero__copy">
                <span className="home-entry-kicker">Your commute</span>
                <h2>{origin} <span>→</span> {destination}</h2>
                <div className="home-returning-meta">
                  <span><CalendarDays size={15} /> {days}</span>
                  <span><Route size={15} /> {timeWindow}</span>
                </div>
              </div>
              <div className="home-returning-scene" aria-hidden="true">
                <BusFront size={42} />
                <MapPinned size={34} />
              </div>
              <button type="button" className="home-entry-primary" onClick={onBrowseOptions}>
                <Sparkles size={19} /> Plan today’s commute
              </button>
            </section>

            <section className="home-returning-metrics" aria-label="Commute snapshot">
              <button type="button" onClick={onBrowseOptions}><strong>{commuteOptions.length}</strong><span>Options</span><small>prototype bundle</small></button>
              <button type="button" onClick={onBrowseMatches}><strong>{commuterMatchTemplates.length}</strong><span>Matches</span><small>planned-route previews</small></button>
              <button type="button" onClick={onOpenGreenWallet}><strong>{totalCredits}</strong><span>Credits</span><small>program benefits</small></button>
            </section>

            <button type="button" className="home-next-step" onClick={onBrowseOptions}>
              <span className="home-next-step__icon"><ArrowRight size={24} /></span>
              <span><strong>Best next step</strong><small>Compare options that align with your schedule, walking preference, and campus destination.</small><em>View commute options <ArrowRight size={14} /></em></span>
            </button>

            <section>
              <div className="home-returning-section-heading"><h2>Explore</h2></div>
              <div className="home-returning-explore">
                <button type="button" onClick={onSuggestRelayZone}><MapPinned size={22} /><strong>Map</strong><small>Routes & hubs</small></button>
                <button type="button" onClick={onShareEVRoute}><BatteryCharging size={22} /><strong>EV route</strong><small>Planned route</small></button>
                <button type="button" onClick={onBrowseActivity}><Route size={22} /><strong>Activity</strong><small>Signals & status</small></button>
                <button type="button" onClick={onOpenGreenWallet}><Coins size={22} /><strong>Wallet</strong><small>Credits & benefits</small></button>
              </div>
            </section>

            <section className="home-entry-trust" aria-label="Prototype guardrails">
              <span><ShieldCheck size={15} /> Approximate areas first</span>
              <span>Match previews only</span>
              <span>Program benefits only</span>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
