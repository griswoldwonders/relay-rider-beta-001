import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import '../green-wallet.css';

interface WalletScreenProps { onBack: () => void; }

export const WalletScreen: React.FC<WalletScreenProps> = ({ onBack }) => {
  const { greenRouteCredits } = useApp();
  const demoCredits = greenRouteCredits.length ? greenRouteCredits : [
    { activity: 'Planned-route check-in', amount: 120, status: 'approved' as const, date: 'Aug 7' },
    { activity: 'Campus commute challenge', amount: 180, status: 'pending' as const, date: 'Aug 5' },
    { activity: 'Access Point preference', amount: 80, status: 'approved' as const, date: 'Aug 2' },
  ];
  const approved = demoCredits.filter(c => c.status === 'approved').reduce((sum, credit) => sum + credit.amount, 0);
  const pending = demoCredits.filter(c => c.status === 'pending').reduce((sum, credit) => sum + credit.amount, 0);

  return (
    <div className="green-wallet-screen">
      <Header title="Green Route Wallet" subtitle="Institution-sponsored promotional program benefits" />
      <div className="container green-wallet-shell">
        <button type="button" onClick={onBack} className="text-link-button self-start"><ArrowLeft size={15} /> Back to profile</button>
        <section className="green-wallet-balance">
          <div className="green-wallet-balance__top"><span>Available balance</span><small>Demo program</small></div>
          <strong>{approved.toLocaleString()} credits</strong>
          <p>Approved promotional program benefits</p>
        </section>
        <div className="green-wallet-status-grid">
          <div className="green-wallet-status-card green-wallet-status-card--approved"><span>Approved</span><strong>{approved}</strong></div>
          <div className="green-wallet-status-card green-wallet-status-card--pending"><span>Pending review</span><strong>{pending}</strong></div>
        </div>
        <h2 className="green-wallet-section-title">Recent activity</h2>
        <div className="green-wallet-activity-list">
          {demoCredits.map((credit, index) => (
            <div className="green-wallet-activity" key={`${credit.activity}-${index}`}>
              <div><strong>{credit.activity}</strong><small>{credit.status === 'approved' ? 'Approved' : 'Pending review'} • {credit.date}</small></div>
              <span>+{credit.amount}</span>
            </div>
          ))}
        </div>
        <div className="green-wallet-disclosure"><ShieldCheck size={15} className="mb-2" /><strong>Program disclosure</strong><br />Green Route Credits are capped promotional or institution-sponsored benefits. They are not cash, wages, fares, guaranteed payments, certified carbon credits, or automatic charging rewards. Eligibility depends on program rules and administrative review.</div>
      </div>
    </div>
  );
};
