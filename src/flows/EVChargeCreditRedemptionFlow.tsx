import { ArrowLeft, ArrowRight, BadgeCheck, BatteryCharging, Clock3, MapPin, ShieldCheck, TicketCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { chargingHubs, useApp } from '../context/AppContext';
import { RedemptionRequest } from '../types';
import '../green-wallet.css';

interface Props { onClose: () => void; }
type Step = 'details' | 'location' | 'confirm' | 'submitted';
const steps: Step[] = ['details', 'location', 'confirm', 'submitted'];

export const EVChargeCreditRedemptionFlow: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('details');
  const [locationId, setLocationId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [requestId, setRequestId] = useState('');
  const reduceMotion = useReducedMotion();
  const { greenRouteCredits, redemptionRequests, createRedemptionRequest } = useApp();
  const unavailableCreditIds = useMemo(
    () => new Set(redemptionRequests.filter(request => request.status !== 'denied').map(request => request.creditId)),
    [redemptionRequests],
  );
  const selectedCredit = greenRouteCredits.find(
    credit => (credit.status === 'issued' || credit.status === 'approved') && !unavailableCreditIds.has(credit.id),
  );
  const selectedHub = useMemo(() => chargingHubs.find(hub => hub.id === locationId && hub.status === 'active'), [locationId]);
  const selectedUnits = selectedCredit?.amountUnits ?? selectedCredit?.amount ?? 0;
  const selectedUnitLabel = selectedCredit?.unitLabel ?? 'Green Route Credits';
  const stepIndex = steps.indexOf(step);

  const next = () => {
    if (step === 'confirm' && selectedCredit && selectedHub) {
      const id = `RR-EV-${Date.now().toString().slice(-6)}`;
      const request: RedemptionRequest = {
        id,
        creditId: selectedCredit.id,
        participantId: 'session-participant',
        chargingHubId: selectedHub.id,
        requestedUnits: selectedUnits,
        unitLabel: selectedUnitLabel,
        status: 'requested',
        requestedAt: new Date().toISOString(),
        reviewNote: undefined,
      };
      createRedemptionRequest(request);
      setRequestId(id);
    }
    setStep(steps[Math.min(stepIndex + 1, steps.length - 1)]);
  };
  const previous = () => stepIndex === 0 ? onClose() : setStep(steps[stepIndex - 1]);

  return <main className="charging-benefit-flow">
    <header className="charging-benefit-flow__header"><button type="button" onClick={previous} className="green-wallet-icon-button" aria-label="Go back"><ArrowLeft size={19} /></button><div><span>Green Wallet</span><strong>EV Charge Benefit</strong></div><span className="charging-benefit-demo-pill">Research beta</span></header>
    <div className="charging-benefit-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>{steps.map(item => <span key={item} className={steps.indexOf(item) <= stepIndex ? 'is-active' : ''} />)}</div>
    <div className="charging-benefit-deck">
      <div className="charging-benefit-deck__layer charging-benefit-deck__layer--back" /><div className="charging-benefit-deck__layer charging-benefit-deck__layer--middle" />
      <AnimatePresence mode="wait" initial={false}><motion.section key={step} className={`charging-benefit-card charging-benefit-card--${step}`} initial={reduceMotion ? false : { opacity: 0, rotateY: 12, x: 22, scale: 0.97 }} animate={{ opacity: 1, rotateY: 0, x: 0, scale: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -10, x: -18, scale: 0.98 }} transition={{ type: 'spring', stiffness: 250, damping: 27 }}>
        {step === 'details' && <><div className="charging-benefit-card__icon"><BatteryCharging size={28} /></div><span className="green-wallet-kicker">Eligible program benefit</span><h1>Request an EV Charge Benefit</h1><p className="charging-benefit-card__intro">Use an issued institution-sponsored benefit to request manual program review at an eligible Charging Hub.</p><div className="charging-benefit-facts"><div><span>Available benefit</span><strong>{selectedUnits} {selectedUnitLabel}</strong></div><div><span>Request type</span><strong>Manual program request</strong></div><div><span>Review</span><strong>Required</strong></div></div><div className="charging-benefit-safety-note"><ShieldCheck size={18} /><p>This request does not reserve a charger, start a session, or process a payment.</p></div></>}
        {step === 'location' && <><div className="charging-benefit-card__icon"><MapPin size={27} /></div><span className="green-wallet-kicker">Eligible Charging Hubs</span><h1>Choose a Charging Hub</h1><p className="charging-benefit-card__intro">Only Charging Hubs with an active program status can be selected. Availability is not live, there is no charger reservation, and access remains subject to program rules.</p><div className="charging-location-list">{chargingHubs.filter(hub => hub.status === 'active').length === 0 ? <div className="charging-benefit-empty-state"><strong>No active Charging Hubs are available</strong><small>Connect the Green Wallet API to load active program locations.</small></div> : chargingHubs.map(hub => { const selectable = hub.status === 'active'; return <button type="button" key={hub.id} disabled={!selectable} aria-disabled={!selectable} className={`charging-location-card ${locationId === hub.id ? 'is-selected' : ''} ${!selectable ? 'is-informational' : ''}`} onClick={() => selectable && setLocationId(hub.id)}><span className="charging-location-card__marker"><MapPin size={18} /></span><span><strong>{hub.name}</strong><small>{hub.city} · {hub.network} · {selectable ? 'Active and selectable' : `${hub.status} · informational only, not selectable`}</small></span><span className="charging-location-card__check"><BadgeCheck size={18} /></span></button>; })}</div></>}
        {step === 'confirm' && <><div className="charging-benefit-card__icon"><TicketCheck size={27} /></div><span className="green-wallet-kicker">Review before submitting</span><h1>Confirm your request</h1><div className="charging-confirmation-list"><div><span>Benefit</span><strong>EV Charge Benefit</strong></div><div><span>Requested amount</span><strong>{selectedUnits} {selectedUnitLabel}</strong></div><div><span>Charging Hub</span><strong>{selectedHub?.name ?? 'No Charging Hub selected'}</strong></div><div><span>Review</span><strong>Manual program decision</strong></div></div><label className="charging-benefit-confirmation"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>I understand this is a request for manual program review. It does not activate, reserve, or guarantee access to a charger.</span></label></>}
        {step === 'submitted' && <><div className="charging-benefit-card__icon"><Clock3 size={27} /></div><span className="green-wallet-kicker">Manual program review</span><h1>Your request was submitted</h1><div className="charging-voucher"><span>Request ID</span><strong>{requestId}</strong><small>Keep this reference for pilot support</small></div><div className="charging-status-panel"><span>Request status</span><strong>Pending review</strong><small>A manual program decision is still required. No program benefit has been deducted.</small></div><div className="charging-benefit-safety-note"><ShieldCheck size={18} /><p>This research-beta flow does not connect to a live charging network.</p></div></>}
      </motion.section></AnimatePresence>
    </div>
    <div className="charging-benefit-actions">{step !== 'submitted' ? <button type="button" onClick={next} disabled={!selectedCredit || !selectedHub || (step === 'confirm' && !acknowledged)} className="green-wallet-primary-button">{step === 'confirm' ? 'Submit request' : 'Continue'} <ArrowRight size={18} /></button> : <button type="button" onClick={onClose} className="green-wallet-primary-button">Return to wallet <ArrowRight size={18} /></button>}<p>Research beta · Manual review only · No live charger integration</p></div>
  </main>;
};
