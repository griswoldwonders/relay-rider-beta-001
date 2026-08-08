import { useMemo, useState } from 'react';
import { CheckCircle2, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { Header } from '../components/Header';
import { CommuterMatchSwipe } from '../components/CommuterMatchSwipe';
import { useApp } from '../context/AppContext';
import {
  commuterMatchTemplates,
  type CommuterMatchTemplate,
} from '../data/commuterMatchesData';
import {
  pccDemoProfile,
  profileFromRouteSignal,
  type CommuteProfile,
} from '../lib/commuteRanking';

export interface RankedCommuterMatch extends CommuterMatchTemplate {
  rank: number;
  fitScore: number;
  scheduleFit: 'Strong' | 'Moderate' | 'Low';
  reasons: string[];
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchesAny = (value: string, candidates: string[]) => {
  const normalized = normalize(value);
  if (!normalized) return false;
  return candidates.some(candidate => {
    const token = normalize(candidate);
    return normalized.includes(token) || token.includes(normalized);
  });
};

const inferTimeBand = (value: string): CommuterMatchTemplate['timeBand'] => {
  const normalized = normalize(value);
  if (normalized.includes('midday') || normalized.includes('noon')) return 'midday';
  if (normalized.includes('evening') || normalized.includes('night')) return 'evening';

  const match = normalized.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)/);
  if (!match) return 'morning';
  const hour = Number(match[1]);
  const meridiem = match[2];
  const hour24 = meridiem === 'pm' && hour !== 12 ? hour + 12 : meridiem === 'am' && hour === 12 ? 0 : hour;
  if (hour24 >= 11 && hour24 < 16) return 'midday';
  if (hour24 >= 16 || hour24 < 5) return 'evening';
  return 'morning';
};

const walkingLimit = (value: string) => {
  if (value === 'under-5') return 5;
  if (value === '5-10') return 10;
  if (value === '10-15') return 15;
  return 15;
};

const rankMatches = (profile: CommuteProfile): RankedCommuterMatch[] => {
  const requestedBand = inferTimeBand(profile.timeWindow);
  const maxWalk = walkingLimit(profile.maxWalkingDistance);

  return commuterMatchTemplates
    .map(template => {
      const originFit = matchesAny(profile.startingArea, template.originKeywords);
      const destinationFit = matchesAny(profile.destinationArea, template.destinationKeywords);
      const campusFit = matchesAny(profile.campusAffiliation, template.campusKeywords);
      const scheduleFit = template.timeBand === requestedBand;
      const dayOverlap = profile.daysOfWeek.length === 0
        ? 1
        : profile.daysOfWeek.filter(day => template.days.includes(day)).length;
      const walkFit = template.walkingMinutes <= maxWalk;
      const cleanVehicleFit = profile.evPreference === 'any'
        || template.vehicleType === 'EV'
        || (profile.evPreference === 'hybrid-ev' && ['EV', 'PHEV', 'Hybrid'].includes(template.vehicleType));

      const score = Math.max(35, Math.min(99, Math.round(
        template.baseScore
        + (originFit ? 5 : -8)
        + (destinationFit ? 5 : -9)
        + (campusFit ? 3 : -4)
        + (scheduleFit ? 3 : -8)
        + (dayOverlap > 0 ? 2 : -5)
        + (walkFit ? 2 : -4)
        + (cleanVehicleFit ? 2 : -6),
      )));

      const reasons: string[] = [];
      if (originFit && destinationFit) {
        reasons.push(`Strong modeled corridor compatibility with your ${profile.startingArea} → ${profile.destinationArea} commute.`);
      } else if (destinationFit || campusFit) {
        reasons.push('The planned route reaches your destination area, but the origin overlap is less direct.');
      } else {
        reasons.push('This is a lower-fit corridor preview included for comparison; it does not closely match both ends of your trip.');
      }

      reasons.push(scheduleFit
        ? `The registered route window overlaps your ${profile.timeWindow || 'selected'} travel period in this prototype model.`
        : `The route window is a weaker match for your ${profile.timeWindow || 'selected'} travel period.`);

      reasons.push(walkFit
        ? `The modeled ${template.walkingMinutes}-minute walk is within your selected walking tolerance.`
        : `The modeled ${template.walkingMinutes}-minute walk is above your selected walking tolerance.`);

      if (cleanVehicleFit) {
        reasons.push(`${template.vehicleType} participation aligns with your clean-vehicle preference.`);
      }

      reasons.push(`Estimated detour impact is ${template.estimatedDetourMinutes} minutes with ${template.routeOverlapScore}% modeled route overlap.`);
      reasons.push('This is a match preview only. Administrative review and program rules apply before any controlled commuter coordination.');

      const resolvedScheduleFit: RankedCommuterMatch['scheduleFit'] = scheduleFit && dayOverlap > 0
        ? 'Strong'
        : scheduleFit || dayOverlap > 0
          ? 'Moderate'
          : 'Low';

      return {
        ...template,
        rank: 0,
        fitScore: score,
        scheduleFit: resolvedScheduleFit,
        reasons,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore || b.routeOverlapScore - a.routeOverlapScore)
    .map((match, index) => ({ ...match, rank: index + 1 }));
};

export function CommuterMatchesScreen() {
  const { routeSignals } = useApp();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [reviewedId, setReviewedId] = useState<string | null>(null);

  const latestSignal = routeSignals.length > 0 ? routeSignals[routeSignals.length - 1] : null;
  const profile = useMemo(
    () => latestSignal ? profileFromRouteSignal(latestSignal) : pccDemoProfile,
    [latestSignal],
  );
  const matches = useMemo(() => rankMatches(profile), [profile]);
  const reviewedMatch = matches.find(match => match.id === reviewedId) ?? null;

  const toggleSaved = (id: string) => {
    setSavedIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]);
  };

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-32">
      <Header title="Commuter matches" subtitle="Browse compatible planned-route previews." />

      <main className="container commuter-matches-screen">
        <section className="commuter-matches-intro">
          <div className="commuter-matches-intro__eyebrow"><Sparkles size={15} /> Planned-route compatibility</div>
          <h1>{profile.startingArea} <span>→</span> {profile.destinationArea}</h1>
          <p>
            {profile.source === 'submitted'
              ? `Ranked from your latest commute signal for ${profile.campusAffiliation || 'your institution'}.`
              : 'PCC demonstration profile · Eagle Rock → Pasadena City College at 8:00 AM.'}
          </p>
          <div className="commuter-matches-intro__meta">
            <span>{matches.length} previews</span>
            <span>{profile.timeWindow || 'Time not set'}</span>
            <span>Approximate zones only</span>
          </div>
        </section>

        <section className="commuter-match-guidance">
          <Info size={17} />
          <p><strong>Swipe to browse.</strong> A swipe is navigation only—it does not accept a route, contact a participant, activate transportation, or create a payment.</p>
        </section>

        <CommuterMatchSwipe
          items={matches}
          savedIds={savedIds}
          onSave={toggleSaved}
          onReview={setReviewedId}
        />

        {reviewedMatch && (
          <section className="commuter-match-review-panel animate-fade-in" aria-live="polite">
            <div className="commuter-match-review-panel__header">
              <div>
                <span>Match #{reviewedMatch.rank}</span>
                <h2>Why this preview was generated</h2>
              </div>
              <strong>{reviewedMatch.fitScore}%</strong>
            </div>

            <div className="commuter-match-review-panel__facts">
              <span>Schedule fit: <strong>{reviewedMatch.scheduleFit}</strong></span>
              <span>Route overlap: <strong>{reviewedMatch.routeOverlapScore}%</strong></span>
              <span>Detour impact: <strong>+{reviewedMatch.estimatedDetourMinutes} min</strong></span>
            </div>

            <ul>
              {reviewedMatch.reasons.map(reason => (
                <li key={reason}><CheckCircle2 size={15} /><span>{reason}</span></li>
              ))}
            </ul>
          </section>
        )}

        <section className="commuter-match-guardrail">
          <ShieldCheck size={19} />
          <p><strong>Research beta.</strong> These are simulated commuter match previews based on approximate zones, schedule compatibility, route overlap, walking tolerance, EV/hybrid preference, and program rules. They are not guaranteed rides or live dispatch. Administrative review is required before any controlled program use.</p>
        </section>
      </main>
    </div>
  );
}
