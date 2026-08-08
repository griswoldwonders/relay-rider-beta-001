import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BatteryCharging,
  Bookmark,
  BusFront,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Gift,
  Info,
  MapPin,
  Route,
  ShieldCheck,
  TrainFront,
} from 'lucide-react';
import { Header } from '../components/Header';
import {
  commuteOptions,
  CommuteOption,
  CommuteOptionFilter,
} from '../data/commuteOptionsData';

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
      aria-label={`${score}% demo compatibility score`}
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
  option: CommuteOption;
  expanded: boolean;
  saved: boolean;
  onExpand: () => void;
  onSave: () => void;
}) {
  const isTransit = option.kind === 'transit';

  return (
    <article className="market-match-card">
      <div className="market-match-card__top">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`m3-badge ${isTransit ? '' : 'm3-badge--green'}`}>
              {isTransit ? 'LOCAL TRANSIT' : 'PLANNED ROUTE'}
            </span>
            <span className="m3-badge">{option.status}</span>
          </div>
          <h2>{option.startArea} <ArrowRight size={16} /> {option.endArea}</h2>
          <p>{option.provider} · {option.title}</p>
        </div>
        {option.fitScore ? <ScoreRing score={option.fitScore} /> : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-light-blue text-blue-700">
            {option.title.includes('Line') ? <TrainFront size={24} /> : <BusFront size={24} />}
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-600">{option.subtitle}</p>

      <div className="market-route-line" aria-hidden="true"><span /><i /><span /></div>

      <div className="market-facts">
        <div><Clock3 size={17} /><span><strong>{option.departureWindow}</strong>{option.days}</span></div>
        <div><MapPin size={17} /><span><strong>Access Point</strong>{option.accessPoint}</span></div>
        <div><Route size={17} /><span><strong>{isTransit ? 'Transit' : 'Shared corridor'}</strong>{isTransit ? 'Official external service' : 'Simulated planned-route preview'}</span></div>
        <div>{isTransit ? <BusFront size={17} /> : <BatteryCharging size={17} />}<span><strong>{option.provider}</strong>{isTransit ? 'Local / regional option' : 'EV/hybrid-first program'}</span></div>
      </div>

      <div className="market-contribution">
        <div>
          <span>{isTransit ? 'Student fare / program status' : 'College-program cost'}</span>
          <strong className="text-base">{option.costLabel}</strong>
        </div>
        <p>{isTransit ? 'Verify current fare and eligibility with the operator' : 'No rider payment is requested in the college prototype'}</p>
      </div>

      {option.benefitLabel && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-green-200 bg-light-green p-3">
          <Gift size={18} className="mt-0.5 flex-shrink-0 text-mobility-green" />
          <p className="text-xs leading-relaxed text-gray-700">{option.benefitLabel}</p>
        </div>
      )}

      {option.factors && (
        <>
          <button type="button" className="score-disclosure" onClick={onExpand} aria-expanded={expanded}>
            <span><Info size={16} /> Why this option?</span>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {expanded && (
            <div className="score-breakdown animate-fade-in">
              <p className="score-breakdown__label">Prototype compatibility model · administrative review only</p>
              {option.factors.map(factor => (
                <div key={factor.label} className="score-factor">
                  <div><span>{factor.label}</span><strong>{factor.value}%</strong></div>
                  <div className="score-factor__bar"><span style={{ width: `${factor.value}%` }} /></div>
                  <small>{factor.detail}</small>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="market-actions">
        <md-outlined-button onClick={onSave}>
          <Bookmark slot="icon" size={16} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Saved option' : 'Save option'}
        </md-outlined-button>
        {option.sourceUrl ? (
          <a href={option.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
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
  const [activeFilter, setActiveFilter] = useState<CommuteOptionFilter | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(commuteOptions[0].id);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const options = useMemo(
    () => activeFilter === 'all' ? commuteOptions : commuteOptions.filter(option => option.filters.includes(activeFilter)),
    [activeFilter],
  );

  const toggleSaved = (id: string) => {
    setSavedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)] pb-28">
      <Header title="Commute options" subtitle="Compare planned routes with local transit." />

      <main className="container py-5">
        <section className="market-hero">
          <div className="market-hero__eyebrow"><TrainFront size={16} /> Shared route + transit</div>
          <h1>Find the best way to campus.</h1>
          <p>Compare Relay Rider planned-route previews with LA Metro, Pasadena Transit, Glendale Beeline, and other local connections.</p>
          <div className="market-hero__meta">
            <span><CheckCircle2 size={15} /> $0 Relay Rider college program</span>
            <span><Gift size={15} /> Incentive eligible</span>
          </div>
        </section>

        <section className="market-filter-section" aria-label="Commute option filters">
          <div className="market-section-heading">
            <div>
              <h2>Available previews</h2>
              <p>{options.length} options · Pasadena–Eagle Rock–Glendale</p>
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
          <p><strong>Research Beta.</strong> Relay Rider entries are simulated commuter options, not guaranteed transportation. Transit information links to external agencies and should be verified before travel. Student fareless programs depend on school and agency eligibility.</p>
        </div>

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

        <div className="mt-5 rounded-xl border border-green-200 bg-light-green p-4">
          <div className="flex items-start gap-3">
            <Gift size={20} className="mt-0.5 flex-shrink-0 text-mobility-green" />
            <div>
              <h2 className="font-bold text-navy">Green Route Credits</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-700">Eligible research participation, sustainable commute challenges, Access Point feedback, and selected campus-sponsored activities may earn capped promotional credits. Credits are not cash, wages, fares, or guaranteed payments.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
