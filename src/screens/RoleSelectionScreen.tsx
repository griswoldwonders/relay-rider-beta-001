import React from 'react';
import { ArrowRight, MapPin, Sparkles, Zap } from 'lucide-react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';

interface RoleSelectionScreenProps {
  onRoleSelect: (role: string) => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ onRoleSelect }) => {
  const { setUserRole } = useApp();

  const roles = [
    {
      id: 'route-need',
      title: 'I need a commute option',
      description: 'Share your school, commute window, and preferences to compare planned routes with local transit.',
      icon: MapPin,
    },
    {
      id: 'ev-participant',
      title: 'I already drive an EV/hybrid route',
      description: 'Register a route you already plan to travel and help identify compatible low-detour corridor opportunities.',
      icon: Zap,
    },
  ];

  const handleSelect = (roleId: string) => {
    setUserRole(roleId as any);
    onRoleSelect(roleId);
  };

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-24">
      <Header title="Start with your commute" subtitle="Choose your participation type" />

      <div className="container py-8 space-y-6">
        <section className="home-material-hero">
          <div>
            <span className="home-material-hero__label"><Sparkles size={15} /> College commuter prototype</span>
            <h1>Your commute, <span className="accent-word">connected.</span></h1>
            <p>Relay Rider combines institution-supported planned-route coordination, local transit, Access Points, and incentive signals in one commuter experience.</p>
          </div>
        </section>

        <div className="space-y-4">
          {roles.map(role => {
            const Icon = role.icon;
            return (
              <button key={role.id} onClick={() => handleSelect(role.id)} className="role-card">
                <div className="flex items-start gap-4">
                  <span className="role-card__icon"><Icon size={23} /></span>
                  <div className="min-w-0 flex-1">
                    <h3>{role.title}</h3>
                    <p>{role.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-iris">
                      Continue <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="card-highlight">
          <p className="text-sm font-semibold text-navy">College commuter program</p>
          <p className="mt-2 text-xs leading-relaxed text-gray-700">
            Relay Rider planned-route participation is modeled at $0 for eligible college participants in this research prototype. Third-party transit fares and student-pass eligibility remain controlled by each school and transit agency.
          </p>
        </div>
      </div>
    </div>
  );
};
