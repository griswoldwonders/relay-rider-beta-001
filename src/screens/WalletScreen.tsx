import { ArrowLeft, ArrowRight, BatteryCharging, BusFront, Clock3, MapPin, ShieldCheck, TicketCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { chargingHubs, useApp } from '../context/AppContext';
import { GreenRouteCredit } from '../types';
import { EVChargeCreditRedemptionFlow } from '../flows/EVChargeCreditRedemptionFlow';
import '../green-wallet.css';

interface WalletScreenProps { onBack: () => void; }

export const WalletScreen: React.FC<WalletScreenProps> = ({ onBack }) => {
  const [showRedemption, setShowRedemption] = useState(false);
  const { greenRouteCredits, redemptionRequests } = useApp();
  const credits = greenRouteCredits;
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
          <div className="green-wallet-balance__top"><span>Available charging benefit</span><small>Research beta</small></div>
          <strong>{approved.toLocaleString()} kWh-equivalent</strong>
          <p>Approved program benefits available for eligible activities.</p>
        </section>
        <div className="green-wallet-status-grid">
          <div className="green-wallet-status-card green-wallet-status-card--approved"><span>Available</span><strong>{approved} kWh-equivalent</strong><small>available charging benefit</small></div>
          <div className="green-wallet-status-card green-wallet-status-card--pending"><span>Under review</span><strong>{pending} kWh-equivalent</strong><small>benefit under review</small></div>
          <div className="green-wallet-status-card green-wallet-status-card--redeemed"><span>Fulfilled</span><strong>{redeemed} kWh-equivalent</strong><small>fulfilled benefit</small></div>
        </div>
        <div className="green-wallet-heading-row"><h2 className="green-wallet-section-title">Eligible benefits</h2><span>Program-configured</span></div>
        <div className="green-wallet-benefit-list">
          <button type="button" className="green-wallet-benefit-card green-wallet-benefit-card--charging" onClick={() => setShowRedemption(true)} disabled={approved === 0 || chargingHubs.length === 0}>
            <span className="green-wallet-benefit-card__icon"><BatteryCharging size={23} /></span>
            <span className="green-wallet-benefit-card__copy"><small>Available for pilot review</small><strong>EV Charge Benefit</strong><span>Request a manually reviewed kWh-equivalent benefit for an eligible Charging Hub.</span></span>
            <span className="green-wallet-benefit-card__action">{approved > 0 && chargingHubs.length > 0 ? 'Explore' : 'Unavailable'} <ArrowRight size={17} /></span>
          </button>
          <div className="green-wallet-benefit-grid">
            <article className="green-wallet-benefit-mini green-wallet-benefit-mini--lavender"><BusFront size={20} /><span><strong>Transit benefit</strong><small>Future sponsor option</small></span></article>
            <article className="green-wallet-benefit-mini green-wallet-benefit-mini--peach"><MapPin size={20} /><span><strong>Access Point benefit</strong><small>Program review required</small></span></article>
          </div>
        </div>
        <h2 className="green-wallet-section-title">Recent activity</h2>
        <div className="green-wallet-activity-list">
          {credits.length === 0 ? <div className="green-wallet-empty-state"><strong>No program activity yet</strong><small>Connect the Green Wallet API to load participant credits and earning history.</small></div> : credits.map(credit => <div className="green-wallet-activity" key={credit.id}><div><strong>{credit.activity}</strong><small>{credit.status === 'approved' ? 'Available' : credit.status === 'pending' ? 'Under review' : 'Fulfilled'} • {credit.date}</small></div><span>{credit.status === 'redeemed' ? '−' : '+'}{credit.amount} kWh-equivalent</span></div>)}
        </div>
        {redemptionRequests.length > 0 && <><div className="green-wallet-heading-row"><h2 className="green-wallet-section-title">EV Charge Benefit requests</h2><span>Administrative review</span></div><div className="green-wallet-activity-list">{redemptionRequests.map(request => <div className="green-wallet-activity" key={request.id}><div><strong>{request.id}</strong><small>{chargingHubs.find(hub => hub.id === request.chargingHubId)?.name ?? 'Selected Charging Hub'} • {request.status === 'requested' ? 'Pending review' : request.status}</small></div><span>{request.requestedUnits} kWh-equivalent</span></div>)}</div></>}
        <div className="green-wallet-disclosure"><ShieldCheck size={15} className="mb-2" /><strong>Program disclosure</strong><br />Green Route Credits and kWh-equivalent benefits are promotional or institution-sponsored benefits. They are not cash, wages, fares, guaranteed payments, certified carbon credits, or automatic charging rewards. Charging Hub availability is not guaranteed.</div>
      </div>
    </div>
  );
};
