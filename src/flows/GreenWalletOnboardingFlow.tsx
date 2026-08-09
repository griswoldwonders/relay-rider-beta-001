import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Gift, ListChecks, ShieldCheck, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import '../green-wallet.css';

interface GreenWalletOnboardingFlowProps {
  onBack: () => void;
  onComplete: () => void;
}

const walletSteps = [
  {
    kicker: 'Participation benefits',
    title: 'Get rewarded for participating',
    description: 'Eligible activities may receive Green Route Credits when they are offered by your institution-sponsored commuter program.',
    detailTitle: 'Built around your commute',
    detail: 'Use approximate zones, planned routes, Access Points, and participation signals—never live tracking by default.',
    icon: Sparkles,
    tone: 'mint',
  },
  {
    kicker: 'Transparent by design',
    title: 'No mystery points',
    description: 'Every credit shows the activity, sponsoring program, review status, and date. Pending means pending—nothing is hidden or automatic.',
    detailTitle: 'Clear status at every step',
    detail: 'Approved, pending, redeemed, and expired credits stay separate. Program administrators review eligibility.',
    icon: ListChecks,
    tone: 'lavender',
  },
  {
    kicker: 'Program-configured',
    title: 'Your credits unlock eligible program benefits',
    description: 'Available benefits depend on your institution’s configured program, participation rules, and current eligibility.',
    detailTitle: 'Benefits—not cash',
    detail: 'Examples may include capped promotional incentives or employer-sponsored mobility benefits. Charging-linked offers are future and program-configurable.',
    icon: Gift,
    tone: 'peach',
  },
] as const;

export const GreenWalletOnboardingFlow: React.FC<GreenWalletOnboardingFlowProps> = ({ onBack, onComplete }) => {
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const current = walletSteps[step];
  const Icon = current.icon;

  const goBack = () => {
    if (step === 0) onBack();
    else setStep(value => value - 1);
  };

  const continueFlow = () => {
    if (step === walletSteps.length - 1) onComplete();
    else setStep(value => value + 1);
  };

  return (
    <main className="green-wallet-onboarding">
      <header className="green-wallet-onboarding__header">
        <button type="button" onClick={goBack} className="green-wallet-icon-button" aria-label={step === 0 ? 'Return to the previous screen' : 'Previous wallet introduction'}>
          <ArrowLeft size={19} />
        </button>
        <div>
          <span>Relay Rider</span>
          <strong>Green Route Wallet</strong>
        </div>
        <span className="green-wallet-beta-pill"><ShieldCheck size={12} /> Research beta</span>
      </header>

      <div className="green-wallet-progress" aria-label={`Step ${step + 1} of ${walletSteps.length}`}>
        {walletSteps.map((_, index) => <span key={index} className={index <= step ? 'is-active' : ''} />)}
      </div>

      <div className="green-wallet-deck">
        <div className="green-wallet-deck__shadow green-wallet-deck__shadow--back" />
        <div className="green-wallet-deck__shadow green-wallet-deck__shadow--middle" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            className={`green-wallet-intro-card green-wallet-intro-card--${current.tone}`}
            initial={reduceMotion ? false : { opacity: 0, rotateY: 16, x: 26, scale: 0.96 }}
            animate={{ opacity: 1, rotateY: 0, x: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -14, x: -24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <div className="green-wallet-intro-card__icon"><Icon size={27} /></div>
            <span className="green-wallet-kicker">{current.kicker}</span>
            <h1>{current.title}</h1>
            <p className="green-wallet-intro-card__description">{current.description}</p>
            <div className="green-wallet-trust-card">
              <BadgeCheck size={19} />
              <div><strong>{current.detailTitle}</strong><p>{current.detail}</p></div>
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="green-wallet-onboarding__actions">
        <p><ShieldCheck size={14} /> Green Route Credits are promotional program benefits—not cash, wages, fares, guaranteed payments, or certified carbon credits.</p>
        <button type="button" onClick={continueFlow} className="green-wallet-primary-button">
          {step === walletSteps.length - 1 ? 'Open my wallet' : 'Continue'} <ArrowRight size={18} />
        </button>
        <button type="button" onClick={onComplete} className="green-wallet-skip-button">Skip introduction</button>
      </div>
    </main>
  );
};
