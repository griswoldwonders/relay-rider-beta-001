import React from 'react';
import { MapPin, Zap, Building2, Eye } from 'lucide-react';
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
      title: 'I need a route',
      description: 'Share your commute need and help validate cleaner corridor options.',
      icon: MapPin,
      color: 'text-mobility-green',
    },
    {
      id: 'ev-participant',
      title: 'I already drive an EV/hybrid route',
      description: 'Share routes you already travel and help validate future low-detour coordination.',
      icon: Zap,
      color: 'text-blue-600',
    },
    {
      id: 'organization',
      title: 'I represent an organization',
      description: 'View corridor demand, Relay Zone signals, and pilot-readiness insights.',
      icon: Building2,
      color: 'text-navy',
    },
    {
      id: 'exploring',
      title: 'I\'m exploring',
      description: 'Preview the research beta without submitting information.',
      icon: Eye,
      color: 'text-gray-600',
    },
  ];

  const handleSelect = (roleId: string) => {
    setUserRole(roleId as any);
    onRoleSelect(roleId);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="How would you like to use Relay Rider?" subtitle="Choose your role" />

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

        <div className="pt-4">
          <button className="btn-primary">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
