import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, BatteryCharging, Clock3, MapPin, ShieldCheck, TicketCheck } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface CampusChargingBenefitFlowProps {
  onClose: () => void;
}

type ChargingStep = 'details' | 'location' | 'confirm' | 'pending' | 'approved';

const steps: ChargingStep[] = ['details', 'location', 'confirm', 'pending', 'approved'];

const demoLocations = [
  { id: 'west-garage', name: 'Campus West Garage', note: 'Demo participating area • availability not live' },
  { id: 'south-lot', name: 'Campus South Lot', note: 'Demo participating area • availability not live' },
] as const;

export const CampusChargingBenefitFlow: React.FC<CampusChargingBenefitFlowProps> = ({ onClose }) => {
  const [step, setStep] = useState<ChargingStep>('details');
  const [locationId, setLocationId] = useState<string>(demoLocations[0].id);
  const [acknowledged, setAcknowledged] = useState(false);
  const reduceMotion = useReducedMotion();
  const stepIndex = steps.indexOf(step);
  const selectedLocation = demoLocations.find(location => location.id === locationId) ?? demoLocations[0];

  const previous = () => {
    if (stepIndex === 0) onClose();
    else setStep(steps[stepIndex - 1]);
  };

  const next = () => setStep(steps[Math.min(stepIndex + 1, steps.length - 1)]);

  return (
    <main className="charging-benefit-flow">
      <header className="charging-benefit-flow__header">
        <button type="button" onClick={previous} className="green-wallet-icon-button" aria-label={stepIndex === 0 ? 'Return to Green Route Wallet' : 'Previous charging benefit step'}><ArrowLeft size={19} /></button>
        <div><span>Green Route Wallet</span><strong>Campus Charging Benefit</strong></div>
        <span className="charging-benefit-demo-pill">Demo only</span>
      </header>

      <div className="charging-benefit-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
        {steps.map((item, index) => <span key={item} className={index <= stepIndex ? 'is-active' : ''} />)}
      </div>

      <div className="charging-benefit-deck">
        <div className="charging-benefit-deck__layer charging-benefit-deck__layer--back" />
        <div className="charging-benefit-deck__layer charging-benefit-deck__layer--middle" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            className={`charging-benefit-card charging-benefit-card--${step}`}
            initial={reduceMotion ? false : { opacity: 0, rotateY: 12, x: 22, scale: 0.97 }}
            animate={{ opacity: 1, rotateY: 0, x: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -10, x: -18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 250, damping: 27 }}
          >
            {step === 'details' && <>
              <div className="charging-benefit-card__icon"><BatteryCharging size={28} /></div>
              <span className="green-wallet-kicker">Institution-sponsored benefit</span>
              <h1>Use credits toward an eligible campus charging benefit</h1>
              <p className="charging-benefit-card__intro">Request a program-configured charging voucher for an approved campus location. The school sponsor, value, and participating stations require confirmation.</p>
              <div className="charging-benefit-facts">
                <div><span>Prototype cost</span><strong>150 credits</strong></div>
                <div><span>Available balance</span><strong>200 credits</strong></div>
                <div><span>Sponsor</span><strong>[NEEDS FOUNDER INPUT]</strong></div>
              </div>
              <div className="charging-benefit-safety-note"><ShieldCheck size={18} /><p>This request does not reserve, start, or pay a charging station. Follow the school or charging operator’s established instructions.</p></div>
            </>}

            {step === 'location' && <>
              <div className="charging-benefit-card__icon"><MapPin size={27} /></div>
              <span className="green-wallet-kicker">Approximate campus area</span>
              <h1>Choose an eligible location</h1>
              <p className="charging-benefit-card__intro">Only institution-approved locations should appear in a live program. These prototype locations do not report charger availability.</p>
              <div className="charging-location-list">
                {demoLocations.map(location => (
                  <button type="button" key={location.id} className={`charging-location-card ${locationId === location.id ? 'is-selected' : ''}`} onClick={() => setLocationId(location.id)}>
                    <span className="charging-location-card__marker"><MapPin size={18} /></span>
                    <span><strong>{location.name}</strong><small>{location.note}</small></span>
                    <span className="charging-location-card__check"><BadgeCheck size={18} /></span>
                  </button>
                ))}
              </div>
            </>}

            {step === 'confirm' && <>
              <div className="charging-benefit-card__icon"><TicketCheck size={27} /></div>
              <span className="green-wallet-kicker">Review before submitting</span>
              <h1>Confirm your benefit request</h1>
              <div className="charging-confirmation-list">
                <div><span>Benefit</span><strong>Campus charging voucher</strong></div>
                <div><span>Location</span><strong>{selectedLocation.name}</strong></div>
                <div><span>Credits requested</span><strong>150</strong></div>
                <div><span>Balance after approval</span><strong>50 credits</strong></div>
                <div><span>Review</span><strong>Administrator required</strong></div>
              </div>
              <label className="charging-benefit-confirmation"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>I understand this is a request for review and does not activate, reserve, or guarantee access to a charger.</span></label>
            </>}

            {step === 'pending' && <>
              <div className="charging-benefit-card__icon"><Clock3 size={27} /></div>
              <span className="green-wallet-kicker">Administrative review</span>
              <h1>Your request is pending</h1>
              <p className="charging-benefit-card__intro">A program administrator would review eligibility, sponsor budget, location rules, and duplicate requests before issuing any benefit.</p>
              <div className="charging-status-panel"><span>Request status</span><strong>Pending review</strong><small>No credits have been deducted. No charging session has been activated.</small></div>
              <div className="charging-benefit-safety-note"><ShieldCheck size={18} /><p>This prototype lets reviewers preview the approved state. It does not submit a real request.</p></div>
            </>}

            {step === 'approved' && <>
              <div className="charging-benefit-card__icon"><TicketCheck size={27} /></div>
              <span className="green-wallet-kicker">Approved-state preview</span>
              <h1>Your demo voucher is ready</h1>
              <div className="charging-voucher">
                <span>Single-use reference</span>
                <strong>RR-DEMO-2048</strong>
                <small>Not valid for real charging</small>
              </div>
              <div className="charging-confirmation-list">
                <div><span>Location</span><strong>{selectedLocation.name}</strong></div>
                <div><span>Prototype validity</span><strong>24 hours</strong></div>
                <div><span>Station action</span><strong>Use operator instructions</strong></div>
              </div>
              <div className="charging-benefit-safety-note"><ShieldCheck size={18} /><p>A live program would require school confirmation, a validated redemption method, support rules, and formal charging-system coordination.</p></div>
            </>}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="charging-benefit-actions">
        {step !== 'approved' ? <button type="button" onClick={next} disabled={step === 'confirm' && !acknowledged} className="green-wallet-primary-button">{step === 'pending' ? 'Preview approved state' : step === 'confirm' ? 'Submit demo request' : 'Continue'} <ArrowRight size={18} /></button> : <button type="button" onClick={onClose} className="green-wallet-primary-button">Return to wallet <ArrowRight size={18} /></button>}
        <p>Research beta • Manual review only • No live charger integration</p>
      </div>
    </main>
  );
};
