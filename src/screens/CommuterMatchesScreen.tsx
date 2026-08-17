import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Info, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Header } from '../components/Header';
import { CommuterMatchSwipe } from '../components/CommuterMatchSwipe';
import { useApp } from '../context/AppContext';
import { rankMatches, type RankedCommuterMatch } from '../lib/commuterMatchRanking';
import {
  pccDemoProfile,
  profileFromRouteSignal,
} from '../lib/commuteRanking';
import type { ParticipantMatchPreview } from '../backend/relayBackend';

export type { RankedCommuterMatch } from '../lib/commuterMatchRanking';

const textFromExplanation = (value: unknown) => typeof value === 'string' ? value : null;

function reviewLabel(match: ParticipantMatchPreview) {
  switch (match.review_decision) {
    case 'approved_for_review': return 'Administrative review complete · approved for controlled review';
    case 'request_changes': return 'Administrative review · changes requested';
    case 'declined': return 'Administrative review · declined';
    case 'withdrawn': return 'Administrative review · withdrawn';
    default: return 'Awaiting administrative review';
  }
}

function reviewTone(match: ParticipantMatchPreview) {
  switch (match.review_decision) {
    case 'approved_for_review': return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'request_changes': return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'declined':
    case 'withdrawn': return 'border-slate-300 bg-slate-100 text-slate-700';
    default: return 'border-blue-200 bg-blue-50 text-blue-900';
  }
}

function GovernedMatchCard({ match }: { match: ParticipantMatchPreview }) {
  const explanation = match.explanation ?? {};
  const details = [
    textFromExplanation(explanation.route_basis),
    textFromExplanation(explanation.time_fit) ? `Time fit: ${textFromExplanation(explanation.time_fit)}` : null,
    textFromExplanation(explanation.access_point_factor),
    textFromExplanation(explanation.ev_hybrid_factor),
    textFromExplanation(explanation.contribution_factor) ? `Contribution signal: ${textFromExplanation(explanation.contribution_factor)}` : null,
    textFromExplanation(explanation.detour_estimate),
  ].filter((value): value is string => Boolean(value));

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Institutional Match Preview</p>
          <h3 className="text-lg font-bold text-slate-950 mt-1">{match.origin_zone} <span className="text-slate-400">→</span> {match.destination_zone}</h3>
          <p className="text-sm text-slate-600 mt-1">Generated {new Date(match.generated_at).toLocaleString()}</p>
        </div>
        <div className="text-right shrink-0">
          <strong className="text-2xl text-slate-950">{match.compatibility_score == null ? '—' : `${Math.round(match.compatibility_score)}%`}</strong>
          <small className="block text-slate-500">compatibility</small>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Schedule fit</span><strong className="text-slate-900 capitalize">{match.time_window_fit?.replaceAll('_', ' ') || 'Not scored'}</strong></div>
        <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">EV / hybrid</span><strong className="text-slate-900 capitalize">{match.ev_hybrid_indicator?.replaceAll('_', ' ') || 'Not specified'}</strong></div>
        <div className="rounded-xl bg-slate-50 p-3 col-span-2"><span className="block text-slate-500">Detour impact</span><strong className="text-slate-900">{match.estimated_detour_minutes == null ? 'Not calculated — routing service not connected' : `+${match.estimated_detour_minutes} min${match.estimated_detour_miles == null ? '' : ` · ${match.estimated_detour_miles} mi`}`}</strong></div>
      </div>

      {match.access_point_name && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Access Point</span>
          <strong className="block text-slate-950 mt-1">{match.access_point_name}</strong>
          {match.access_point_address_label && <span className="block text-sm text-slate-600 mt-1">{match.access_point_address_label}</span>}
          <span className="inline-block text-xs font-semibold text-slate-600 mt-2">Status: {(match.access_point_review_status || 'not assigned').replaceAll('_', ' ')}</span>
        </div>
      )}

      <div className={`rounded-2xl border p-4 ${reviewTone(match)}`}>
        <strong className="block">{reviewLabel(match)}</strong>
        {match.review_rationale && <span className="block text-sm mt-1">{match.review_rationale}</span>}
        <small className="block mt-2">A reviewed commuter option is not guaranteed transportation and does not activate a route.</small>
      </div>

      {details.length > 0 && (
        <div>
          <h4 className="font-bold text-slate-900">Why this option was generated</h4>
          <ul className="mt-2 space-y-2">
            {details.map((detail, index) => <li key={`${match.id}-${index}`} className="flex items-start gap-2 text-sm text-slate-700"><CheckCircle2 size={15} className="mt-0.5 text-emerald-700 shrink-0" /><span>{detail}</span></li>)}
          </ul>
        </div>
      )}

      {textFromExplanation(explanation.guardrail) && <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">{textFromExplanation(explanation.guardrail)}</p>}
    </article>
  );
}

export function CommuterMatchesScreen() {
  const {
    routeSignals,
    backendSession,
    activeProgram,
    participantMatches,
    refreshParticipantMatches,
    backendActivity,
  } = useApp();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!backendSession || !activeProgram) return;
    void refreshParticipantMatches().catch(() => undefined);
  }, [backendSession, activeProgram?.organization_id, activeProgram?.site_id, activeProgram?.cohort_id]);

  const latestSignal = routeSignals.length > 0 ? routeSignals[routeSignals.length - 1] : null;
  const profile = useMemo(
    () => latestSignal ? profileFromRouteSignal(latestSignal) : pccDemoProfile,
    [latestSignal],
  );
  const matches = useMemo(() => rankMatches(profile), [profile]);
  const reviewedMatch = matches.find(match => match.id === reviewedId) ?? null;
  const activeProgramMatches = activeProgram
    ? participantMatches.filter(match => match.organization_id === activeProgram.organization_id)
    : [];

  const toggleSaved = (id: string) => {
    setSavedIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id]);
  };

  const refreshProgramStatus = async () => {
    setRefreshing(true);
    try {
      await refreshParticipantMatches();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-32">
      <Header title="Commuter matches" subtitle="Governed Match Previews and clearly labeled simulations." />

      <main className="container commuter-matches-screen">
        <section className="commuter-matches-intro">
          <div className="commuter-matches-intro__eyebrow"><Sparkles size={15} /> Planned-route compatibility</div>
          <h1>{profile.startingArea} <span>→</span> {profile.destinationArea}</h1>
          <p>{activeProgram ? `Connected program: ${activeProgram.organization_name}${activeProgram.site_name ? ` · ${activeProgram.site_name}` : ''}.` : 'No governed institution program is connected. The comparison deck below remains prototype-only.'}</p>
          <div className="commuter-matches-intro__meta">
            <span>Approximate zones only</span>
            <span>Administrative review required</span>
            <span>No guaranteed transportation</span>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Governed program record</p>
              <h2 className="text-xl font-bold text-slate-950 mt-1">Institutional Match Previews</h2>
              <p className="text-sm text-slate-600 mt-1">These records come from the shared institutional backend and are separate from the simulated comparison cards below.</p>
            </div>
            {backendSession && activeProgram && (
              <button type="button" onClick={refreshProgramStatus} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800">
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
            )}
          </div>

          {!backendSession || !activeProgram ? (
            <div className="rounded-2xl bg-white border border-emerald-100 p-4 text-sm text-slate-700"><strong>Not connected.</strong> Sign in and accept an institution invitation before a commuter need can persist to a governed program.</div>
          ) : activeProgramMatches.length === 0 ? (
            <div className="rounded-2xl bg-white border border-emerald-100 p-4 flex items-start gap-3">
              <Clock3 size={19} className="text-emerald-700 mt-0.5 shrink-0" />
              <div><strong className="block text-slate-950">No institutional Match Preview is available yet.</strong><span className="block text-sm text-slate-600 mt-1">{backendActivity.recordType === 'commuter_need' && backendActivity.state === 'persisted' ? 'Your commuter need is persisted. A qualified institutional reviewer must generate and review a compatible option.' : 'Submit a commute profile to the connected program. Match generation remains an institutional reviewer action.'}</span></div>
            </div>
          ) : (
            <div className="space-y-4">{activeProgramMatches.map(match => <GovernedMatchCard key={match.id} match={match} />)}</div>
          )}
        </section>

        <section className="commuter-match-guidance">
          <Info size={17} />
          <p><strong>Prototype comparison deck below.</strong> Swiping or saving a simulated card is navigation only—it does not accept a route, contact another participant, activate transportation, or create a payment.</p>
        </section>

        <section aria-label="Simulated comparison previews">
          <div className="mb-4">
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-800">PROTOTYPE_SESSION</span>
            <h2 className="text-xl font-bold text-slate-950 mt-2">Simulated comparison previews</h2>
            <p className="text-sm text-slate-600 mt-1">Template records help demonstrate the interface. Their scores, overlap and detour values are not institutional Match Preview records.</p>
          </div>
          <CommuterMatchSwipe
            items={matches}
            savedIds={savedIds}
            onSave={toggleSaved}
            onReview={setReviewedId}
          />
        </section>

        {reviewedMatch && (
          <section className="commuter-match-review-panel animate-fade-in" aria-live="polite">
            <div className="commuter-match-review-panel__header">
              <div>
                <span>Simulated match #{reviewedMatch.rank}</span>
                <h2>Why this prototype preview was generated</h2>
              </div>
              <strong>{reviewedMatch.fitScore}%</strong>
            </div>

            <div className="commuter-match-review-panel__facts">
              <span>Schedule fit: <strong>{reviewedMatch.scheduleFit}</strong></span>
              <span>Modeled route overlap: <strong>{reviewedMatch.routeOverlapScore}%</strong></span>
              <span>Prototype detour display: <strong>+{reviewedMatch.estimatedDetourMinutes} min</strong></span>
            </div>

            <ul>{reviewedMatch.reasons.map(reason => <li key={reason}><CheckCircle2 size={15} /><span>{reason}</span></li>)}</ul>
          </section>
        )}

        <section className="commuter-match-guardrail">
          <ShieldCheck size={19} />
          <p><strong>Research beta.</strong> Governed Match Previews come from the institution-backed participant contract and remain subject to administrative review. Simulated comparison cards remain `PROTOTYPE_SESSION`. Neither category is a guaranteed ride, live dispatch, automatic route activation, or payment.</p>
        </section>
      </main>
    </div>
  );
}
