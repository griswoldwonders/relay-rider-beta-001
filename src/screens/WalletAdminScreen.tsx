import { ArrowLeft, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { demoChargingHubs, useApp } from '../context/AppContext';
import '../green-wallet.css';

interface Props { onBack: () => void; }

export const WalletAdminScreen: React.FC<Props> = ({ onBack }) => {
  const { redemptionRequests, reviewRedemptionRequest } = useApp();
  const requests = useMemo(() => redemptionRequests, [redemptionRequests]);
  const hubById = Object.fromEntries(demoChargingHubs.map(hub => [hub.id, hub]));

  return <main className="green-wallet-admin">
    <header className="green-wallet-admin__header"><button type="button" onClick={onBack} className="green-wallet-icon-button" aria-label="Return to wallet"><ArrowLeft size={19} /></button><div><span>Relay Rider · Program operations</span><strong>EV Charge Benefit review</strong></div><span className="green-wallet-beta-pill"><ShieldCheck size={12} /> Prototype</span></header>
    <div className="container green-wallet-admin__shell">
      <div className="green-wallet-admin__intro"><div><span className="green-wallet-kicker">Administrative queue</span><h1>Review redemption requests</h1><p>Confirm program eligibility before marking an EV Charge Benefit request fulfilled. Amounts are shown as kWh-equivalent program benefits; this view is a prototype and does not settle a charging session.</p></div><div className="green-wallet-admin__count"><strong>{requests.filter(request => request.status === 'requested' || request.status === 'under-review').length}</strong><span>open requests</span></div></div>
      {requests.length === 0 ? <div className="green-wallet-admin__empty"><ShieldCheck size={22} /><strong>No requests yet</strong><span>Participant requests will appear here for review.</span></div> : <div className="green-wallet-admin__list">{requests.map(request => <article className="green-wallet-admin__row" key={request.id}><div className="green-wallet-admin__request"><div><span className="green-wallet-kicker">{request.id}</span><strong>{request.requestedUnits} kWh-equivalent</strong></div><span>{hubById[request.chargingHubId]?.name ?? request.chargingHubId} · Submitted {new Date(request.requestedAt).toLocaleString()}</span><small>Status: {request.status === 'requested' ? 'Pending review' : request.status}</small>{request.reviewNote && <small>Note: {request.reviewNote}</small>}</div>{(request.status === 'requested' || request.status === 'under-review') && <div className="green-wallet-admin__actions"><button type="button" className="green-wallet-admin__approve" onClick={() => reviewRedemptionRequest(request.id, 'fulfilled', 'Approved by program administrator.')}><CheckCircle2 size={16} /> Approve</button><button type="button" className="green-wallet-admin__deny" onClick={() => reviewRedemptionRequest(request.id, 'denied', 'Denied during pilot review.')}><XCircle size={16} /> Deny</button></div>}</article>)}</div>}
      <div className="green-wallet-disclosure"><ShieldCheck size={15} /><span><strong>Operational boundary:</strong> administrator review records a program decision. It does not reserve a charger, start a charging session, or process a payment.</span></div>
    </div>
  </main>;
};
