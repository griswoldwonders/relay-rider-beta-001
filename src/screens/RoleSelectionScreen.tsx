import React from 'react';
import { MapPin, Zap } from 'lucide-react';
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
      description: 'Share your commute need to compare free college-program route previews and local transit options.',
      icon: MapPin,
      color: 'text-mobility-green',
    },
    {
      id: 'ev-participant',
      title: 'I already drive an EV/hybrid route',
      description: 'Register a route you already plan to travel and help validate low-detour commuter coordination.',
      icon: Zap,
      color: 'text-blue-600',
    },
  ];

  const handleSelect = (roleId: string) => {
    setUserRole(roleId as any);
    onRoleSelect(roleId);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="How would you like to use Relay Rider?" subtitle="Choose your participation type" />

      <div className="container py-6 space-y-4">
        {roles.map(role => {
          const Icon = role.icon;
          return (
            <button
              key={role.id}
              onClick={() => handleSelect(role.id)}
              className="card text-left hover:shadow-md transition-shadow w-full"
            >
              <div className="flex gap-4">
                <div className={`flex-shrink-0 w-12 h-12 bg-soft-gray rounded-lg flex items-center justify-center ${role.color}`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-navy">{role.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                </div>
              </div>
            </button>
          );
        })}

        <div className="rounded-xl border border-green-200 bg-light-green p-4">
          <p className="text-sm font-semibold text-navy">College commuter program</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-700">
            Relay Rider route participation is shown as $0 for eligible college participants in this research prototype.
            Third-party transit fares and student pass eligibility are controlled by each transit agency and school.
          </p>
        </div>
      </div>
    </div>
  );
};
