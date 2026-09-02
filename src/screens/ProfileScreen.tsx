import React from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { ChevronRight, Gift, ShieldCheck, Sparkles } from 'lucide-react';

interface ProfileScreenProps {
  onPrivacyCenter: () => void;
  onSecurityCenter: () => void;
  onReviewGates: () => void;
  onOpenGreenWallet: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onPrivacyCenter,
  onSecurityCenter,
  onReviewGates,
  onOpenGreenWallet,
}) => {
  const { userProfile, routeSignals, greenRouteCredits } = useApp();
  const totalCredits = greenRouteCredits.reduce((sum, credit) => sum + (credit.amountUnits ?? credit.amount ?? 0), 0);

  const menuItems = [
    { label: 'Green Route Wallet', onClick: onOpenGreenWallet },
    { label: 'Security & Privacy', onClick: onSecurityCenter },
    { label: 'Privacy Center', onClick: onPrivacyCenter },
    { label: 'Program Review Gates', onClick: onReviewGates },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-24">
      <Header title="Profile" subtitle="Preferences, participation, and commuter benefits" />

      <div className="container py-7 space-y-8">
        <section className="card-highlight">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="mt-0.5 flex-shrink-0 text-navy" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-navy">Participation snapshot</p>
              <div className="profile-benefit-bubbles">
                <div className="profile-benefit-bubble profile-benefit-bubble--lavender">
                  <div className="text-2xl font-semibold text-navy">{routeSignals.length}</div>
                  <p className="mt-1 text-xs text-gray-600">Commute signals</p>
                </div>
                <div className="profile-benefit-bubble profile-benefit-bubble--peach">
                  <div className="flex items-center justify-center gap-1 text-2xl font-semibold text-navy"><Gift size={20} />{totalCredits}</div>
                  <p className="mt-1 text-xs text-gray-600">Green Route Credits</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-700">Green Route Credits are capped promotional participation benefits. They are not cash, fares, wages, or guaranteed payments.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="section-title">Account</h2>
          <div className="card space-y-4">
            <div><p className="text-xs text-gray-600">Name</p><p className="mt-1 font-medium text-navy">{userProfile?.name || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">Email</p><p className="mt-1 font-medium text-navy">{userProfile?.email || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">Participation type</p><p className="mt-1 font-medium text-navy">{userProfile?.role?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not selected'}</p></div>
            <div><p className="text-xs text-gray-600">Adult confirmation</p><p className="mt-1 font-medium text-navy">{userProfile?.adultConfirmed ? 'Confirmed' : 'Pending'}</p></div>
            <div><p className="text-xs text-gray-600">Research consent</p><p className="mt-1 font-medium text-navy">{userProfile?.researchConsentGiven ? 'Given' : 'Pending'}</p></div>
          </div>
        </section>

        <section>
          <h2 className="section-title">Commute preferences</h2>
          <div className="card space-y-4">
            <div><p className="text-xs text-gray-600">Preferred corridor</p><p className="mt-1 font-medium text-navy">{userProfile?.preferredCorridor || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">Preferred Access Point type</p><p className="mt-1 font-medium text-navy">{userProfile?.preferredRelayZoneType || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">EV/Hybrid preference</p><p className="mt-1 font-medium text-navy">{userProfile?.evHybridPreference || 'Not set'}</p></div>
            <div><p className="text-xs text-gray-600">Privacy preference</p><p className="mt-1 font-medium text-navy">{userProfile?.privacyPreference || 'Not set'}</p></div>
          </div>
        </section>

        <div className="research-banner">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-iris" />
            <p className="text-xs leading-relaxed text-gray-700"><strong>No live route coordination is active.</strong> Future controlled pilot activity requires legal, insurance, safety, privacy, accessibility, and operational review.</p>
          </div>
        </div>

        <section>
          <h2 className="section-title">Controls</h2>
          <div className="space-y-3">
            {menuItems.map(item => (
              <button key={item.label} onClick={item.onClick} className="card flex w-full items-center justify-between text-left transition-transform active:scale-[0.99]">
                <span className="font-medium text-navy">{item.label}</span>
                <ChevronRight size={20} className="text-gray-400" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
