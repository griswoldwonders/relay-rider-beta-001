import React from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { ChevronRight, Gift } from 'lucide-react';

interface ProfileScreenProps {
  onPrivacyCenter: () => void;
  onSecurityCenter: () => void;
  onReviewGates: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onPrivacyCenter,
  onSecurityCenter,
  onReviewGates,
}) => {
  const { userProfile, routeSignals, greenRouteCredits } = useApp();
  const totalCredits = greenRouteCredits.reduce((sum, credit) => sum + credit.amount, 0);

  const menuItems = [
    { label: 'Security & Privacy', onClick: onSecurityCenter },
    { label: 'Privacy Center', onClick: onPrivacyCenter },
    { label: 'Research Beta Terms', onClick: () => {} },
    { label: 'Report an Issue', onClick: () => {} },
    { label: 'Delete My Data Request', onClick: () => {} },
    { label: 'Review Gates', onClick: onReviewGates },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Profile" subtitle="Your account, commute preferences, and benefits" />

      <div className="container py-6 space-y-6">
        <div>
          <h2 className="section-title">Account</h2>
          <div className="card space-y-3">
            <div><p className="text-xs text-gray-600">Name</p><p className="font-medium text-navy mt-1">{userProfile?.name || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">Email</p><p className="font-medium text-navy mt-1">{userProfile?.email || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">Participation type</p><p className="font-medium text-navy mt-1">{userProfile?.role?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not selected'}</p></div>
            <div><p className="text-xs text-gray-600">Adult Confirmation</p><p className="font-medium text-navy mt-1">{userProfile?.adultConfirmed ? 'Confirmed' : 'Pending'}</p></div>
            <div><p className="text-xs text-gray-600">Research Consent</p><p className="font-medium text-navy mt-1">{userProfile?.researchConsentGiven ? 'Given' : 'Pending'}</p></div>
          </div>
        </div>

        <div>
          <h2 className="section-title">My Preferences</h2>
          <div className="card space-y-3">
            <div><p className="text-xs text-gray-600">Preferred Corridor</p><p className="font-medium text-navy mt-1">{userProfile?.preferredCorridor || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">Preferred Access Point Type</p><p className="font-medium text-navy mt-1">{userProfile?.preferredRelayZoneType || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">EV/Hybrid Preference</p><p className="font-medium text-navy mt-1">{userProfile?.evHybridPreference || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">Privacy Preference</p><p className="font-medium text-navy mt-1">{userProfile?.privacyPreference || 'Not set'}</p></div>
          </div>
        </div>

        <div>
          <h2 className="section-title">Participation & Incentives</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center">
              <div className="text-2xl font-bold text-navy">{routeSignals.length}</div>
              <p className="text-xs text-gray-600 mt-1">Commute Signals</p>
            </div>
            <div className="card text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-mobility-green"><Gift size={20} />{totalCredits}</div>
              <p className="text-xs text-gray-600 mt-1">Green Route Credits</p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">Green Route Credits are capped promotional participation benefits. They are not cash, fares, wages, or guaranteed payments.</p>
        </div>

        <div className="bg-light-blue border border-blue-300 rounded-lg p-4">
          <p className="text-xs text-blue-900"><strong>No live route coordination is active.</strong> Future controlled pilot activity requires legal, insurance, safety, privacy, accessibility, and operational review.</p>
        </div>

        <div className="space-y-2">
          {menuItems.map((item, idx) => (
            <button key={idx} onClick={item.onClick} className="card flex items-center justify-between hover:shadow-md transition-shadow w-full">
              <span className="font-medium text-navy">{item.label}</span>
              <ChevronRight size={20} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
