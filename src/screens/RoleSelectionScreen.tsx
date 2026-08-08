import React from 'react';
import { ArrowRight, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';

interface RoleSelectionScreenProps {
  onRoleSelect: (role: string) => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ onRoleSelect }) => {
  const { setUserRole } = useApp();

  const startCommuterSetup = () => {
    setUserRole('route-need');
    onRoleSelect('route-need');
  };

  const startPlannedRoute = () => {
    setUserRole('ev-participant');
    onRoleSelect('ev-participant');
  };

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-24">
      <Header title="Relay Rider" subtitle="Campus commuter research beta" />

      <div className="container py-8 space-y-6">
        <section className="home-material-hero">
          <div>
            <span className="home-material-hero__label"><Sparkles size={15} /> Build your commute</span>
            <h1>Find better ways to <span className="accent-word">campus.</span></h1>
            <p>Answer a few quick questions and Relay Rider will build a personalized bundle of local transit, planned-route previews, Access Points, and eligible campus mobility benefits.</p>
          </div>
          <button type="button" className="commute-primary-action" onClick={startCommuterSetup}>
            <Sparkles size={18} />
            <span>Set up my commute</span>
            <ArrowRight size={17} />
          </button>
        </section>

        <div className="card-highlight">
          <div className="flex items-start gap-3">
            <ShieldCheck size={19} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-navy">Approximate areas first</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-700">You can begin with a neighborhood or general origin area. Exact home addresses are not required for this demonstration onboarding flow.</p>
            </div>
          </div>
        </div>

        <button type="button" onClick={startPlannedRoute} className="role-card">
          <div className="flex items-start gap-4">
            <span className="role-card__icon"><Zap size={23} /></span>
            <div className="min-w-0 flex-1 text-left">
              <h3>Already drive an EV/hybrid route?</h3>
              <p>Register a route you already intend to travel and help identify compatible low-detour commuter opportunities.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-iris">Register planned route <ArrowRight size={14} /></span>
            </div>
          </div>
        </button>

        <p className="px-2 text-center text-[10px] leading-relaxed text-gray-500">
          Relay Rider is a commuter coordination research prototype, not live dispatch or guaranteed transportation. Planned-route participation remains subject to program rules and administrative review.
        </p>
      </div>
    </div>
  );
};
