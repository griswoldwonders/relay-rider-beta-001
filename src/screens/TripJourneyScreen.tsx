import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  Clock3,
  Flag,
  Leaf,
  MapPin,
  MessageCircleWarning,
  Navigation,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';

type TripJourneyMode = 'participant' | 'route-participant';

interface TripJourneyScreenProps {
  mode: TripJourneyMode;
  onBack: () => void;
  onDone: () => void;
}

interface StepCopy {
  label: string;
  title: string;
  subtitle: string;
  primaryAction: string;
}

const participantSteps: StepCopy[] = [
  {
    label: 'Confirmed',
    title: 'Coordination confirmed',
    subtitle: 'Your planned-route option has cleared this demonstration review state.',
    primaryAction: 'I’m ready',
  },
  {
    label: 'Meet',
    title: 'Head to your Access Point',
    subtitle: 'Please arrive during the planned meeting window.',
    primaryAction: 'I’m at the Access Point',
  },
  {
    label: 'In progress',
    title: 'Route in progress',
    subtitle: 'The coordinated planned route is underway.',
    primaryAction: 'Continue trip demo',
  },
  {
    label: 'Arriving',
    title: 'Almost there',
    subtitle: 'Approaching the destination Access Point.',
    primaryAction: 'Continue to arrival',
  },
  {
    label: 'Arrived',
    title: 'You’ve arrived',
    subtitle: 'Confirm only after reaching the designated destination area.',
    primaryAction: 'Complete trip',
  },
  {
    label: 'Complete',
    title: 'Commute complete',
    subtitle: 'Your demonstration trip summary is ready.',
    primaryAction: 'Done',
  },
];

const driverSteps: StepCopy[] = [
  {
    label: 'Confirmed',
    title: 'Today’s planned route',
    subtitle: 'One compatible participant is confirmed for this demonstration route.',
    primaryAction: 'I’m heading to the Access Point',
  },
  {
    label: 'Meet',
    title: 'Arrived at Access Point?',
    subtitle: 'Let the participant know you are at the planned meeting area.',
    primaryAction: 'I’ve arrived at Access Point',
  },
  {
    label: 'Ready',
    title: 'Ready to begin the planned route?',
    subtitle: 'Once everyone is set, begin the route you already intended to travel.',
    primaryAction: 'Begin planned route',
  },
  {
    label: 'In progress',
    title: 'Route in progress',
    subtitle: 'The coordinated planned route is underway.',
    primaryAction: 'Continue to destination',
  },
  {
    label: 'Arrived',
    title: 'Arrived at PCC Access Point?',
    subtitle: 'Confirm arrival at the destination area.',
    primaryAction: 'Route complete',
  },
  {
    label: 'Complete',
    title: 'Route complete',
    subtitle: 'Clean-route participation has been recorded for demonstration purposes.',
    primaryAction: 'Done',
  },
];

const stepIcons = [CheckCircle2, MapPin, Navigation, Navigation, Flag, Sparkles];

function PlannedCorridorPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`trip-map-preview ${compact ? 'trip-map-preview--compact' : ''}`} aria-label="Planned corridor preview from Eagle Rock to Pasadena City College. This is not live location tracking.">
      <div className="trip-map-preview__road" />
      <div className="trip-map-preview__branch trip-map-preview__branch--one" />
      <div className="trip-map-preview__branch trip-map-preview__branch--two" />
      <span className="trip-map-preview__point trip-map-preview__point--start"><MapPin size={17} /></span>
      <span className="trip-map-preview__point trip-map-preview__point--vehicle"><CarFront size={18} /></span>
      <span className="trip-map-preview__point trip-map-preview__point--end"><Flag size={17} /></span>
      <div className="trip-map-preview__legend">
        <span>Eagle Rock area</span>
        <span>PCC Access Point</span>
      </div>
      <small>Planned corridor preview · not live location</small>
    </div>
  );
}

function StepRail({ current, steps }: { current: number; steps: StepCopy[] }) {
  return (
    <div className="trip-step-rail" aria-label={`Trip progress: step ${current + 1} of ${steps.length}`}>
      {steps.map((step, index) => {
        const Icon = stepIcons[index];
        const state = index < current ? 'complete' : index === current ? 'current' : 'upcoming';
        return (
          <React.Fragment key={step.label}>
            <div className={`trip-step-dot trip-step-dot--${state}`} title={step.label}>
              {index < current ? <Check size={13} /> : <Icon size={13} />}
            </div>
            {index < steps.length - 1 && <span className={`trip-step-line ${index < current ? 'is-complete' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function StatusList({ current, mode }: { current: number; mode: TripJourneyMode }) {
  const statuses = mode === 'participant'
    ? ['Coordination confirmed', 'Met at Access Point', 'Route in progress', 'Arriving', 'Arrived', 'Complete']
    : ['Route confirmed', 'At Access Point', 'Ready to depart', 'Route in progress', 'Arrived', 'Complete'];

  return (
    <div className="trip-status-list">
      {statuses.map((status, index) => (
        <div key={status} className={`trip-status-row ${index === current ? 'is-current' : ''} ${index < current ? 'is-complete' : ''}`}>
          <span>{index < current ? <Check size={12} /> : index === current ? <span className="trip-status-pulse" /> : null}</span>
          <p>{status}</p>
        </div>
      ))}
    </div>
  );
}

export const TripJourneyScreen: React.FC<TripJourneyScreenProps> = ({ mode, onBack, onDone }) => {
  const [step, setStep] = useState(0);
  const [issueOpen, setIssueOpen] = useState(false);
  const steps = mode === 'participant' ? participantSteps : driverSteps;
  const current = steps[step];
  const isParticipant = mode === 'participant';
  const isComplete = step === steps.length - 1;

  const eyebrow = useMemo(() => {
    if (isParticipant) return 'Commuter participant';
    return 'Planned-route participant';
  }, [isParticipant]);

  const advance = () => {
    setIssueOpen(false);
    if (isComplete) {
      onDone();
      return;
    }
    setStep(value => Math.min(value + 1, steps.length - 1));
  };

  const goBackStep = () => {
    setIssueOpen(false);
    if (step === 0) {
      onBack();
      return;
    }
    setStep(value => Math.max(value - 1, 0));
  };

  return (
    <div className="trip-journey-page">
      <header className="trip-journey-header">
        <button type="button" onClick={goBackStep} aria-label={step === 0 ? 'Back to Activity' : 'Previous trip state'}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <span>{eyebrow}</span>
          <strong>{current.label}</strong>
        </div>
        <span className="trip-beta-pill"><ShieldCheck size={13} /> Demo</span>
      </header>

      <main className="trip-journey-shell">
        <StepRail current={step} steps={steps} />

        <section className="trip-journey-hero">
          <div className="trip-journey-hero__status">
            <span><CheckCircle2 size={15} /> {current.label}</span>
            <small>Step {step + 1} of {steps.length}</small>
          </div>
          <h1>{current.title}</h1>
          <p>{current.subtitle}</p>
        </section>

        <section className="trip-route-card">
          <div className="trip-route-card__top">
            <div>
              <span className="trip-kicker">Planned route</span>
              <h2>Eagle Rock <ArrowRight size={17} /> Pasadena City College</h2>
            </div>
            <span className="trip-vehicle-pill"><Leaf size={13} /> EV planned route</span>
          </div>
          <div className="trip-route-meta">
            <span><CalendarDays size={14} /> Wed · demonstration</span>
            <span><Clock3 size={14} /> 7:45–8:05 AM</span>
            <span><UsersRound size={14} /> {isParticipant ? '94% match preview' : '1 participant confirmed'}</span>
          </div>
        </section>

        {step === 0 && (
          <section className="trip-info-card trip-info-card--access">
            <div className="trip-info-card__heading"><MapPin size={18} /><div><span className="trip-kicker">Access Point</span><h2>Eagle Rock Plaza area</h2></div></div>
            <div className="trip-detail-grid">
              <div><span>Meeting window</span><strong>7:40–7:50 AM</strong></div>
              <div><span>Walking</span><strong>{isParticipant ? '~6 min' : 'Participant walk ~6 min'}</strong></div>
              <div><span>Estimated detour</span><strong>+4 min modeled</strong></div>
              <div><span>Review state</span><strong>Confirmed demo</strong></div>
            </div>
            <p>Public-area coordination preview. A production Access Point would require program review for visibility, lighting, accessibility, and general suitability.</p>
          </section>
        )}

        {step === 1 && (
          <>
            <PlannedCorridorPreview compact />
            <section className="trip-info-card trip-info-card--warm">
              <span className="trip-kicker">Planned meeting window</span>
              <h2>7:40–7:50 AM</h2>
              <p>{isParticipant ? 'Meet at the designated public Access Point during the agreed window.' : 'One participant is expected at the designated public Access Point during this window.'}</p>
            </section>
          </>
        )}

        {(step === 2 || step === 3) && (
          <>
            <PlannedCorridorPreview />
            <section className="trip-progress-card">
              <div>
                <span className="trip-kicker">Modeled arrival</span>
                <strong>8:03 AM</strong>
              </div>
              <div>
                <span className="trip-kicker">Destination</span>
                <strong>PCC Access Point</strong>
              </div>
            </section>
            <section className="trip-info-card">
              <span className="trip-kicker">Trip status</span>
              <StatusList current={step} mode={mode} />
            </section>
          </>
        )}

        {step === 4 && (
          <section className="trip-arrival-card">
            <span className="trip-arrival-icon"><MapPin size={34} /></span>
            <span className="trip-kicker">Destination Access Point</span>
            <h2>{isParticipant ? 'You’ve arrived' : 'Arrival ready to confirm'}</h2>
            <p>Pasadena City College area</p>
            <div className="trip-arrival-time">Arrival recorded around <strong>8:04 AM</strong> in this demonstration.</div>
            <small>{isParticipant ? 'Only confirm after reaching the designated destination area.' : 'Confirm arrival only after the planned route reaches the destination area.'}</small>
          </section>
        )}

        {step === 5 && (
          <>
            <section className="trip-complete-card">
              <span className="trip-complete-icon"><CheckCircle2 size={30} /></span>
              <span className="trip-kicker">Trip summary</span>
              <h2>{isParticipant ? 'Commute complete' : 'Route complete'}</h2>
              <div className="trip-summary-grid">
                <div><span>Route</span><strong>Eagle Rock → PCC</strong></div>
                <div><span>Route fit</span><strong>94% modeled</strong></div>
                <div><span>Access Points</span><strong>2 areas</strong></div>
                <div><span>Detour</span><strong>+4 min modeled</strong></div>
              </div>
            </section>
            <section className="trip-credit-card">
              <div><Leaf size={21} /><span><strong>+2 Green Route Credits</strong><small>Pending program rules / review</small></span></div>
              <p>Promotional program benefit only. Not cash, wages, fares, or guaranteed payment.</p>
            </section>
          </>
        )}

        {issueOpen && (
          <section className="trip-issue-note" aria-live="polite">
            <MessageCircleWarning size={18} />
            <p><strong>Prototype support state.</strong> A production version would open a controlled report/block/escalation workflow. No report is being submitted from this demonstration.</p>
          </section>
        )}

        <div className="trip-journey-actions">
          <button type="button" className="trip-primary-action" onClick={advance}>
            {current.primaryAction} <ArrowRight size={17} />
          </button>
          {!isComplete && (
            <button type="button" className="trip-secondary-action" onClick={() => setIssueOpen(value => !value)}>
              <MessageCircleWarning size={16} /> {issueOpen ? 'Hide support note' : 'Report an issue'}
            </button>
          )}
        </div>

        <section className="trip-guardrail-note">
          <ShieldCheck size={17} />
          <p><strong>Research beta demonstration.</strong> This screen simulates a governed planned-route workflow. It is not live dispatch, real-time vehicle tracking, guaranteed transportation, or an unrestricted public marketplace.</p>
        </section>
      </main>
    </div>
  );
};
