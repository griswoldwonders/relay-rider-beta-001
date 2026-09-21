import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import {
  LEDGER_STATUSES,
  PARTNER_SITES,
  PROGRAM,
  dollars,
  estimateClaim,
  kwhLabel,
  parseMoneyToCents,
  remainingFromLedger,
  validateClaimForm,
  type LedgerEntry,
  type LedgerStatus,
  type PartnerSite,
  type ProgramState,
  type ClaimEstimate,
} from './program';
import { loadProgramState, saveProgramState } from './storage';

const COMMUTER_NAV = [
  ['dashboard', 'Dashboard'],
  ['voucher', 'Partner voucher'],
  ['claim', 'Submit claim'],
  ['ledger', 'Credit activity'],
  ['rules', 'Rules & privacy'],
] as const;
const ADMIN_NAV = [
  ['admin-home', 'Program administration'],
  ['admin-claims', 'Claim review'],
  ['admin-campaigns', 'Voucher campaigns'],
] as const;

type Role = 'commuter' | 'admin';
type View = (typeof COMMUTER_NAV)[number][0] | (typeof ADMIN_NAV)[number][0];

function Badge({ status }: { status: string }) {
  return <span className={`grc-badge grc-badge-${status}`}>{status}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="grc-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="grc-modal-title">
      <div className="grc-modal">
        <h2 id="grc-modal-title">{title}</h2>
        {children}
        <div className="grc-actions">
          <button type="button" className="gw-secondary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export type GreenRouteCreditsProps = {
  onOpenClassicWallet?: () => void;
  onOpenClassicAdmin?: () => void;
};

export function GreenRouteCredits({ onOpenClassicWallet, onOpenClassicAdmin }: GreenRouteCreditsProps) {
  const [role, setRole] = useState<Role>('commuter');
  const [view, setView] = useState<View>('dashboard');
  const [state, setState] = useState<ProgramState>(loadProgramState);
  const [modal, setModal] = useState<PartnerSite | LedgerEntry | null>(null);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [claim, setClaim] = useState({
    network: 'Demo Partner Network',
    locationName: '',
    cityCorridor: 'Pasadena corridor',
    sessionDate: '2026-09-15',
    startTime: '07:40',
    energyKwh: '9.6',
    energyCharge: '14.80',
    idleFee: '1.50',
    parkingFee: '0.40',
    tax: '0.20',
    receiptId: '',
    commuteRelated: false,
    exclusionsAcknowledged: false,
    note: '',
  });
  const [claimResult, setClaimResult] = useState<ClaimEstimate | null>(null);
  const [claimErrors, setClaimErrors] = useState<string[]>([]);
  const [campaign, setCampaign] = useState({
    name: '',
    monthlyCap: '30.00',
    sessionCap: '12.00',
    weekdayOnly: true,
  });

  function persist(next: ProgramState) {
    saveProgramState(next);
    setState(next);
  }

  const remaining = useMemo(() => ({
    cents: state.remainingCents,
    kwhTenths: state.remainingKwhTenths,
  }), [state]);

  const dollarPct = Math.min(100, Math.round(((PROGRAM.monthlyBenefitCents - remaining.cents) / PROGRAM.monthlyBenefitCents) * 100));
  const kwhPct = Math.min(100, Math.round(((PROGRAM.monthlyKwhTenths - remaining.kwhTenths) / PROGRAM.monthlyKwhTenths) * 100));

  function go(nextView: View) {
    setView(nextView);
    setModal(null);
  }

  function copyCode() {
    navigator.clipboard?.writeText(PROGRAM.demoVoucherCode);
    setCopied(true);
  }

  function submitClaim() {
    const checked = validateClaimForm(claim);
    if (checked.errors.length || checked.energyChargeCents == null || checked.kwhTenths == null || !claim.sessionDate) {
      setClaimErrors(checked.errors.length ? checked.errors : ['Complete required claim fields.']);
      setClaimResult(null);
      return;
    }
    const estimate = estimateClaim({
      energyChargeCents: checked.energyChargeCents,
      idleFeeCents: parseMoneyToCents(claim.idleFee) || 0,
      parkingFeeCents: parseMoneyToCents(claim.parkingFee) || 0,
      taxCents: parseMoneyToCents(claim.tax) || 0,
      remainingCents: state.remainingCents,
    });
    const id = `CLM-${Date.now()}`;
    const entry: LedgerEntry = {
      id,
      date: claim.sessionDate,
      eventType: 'Charging claim',
      source: `${claim.locationName} · ${claim.cityCorridor} · Demo data`,
      kwhTenths: checked.kwhTenths,
      amountCents: estimate.estimatedCents,
      signedCents: 0,
      status: LEDGER_STATUSES.pending,
      referenceId: claim.receiptId || id,
      detail: claim.note || 'Simulated claim pending administrative review.',
      network: claim.network,
      estimate,
    };
    persist({
      ...state,
      ledger: [entry, ...state.ledger],
      claims: [entry, ...state.claims],
      remainingKwhTenths: Math.max(0, state.remainingKwhTenths - (checked.kwhTenths || 0)),
    });
    setClaimErrors([]);
    setClaimResult(estimate);
  }

  function reviewClaim(id: string, status: LedgerStatus, note: string) {
    const claims = state.claims.map((row) => (row.id === id ? { ...row, status, reviewNote: note } : row));
    const ledger = state.ledger.map((row) => (row.id === id ? { ...row, status, signedCents: status === LEDGER_STATUSES.approved ? -row.amountCents : 0 } : row));
    let remainingCents = state.remainingCents;
    const target = state.claims.find((row) => row.id === id);
    if (status === LEDGER_STATUSES.approved && target) {
      remainingCents = Math.max(0, remainingCents - target.amountCents);
    }
    persist({ ...state, claims, ledger, remainingCents });
  }

  function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      id: `cmp-${Date.now()}`,
      name: campaign.name || 'Untitled simulated campaign',
      status: 'Simulated — not live',
      monthlyCapCents: parseMoneyToCents(campaign.monthlyCap) || PROGRAM.monthlyBenefitCents,
      sessionCapCents: parseMoneyToCents(campaign.sessionCap) || PROGRAM.sessionCapCents,
      weekdayOnly: campaign.weekdayOnly,
      sites: PARTNER_SITES.map((site) => site.name),
    };
    persist({ ...state, campaigns: [next, ...state.campaigns] });
    setCampaign({ name: '', monthlyCap: '30.00', sessionCap: '12.00', weekdayOnly: true });
  }

  const filteredLedger = state.ledger.filter((row) => filter === 'all' || row.status === filter);
  const pendingClaims = state.claims.filter((row) => row.status === LEDGER_STATUSES.pending || row.status === LEDGER_STATUSES.flagged);
  const liveRemaining = remainingFromLedger(state.ledger);

  return (
    <div className="grc-shell">
      <header className="grc-hero">
        <span className="gw-eyebrow">Relay Rider Green Route Credits</span>
        <h1>Employer-sponsored, verified commute-charging support</h1>
        <p>Capped promotional benefits for verified commute-related EV charging. Demo data / simulated. Not a payment processor, charging network, eMSP, cash wallet, or guaranteed access.</p>
        <span className="grc-demo-flag">This is a demo prototype · Simulated records</span>
      </header>

      <div className="grc-roles" role="group" aria-label="Prototype role">
        <button type="button" aria-pressed={role === 'commuter'} onClick={() => { setRole('commuter'); setView('dashboard'); }}>Commuter view</button>
        <button type="button" aria-pressed={role === 'admin'} onClick={() => { setRole('admin'); setView('admin-home'); }}>Program administrator view</button>
        {onOpenClassicWallet && (
          <button type="button" className="gw-secondary-button" onClick={onOpenClassicWallet}>Open hub redemption wallet</button>
        )}
        {onOpenClassicAdmin && (
          <button type="button" className="gw-secondary-button" onClick={onOpenClassicAdmin}>Open hub review queue</button>
        )}
      </div>

      <nav className="grc-nav" aria-label="Green Route Credits">
        {(role === 'commuter' ? COMMUTER_NAV : ADMIN_NAV).map(([id, label]) => (
          <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>
        ))}
      </nav>

      {role === 'commuter' && view === 'dashboard' && (
        <>
          <section className="grc-balance">
            <small>{PROGRAM.name}</small>
            <strong>{dollars(remaining.cents)} remaining</strong>
            <p>{kwhLabel(remaining.kwhTenths)} kWh remaining · {PROGRAM.participant} · {PROGRAM.participantStatus}</p>
            <p>Sponsor: {PROGRAM.sponsor} · Monthly benefit up to {dollars(PROGRAM.monthlyBenefitCents)} · {PROGRAM.resetLabel}</p>
            <div className="grc-meters">
              <div><span>Dollar cap used {dollarPct}%</span><div className="grc-meter" aria-hidden="true"><span style={{ width: `${dollarPct}%` }} /></div></div>
              <div><span>kWh cap used {kwhPct}%</span><div className="grc-meter" aria-hidden="true"><span style={{ width: `${kwhPct}%` }} /></div></div>
            </div>
          </section>
          <div className="grc-grid">
            <article className="grc-card">
              <h2>How to use your credits</h2>
              <div className="grc-paths">
                <button type="button" onClick={() => go('voucher')}><strong>Use a partner voucher</strong><span>Simulated support at participating demo sites.</span></button>
                <button type="button" onClick={() => go('claim')}><strong>Submit a verified claim</strong><span>Reimbursement path for eligible sessions outside a direct partner network.</span></button>
              </div>
            </article>
            <article className="grc-card">
              <h2>Program details</h2>
              <ul>
                <li>$30.00 maximum per calendar month</li>
                <li>50 kWh maximum per calendar month</li>
                <li>$12.00 maximum sponsor contribution per eligible session</li>
                <li>Weekday commute-related charging only</li>
                <li>Energy charges may qualify; idle fees, parking, taxes, reservations, and non-commute charging do not</li>
                <li>Benefits cannot be transferred, sold, redeemed for cash, or guaranteed</li>
              </ul>
            </article>
          </div>
          <article className="grc-card">
            <h2>Recent activity</h2>
            <ul className="grc-activity">
              {state.ledger.slice(0, 4).map((row) => (
                <li key={row.id}>
                  <div><strong>{row.eventType}</strong><span>{row.date} · {row.source}</span></div>
                  <span>{dollars(row.amountCents)} <Badge status={row.status} /></span>
                </li>
              ))}
            </ul>
          </article>
          <article className="grc-card">
            <h2>Privacy first</h2>
            <p>Relay Rider uses only the information needed to verify eligible program use and report aggregated commute-program outcomes. Your employer sees aggregate program reporting, not an exact personal trip trail by default.</p>
          </article>
        </>
      )}

      {view === 'voucher' && (
        <section>
          <article className="grc-card">
            <h2>Use a Partner Charging Voucher</h2>
            <p>Partner vouchers can reduce eligible charging costs at participating sites. A voucher is not universal charging access and may not work at non-partner charging networks.</p>
          </article>
          <div className="grc-sites">
            {PARTNER_SITES.map((site) => (
              <article className="grc-site" key={site.id}>
                <strong>{site.name}</strong>
                <span>{site.networkLabel} · {site.chargers} chargers · {site.level}</span>
                <span>{site.hours}</span>
                <span>{site.corridor}</span>
                <Badge status="eligible" />
                <div className="grc-actions">
                  <button type="button" className="gw-primary-button" onClick={() => setModal(site as PartnerSite)}>Use voucher</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {view === 'claim' && (
        <article className="grc-card">
          <h2>Submit an Eligible Charging Claim</h2>
          <p>Verified reimbursement for eligible charging sessions outside a direct partner network. Demo submission only.</p>
          <div className="gw-form-row">
            <label>Charging network
              <select value={claim.network} onChange={(e) => setClaim({ ...claim, network: e.target.value })}>
                <option>Demo Partner Network</option>
                <option>Other approved public network</option>
                <option>Workplace or campus charging</option>
                <option>Other</option>
              </select>
            </label>
            <label>Charging location name<input value={claim.locationName} onChange={(e) => setClaim({ ...claim, locationName: e.target.value })} /></label>
            <label>City / corridor<input value={claim.cityCorridor} onChange={(e) => setClaim({ ...claim, cityCorridor: e.target.value })} /></label>
            <label>Session date<input type="date" value={claim.sessionDate} onChange={(e) => setClaim({ ...claim, sessionDate: e.target.value })} /></label>
            <label>Start time<input type="time" value={claim.startTime} onChange={(e) => setClaim({ ...claim, startTime: e.target.value })} /></label>
            <label>Energy delivered (kWh)<input value={claim.energyKwh} onChange={(e) => setClaim({ ...claim, energyKwh: e.target.value })} /></label>
            <label>Energy charge amount<input value={claim.energyCharge} onChange={(e) => setClaim({ ...claim, energyCharge: e.target.value })} /></label>
            <label>Idle fee (optional)<input value={claim.idleFee} onChange={(e) => setClaim({ ...claim, idleFee: e.target.value })} /></label>
            <label>Parking fee (optional)<input value={claim.parkingFee} onChange={(e) => setClaim({ ...claim, parkingFee: e.target.value })} /></label>
            <label>Tax (optional)<input value={claim.tax} onChange={(e) => setClaim({ ...claim, tax: e.target.value })} /></label>
            <label>Receipt / session ID<input value={claim.receiptId} onChange={(e) => setClaim({ ...claim, receiptId: e.target.value })} /></label>
            <label>Upload receipt (stub)<input type="file" /></label>
          </div>
          <label className="grc-check"><input type="checkbox" checked={claim.commuteRelated} onChange={(e) => setClaim({ ...claim, commuteRelated: e.target.checked })} />This session was related to an eligible commute under my program rules.</label>
          <label className="grc-check"><input type="checkbox" checked={claim.exclusionsAcknowledged} onChange={(e) => setClaim({ ...claim, exclusionsAcknowledged: e.target.checked })} />I understand that idle fees, parking fees, taxes, and non-eligible activity are excluded unless my program expressly states otherwise.</label>
          <label>Optional note<textarea rows={3} value={claim.note} onChange={(e) => setClaim({ ...claim, note: e.target.value })} /></label>
          {claimErrors.length > 0 && <ul>{claimErrors.map((error) => <li key={error}>{error}</li>)}</ul>}
          <div className="grc-actions">
            <button type="button" className="gw-primary-button" onClick={submitClaim}>Submit for demo review</button>
          </div>
          {claimResult && (
            <div className="grc-summary">
              <div>Energy charge: {dollars(claimResult.energyChargeCents)}</div>
              <div>Excluded fees: {dollars(claimResult.excludedCents)}</div>
              <div>Eligible energy cost: {dollars(claimResult.eligibleEnergyCents)}</div>
              <div>Per-session cap: {dollars(claimResult.sessionCapCents)}</div>
              <div>Estimated Green Route Credit: {dollars(claimResult.estimatedCents)}</div>
              <div>Status: Pending administrative review</div>
            </div>
          )}
        </article>
      )}

      {view === 'ledger' && (
        <article className="grc-card">
          <h2>Credit activity / ledger</h2>
          <p>Green Route Credits are program benefits recorded in a Relay Rider ledger. They are not cash, stored-value accounts, utility credits, carbon credits, or transferable property.</p>
          <div className="grc-nav">
            {['all', 'pending', 'approved', 'redeemed', 'reversed', 'expired'].map((item) => (
              <button key={item} type="button" aria-current={filter === item ? 'page' : undefined} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <div className="grc-table-wrap grc-desktop-table">
            <table className="grc-table">
              <thead><tr><th>Date</th><th>Event</th><th>Source</th><th>kWh</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
              <tbody>
                {filteredLedger.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td><button type="button" className="gw-secondary-button" onClick={() => setModal(row)}>{row.eventType}</button></td>
                    <td>{row.source}</td>
                    <td>{row.kwhTenths ? kwhLabel(row.kwhTenths) : '—'}</td>
                    <td>{dollars(row.amountCents)}</td>
                    <td><Badge status={row.status} /></td>
                    <td>{row.referenceId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grc-mobile-cards">
            {filteredLedger.map((row) => (
              <button type="button" className="grc-site" key={row.id} onClick={() => setModal(row)}>
                <strong>{row.eventType}</strong>
                <span>{row.date} · {dollars(row.amountCents)}</span>
                <Badge status={row.status} />
              </button>
            ))}
          </div>
        </article>
      )}

      {view === 'rules' && (
        <article className="grc-card grc-rules">
          <h2>Program rules and privacy</h2>
          <section><h3>1. What Green Route Credits are</h3><p>Capped promotional or employer-sponsored program benefits recorded in a policy-controlled internal ledger. They support verified commute-related EV charging. They are not cash, wages, fares, cryptocurrency, utility credits, carbon credits, LCFS credits, or transferable property.</p></section>
          <section><h3>2. How eligibility works</h3><p>An eligible commuter must belong to an employer- or institution-sponsored mobility program. Credits are subject to eligibility, verification, availability, and administrative review. Completing a Clean Route under program rules is required before benefits apply.</p></section>
          <section><h3>3. What charging costs qualify</h3><p>Energy charges for weekday, commute-related sessions at approved partner sites or through verified reimbursement may qualify, up to monthly dollar and kWh caps and a $12.00 per-session sponsor cap.</p></section>
          <section><h3>4. What is excluded</h3><p>Idle fees, parking fees, taxes, reservations, and non-commute charging do not qualify unless a program expressly states otherwise. Benefits cannot be transferred, sold, redeemed for cash, or guaranteed.</p></section>
          <section><h3>5. How partner vouchers differ from verified reimbursement</h3><p>Partner vouchers may reduce eligible costs only at participating demo sites. Verified reimbursement is a claim path for eligible sessions outside a direct partner network. Neither path is universal charging access.</p></section>
          <section><h3>6. How claims are reviewed</h3><p>Submitted claims appear in an administrator queue as pending, then may be approved, declined, or flagged in this prototype. Review does not guarantee payment or charger availability.</p></section>
          <section><h3>7. Privacy and data minimization</h3><p>Relay Rider uses only the information needed to verify eligible program use and report aggregated commute-program outcomes. Your employer sees aggregate program reporting, not an exact personal trip trail by default.</p></section>
          <section><h3>8. Important program limitations</h3><p>Availability, eligibility, verification, and administrative review apply. Participation does not guarantee reimbursement, voucher acceptance, charging availability, transportation, savings, or emissions outcomes.</p></section>
          <section>
            <h3>Charging-network interoperability</h3>
            <p>Charging-network interoperability has multiple layers:</p>
            <ul>
              <li>Authorization: whether a driver credential can start a session</li>
              <li>Charging access: whether a participating network accepts that credential</li>
              <li>Pricing: the tariff and fees applied by a network</li>
              <li>Incentives: whether a sponsor-funded voucher or credit can apply</li>
              <li>Settlement: how final eligible costs are reconciled</li>
            </ul>
            <p>A user may have charging access at a network without being able to use a specific promotional credit there.</p>
            <p>OCPI is commonly used for data exchange and roaming functions between charging-service providers and charge-point operators. It does not by itself create a universal sponsor-credit wallet.</p>
          </section>
        </article>
      )}

      {view === 'admin-home' && (
        <section>
          <article className="grc-card">
            <h2>Green Route Credits — Program Administration</h2>
            <p>{PROGRAM.name} · Sponsor {PROGRAM.sponsor} · Demo data only. Reporting is aggregate, not an individual trip trail.</p>
            <div className="grc-stats">
              <div className="grc-stat"><span>Monthly funding</span><strong>{dollars(PROGRAM.monthlyBenefitCents)}</strong></div>
              <div className="grc-stat"><span>Demo enrollment</span><strong>1 active commuter</strong></div>
              <div className="grc-stat"><span>Utilized (approved/redeemed)</span><strong>{dollars(liveRemaining.consumedCents)}</strong></div>
              <div className="grc-stat"><span>Remaining snapshot</span><strong>{dollars(state.remainingCents)}</strong></div>
              <div className="grc-stat"><span>Pending review</span><strong>{pendingClaims.length}</strong></div>
            </div>
          </article>
          <article className="grc-card">
            <h3>Aggregate program reporting</h3>
            <p>Partner-site redemptions, verified claims, and pending reviews are summarized without exact personal trip trails. kWh remaining in the commuter snapshot: {kwhLabel(state.remainingKwhTenths)} of {kwhLabel(PROGRAM.monthlyKwhTenths)}.</p>
          </article>
        </section>
      )}

      {view === 'admin-claims' && (
        <article className="grc-card">
          <h2>Admin claim review queue</h2>
          {state.claims.map((row) => (
            <div className="gw-review-row" key={row.id}>
              <div className="gw-review-main">
                <strong>{row.eventType} · {dollars(row.amountCents)}</strong>
                <small>{row.date} · {row.source} · {row.referenceId}</small>
              </div>
              <Badge status={row.status} />
              {(row.status === LEDGER_STATUSES.pending || row.status === LEDGER_STATUSES.flagged) && (
                <div className="gw-review-actions">
                  <button type="button" className="gw-secondary-button approve" onClick={() => reviewClaim(row.id, LEDGER_STATUSES.approved, 'Demo approval')}>Approve</button>
                  <button type="button" className="gw-secondary-button deny" onClick={() => reviewClaim(row.id, LEDGER_STATUSES.declined, 'Demo decline')}>Decline</button>
                  <button type="button" className="gw-secondary-button" onClick={() => reviewClaim(row.id, LEDGER_STATUSES.flagged, 'Flagged for review')}>Flag</button>
                </div>
              )}
            </div>
          ))}
        </article>
      )}

      {view === 'admin-campaigns' && (
        <article className="grc-card">
          <h2>Admin voucher campaign builder</h2>
          <p>Simulated campaign rules. This does not publish a live network offer.</p>
          <form onSubmit={createCampaign}>
            <div className="gw-form-row">
              <label>Campaign name<input value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} /></label>
              <label>Monthly cap<input value={campaign.monthlyCap} onChange={(e) => setCampaign({ ...campaign, monthlyCap: e.target.value })} /></label>
              <label>Per-session cap<input value={campaign.sessionCap} onChange={(e) => setCampaign({ ...campaign, sessionCap: e.target.value })} /></label>
            </div>
            <label className="grc-check"><input type="checkbox" checked={campaign.weekdayOnly} onChange={(e) => setCampaign({ ...campaign, weekdayOnly: e.target.checked })} />Weekday commute-related charging only</label>
            <button className="gw-primary-button" type="submit">Save simulated campaign</button>
          </form>
          <ul className="grc-activity">
            {state.campaigns.map((row) => (
              <li key={row.id}><div><strong>{row.name}</strong><span>{row.status} · monthly {dollars(row.monthlyCapCents)} · session {dollars(row.sessionCapCents)}</span></div></li>
            ))}
          </ul>
        </article>
      )}

      {modal && 'chargers' in modal && (
        <Modal title="Simulated partner voucher" onClose={() => { setModal(null); setCopied(false); }}>
          <p><strong>{modal.name}</strong> · {modal.corridor}</p>
          <p>Available balance: {dollars(state.remainingCents)}</p>
          <p>Per-session sponsor cap: {dollars(PROGRAM.sessionCapCents)}</p>
          <p>Eligible energy charges only. Idle fees, parking fees, taxes, and reservations are excluded.</p>
          <p className="grc-code">{PROGRAM.demoVoucherCode}</p>
          <p>Expiry: {PROGRAM.demoVoucherExpiry}</p>
          <p><Badge status="pending" /> Simulated — not redeemable</p>
          <div className="grc-actions">
            <button type="button" className="gw-primary-button" onClick={copyCode}>{copied ? 'Copied' : 'Copy demo code'}</button>
            <button type="button" className="gw-secondary-button" onClick={() => go('rules')}>View program rules</button>
          </div>
        </Modal>
      )}

      {modal && 'eventType' in modal && (
        <Modal title="Policy-safe record" onClose={() => setModal(null)}>
          <p>{modal.date} · {modal.eventType}</p>
          <p>{modal.source}</p>
          <p>{dollars(modal.amountCents)} · {modal.kwhTenths ? `${kwhLabel(modal.kwhTenths)} kWh` : 'No kWh on this entry'}</p>
          <p>Reference {modal.referenceId}</p>
          <p>{modal.detail}</p>
          <p>Demo data / simulated. Aggregate employer reporting only.</p>
        </Modal>
      )}

      <p className="grc-notice">Demo data / simulated. This prototype does not process payments, start chargers, or create a universal wallet.</p>
    </div>
  );
}

export default GreenRouteCredits;
