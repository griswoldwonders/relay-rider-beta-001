import React from 'react';
import { AlertCircle } from 'lucide-react';

export const ResearchBetaBanner: React.FC = () => {
  return (
    <div className="research-banner">
      <div className="flex gap-3">
        <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm text-blue-900">Research Beta Notice</p>
          <p className="research-banner-text mt-1">
            Relay Rider is collecting route-interest signals for pilot-readiness planning. This is not a live transportation service, ride booking, taxi, shuttle, or guaranteed route offer.
          </p>
        </div>
      </div>
    </div>
  );
};
