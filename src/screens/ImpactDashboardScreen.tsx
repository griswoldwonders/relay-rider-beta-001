import React from 'react';
import { BarChart3, BatteryCharging, CarFront, Leaf, MapPinned, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Header';
import { impactMethodology, impactMetrics } from '../data/impactMetrics';

interface ImpactDashboardScreenProps { onBack: () => void; }

const icons = {
  'avoided-miles': CarFront,
  emissions: Leaf,
  'ev-share': BatteryCharging,
  'access-points': MapPinned,
};

export const ImpactDashboardScreen: React.FC<ImpactDashboardScreenProps> = ({ onBack }) => (
  <div className="impact-screen min-h-screen">
    <Header title="Impact dashboard" subtitle="Pre-pilot projections for corridor review" onBack={onBack} showBack />
    <main className="container impact-shell">
      <section className="impact-hero">
        <span><BarChart3 size={15} /> Pasadena · Eagle Rock · Glendale</span>
        <h1>What a controlled corridor pilot could help test</h1>
        <p>These modeled indicators help partners discuss a pilot. They are not measured environmental outcomes, certified reductions, or guaranteed transportation results.</p>
      </section>

      <section className="impact-grid" aria-label="Demo impact metrics">
        {impactMetrics.map(metric => {
          const Icon = icons[metric.id as keyof typeof icons];
          return (
            <article className="impact-card" key={metric.id}>
              <div className="impact-card__top"><span className="impact-card__icon"><Icon size={21} /></span><em>{metric.status}</em></div>
              <strong>{metric.value}</strong>
              <h2>{metric.label}</h2>
              <small>{metric.unit}</small>
              <div className="impact-progress" aria-label={`${metric.label}: ${metric.progress}% demonstration progress`}><span style={{ width: `${metric.progress}%` }} /></div>
              <p>{metric.description}</p>
            </article>
          );
        })}
      </section>

      <section className="impact-method">
        <span className="impact-section-kicker">Transparent assumptions</span>
        <h2>Prototype methodology</h2>
        <ul>{impactMethodology.map(item => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className="impact-guardrail">
        <ShieldCheck size={21} />
        <div><strong>Validation required</strong><p>Real reporting would require reviewed participant records, an approved baseline, documented calculation methods, and partner sign-off. No result shown here is a certified carbon claim.</p></div>
      </section>
    </main>
  </div>
);
