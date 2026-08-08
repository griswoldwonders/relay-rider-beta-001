import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Footprints,
  Gift,
  Info,
  MapPin,
  Route,
  ShieldCheck,
  TrainFront,
} from 'lucide-react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import {
  commuteOptions,
  CommuteOptionFilter,
} from '../data/commuteOptionsData';
import {
  pccDemoProfile,
  profileFromRouteSignal,
  rankCommuteOptions,
  RankedCommuteOption,
} from '../lib/commuteRanking';

const filters: { id: CommuteOptionFilter | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'best-fit', label: 'Best fit' },
  { id: 'transit', label: 'Transit' },
  { id: 'free-college', label: 'Free / student' },
  { id: 'morning', label: 'Morning' },
  { id: 'ev-hybrid', label: 'EV / hybrid' },
];

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

  return (
    <article className={`market-match-card ${option.rank === 1 ? 'market-match-card--top' : ''}`}>
      <div className="market-match-card__top">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="m3-badge m3-badge--green">#{option.rank} recommended</span>
            <span className="m3-badge">{isTransit ? 'Local transit' : 'Planned route'}</span>
          </div>
          <h2>{option.startArea} <ArrowRight size={16} /> {option.endArea}</h2>
          <p>{option.provider} · {option.title}</p>
        </div>
        <ScoreRing score={option.fitScore} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-600">{option.subtitle}</p>

      <div className="trip-profile-band">
        <p className="!mt-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-iris">Why it ranked here</p>
        <p>{option.reasons[0]}</p>
      </div>

      <div className="market-route-line" aria-hidden="true"><span /><i /><span /></div>

      <div className="market-facts">
        <div>
          <Clock3 size={17} />
          <span><strong>~{option.modeledDurationMinutes} min</strong>{option.scheduleFit} schedule fit</span>
        </div>
        <div>
          <Footprints size={17} />
          <span><strong>~{option.walkingMinutes} min walk</strong>modeled access time</span>
        </div>
        <div>
          <Route size={17} />
          <span><strong>{option.transferCount} transfer{option.transferCount === 1 ? '' : 's'}</strong>{option.departureWindow}</span>
        </div>
        <div>
          <MapPin size={17} />
          <span><strong>Access Point</strong>{option.accessPoint}</span>
        </div>
      </div>

      <div className="market-contribution">
        <div>
          <span>{isTransit ? 'Student fare / program status' : 'College-program cost'}</span>
          <strong>{option.resolvedCostLabel}</strong>
        </div>
        <p>{isTransit ? 'Verify fare, eligibility, and schedule with the operator' : 'No rider payment requested in this prototype'}</p>
      </div>

      {option.resolvedBenefitLabel && (
        <div className="mt-4 flex items-start gap-2 rounded-3xl border border-green-200 bg-light-green p-4">
          <Gift size={18} className="mt-0.5 flex-shrink-0 text-navy" />
          <p className="text-xs leading-relaxed text-gray-700">{option.resolvedBenefitLabel}</p>
        </div>
      )}

      <button type="button" className="score-disclosure" onClick={onExpand} aria-expanded={expanded}>
        <span><Info size={16} /> Why this option?</span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="score-breakdown animate-fade-in">
          <p className="score-breakdown__label">Personalized prototype ranking · modeled, not live routing</p>

          <div className="mb-4 rounded-3xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold text-navy">Recommendation explanation</p>
            <ul className="mt-3 space-y-2">
              {option.reasons.map(reason => (
                <li key={reason} className="flex gap-2 text-xs leading-relaxed text-gray-600">
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-navy" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {option.factors.map(factor => (
            <div key={factor.label} className="score-factor">
              <div><span>{factor.label}</span><strong>{factor.value}%</strong></div>
              <div className="score-factor__bar"><span style={{ width: `${factor.value}%` }} /></div>
              <small>{factor.detail}</small>
            </div>
          ))}
        </div>
      )}

      <div className="market-actions">
        <md-outlined-button onClick={onSave}>
          <Bookmark slot="icon" size={16} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Saved option' : 'Save option'}
        </md-outlined-button>
        {option.sourceUrl ? (
          <a href={option.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-iris">
            Verify with {option.sourceLabel} <ExternalLink size={13} />
          </a>
        ) : (
          <md-filled-button onClick={onExpand}>
            <ArrowRight slot="icon" size={16} />
            Review preview
          </md-filled-button>
        )}
      </div>
    </article>
  );
}

export function CommuteOptionsScreen() {
  const { routeSignals } = useApp();
  const [activeFilter, setActiveFilter] = useState<CommuteOptionFilter | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>('relay-eagle-rock-pcc');
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const latestSignal = routeSignals.length > 0 ? routeSignals[routeSignals.length - 1] : null;
  const profile = useMemo(
    () => latestSignal ? profileFromRouteSignal(latestSignal) : pccDemoProfile,
    [latestSignal],
  );

  const rankedOptions = useMemo(
    () => rankCommuteOptions(profile, commuteOptions),
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
    <div className="min-h-screen bg-[var(--color-parchment)] pb-28">
      <Header title="Commute options" subtitle="A ranked bundle built around your commute." />

      <main className="container py-6">
        <section className="market-hero">
          <div className="market-hero__eyebrow"><TrainFront size={16} /> Personalized commute bundle</div>
          <h1>{profile.startingArea} → <span className="accent-word">{profile.destinationArea}</span></h1>
          <p>
            Ranked for {profile.campusAffiliation || 'your institution'} using your origin, destination, travel window,
            walking tolerance, transit preferences, student-pass status, and incentive interests.
          </p>
          <div className="market-hero__meta">
            <span><Clock3 size={15} /> {profile.timeWindow || 'Time not set'}</span>
            <span><Gift size={15} /> Incentive-aware</span>
          </div>
        </section>

        <section className="trip-profile-band">
          <div className="flex items-start gap-3">
            <Info size={19} className="mt-0.5 flex-shrink-0 text-iris" />
            <div>
              <strong>{profile.source === 'submitted' ? 'Using your latest commute signal' : 'PCC demonstration profile'}</strong>
              <p>
                {profile.source === 'submitted'
                  ? `${profile.daysOfWeek.join(', ') || 'Selected days'} · student pass: ${profile.studentTransitPass.replace('-', ' ')}`
                  : 'Eagle Rock → Pasadena City College at 8:00 AM. Submit a commute need to replace this example with your own ranking.'}
              </p>
            </div>
          </div>
        </section>

        <section className="market-filter-section" aria-label="Commute option filters">
          <div className="market-section-heading">
            <div>
              <h2>Ranked commute bundle</h2>
              <p>{options.length} shown · scores recalculate from the commute signal</p>
            </div>
          </div>
          <div className="m3-chip-row">
            {filters.map(filter => (
              <md-filter-chip key={filter.id} selected={activeFilter === filter.id} onClick={() => setActiveFilter(filter.id)}>
                {filter.label}
              </md-filter-chip>
            ))}
          </div>
        </section>

        <div className="market-notice">
          <ShieldCheck size={19} />
          <p>
            <strong>Research Beta.</strong> Ranking, travel time, walking time, transfer count, and schedule fit are modeled demonstration values—not live trip planning or guaranteed transportation. Transit schedules, fares, and student eligibility must be verified with the relevant operator or school. Relay Rider planned-route previews require administrative review before any controlled program use.
          </p>
        </div>

        <div className="space-y-5">
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

        <div className="mt-6 card-highlight">
          <div className="flex items-start gap-3">
            <Gift size={20} className="mt-0.5 flex-shrink-0 text-navy" />
            <div>
              <h2 className="font-semibold text-navy">Incentives are part of the recommendation</h2>
              <p className="mt-2 text-xs leading-relaxed text-gray-700">
                The prototype boosts options that align with incentive interests selected in commute intake, such as Green Route Credits, transit participation rewards, campus commute challenges, EV/clean-route recognition, and Access Point feedback. Benefits remain capped, promotional, program-dependent, and are not cash, fares, wages, or guaranteed payments.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
