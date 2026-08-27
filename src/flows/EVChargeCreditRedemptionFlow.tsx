import { ArrowLeft, ArrowRight, BadgeCheck, BatteryCharging, Clock3, MapPin, ShieldCheck, TicketCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { demoChargingHubs, useApp } from '../context/AppContext';
import { GreenRouteCredit, RedemptionRequest } from '../types';
import '../green-wallet.css';

interface Props { onClose: () => void; }
type Step = 'details' | 'location' | 'confirm' | 'submitted';
const steps: Step[] = ['details', 'location', 'confirm', 'submitted'];
const demoCredits: GreenRouteCredit[] = [{ id: 'demo-approved-01', activity: 'Planned-route check-in', amount: 120, status: 'approved', date: 'Aug 7' }];

export const EVChargeCreditRedemptionFlow: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('details');
  const [locationId, setLocationId] = useState(demoChargingHubs[0].id);
  const [acknowledged, setAcknowledged] = useState(false);
  const [requestId, setRequestId] = useState('');
  const reduceMotion = useReducedMotion();
  const { greenRouteCredits, createRedemptionRequest } = useApp();
  const credits = greenRouteCredits.length ? greenRouteCredits : demoCredits;
  const selectedCredit = credits.find(credit => credit.status === 'approved') ?? credits[0];
  const selectedHub = useMemo(() => demoChargingHubs.find(hub => hub.id === locationId) ?? demoChargingHubs[0], [locationId]);
  const stepIndex = steps.indexOf(step);

  const next = () => {
    if (step === 'confirm') {
      const id = `RR-EV-${Date.now().toString().slice(-6)}`;
      const request: RedemptionRequest = { id, creditId: selectedCredit.id, participantId: 'session-participant', chargingHubId: selectedHub.id, requestedUnits: selectedCredit.amount, unitLabel: 'kWh-equivalent', status: 'requested', requestedAt: new Date().toISOString() };
      createRedemptionRequest(request);
      setRequestId(id);
    }
    setStep(steps[Math.min(stepIndex + 1, steps.length - 1)]);
  };
  const previous = () => stepIndex === 0 ? onClose() : setStep(steps[stepIndex - 1]);

  return <main className="charging-benefit-flow">
    <header className="charging-benefit-flow__header"><button type="button" onClick={previous} className="green-wallet-icon-button" aria-label="Go back"><ArrowLeft size={19} /></button><div><span>Green Route Wallet</span><strong>EV Charge Benefit</strong></div><span className="charging-benefit-demo-pill">Research beta</span></header>
    <div className="charging-benefit-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>{steps.map(item => <span key={item} className={steps.indexOf(item) <= stepIndex ? 'is-active' : ''} />)}</div>
    <div className="charging-benefit-deck">
      <div className="charging-benefit-deck__layer charging-benefit-deck__layer--back" /><div className="charging-benefit-deck__layer charging-benefit-deck__layer--middle" />
      <AnimatePresence mode="wait" initial={false}><motion.section key={step} className={`charging-benefit-card charging-benefit-card--${step}`} initial={reduceMotion ? false : { opacity: 0, rotateY: 12, x: 22, scale: 0.97 }} animate={{ opacity: 1, rotateY: 0, x: 0, scale: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -10, x: -18, scale: 0.98 }} transition={{ type: 'spring', stiffness: 250, damping: 27 }}>
        {step === 'details' && <><div className="charging-benefit-card__icon"><BatteryCharging size={28} /></div><span className="green-wallet-kicker">Eligible program benefit</span><h1>Request an EV Charge Benefit</h1><p className="charging-benefit-card__intro">Use an approved program benefit to request a manually reviewed kWh-equivalent allocation at an eligible Charging Hub.</p><div className="charging-benefit-facts"><div><span>Available benefit</span><strong>{selectedCredit.amount} kWh-equivalent</strong></div><div><span>Request type</span><strong>Full kWh-equivalent benefit</strong></div><div><span>Review</span><strong>Required</strong></div></div><div className="charging-benefit-safety-note"><ShieldCheck size={18} /><p>This request does not reserve a charger, start a session, or process a payment.</p></div></>}
        {step === 'location' && <><div className="charging-benefit-card__icon"><MapPin size={27} /></div><span className="green-wallet-kicker">Eligible Charging Hubs</span><h1>Choose a Charging Hub</h1><p className="charging-benefit-card__intro">Choose a program-configured location. Availability is not live and access remains subject to program rules.</p><div className="charging-location-list">{demoChargingHubs.map(hub => <button type="button" key={hub.id} className={`charging-location-card ${locationId === hub.id ? 'is-selected' : ''}`} onClick={() => setLocationId(hub.id)}><span className="charging-location-card__marker"><MapPin size={18} /></span><span><strong>{hub.name}</strong><small>{hub.city} · {hub.network} · {hub.status}</small></span><span className="charging-location-card__check"><BadgeCheck size={18} /></span></button>)}</div></>}
        {step === 'confirm' && <><div className="charging-benefit-card__icon"><TicketCheck size={27} /></div><span className="green-wallet-kicker">Review before submitting</span><h1>Confirm your request</h1><div className="charging-confirmation-list"><div><span>Benefit</span><strong>EV Charge Benefit</strong></div><div><span>kWh-equivalent requested</span><strong>{selectedCredit.amount} kWh-equivalent</strong></div><div><span>Charging Hub</span><strong>{selectedHub.name}</strong></div><div><span>Review</span><strong>Administrator required</strong></div></div><label className="charging-benefit-confirmation"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>I understand this is a request for review. It does not activate, reserve, or guarantee access to a charger.</span></label></>}
        {step === 'submitted' && <><div className="charging-benefit-card__icon"><Clock3 size={27} /></div><span className="green-wallet-kicker">Administrative review</span><h1>Your request was submitted</h1><div className="charging-voucher"><span>Request ID</span><strong>{requestId}</strong><small>Keep this reference for pilot support</small></div><div className="charging-status-panel"><span>Request status</span><strong>Pending review</strong><small>An administrator must review eligibility before fulfillment. No kWh-equivalent benefit has been deducted.</small></div><div className="charging-benefit-safety-note"><ShieldCheck size={18} /><p>This research-beta flow does not connect to a live charging network.</p></div></>}
      </motion.section></AnimatePresence>
    </div>
    <div className="charging-benefit-actions">{step !== 'submitted' ? <button type="button" onClick={next} disabled={step === 'confirm' && !acknowledged} className="green-wallet-primary-button">{step === 'confirm' ? 'Submit request' : 'Continue'} <ArrowRight size={18} /></button> : <button type="button" onClick={onClose} className="green-wallet-primary-button">Return to wallet <ArrowRight size={18} /></button>}<p>Research beta · Manual review only · No live charger integration</p></div>
  </main>;
};
