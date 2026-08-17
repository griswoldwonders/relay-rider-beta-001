import React from 'react';
import { BatteryCharging, ClipboardCheck, MapPinned, Route, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { Header } from '../components/Header';

interface HowItWorksScreenProps {
  onBack: () => void;
  onStartCommute: () => void;
  onPostRoute: () => void;
}

const steps = [
  { icon: UserRound, number: '01', title: 'Share an adult commute need', body: 'Submit approximate areas, a preferred time window, walking tolerance, and campus affiliation. This is a route request for pilot research—not an immediate transportation booking.' },
  { icon: BatteryCharging, number: '02', title: 'Post a route already planned', body: 'Verified or pending EV/hybrid participants describe a route they already expect to travel, including schedule and comfortable detour limits.' },
  { icon: MapPinned, number: '03', title: 'Prefer public Access Points', body: 'Candidate transit stops, campus edges, and other public locations reduce exact-location sharing. Every candidate still requires site, accessibility, safety, and partner review.' },
  { icon: Sparkles, number: '04', title: 'Preview compatibility', body: 'The prototype compares route overlap, schedule fit, modeled detour, walking distance, EV/hybrid preference, and Access Point fit using explainable demo scoring.' },
  { icon: ClipboardCheck, number: '05', title: 'Pause for administrative review', body: 'A match preview does not activate a route. Program, verification, privacy, legal, insurance, and operational gates must be reviewed before any controlled pilot use.' },
];

export const HowItWorksScreen: React.FC<HowItWorksScreenProps> = ({ onBack, onStartCommute, onPostRoute }) => (
  <div className="how-screen min-h-screen">
    <Header title="How it works" subtitle="Planned-route coordination, explained" onBack={onBack} showBack />
    <main className="container how-shell">
      <section className="how-hero">
        <span><Route size={15} /> Research beta</span>
        <h1>Who is already driving this way?</h1>
        <p>Relay Rider compares adult commute needs with EV/hybrid routes people already plan to travel across a shared local corridor.</p>
      </section>

      <section className="how-steps" aria-label="How Relay Rider works">
        {steps.map(({ icon: Icon, number, title, body }) => (
          <article className="how-step" key={number}>
            <div className="how-step__rail"><span><Icon size={20} /></span><i /></div>
            <div><small>{number}</small><h2>{title}</h2><p>{body}</p></div>
          </article>
        ))}
      </section>

      <section className="how-not-live">
        <ShieldCheck size={22} />
        <div><strong>Not active transportation service</strong><p>No live dispatch, payment processing, guaranteed transportation, exact-location tracking, or automatic route activation is available in this prototype.</p></div>
      </section>

      <section className="how-actions">
        <button type="button" className="btn-primary" onClick={onStartCommute}>Set up my commute</button>
        <button type="button" className="btn-outline" onClick={onPostRoute}>Register a planned EV/hybrid route</button>
      </section>
    </main>
  </div>
);
