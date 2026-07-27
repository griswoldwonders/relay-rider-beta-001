import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BatteryCharging,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Info,
  MapPin,
  Route,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Header } from '../components/Header';
import {
  marketplaceMatches,
  MarketplaceFilter,
  MarketplaceMatch,
} from '../data/marketplaceData';

const filters: { id: MarketplaceFilter | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'best-fit', label: 'Best fit' },
  { id: 'morning', label: 'Morning' },
  { id: 'ev-only', label: 'EV only' },
  { id: 'low-detour', label: 'Low detour' },
];

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="score-ring"
      style={{ '--match-score': `${score * 3.6}deg` } as React.CSSProperties}
      aria-label={`${score}% demo match score`}
    >
      <span>{score}</span>
      <small>%</small>
    </div>
  );
}

function MatchCard({
  match,
  expanded,
  saved,
  onExpand,
  onSave,
}: {
  match: MarketplaceMatch;
  expanded: boolean;
  saved: boolean;
  onExpand: () => void;
  onSave: () => void;
}) {
  return (
    <article className="market-match-card">
      <div className="market-match-card__top">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="m3-badge m3-badge--green">{match.vehicleStatus}</span>
            <span className="m3-badge">{match.adminStatus}</span>
          </div>
          <h2>{match.startArea} <ArrowRight size={16} /> {match.endArea}</h2>
          <p>{match.driverFirstName}'s planned route · {match.vehicle}</p>
        </div>
        <ScoreRing score={match.totalScore} />
      </div>

      <div className="market-route-line" aria-hidden="true">
        <span />
        <i />
        <span />
      </div>

      <div className="market-facts">
        <div><Clock3 size={17} /><span><strong>{match.departureWindow}</strong>{match.days}</span></div>
        <div><Route size={17} /><span><strong>{match.detourMinutes} min</strong>modeled detour</span></div>
        <div><Users size={17} /><span><strong>{match.seats} open</strong>demo seat signal</span></div>
        <div><MapPin size={17} /><span><strong>Anchor Point</strong>{match.anchorPoint}</span></div>
      </div>

      <div className="market-contribution">
        <div>
          <span>Suggested route contribution</span>
          <strong>${match.suggestedContribution}</strong>
        </div>
        <p>Bid signal only · no payment processing</p>
      </div>

      <button type="button" className="score-disclosure" onClick={onExpand} aria-expanded={expanded}>
        <span><Info size={16} /> Why this match?</span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="score-breakdown animate-fade-in">
          <p className="score-breakdown__label">Prototype scoring model · pilot review only</p>
          {match.factors.map(factor => (
            <div key={factor.label} className="score-factor">
              <div>
                <span>{factor.label}</span>
                <strong>{factor.value}%</strong>
              </div>
              <div className="score-factor__bar"><span style={{ width: `${factor.value}%` }} /></div>
              <small>{factor.detail}</small>
            </div>
          ))}
        </div>
      )}

      <div className="market-actions">
        <md-outlined-button onClick={onSave}>
          <Bookmark slot="icon" size={16} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Saved preview' : 'Save preview'}
        </md-outlined-button>
        <md-filled-button onClick={onExpand}>
          <ArrowRight slot="icon" size={16} />
          Review match
        </md-filled-button>
      </div>
    </article>
  );
}

export function MarketplaceScreen() {
  const [activeFilter, setActiveFilter] = useState<MarketplaceFilter | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(marketplaceMatches[0].id);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const matches = useMemo(
    () =>
      activeFilter === 'all'
        ? marketplaceMatches
        : marketplaceMatches.filter(match => match.filters.includes(activeFilter)),
    [activeFilter],
  );

  const toggleSaved = (id: string) => {
    setSavedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)] pb-28">
      <Header
        title="Match marketplace"
        subtitle="Compare planned-route opportunities along your corridor."
      />

      <main className="container py-5">
        <section className="market-hero">
          <div className="market-hero__eyebrow"><BatteryCharging size={16} /> EV/hybrid-first</div>
          <h1>Routes already moving your way.</h1>
          <p>
            Review explainable match previews using corridor overlap, timing, detour impact,
            Anchor Point fit, and rider bid signals.
          </p>
          <div className="market-hero__meta">
            <span><CheckCircle2 size={15} /> Adult riders</span>
            <span><ShieldCheck size={15} /> Admin review</span>
          </div>
        </section>

        <section className="market-filter-section" aria-label="Marketplace filters">
          <div className="market-section-heading">
            <div>
              <h2>Candidate matches</h2>
              <p>{matches.length} demo previews · Pasadena–Eagle Rock–Glendale</p>
            </div>
          </div>
          <div className="m3-chip-row">
            {filters.map(filter => (
              <md-filter-chip
                key={filter.id}
                selected={activeFilter === filter.id}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </md-filter-chip>
            ))}
          </div>
        </section>

        <div className="market-notice">
          <ShieldCheck size={19} />
          <p>
            <strong>Research Beta.</strong> These are simulated match previews, not transportation offers.
            No payment or live route activation occurs. Admin, driver, legal, and insurance review are required.
          </p>
        </div>

        <div className="space-y-4">
          {matches.length > 0 ? (
            matches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                expanded={expandedId === match.id}
                saved={savedIds.includes(match.id)}
                onExpand={() => setExpandedId(current => current === match.id ? null : match.id)}
                onSave={() => toggleSaved(match.id)}
              />
            ))
          ) : (
            <div className="market-empty">
              <Route size={34} />
              <h2>No previews match this filter</h2>
              <p>Try another filter or submit a route request to add a new research signal.</p>
              <md-outlined-button onClick={() => setActiveFilter('all')}>View all previews</md-outlined-button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
