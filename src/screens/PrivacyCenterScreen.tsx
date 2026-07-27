import React from 'react';
import { Header } from '../components/Header';
import { ChevronRight } from 'lucide-react';

interface PrivacyCenterScreenProps {
  onBack: () => void;
}

export const PrivacyCenterScreen: React.FC<PrivacyCenterScreenProps> = ({ onBack }) => {
  const sections = [
    {
      title: 'What Relay Rider Collects',
      items: [
        'Contact information',
        'Route area',
        'Time window',
        'Corridor preference',
        'Relay Zone preference',
        'EV/hybrid status if submitted',
        'Research feedback',
        'Partner type if applicable',
      ],
    },
    {
      title: 'What Relay Rider Avoids During Research Beta',
      items: [
        'Exact private-address requirement',
        'Live route tracking',
        'Payment processing',
        'Active route activation',
        'Driver payout processing',
        'Public transportation booking',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Privacy Center" onBack={onBack} showBack />

      <div className="container py-6 space-y-6">
        {sections.map((section, idx) => (
          <div key={idx}>
            <h2 className="section-title">{section.title}</h2>
            <div className="card space-y-2">
              {section.items.map((item, itemIdx) => (
                <div key={itemIdx} className="flex gap-2">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  <span className="text-sm text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div>
          <h2 className="section-title">Data Controls</h2>
          <div className="space-y-2">
            {[
              'Edit profile',
              'Delete route signal',
              'Request data deletion',
              'Notification preferences',
              'Consent history',
            ].map((item, idx) => (
              <button
                key={idx}
                className="card flex items-center justify-between hover:shadow-md transition-shadow w-full"
              >
                <span className="font-medium text-navy">{item}</span>
                <ChevronRight size={20} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
