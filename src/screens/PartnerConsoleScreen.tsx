import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  BatteryCharging,
  Building2,
  ClipboardCheck,
  FileText,
  Home,
  Leaf,
  MapPinned,
  ParkingCircle,
  Route,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { corridors } from '../data/demoData';

interface PartnerConsoleScreenProps {
  onBack: () => void;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'demand', label: 'Demand', icon: UsersRound },
  { id: 'access', label: 'Access Points', icon: MapPinned },
  { id: 'parking', label: 'Parking', icon: ParkingCircle },
  { id: 'ev', label: 'EV / Hybrid', icon: BatteryCharging },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
  { id: 'report', label: 'Decision Brief', icon: FileText },
];

export const PartnerConsoleScreen: React.FC<PartnerConsoleScreenProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const summary = useMemo(() => ({
    records: corridors.reduce((sum, item) => sum + item.routeSignals, 0),
    evSignals: corridors.reduce((sum, item) => sum + item.evParticipants, 0),
    accessPoints: corridors.reduce((sum, item) => sum + item.relayZones, 0),
  }), []);

  return (
    <div className="partner-workspace-shell">
      <div className="partner-workspace">
        <aside className="partner-sidebar">
          <div className="partner-sidebar__brand">
            <span className="partner-sidebar__mark"><Leaf size={20} /></span>
            <span>RELAY<br />RIDER</span>
          </div>

          <nav aria-label="Institutional workspace navigation">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={activeTab === item.id ? 'is-active' : ''}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={16} /> {item.label}
                </button>
              );
            })}
          </nav>

          <div className="partner-sidebar__foot">
            <strong>PCC demonstration workspace</strong><br />
            Synthetic + modeled data only until a partner dataset is loaded.
            <button type="button" className="mt-3 !px-0" onClick={onBack}><ArrowLeft size={14} /> Back to commuter app</button>
          </div>
        </aside>

        <main className="partner-main">
          <header className="partner-topbar">
            <div>
              <span className="mobile-section-kicker">Institutional TDM workspace</span>
              <h1>{activeTab === 'overview' ? 'Pasadena commuter decision workspace' : navItems.find(item => item.id === activeTab)?.label}</h1>
              <p>Follow evidence from commuter signal → record → score → preview → task → review → dashboard → report → partner action.</p>
            </div>
            <span className="partner-source-pill"><ShieldCheck size={14} /> Demo provenance visible</span>
          </header>

          {activeTab === 'overview' && (
            <>
              <section className="partner-kpi-grid" aria-label="Institutional summary metrics">
                <div className="partner-kpi"><span>Commuter records</span><strong>{summary.records}</strong><small>synthetic demonstration records</small></div>
                <div className="partner-kpi"><span>EV / hybrid signals</span><strong>{summary.evSignals}</strong><small>reported-style demo fields</small></div>
                <div className="partner-kpi"><span>Candidate Access Points</span><strong>{summary.accessPoints}</strong><small>modeled / review required</small></div>
                <div className="partner-kpi"><span>Decision cards</span><strong>3</strong><small>2 open · 1 draft</small></div>
              </section>

              <div className="partner-content-grid">
                <section className="partner-panel">
                  <div className="mockup-section-heading">
                    <div>
                      <span className="mobile-section-kicker">Corridor evidence</span>
                      <h2>Where the demonstration is pointing</h2>
                    </div>
                    <BarChart3 size={18} />
                  </div>

                  <table className="partner-table">
                    <thead>
                      <tr>
                        <th>Corridor</th>
                        <th>Records</th>
                        <th>EV / Hybrid</th>
                        <th>Parking</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corridors.map((corridor, index) => (
                        <tr key={corridor.id}>
                          <td><strong>{corridor.name}</strong></td>
                          <td>{corridor.routeSignals}</td>
                          <td>{corridor.evParticipants}</td>
                          <td>{corridor.parkingPressure}</td>
                          <td><span className={`data-label ${index === 0 ? 'data-label--synthetic' : 'data-label--modeled'}`}>{index === 0 ? 'Synthetic' : 'Modeled'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="partner-empty-note">
                    <strong>Acceptance rule:</strong> imported, reported, synthetic, and modeled values must remain distinguishable in every dashboard, report, and export. This workspace intentionally exposes provenance instead of blending demonstration data into institutional findings.
                  </div>
                </section>

                <aside className="decision-card">
                  <div className="decision-card__top">
                    <span className="decision-card__eyebrow"><Sparkles size={11} className="inline mr-1" /> Decision card</span>
                    <h2 className="mt-2">Evaluate Eagle Rock Access Point</h2>
                    <div className="mt-3"><span className="data-label data-label--synthetic">Not started · synthetic evidence</span></div>
                  </div>
                  <div className="decision-card__body">
                    <div className="decision-card__row"><span>Finding</span><p>Demonstration records show concentrated Eagle Rock → PCC commute demand during the morning arrival window.</p></div>
                    <div className="decision-card__row"><span>Evidence</span><ul className="decision-card__evidence"><li>12 drive-alone records</li><li>9 high parking-difficulty signals</li><li>11 willing to use an Access Point</li></ul></div>
                    <div className="decision-card__row"><span>Recommended action</span><strong>Review one candidate Access Point and run a controlled program scenario.</strong></div>
                    <div className="decision-card__row"><span>Owner</span><p>Transportation Coordinator · [NEEDS FOUNDER INPUT for partner owner]</p></div>
                  </div>
                  <div className="decision-card__footer">
                    <span className="text-[10px] text-[rgba(15,41,64,.55)]">Target date: demonstration only</span>
                    <button type="button" className="mockup-primary-button !mt-0" onClick={() => setActiveTab('report')}>View brief</button>
                  </div>
                </aside>
              </div>

              <section className="partner-panel mt-5">
                <div className="mockup-section-heading"><div><span className="mobile-section-kicker">Operating spine</span><h2>Acceptance evidence</h2></div><Route size={18} /></div>
                <table className="partner-table">
                  <thead><tr><th>Stage</th><th>Capability</th><th>Demo state</th><th>Today’s proof</th></tr></thead>
                  <tbody>
                    <tr><td><strong>Signal</strong></td><td>Commuter / CSV intake</td><td><span className="data-label data-label--reported">Built</span></td><td>Load one synthetic institutional fixture</td></tr>
                    <tr><td><strong>Record</strong></td><td>Tenant + provenance</td><td><span className="data-label data-label--synthetic">Evidence needed</span></td><td>Verify persistence + source label</td></tr>
                    <tr><td><strong>Score</strong></td><td>Deterministic Match Preview</td><td><span className="data-label data-label--synthetic">Evidence needed</span></td><td>Run known fixture</td></tr>
                    <tr><td><strong>Preview</strong></td><td>Explainable commuter option</td><td><span className="data-label data-label--modeled">Draft</span></td><td>Verify why + limiting factor</td></tr>
                    <tr><td><strong>Review</strong></td><td>Governed workflow</td><td><span className="data-label data-label--synthetic">Security test</span></td><td>Verify role boundaries</td></tr>
                    <tr><td><strong>Partner action</strong></td><td>Decision Card</td><td><span className="data-label data-label--modeled">Draft</span></td><td>Finding → evidence → action → owner</td></tr>
                  </tbody>
                </table>
              </section>
            </>
          )}

          {activeTab === 'demand' && <WorkspaceDetail icon={<UsersRound size={20} />} title="Demand signals" body="Segment commute records by corridor, arrival window, mode, parking difficulty, Access Point willingness, and provenance. Imported institutional records and synthetic fixtures should never be silently combined." />}
          {activeTab === 'access' && <WorkspaceDetail icon={<MapPinned size={20} />} title="Access Point review" body="Review candidate public, route-compatible Access Points with visibility, lighting, accessibility, site-rule, and institutional suitability checks. Do not present a candidate as guaranteed safe." />}
          {activeTab === 'parking' && <WorkspaceDetail icon={<ParkingCircle size={20} />} title="Parking pressure" body="Compare reported parking difficulty with modeled corridor concentration. Keep the methodology and evidence threshold visible before a finding becomes a partner recommendation." />}
          {activeTab === 'ev' && <WorkspaceDetail icon={<BatteryCharging size={20} />} title="EV / hybrid participation" body="Separate current EV/hybrid participation, preference signals, and future charging-demand analysis. Keep infrastructure need and environmental outcomes modeled until validated." />}
          {activeTab === 'review' && <WorkspaceDetail icon={<ClipboardCheck size={20} />} title="Administrative review queue" body="Tasks should link back to their triggering record, score, preview, tenant, and provenance. Role boundaries and cross-tenant denial tests are acceptance requirements, not optional polish." />}
          {activeTab === 'report' && <DecisionBrief />}
        </main>
      </div>
    </div>
  );
};

function WorkspaceDetail({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <section className="partner-panel">
      <div className="flex items-start gap-3">
        <span className="mockup-metric-card__icon">{icon}</span>
        <div><span className="mobile-section-kicker">Prototype workspace</span><h2>{title}</h2><p className="mt-3 text-sm leading-6">{body}</p></div>
      </div>
      <div className="partner-empty-note">This panel is a demonstration environment. Partner-specific rules, owners, thresholds, and live institutional findings require loaded source data and administrative configuration.</div>
    </section>
  );
}

function DecisionBrief() {
  return (
    <section className="partner-panel">
      <div className="mockup-section-heading"><div><span className="mobile-section-kicker">Corridor Decision Brief</span><h2>Eagle Rock → PCC demonstration</h2></div><Building2 size={19} /></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="decision-card__row"><span>Finding</span><p>Morning demand appears concentrated enough in the synthetic fixture to justify a deeper Access Point and multimodal scenario review.</p></div>
        <div className="decision-card__row"><span>Evidence</span><p>12 drive-alone records · 9 high parking-difficulty signals · 11 Access Point willing · synthetic demonstration source.</p></div>
        <div className="decision-card__row"><span>Interpretation</span><p>The corridor is worth evaluating, but the demonstration does not establish real PCC demand or guaranteed parking reduction.</p></div>
        <div className="decision-card__row"><span>Partner action</span><p>Review one candidate Access Point, validate with real institutional data, and assign an owner for a controlled commuter-program scenario.</p></div>
      </div>
      <div className="partner-empty-note"><strong>Report guardrail:</strong> all current values on this screen are synthetic or modeled. A partner-ready brief should replace them with imported/reported evidence while preserving source labels and calculation caveats.</div>
    </section>
  );
}
