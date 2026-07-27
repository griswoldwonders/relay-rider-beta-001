import React, { useState } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { DollarSign } from 'lucide-react';

interface WalletScreenProps {
  onViewRules: () => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ onViewRules }) => {
  const { greenRouteCredits } = useApp();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'redeemed' | 'expired'>('pending');

  const tabs = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'redeemed', label: 'Redeemed' },
    { id: 'expired', label: 'Expired' },
  ];

  const filteredCredits = greenRouteCredits.filter(credit => credit.status === activeTab);

  const totalPending = greenRouteCredits
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalApproved = greenRouteCredits
    .filter(c => c.status === 'approved')
    .reduce((sum, c) => sum + c.amount, 0);

  const sampleActivities = [
    { activity: 'Route interest profile submitted', amount: 3, status: 'pending' as const },
    { activity: 'EV/hybrid route pattern submitted', amount: 5, status: 'pending' as const },
    { activity: 'Feedback call completed', amount: 10, status: 'approved' as const },
    { activity: 'Relay Zone suggestion reviewed', amount: 2, status: 'pending' as const },
  ];

  const displayCredits = greenRouteCredits.length > 0 ? greenRouteCredits : sampleActivities;

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Green Wallet" subtitle="Promotional beta rewards for research participation." />

      <div className="container py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <div className="text-2xl font-bold text-mobility-green">${totalPending}</div>
            <p className="text-xs text-gray-600 mt-1">Pending Credits</p>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-blue-600">${totalApproved}</div>
            <p className="text-xs text-gray-600 mt-1">Approved Credits</p>
          </div>
        </div>

        {/* Important Framing */}
        <div className="bg-warning-yellow border border-yellow-400 rounded-lg p-4">
          <p className="text-xs text-yellow-900">
            <strong>Green Route Credits</strong> are capped promotional beta rewards funded by Relay Rider or partners. They are not fares, wages, driver earnings, government carbon credits, certified offsets, or LCFS payouts.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-mobility-green text-white'
                  : 'bg-soft-gray text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Credit Activities */}
        <div className="space-y-3">
          {filteredCredits.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-600">No {activeTab} credits yet</p>
            </div>
          ) : (
            filteredCredits.map((credit, idx) => (
              <div key={idx} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-navy text-sm">{credit.activity}</p>
                    <p className="text-xs text-gray-600 mt-1">{credit.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-mobility-green" />
                    <span className="font-bold text-mobility-green">{credit.amount}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Credit Rules */}
        <div className="space-y-3">
          <h3 className="section-title">Credit Rules</h3>
          <div className="card space-y-2">
            <div className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm text-gray-700">Manual approval required</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm text-gray-700">No cash-out</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm text-gray-700">No route activation</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm text-gray-700">One profile reward per user</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm text-gray-700">Rewards subject to beta cap</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm text-gray-700">Credits may expire</span>
            </div>
            <div className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm text-gray-700">Rewards are for research participation only</span>
            </div>
          </div>
        </div>

        <button onClick={onViewRules} className="btn-secondary">
          View Full Credit Rules
        </button>
      </div>
    </div>
  );
};
