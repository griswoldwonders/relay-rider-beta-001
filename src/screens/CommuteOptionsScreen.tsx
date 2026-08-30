import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BusFront,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Footprints,
  Gift,
  Info,
  MapPin,
  PackageSearch,
  Route,
  ShieldCheck,
  Sparkles,
  TrainFront,
} from 'lucide-react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import {
  commuteOptions,
  CommuteOptionFilter,
} from '../data/commuteOptionsData';
import {
  profileFromRouteSignal,
  rankCommuteOptions,
  RankedCommuteOption,
} from '../lib/commuteRanking';

const filters: { id: CommuteOptionFilter | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'best-fit', label: 'Best fit' },
  { id: 'transit', label: 'Transit' },
  { id: 'free-college', label: '$0 / student' },
  { id: 'morning', label: 'Morning' },
  { id: 'ev-hybrid', label: 'EV / hybrid' },
];

function getOptionTheme(option: RankedCommuteOption) {
  if (option.kind === 'relay') return 'option-theme--relay';
  if (option.provider.toLowerCase().includes('pasadena')) return 'option-theme--local';
  if (option.title.toLowerCase().includes('a line')) return 'option-theme--rail';
  if (option.provider.toLowerCase().includes('glendale')) return 'option-theme--glendale';
  return 'option-theme--bus';
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="score-ring"
      style={{ '--match-score': `${score * 3.6}deg` } as React.CSSProperties}
      aria-label={`${score}% personalized compatibility score`}
    >
      <span>{score}</span>
      <small>%</small>
    </div>
  );
}

function OptionCard({
  option,
  expanded,
  saved,
  onExpand,
  onSave,
}: {
  option: RankedCommuteOption;
  expanded: boolean;
  saved: boolean;
  onExpand: () => void;
  onSave: () => void;
}) {
  const isTransit = option.kind === 'transit';
  const theme = getOptionTheme(option);

  return (
    <article className={`market-match-card ${theme} ${option.rank === 1 ? 'market-match-card--top' : ''}`}>
      <div className="option-card-heading">
        <div className="min-w-0">
          <div className="option-card-badges">
            <span className={`m3-badge ${option.rank === 1 ? 'm3-badge--best' : ''}`}>
              {option.rank === 1 ? <><Sparkles size={11} /> Best fit</> : `#${option.rank}`}
            </span>
            <span className="m3-badge">{isTransit ? 'Transit' : 'Planned route'}</span>
          </div>
          <p className="option-card-provider">{option.provider}</p>
          <h2>{option.title}</h2>
          <p className="option-card-route">{option.startArea} <ArrowRight size={14} /> {option.endArea}</p>
        </div>
        <div className="option-card-actions-top">
          <ScoreRing score={option.fitScore} />
          <button type="button" className="round-save-button" onClick={onSave} aria-label={saved ? 'Remove saved option' : 'Save option'}>
            <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="option-metric-strip" aria-label="Modeled commute metrics">
        <div><Clock3 size={17} /><strong>~{option.modeledDurationMinutes}</strong><span>min</span></div>
        <div><Footprints size={17} /><strong>~{option.walkingMinutes}</strong><span>walk</span></div>
        <div><Route size={17} /><strong>{option.transferCount}</strong><span>transfer{option.transferCount === 1 ? '' : 's'}</span></div>
        <div><CheckCircle2 size={17} /><strong>{option.scheduleFit}</strong><span>schedule</span></div>
      </div>

      <div className="option-reason-card">
        <span>Why recommended</span>
        <p>{option.reasons[0]}</p>
      </div>

      <div className="option-detail-row">
        <MapPin size={16} />
        <div><strong>{option.accessPoint}</strong><span>Access Point / boarding area</span></div>
      </div>

      <div className="option-value-band">
        <div>
          <span>{isTransit ? 'Student fare / program status' : 'College-program participation'}</span>
          <strong>{option.resolvedCostLabel}</strong>
        </div>
        {option.resolvedBenefitLabel && (
          <div className="option-incentive-pill"><Gift size={14} /><span>{option.resolvedBenefitLabel}</span></div>
        )}
      </div>

      <button type="button" className="score-disclosure" onClick={onExpand} aria-expanded={expanded}>
        <span><Info size={16} /> Why this option?</span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="score-breakdown animate-fade-in">
          <p className="score-breakdown__label">Personalized prototype ranking · modeled, not live routing</p>
          <ul className="option-reason-list">
            {option.reasons.map(reason => (
              <li key={reason}><CheckCircle2 size={14} /><span>{reason}</span></li>
            ))}
          </ul>
          {option.factors.map(factor => (
            <div key={factor.label} className="score-factor">
              <div><span>{factor.label}</span><strong>{factor.value}%</strong></div>
              <div className="score-factor__bar"><span style={{ width: `${factor.value}%` }} /></div>
              <small>{factor.detail}</small>
            </div>
          ))}
        </div>
      )}

      <div className="option-footer-action">
        {option.sourceUrl ? (
          <a href={option.sourceUrl} target="_blank" rel="noreferrer">
            Verify service with {option.sourceLabel} <ExternalLink size={13} />
          </a>
        ) : (
          <button type="button" onClick={onExpand}>Review planned-route preview <ArrowRight size={14} /></button>
        )}
      </div>
    </article>
  );
}

export function CommuteOptionsScreen() {
  const { routeSignals } = useApp();
  const [activeFilter, setActiveFilter] = useState<CommuteOptionFilter | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const latestSignal = routeSignals.length > 0 ? routeSignals[routeSignals.length - 1] : null;
  const profile = useMemo(
    () => latestSignal ? profileFromRouteSignal(latestSignal) : null,
    [latestSignal],
  );

  const rankedOptions = useMemo(
    () => profile ? rankCommuteOptions(profile, commuteOptions) : [],
    [profile],
  );

  const options = useMemo(() => {
    if (activeFilter === 'all') return rankedOptions;
    if (activeFilter === 'best-fit') return rankedOptions.filter(option => option.rank <= 4);
    if (activeFilter === 'transit') return rankedOptions.filter(option => option.kind === 'transit');
    return rankedOptions.filter(option => option.filters.includes(activeFilter));
  }, [activeFilter, rankedOptions]);

  const toggleSaved = (id: string) => {
    setSavedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-32">
      <Header title="Commute options" subtitle="A personalized campus commute bundle." />

      <main className="container mobile-dashboard-shell">
        <section className="commute-bundle-header">
          <span className="mobile-section-kicker">Your trip</span>
          {profile ? (
            <>
              <h1>{profile.startingArea} <span>→</span> {profile.destinationArea}</h1>
              <div className="commute-bundle-summary">
                <span><Clock3 size={14} /> {profile.timeWindow || 'Time not set'}</span>
                <span><TrainFront size={14} /> {profile.campusAffiliation || 'Institution not set'}</span>
                <span><Footprints size={14} /> {profile.maxWalkingDistance || 'Walking preference not set'}</span>
              </div>
              <p>Ranked from your latest submitted commute signal.</p>
            </>
          ) : (
            <>
              <h1>Submit a commute signal to see options</h1>
              <p>No commute signal is on file yet for this session. Submit your route to see a personalized, ranked list of commute options.</p>
            </>
          )}
        </section>

        <section className="market-filter-section" aria-label="Commute option filters">
          <div className="mobile-section-heading">
            <div><span className="mobile-section-kicker">Recommended</span><h2>Best ways to campus</h2></div>
            <span className="option-count-pill">{options.length} options</span>
          </div>
          <div className="m3-chip-row">
            {filters.map(filter => (
              <md-filter-chip key={filter.id} selected={activeFilter === filter.id} onClick={() => setActiveFilter(filter.id)}>
                {filter.label}
              </md-filter-chip>
            ))}
          </div>
        </section>

        {options.length > 0 ? (
          <div className="space-y-4">
            {options.map(option => (
              <OptionCard
                key={option.id}
                option={option}
                expanded={expandedId === option.id}
                saved={savedIds.includes(option.id)}
                onExpand={() => setExpandedId(current => current === option.id ? null : option.id)}
                onSave={() => toggleSaved(option.id)}
              />
            ))}
          </div>
        ) : (
          <section className="commuter-matches-empty-state" aria-live="polite">
            <PackageSearch size={28} />
            <h2>No commute options yet</h2>
            <p>
              {profile
                ? 'No commute options currently match this filter. Try a different filter, or check back later.'
                : 'Submit a commute signal to see personalized, ranked commute options.'}
            </p>
          </section>
        )}

        <section className="market-notice">
          <ShieldCheck size={16} />
          <p>
            <strong>Relay Rider planned-route previews are not shown here yet.</strong> This research-beta
            backend does not yet have a live endpoint for participant-planned relay routes, so only
            real, source-verified local transit lines are listed above until relay-route matching is
            available.
          </p>
        </section>

        <section className="benefit-dashboard-card mt-5">
          <div className="benefit-dashboard-card__header">
            <div><span className="mobile-section-kicker">Incentives</span><h2>Your commute benefits</h2></div>
            <Gift size={20} />
          </div>
          <div className="benefit-progress-row">
            <div><strong>Green Route Credits</strong><span>Selected activity may qualify</span></div>
            <div><strong>Transit participation</strong><span>Program dependent</span></div>
            <div><strong>Campus challenges</strong><span>Where configured</span></div>
          </div>
          <p>Benefits are capped promotional or institution-sponsored participation benefits, not cash, wages, fares, or guaranteed payments.</p>
        </section>

        <details className="modeling-note">
          <summary><ShieldCheck size={16} /> Research beta & modeling note</summary>
          <p>Ranking, travel time, walking time, transfer count, and schedule fit are modeled demonstration values—not live trip planning or guaranteed transportation. Transit schedules, fares, and student eligibility must be verified with the relevant operator or school. Relay Rider planned-route previews require administrative review before controlled program use.</p>
        </details>
      </main>
    </div>
  );
}
