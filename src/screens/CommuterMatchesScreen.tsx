import { useMemo, useState } from 'react';
import { CheckCircle2, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { Header } from '../components/Header';
import { CommuterMatchSwipe } from '../components/CommuterMatchSwipe';
import { useApp } from '../context/AppContext';
import { rankMatches, type RankedCommuterMatch } from '../lib/commuterMatchRanking';
import {
  pccDemoProfile,
  profileFromRouteSignal,
} from '../lib/commuteRanking';

export type { RankedCommuterMatch } from '../lib/commuterMatchRanking';

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
