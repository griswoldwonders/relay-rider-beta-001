import { ArrowLeft, ArrowRight, BatteryCharging, BusFront, Clock3, MapPin, ShieldCheck, TicketCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { demoChargingHubs, useApp } from '../context/AppContext';
import { GreenRouteCredit } from '../types';
import { EVChargeCreditRedemptionFlow } from '../flows/EVChargeCreditRedemptionFlow';
import '../green-wallet.css';

interface WalletScreenProps { onBack: () => void; }

const demoCredits: GreenRouteCredit[] = [
  { id: 'demo-approved-01', activity: 'Planned-route check-in', amount: 120, status: 'approved', date: 'Aug 7' },
  { id: 'demo-pending-02', activity: 'Campus commute challenge', amount: 180, status: 'pending', date: 'Aug 5' },
  { id: 'demo-redeemed-03', activity: 'Access Point preference', amount: 80, status: 'redeemed', date: 'Aug 2' },
];

export const WalletScreen: React.FC<WalletScreenProps> = ({ onBack }) => {
  const [showRedemption, setShowRedemption] = useState(false);
  const { greenRouteCredits, redemptionRequests } = useApp();
  const credits = greenRouteCredits.length ? greenRouteCredits : demoCredits;
  const approved = useMemo(() => credits.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.amount, 0), [credits]);
  const pending = useMemo(() => credits.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0), [credits]);
  const redeemed = useMemo(() => credits.filter(c => c.status === 'redeemed').reduce((sum, c) => sum + c.amount, 0), [credits]);

  if (showRedemption) return <EVChargeCreditRedemptionFlow onClose={() => setShowRedemption(false)} />;

  return (
    <div className="green-wallet-screen">
      <Header title="Green Route Wallet" subtitle="Institution-sponsored promotional program benefits" />
      <div className="container green-wallet-shell">
        <button type="button" onClick={onBack} className="text-link-button self-start"><ArrowLeft size={15} /> Back to profile</button>
        <section className="green-wallet-balance">
          <div className="green-wallet-balance__top"><span>Available Green Route Credits</span><small>Research beta</small></div>
          <strong>{approved.toLocaleString()}</strong>
          <p>Approved program benefits available for eligible activities.</p>
        </section>
        <div className="green-wallet-status-grid">
          <div className="green-wallet-status-card green-wallet-status-card--approved"><span>Available</span><strong>{approved}</strong><small>approved credits</small></div>
          <div className="green-wallet-status-card green-wallet-status-card--pending"><span>Under review</span><strong>{pending}</strong><small>pending credits</small></div>
          <div className="green-wallet-status-card green-wallet-status-card--redeemed"><span>Redeemed</span><strong>{redeemed}</strong><small>recorded benefits</small></div>
        </div>
        <div className="green-wallet-heading-row"><h2 className="green-wallet-section-title">Eligible benefits</h2><span>Program-configured</span></div>
        <div className="green-wallet-benefit-list">
          <button type="button" className="green-wallet-benefit-card green-wallet-benefit-card--charging" onClick={() => setShowRedemption(true)}>
            <span className="green-wallet-benefit-card__icon"><BatteryCharging size={23} /></span>
            <span className="green-wallet-benefit-card__copy"><small>Available for pilot review</small><strong>EV Charge Credit</strong><span>Request a manually reviewed credit for an eligible Charging Hub.</span></span>
            <span className="green-wallet-benefit-card__action">Explore <ArrowRight size={17} /></span>
          </button>
          <div className="green-wallet-benefit-grid">
            <article className="green-wallet-benefit-mini green-wallet-benefit-mini--lavender"><BusFront size={20} /><span><strong>Transit benefit</strong><small>Future sponsor option</small></span></article>
            <article className="green-wallet-benefit-mini green-wallet-benefit-mini--peach"><MapPin size={20} /><span><strong>Access Point benefit</strong><small>Program review required</small></span></article>
          </div>
        </div>
        <h2 className="green-wallet-section-title">Recent activity</h2>
        <div className="green-wallet-activity-list">
          {credits.map(credit => <div className="green-wallet-activity" key={credit.id}><div><strong>{credit.activity}</strong><small>{credit.status === 'approved' ? 'Available' : credit.status === 'pending' ? 'Under review' : 'Redeemed'} • {credit.date}</small></div><span>{credit.status === 'redeemed' ? '−' : '+'}{credit.amount}</span></div>)}
        </div>
        {redemptionRequests.length > 0 && <><div className="green-wallet-heading-row"><h2 className="green-wallet-section-title">EV Charge Credit requests</h2><span>Administrative review</span></div><div className="green-wallet-activity-list">{redemptionRequests.map(request => <div className="green-wallet-activity" key={request.id}><div><strong>{request.id}</strong><small>{demoChargingHubs.find(hub => hub.id === request.chargingHubId)?.name ?? 'Selected Charging Hub'} • {request.status === 'requested' ? 'Pending review' : request.status}</small></div><span>{request.requestedUnits}</span></div>)}</div></>}
        <div className="green-wallet-disclosure"><ShieldCheck size={15} className="mb-2" /><strong>Program disclosure</strong><br />Green Route Credits are promotional or institution-sponsored benefits. They are not cash, wages, fares, guaranteed payments, certified carbon credits, or automatic charging rewards. Charging Hub availability is not guaranteed.</div>
      </div>
    </div>
  );
};
