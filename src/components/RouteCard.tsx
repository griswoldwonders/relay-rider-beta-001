import React from 'react';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface RouteCardProps {
  corridor: string;
  timeWindow: string;
  status: string;
  routeFit: string;
  relayZonePreference: string;
  greenRouteCredit: number;
  onClick?: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  corridor,
  timeWindow,
  status,
  routeFit,
  relayZonePreference,
  greenRouteCredit,
  onClick,
}) => {
  const getStatusType = (status: string) => {
    if (status.includes('Research')) return 'research';
    if (status.includes('Needs')) return 'pending';
    if (status.includes('Active')) return 'active';
    return 'inactive';
  };

  return (
    <div
      onClick={onClick}
      className="card cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-navy">{corridor}</h3>
          <p className="text-xs text-gray-600 mt-1">{timeWindow}</p>
        </div>
        <ChevronRight size={20} className="text-gray-400" />
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">Status</span>
          <StatusBadge status={getStatusType(status)} label={status} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">Route Fit</span>
          <span className="text-xs font-medium text-navy">{routeFit}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">Relay Zone</span>
          <span className="text-xs font-medium text-navy">{relayZonePreference}</span>
        </div>
      </div>

      {greenRouteCredit > 0 && (
        <div className="bg-light-green border border-green-200 rounded p-2 text-center">
          <p className="text-xs font-semibold text-mobility-green">
            +${greenRouteCredit} Green Route Credit
          </p>
        </div>
      )}
    </div>
  );
};
