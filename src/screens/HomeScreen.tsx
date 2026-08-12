import React from 'react';
import {
  ArrowRight,
  BatteryCharging,
  Bell,
  BusFront,
  CalendarDays,
  CarFront,
  Clock3,
  Coins,
  Leaf,
  MapPinned,
  Route,
  Sparkles,
  TrainFront,
  UsersRound,
} from 'lucide-react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';

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
  const days = latestSignal?.daysOfWeek?.length ? latestSignal.daysOfWeek.join(', ') : 'Mon, Wed, Fri';
  const school = latestSignal?.campusAffiliation || 'PCC demonstration program';

  return (
    <div className="min-h-screen bg-[#f8faf8] pb-32">
      <Header title="Home" subtitle="Your commute at a glance." />

      <main className="container mockup-home">
        <section className="mockup-home__hero">
          <div>
            <span className="mobile-section-kicker">Relay Rider</span>
            <h1>Good evening 👋</h1>
            <p>Here’s your commute overview. Demo and modeled values are labeled before partner use.</p>
          </div>
          <span className="mockup-program-pill"><Leaf size={14} /> {school}</span>
        </section>

        <section className="mockup-metric-grid" aria-label="Commute snapshot">
          <button type="button" className="mockup-metric-card" onClick={onOpenGreenWallet}>
            <span className="mockup-metric-card__icon"><Coins size={18} /></span>
            <strong>{totalCredits}</strong>
            <span>Green Route Credits · program benefit</span>
          </button>
          <button type="button" className="mockup-metric-card" onClick={onBrowseOptions}>
            <span className="mockup-metric-card__icon"><Leaf size={18} /></span>
            <strong>24 lb</strong>
            <span>modeled CO₂ avoided · demonstration</span>
          </button>
          <button type="button" className="mockup-metric-card" onClick={onBrowseMatches}>
            <span className="mockup-metric-card__icon"><UsersRound size={18} /></span>
            <strong>4</strong>
            <span>compatible commuter previews</span>
          </button>
          <button type="button" className="mockup-metric-card" onClick={onBrowseActivity}>
            <span className="mockup-metric-card__icon"><Route size={18} /></span>
            <strong>{Math.max(routeSignals.length, 3)}</strong>
            <span>commute signals / demo activity</span>
          </button>
        </section>

        <section>
          <div className="mockup-section-heading">
            <h2>Your current commute</h2>
            <button type="button" onClick={onStartRouteSignal}>Edit <ArrowRight size={13} /></button>
          </div>

          <article className="mockup-trip-card">
            <div className="mockup-trip-card__row">
              <div className="mockup-trip-card__date"><span>AUG</span><strong>12</strong></div>
              <div className="mockup-trip-card__body">
                <span className="mockup-status"><Sparkles size={10} /> Profile ready</span>
                <h3>{origin} → {destination}</h3>
                <p><Clock3 size={11} className="inline mr-1" />{timeWindow} · {days}</p>
                <p><MapPinned size={11} className="inline mr-1" />Approximate zones only. Access Point and route details remain preview-level until review.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="mockup-primary-button" onClick={onBrowseOptions}><TrainFront size={15} /> Plan commute</button>
              <button type="button" className="mockup-primary-button" onClick={onBrowseMatches}><UsersRound size={15} /> Find matches</button>
            </div>
          </article>
        </section>

        <section className="mockup-home-grid">
          <article className="mockup-feature-card">
            <span className="mobile-section-kicker">Make your commute greener</span>
            <h3>Compare the best-fit options for your schedule.</h3>
            <p>See transit, planned-route previews, walking burden, schedule fit, and modeled impact without implying guaranteed transportation.</p>
            <button type="button" className="mockup-primary-button" onClick={onBrowseOptions}>Explore options <ArrowRight size={14} /></button>
          </article>

          <article className="mockup-announcement-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="mobile-section-kicker">Announcements</span>
                <h3>Access Point review</h3>
              </div>
              <Bell size={18} />
            </div>
            <p>A candidate public Access Point can be reviewed near the Eagle Rock → Pasadena corridor. This is a demonstration prompt, not an approved location.</p>
            <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--rr-green-dark)]" onClick={onSuggestRelayZone}>Open map <ArrowRight size={13} /></button>
          </article>
        </section>

        <section>
          <div className="mockup-section-heading">
            <h2>Quick actions</h2>
          </div>
          <div className="compact-action-grid">
            <button type="button" onClick={onStartRouteSignal} className="compact-action-card compact-action-card--mint">
              <span><CalendarDays size={20} /></span>
              <strong>Plan my commute</strong>
              <small>Update campus, approximate origin, schedule, and preferences.</small>
            </button>
            <button type="button" onClick={onBrowseMatches} className="compact-action-card compact-action-card--lavender">
              <span><UsersRound size={20} /></span>
              <strong>Browse matches</strong>
              <small>Review compatible planned-route previews and limiting factors.</small>
            </button>
            <button type="button" onClick={onShareEVRoute} className="compact-action-card compact-action-card--peach">
              <span><BatteryCharging size={20} /></span>
              <strong>Register planned EV route</strong>
              <small>Share a route you already intend to travel.</small>
            </button>
            <button type="button" onClick={onOpenGreenWallet} className="compact-action-card compact-action-card--mint">
              <span><Coins size={20} /></span>
              <strong>Green Route Wallet</strong>
              <small>Track promotional program credits, activity, and challenges.</small>
            </button>
            <button type="button" onClick={onSuggestRelayZone} className="compact-action-card compact-action-card--wide compact-action-card--lavender">
              <span><BusFront size={20} /></span>
              <div><strong>Explore mobility map</strong><small>Transit hubs, candidate Access Points, and EV charging locations.</small></div>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <p className="micro-disclaimer">Research beta. CO₂, travel-time, score, and route-impact values are modeled or synthetic unless explicitly labeled reported/imported. Planned-route previews require administrative review.</p>
      </main>
    </div>
  );
};
