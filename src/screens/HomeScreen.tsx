import React from 'react';
import {
  ArrowRight,
  BatteryCharging,
  CalendarDays,
  CarFront,
  ChevronRight,
  Coins,
  FlaskConical,
  BarChart3,
  CircleHelp,
  Gift,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
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
  onOpenImpact: () => void;
  onOpenHowItWorks: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartRouteSignal,
  onShareEVRoute,
  onSuggestRelayZone,
  onBrowseOptions,
  onBrowseMatches,
  onBrowseActivity,
  onOpenGreenWallet,
  onOpenImpact,
  onOpenHowItWorks,
}) => {
  const { routeSignals, greenRouteCredits } = useApp();
  const totalCredits = greenRouteCredits.reduce((sum, credit) => sum + (credit.amountUnits ?? credit.amount ?? 0), 0);
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
            <h1>EV commuter program</h1>
          </div>
          <span className="home-entry-beta"><FlaskConical size={15} /> Research beta</span>
        </header>

        {isFirstVisit ? (
          <>
            <section className="home-entry-hero" aria-labelledby="home-entry-title">
              <div className="home-entry-hero__copy">
                <span className="home-entry-kicker">Start here</span>
                <h2 id="home-entry-title">Earn benefits from the way you already commute</h2>
                <p>Explore EV and hybrid commuter options, participate in planned-route programs, and use Green Route Credits for eligible benefits.</p>
              </div>

              <HomeCampusIllustration />

              <button type="button" className="home-entry-primary" onClick={onOpenGreenWallet}>
                <Gift size={20} /> Open Green Wallet
              </button>
              <button type="button" className="home-entry-secondary" onClick={onStartRouteSignal}>
                Set up my EV commute <ArrowRight size={17} />
              </button>
            </section>

            <section className="home-entry-feature-list" aria-label="What Relay Rider helps you do">
              <button type="button" className="home-entry-feature home-entry-feature--plan" onClick={onOpenGreenWallet}>
                <span className="home-entry-feature__visual"><BatteryCharging size={29} /></span>
                <span className="home-entry-feature__number">1</span>
                <span className="home-entry-feature__copy"><strong>Incentives</strong><small>See Green Route Credits, eligible EV benefits, and what to do next.</small></span>
                <ChevronRight size={22} />
              </button>

              <button type="button" className="home-entry-feature home-entry-feature--matches" onClick={onBrowseOptions}>
                <span className="home-entry-feature__visual"><CarFront size={29} /></span>
                <span className="home-entry-feature__number">2</span>
                <span className="home-entry-feature__copy"><strong>EV options</strong><small>Compare planned EV and hybrid commute options around your schedule.</small></span>
                <ChevronRight size={22} />
              </button>

              <button type="button" className="home-entry-feature home-entry-feature--benefits" onClick={onBrowseMatches}>
                <span className="home-entry-feature__visual"><Gift size={29} /></span>
                <span className="home-entry-feature__number">3</span>
                <span className="home-entry-feature__copy"><strong>Connections</strong><small>Explore compatible planned-route participants without on-demand ride language.</small></span>
                <ChevronRight size={22} />
              </button>
            </section>

            <section className="home-entry-learn" aria-label="Learn about Relay Rider">
              <button type="button" onClick={onOpenHowItWorks}><CircleHelp size={20} /><span><strong>How Relay Rider works</strong><small>See the five-step research-beta process.</small></span><ChevronRight size={20} /></button>
              <button type="button" onClick={onOpenImpact}><BarChart3 size={20} /><span><strong>Impact dashboard</strong><small>Review transparent pre-pilot estimates.</small></span><ChevronRight size={20} /></button>
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
                <h2>EV program <span>·</span> {origin} → {destination}</h2>
                <div className="home-returning-meta">
                  <span><CalendarDays size={15} /> {days}</span>
                  <span><Route size={15} /> {timeWindow}</span>
                </div>
              </div>
              <div className="home-returning-scene" aria-hidden="true">
                <CarFront size={42} />
                <MapPinned size={34} />
              </div>
              <button type="button" className="home-entry-primary" onClick={onOpenGreenWallet}>
                <Gift size={19} /> View my incentives
              </button>
            </section>

            <section className="home-returning-metrics" aria-label="EV program snapshot">
              <button type="button" onClick={onOpenGreenWallet}><strong>{totalCredits}</strong><span>Credits</span><small>program benefits</small></button>
              <button type="button" onClick={onBrowseOptions}><strong>{commuteOptions.length}</strong><span>EV options</span><small>planned-route previews</small></button>
              <button type="button" onClick={onBrowseMatches}><strong>{commuterMatchTemplates.length}</strong><span>Connections</span><small>route-fit previews</small></button>
            </section>

            <button type="button" className="home-next-step" onClick={onOpenGreenWallet}>
              <span className="home-next-step__icon"><ArrowRight size={24} /></span>
              <span><strong>Best next step</strong><small>Open Green Wallet to review available benefits and request an EV Charge Credit at an eligible Charging Hub.</small><em>View incentives <ArrowRight size={14} /></em></span>
            </button>

            <section>
              <div className="home-returning-section-heading"><h2>Continue your EV program journey</h2></div>
              <div className="home-returning-explore">
                <button type="button" onClick={onSuggestRelayZone}><MapPinned size={22} /><strong>Charging & Access</strong><small>Hubs & corridors</small></button>
                <button type="button" onClick={onShareEVRoute}><BatteryCharging size={22} /><strong>EV options</strong><small>Planned routes</small></button>
                <button type="button" onClick={onBrowseActivity}><Route size={22} /><strong>Participation</strong><small>Signals & credits</small></button>
                <button type="button" onClick={onOpenGreenWallet}><Coins size={22} /><strong>Green Wallet</strong><small>Credits & redemption</small></button>
                <button type="button" onClick={onOpenImpact}><BarChart3 size={22} /><strong>Impact</strong><small>Pilot estimates</small></button>
                <button type="button" onClick={onOpenHowItWorks}><CircleHelp size={22} /><strong>How it works</strong><small>Process & review</small></button>
              </div>
            </section>

            <section className="home-entry-trust" aria-label="Prototype guardrails">
              <span><ShieldCheck size={15} /> Approximate areas first</span>
              <span>Planned-route connections only</span>
              <span>Program benefits only</span>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
