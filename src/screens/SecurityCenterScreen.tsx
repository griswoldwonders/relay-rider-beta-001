import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { dataClassifications, securityControls } from '../security/securityPolicy';

interface SecurityCenterScreenProps {
  onBack: () => void;
}

const statusLabel = {
  active: 'Active now',
  'backend-required': 'Backend required',
  'pilot-required': 'Before pilot',
};

export function SecurityCenterScreen({ onBack }: SecurityCenterScreenProps) {
  const { clearSessionData, storageMode } = useApp();
  const [showDataRules, setShowDataRules] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClear = () => {
    clearSessionData();
    setCleared(true);
  };

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)] pb-12">
      <Header
        title="Security & privacy"
        subtitle="Controls for this Research Beta"
        showBack
        onBack={onBack}
      />

      <main className="container space-y-5 py-5">
        <section className="security-hero">
          <ShieldCheck size={26} />
          <div>
            <span>Current protection</span>
            <h1>Demo information stays in this session.</h1>
            <p>
              This prototype does not provide production authentication or a protected commuter database.
              Do not enter identity documents, exact home locations, or real verification records.
            </p>
          </div>
        </section>

        <div className="security-summary-grid">
          <div><LockKeyhole size={19} /><strong>Local persistence</strong><span>Disabled</span></div>
          <div><Database size={19} /><strong>Storage mode</strong><span>{storageMode.replace('-', ' ')}</span></div>
          <div><KeyRound size={19} /><strong>Authentication</strong><span>Backend not connected</span></div>
        </div>

        <section>
          <div className="material-section-heading">
            <div>
              <h2>Security controls</h2>
              <p>Active protections and required implementation gates.</p>
            </div>
          </div>

          <div className="security-control-list">
            {securityControls.map(control => (
              <article key={control.id} className="security-control">
                <div className={`security-control__icon security-control__icon--${control.status}`}>
                  {control.status === 'active' ? <CheckCircle2 size={19} /> : <ShieldAlert size={19} />}
                </div>
                <div>
                  <div className="security-control__heading">
                    <h3>{control.title}</h3>
                    <span className={`security-status security-status--${control.status}`}>
                      {statusLabel[control.status]}
                    </span>
                  </div>
                  <p>{control.description}</p>
                  <small>{control.standard}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="data-rules">
          <button type="button" onClick={() => setShowDataRules(current => !current)} aria-expanded={showDataRules}>
            <span><Database size={18} /> Data classification rules</span>
            {showDataRules ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showDataRules && (
            <div className="data-rules__content animate-fade-in">
              {dataClassifications.map(rule => (
                <div key={rule.classification}>
                  <span className={`data-class data-class--${rule.classification}`}>{rule.classification}</span>
                  <strong>{rule.examples}</strong>
                  <p>{rule.handling}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="security-clear-card">
          <div>
            <h2>Clear this demo session</h2>
            <p>Removes the current profile, route requests, planned routes, and credits from browser memory.</p>
          </div>
          <md-outlined-button onClick={handleClear}>
            <Trash2 slot="icon" size={16} />
            {cleared ? 'Session cleared' : 'Clear demo data'}
          </md-outlined-button>
        </section>

        <a
          className="security-standard-link"
          href="https://owasp.org/www-project-application-security-verification-standard/"
          target="_blank"
          rel="noreferrer"
        >
          Security target: OWASP ASVS 5.0 Level 2
          <ExternalLink size={15} />
        </a>
      </main>
    </div>
  );
}
