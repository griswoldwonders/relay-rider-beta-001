import React from 'react';
import { Header } from '../components/Header';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface ReviewGatesScreenProps {
  onBack: () => void;
}

export const ReviewGatesScreen: React.FC<ReviewGatesScreenProps> = ({ onBack }) => {
  const gates = [
    { name: 'Transportation counsel review', status: 'not-started' },
    { name: 'Insurance broker review', status: 'not-started' },
    { name: 'Privacy policy and consent flow', status: 'not-started' },
    { name: 'Participant agreements', status: 'not-started' },
    { name: 'Identity review workflow', status: 'not-started' },
    { name: 'License review workflow', status: 'not-started' },
    { name: 'Insurance documentation workflow', status: 'not-started' },
    { name: 'Vehicle / EV-hybrid status workflow', status: 'not-started' },
    { name: 'Background / MVR workflow review', status: 'not-started' },
    { name: 'Safe Relay Zone standards', status: 'not-started' },
    { name: 'Incident response plan', status: 'not-started' },
    { name: 'Accessibility and service animal policy review', status: 'not-started' },
    { name: 'Local property / campus / hospital / venue / airport restrictions review', status: 'not-started' },
    { name: 'Operational review', status: 'not-started' },
  ];

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 size={20} className="text-mobility-green" />;
    if (status === 'in-progress') return <Clock size={20} className="text-blue-600" />;
    return <AlertCircle size={20} className="text-gray-400" />;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'in-progress') return 'In Progress';
    return 'Not Started';
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Review Gates" subtitle="Checklist for pilot readiness" onBack={onBack} showBack />

      <div className="container py-6 space-y-6">
        {/* Large Notice */}
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-900 mb-2">Important Notice</p>
          <p className="text-xs text-red-800">
            Relay Rider should not activate public paid transportation, route booking, or compensated route coordination until these gates are reviewed.
          </p>
        </div>

        {/* Gates Checklist */}
        <div className="space-y-2">
          {gates.map((gate, idx) => (
            <div key={idx} className="card flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(gate.status)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-navy text-sm">{gate.name}</p>
                <p className="text-xs text-gray-600 mt-1">{getStatusLabel(gate.status)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="card bg-light-blue border border-blue-300">
          <p className="text-sm font-semibold text-blue-900 mb-2">Status Summary</p>
          <p className="text-xs text-blue-800">
            All gates must be completed before Relay Rider can activate any controlled route coordination or transportation service.
          </p>
        </div>
      </div>
    </div>
  );
};
