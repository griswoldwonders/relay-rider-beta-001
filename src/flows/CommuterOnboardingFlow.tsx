import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  BusFront,
  Check,
  Clock3,
  Footprints,
  Gift,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Zap,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { GreenRouteCredit, RouteSignal } from '../types';

interface CommuterOnboardingFlowProps {
  onComplete: () => void;
  onCancel: () => void;
}

const campuses = [
  'Pasadena City College',
  'Glendale Community College',
  'Caltech',
  'ArtCenter College of Design',
  'Cal State LA',
  'Other college / university',
];

const days = [
  ['Monday', 'M'],
  ['Tuesday', 'T'],
  ['Wednesday', 'W'],
  ['Thursday', 'T'],
  ['Friday', 'F'],
  ['Saturday', 'S'],
  ['Sunday', 'S'],
] as const;

const travelModes = [
  { value: 'LA Metro rail', label: 'Metro rail', icon: TrainFront },
  { value: 'LA Metro bus', label: 'Metro bus', icon: BusFront },
  { value: 'Pasadena Transit', label: 'Pasadena Transit', icon: BusFront },
  { value: 'Glendale Beeline', label: 'Glendale Beeline', icon: BusFront },
  { value: 'Bike / walk connection', label: 'Walk / bike', icon: Bike },
] as const;

const incentives = [
  'Green Route Credits',
  'Campus commute challenges',
  'Transit participation rewards',
  'EV / clean-route recognition',
] as const;

const cardThemes = ['lavender', 'peach', 'yellow', 'mint', 'green'] as const;

const cardVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 92 : -92,
    rotateY: direction > 0 ? 58 : -58,
    rotateX: 3,
    scale: 0.92,
    opacity: 0,
  }),
  center: {
    x: 0,
    rotateY: 0,
    rotateX: 0,
    scale: 1,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -92 : 92,
    rotateY: direction > 0 ? -62 : 62,
    rotateX: -2,
    scale: 0.94,
    opacity: 0,
  }),
};

const spring = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 30,
};

function formatTime(value: string) {
  if (!value) return '';
  const [hourString, minute] = value.split(':');
  const hour = Number(hourString);
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${meridiem}`;
}

export const CommuterOnboardingFlow: React.FC<CommuterOnboardingFlowProps> = ({ onComplete, onCancel }) => {
  const { addGreenRouteCredit, addRouteSignal } = useApp();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [campus, setCampus] = useState('');
  const [customCampus, setCustomCampus] = useState('');
  const [startingArea, setStartingArea] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday', 'Wednesday', 'Friday']);
  const [arrivalTime, setArrivalTime] = useState('08:00');
  const [flexibility, setFlexibility] = useState('±15 min');
  const [selectedModes, setSelectedModes] = useState<string[]>(['LA Metro bus', 'LA Metro rail']);
  const [plannedRouteInterest, setPlannedRouteInterest] = useState(true);
  const [evPreference, setEvPreference] = useState<RouteSignal['evPreference']>('hybrid-ev');
  const [walking, setWalking] = useState('10-15');
  const [studentPass, setStudentPass] = useState<RouteSignal['studentTransitPass']>('not-sure');
  const [selectedIncentives, setSelectedIncentives] = useState<string[]>(['Green Route Credits']);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [researchConsent, setResearchConsent] = useState(false);

  const campusName = campus === 'Other college / university' ? customCampus.trim() : campus;
  const destinationArea = campusName;

  const corridor = useMemo(() => {
    const value = `${startingArea} ${campusName}`.toLowerCase();
    if (value.includes('pasadena') || value.includes('eagle rock') || value.includes('glendale') || value.includes('caltech') || value.includes('artcenter')) {
      return 'Pasadena ↔ Eagle Rock ↔ Glendale';
    }
    if (value.includes('cal state la')) return 'Northeast Los Angeles → Cal State LA';
    return 'Campus-specific commute corridor';
  }, [startingArea, campusName]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(campusName);
    if (step === 1) return startingArea.trim().length >= 2;
    if (step === 2) return selectedDays.length > 0 && Boolean(arrivalTime);
    if (step === 3) return selectedModes.length > 0 || plannedRouteInterest;
    return adultConfirmed && researchConsent;
  }, [step, campusName, startingArea, selectedDays, arrivalTime, selectedModes, plannedRouteInterest, adultConfirmed, researchConsent]);

  const goNext = () => {
    if (!canContinue) return;
    if (step < 4) {
      setDirection(1);
      setStep(current => current + 1);
      return;
    }

    const timeLabel = formatTime(arrivalTime);
    const signal: RouteSignal = {
      id: nanoid(),
      corridor,
      startingArea: startingArea.trim(),
      destinationArea,
      campusAffiliation: campusName,
      daysOfWeek: selectedDays,
      timeWindow: `${timeLabel}${flexibility === 'Exact' ? '' : ` ${flexibility}`}`,
      routeType: 'campus',
      relayZoneType: selectedModes.length > 0
        ? ['Metro / transit station', 'Campus edge', 'Walkable public area']
        : ['Campus edge', 'Walkable public area'],
      transitOptions: selectedModes,
      studentTransitPass: studentPass,
      incentiveInterests: selectedIncentives,
      evPreference: plannedRouteInterest ? evPreference : 'any',
      maxWalkingDistance: walking,
      privacyPreference: 'mask-address',
      status: 'submitted',
      routeFit: 'moderate',
      greenRouteCredit: 3,
      createdAt: new Date().toISOString(),
      modeled: {
        overlapPotential: 'medium',
        timeCompatibility: 'moderate',
        relayZoneFit: 'moderate',
        evHybridSupply: 'needs-more',
        parkingPressure: 'medium',
        pilotReadiness: 'research-only',
      },
    };

    addRouteSignal(signal);

    const credit: GreenRouteCredit = {
      id: nanoid(),
      activity: 'Commute profile submitted',
      amount: 3,
      status: 'pending',
      date: new Date().toLocaleDateString(),
    };
    addGreenRouteCredit(credit);
    onComplete();
  };

  const goBack = () => {
    if (step === 0) {
      onCancel();
      return;
    }
    setDirection(-1);
    setStep(current => current - 1);
  };

  const toggleDay = (day: string) => {
    setSelectedDays(current => current.includes(day) ? current.filter(item => item !== day) : [...current, day]);
  };

  const toggleMode = (mode: string) => {
    setSelectedModes(current => current.includes(mode) ? current.filter(item => item !== mode) : [...current, mode]);
  };

  const toggleIncentive = (value: string) => {
    setSelectedIncentives(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  const renderCard = () => {
    if (step === 0) {
      return (
        <>
          <div className="onboarding-card__icon"><GraduationCap size={30} /></div>
          <span className="onboarding-kicker">Your campus</span>
          <h1>Where are you going?</h1>
          <p className="onboarding-card__intro">Start with your school so Relay Rider can organize transit, planned-route, Access Point, and benefit signals around the right destination.</p>
          <div className="onboarding-choice-grid onboarding-choice-grid--campus">
            {campuses.map(option => (
              <button
                type="button"
                key={option}
                className={`onboarding-choice ${campus === option ? 'is-selected' : ''}`}
                onClick={() => setCampus(option)}
              >
                <span>{option}</span>
                {campus === option && <Check size={16} />}
              </button>
            ))}
          </div>
          {campus === 'Other college / university' && (
            <input
              className="onboarding-input"
              value={customCampus}
              onChange={event => setCustomCampus(event.target.value)}
              placeholder="Enter your college or university"
              autoFocus
            />
          )}
          <p className="onboarding-footnote">Selecting a school does not imply a formal partnership.</p>
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <div className="onboarding-card__icon"><MapPin size={30} /></div>
          <span className="onboarding-kicker">Your starting area</span>
          <h1>Where does your commute begin?</h1>
          <p className="onboarding-card__intro">A neighborhood or general area is enough. Relay Rider does not need your exact home address for this prototype.</p>
          <label className="onboarding-field-label" htmlFor="starting-area">Starting area</label>
          <input
            id="starting-area"
            className="onboarding-input onboarding-input--large"
            value={startingArea}
            onChange={event => setStartingArea(event.target.value)}
            placeholder="e.g., Eagle Rock"
            autoFocus
          />
          <div className="onboarding-destination-preview">
            <span>Destination</span>
            <strong>{destinationArea || 'Your campus'}</strong>
          </div>
          <div className="onboarding-privacy-note"><ShieldCheck size={17} /><span><strong>Approximate location only.</strong> Precise addresses stay out of this onboarding flow.</span></div>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <div className="onboarding-card__icon"><Clock3 size={30} /></div>
          <span className="onboarding-kicker">Your schedule</span>
          <h1>When do you need to get there?</h1>
          <p className="onboarding-card__intro">Recurring days and arrival flexibility help us compare schedule fit without implying a guaranteed trip.</p>
          <div className="onboarding-days" aria-label="Travel days">
            {days.map(([value, label], index) => (
              <button
                type="button"
                key={`${value}-${index}`}
                className={selectedDays.includes(value) ? 'is-selected' : ''}
                onClick={() => toggleDay(value)}
                aria-label={value}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="onboarding-field-label" htmlFor="arrival-time">Arrive around</label>
          <input
            id="arrival-time"
            type="time"
            className="onboarding-input onboarding-input--large"
            value={arrivalTime}
            onChange={event => setArrivalTime(event.target.value)}
          />
          <span className="onboarding-field-label">Schedule flexibility</span>
          <div className="onboarding-pill-row">
            {['Exact', '±15 min', '±30 min'].map(option => (
              <button type="button" key={option} className={flexibility === option ? 'is-selected' : ''} onClick={() => setFlexibility(option)}>{option}</button>
            ))}
          </div>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <div className="onboarding-card__icon"><BusFront size={30} /></div>
          <span className="onboarding-kicker">Ways you would travel</span>
          <h1>What works for you?</h1>
          <p className="onboarding-card__intro">Choose the modes Relay Rider should compare. You can update these preferences later.</p>
          <div className="onboarding-mode-grid">
            {travelModes.map(({ value, label, icon: Icon }) => (
              <button type="button" key={value} className={selectedModes.includes(value) ? 'is-selected' : ''} onClick={() => toggleMode(value)}>
                <Icon size={19} />
                <span>{label}</span>
                {selectedModes.includes(value) && <Check size={14} />}
              </button>
            ))}
            <button type="button" className={plannedRouteInterest ? 'is-selected' : ''} onClick={() => setPlannedRouteInterest(current => !current)}>
              <Zap size={19} />
              <span>Planned commuter route</span>
              {plannedRouteInterest && <Check size={14} />}
            </button>
          </div>
          {plannedRouteInterest && (
            <>
              <span className="onboarding-field-label">Vehicle preference for planned-route previews</span>
              <div className="onboarding-pill-row">
                {[
                  ['ev-only', 'EV only'],
                  ['hybrid-ev', 'EV / hybrid'],
                  ['any', 'Any eligible vehicle'],
                ].map(([value, label]) => (
                  <button type="button" key={value} className={evPreference === value ? 'is-selected' : ''} onClick={() => setEvPreference(value as RouteSignal['evPreference'])}>{label}</button>
                ))}
              </div>
            </>
          )}
          <span className="onboarding-field-label"><Footprints size={15} /> Comfortable walking time</span>
          <div className="onboarding-pill-row">
            {[
              ['under-5', '5 min'],
              ['5-10', '10 min'],
              ['10-15', '15 min'],
              ['depends', '20+ min'],
            ].map(([value, label]) => (
              <button type="button" key={value} className={walking === value ? 'is-selected' : ''} onClick={() => setWalking(value)}>{label}</button>
            ))}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="onboarding-card__icon"><Gift size={30} /></div>
        <span className="onboarding-kicker">Benefits + data use</span>
        <h1>Personalize your campus benefits.</h1>
        <p className="onboarding-card__intro">These preferences help highlight relevant program benefits. They do not guarantee eligibility, transportation, credits, or rewards.</p>
        <span className="onboarding-field-label">Student transit pass / GoPass</span>
        <div className="onboarding-pill-row">
          {[
            ['yes', 'Yes'],
            ['no', 'No'],
            ['not-sure', 'Not sure'],
          ].map(([value, label]) => (
            <button type="button" key={value} className={studentPass === value ? 'is-selected' : ''} onClick={() => setStudentPass(value as RouteSignal['studentTransitPass'])}>{label}</button>
          ))}
        </div>
        <span className="onboarding-field-label">Benefits that interest you</span>
        <div className="onboarding-choice-grid">
          {incentives.map(option => (
            <button type="button" key={option} className={`onboarding-choice ${selectedIncentives.includes(option) ? 'is-selected' : ''}`} onClick={() => toggleIncentive(option)}>
              <span>{option}</span>{selectedIncentives.includes(option) && <Check size={16} />}
            </button>
          ))}
        </div>
        <div className="onboarding-consent-box">
          <label>
            <input type="checkbox" checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)} />
            <span>I confirm I am an eligible adult participant for this research prototype.</span>
          </label>
          <label>
            <input type="checkbox" checked={researchConsent} onChange={event => setResearchConsent(event.target.checked)} />
            <span>I consent to use of my approximate commute information for match previews and aggregated mobility research in this demonstration environment.</span>
          </label>
          <p>Relay Rider uses approximate zones before precise locations. You can update or withdraw your information in a governed program.</p>
        </div>
      </>
    );
  };

  return (
    <div className="onboarding-screen">
      <div className="onboarding-topbar">
        <button type="button" onClick={goBack} className="onboarding-back" aria-label={step === 0 ? 'Exit onboarding' : 'Previous onboarding card'}><ArrowLeft size={21} /></button>
        <div>
          <span>Relay Rider</span>
          <strong>Build your commute</strong>
        </div>
        <span className="onboarding-step-count">{step + 1}/5</span>
      </div>

      <div className="onboarding-progress" aria-label={`Step ${step + 1} of 5`}>
        {[0, 1, 2, 3, 4].map(index => (
          <span key={index} className={index <= step ? 'is-active' : ''} />
        ))}
      </div>

      <div className="onboarding-deck-wrap">
        <div className="onboarding-stack-card onboarding-stack-card--two" aria-hidden="true" />
        <div className="onboarding-stack-card onboarding-stack-card--one" aria-hidden="true" />
        <AnimatePresence mode="wait" custom={direction}>
          <motion.section
            key={step}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            className={`onboarding-card onboarding-card--${cardThemes[step]}`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {renderCard()}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="onboarding-action-bar">
        <div className="onboarding-summary-line">
          <Sparkles size={14} />
          <span>{step < 4 ? 'Your answers build the ranking profile.' : `${startingArea || 'Starting area'} → ${destinationArea || 'campus'} · ${formatTime(arrivalTime) || 'time not set'}`}</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          className="onboarding-continue"
          disabled={!canContinue}
          onClick={goNext}
        >
          <span>{step === 4 ? 'Build my commute' : 'Continue'}</span>
          <ArrowRight size={18} />
        </motion.button>
      </div>
    </div>
  );
};
