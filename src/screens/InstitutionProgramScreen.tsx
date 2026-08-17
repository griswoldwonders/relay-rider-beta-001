import { useState } from 'react';
import { Building2, CheckCircle2, KeyRound, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';

interface InstitutionProgramScreenProps {
  onBack: () => void;
}

export function InstitutionProgramScreen({ onBack }: InstitutionProgramScreenProps) {
  const {
    backendSession,
    programContexts,
    activeProgram,
    backendActivity,
    connectProgram,
    createProgramAccount,
    acceptProgramInvitation,
    disconnectProgram,
    selectProgramContext,
    refreshProgramContexts,
  } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setLocalMessage('');
    try {
      await action();
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  const signIn = () => run(() => connectProgram(email.trim(), password));
  const createAccount = () => run(async () => {
    const result = await createProgramAccount(email.trim(), password);
    if (result === 'email_confirmation_required') {
      setLocalMessage('Account created. Confirm your email if required, then return here to sign in.');
    }
  });
  const acceptInvite = () => run(async () => {
    await acceptProgramInvitation(inviteToken.trim());
    setInviteToken('');
  });

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-16">
      <Header title="Institution program" subtitle="Connect to a governed commuter program." onBack={onBack} showBack />

      <main className="container py-6 space-y-5 max-w-2xl">
        <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><ShieldCheck size={21} /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Governed backend</p>
              <h1 className="text-xl font-bold text-slate-950 mt-1">Institution membership controls persistence</h1>
              <p className="text-sm text-slate-600 mt-2 leading-6">Signing in does not create a public marketplace account. An institution-issued invitation is required before commute needs or planned routes are written into an institution's program.</p>
            </div>
          </div>
        </section>

        {!backendSession ? (
          <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Participant account</p>
              <h2 className="text-lg font-bold text-slate-950 mt-1">Sign in or create an account</h2>
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="input-field mt-2" placeholder="you@example.edu" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="input-field mt-2" placeholder="8+ characters" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" className="btn-primary" disabled={busy || !email.trim() || password.length < 8} onClick={signIn}>Sign in</button>
              <button type="button" className="btn-secondary" disabled={busy || !email.trim() || password.length < 8} onClick={createAccount}>Create account</button>
            </div>
            <p className="text-xs text-slate-500">Account creation may require email confirmation. Program access still requires an institution invitation.</p>
          </section>
        ) : (
          <>
            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Authenticated</p>
                  <h2 className="text-lg font-bold text-slate-950 mt-1">{backendSession.user.email || 'Participant account'}</h2>
                </div>
                <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600" disabled={busy} onClick={() => run(disconnectProgram)}><LogOut size={16} /> Disconnect</button>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <KeyRound size={20} className="text-slate-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900">Accept institution invitation</h3>
                    <p className="text-sm text-slate-600 mt-1">Use the one-time token provided through the institution's program workflow.</p>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input value={inviteToken} onChange={event => setInviteToken(event.target.value)} className="input-field flex-1" placeholder="Invitation token" autoComplete="off" />
                      <button type="button" className="btn-primary sm:w-auto" disabled={busy || inviteToken.trim().length < 16} onClick={acceptInvite}>Accept</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Program membership</p>
                  <h2 className="text-lg font-bold text-slate-950 mt-1">Choose the active institution context</h2>
                </div>
                <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600" disabled={busy} onClick={() => run(refreshProgramContexts)}><RefreshCw size={16} /> Refresh</button>
              </div>

              {programContexts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">No active institution membership is associated with this account yet. Accept an invitation above.</div>
              ) : (
                <div className="space-y-3">
                  {programContexts.map((context, index) => {
                    const active = activeProgram?.organization_id === context.organization_id
                      && activeProgram?.site_id === context.site_id
                      && activeProgram?.cohort_id === context.cohort_id;
                    return (
                      <button
                        type="button"
                        key={`${context.organization_id}-${context.site_id ?? 'all'}-${context.cohort_id ?? 'all'}-${index}`}
                        onClick={() => selectProgramContext(context)}
                        className={`w-full text-left rounded-2xl border p-4 transition ${active ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700"><Building2 size={18} /></span>
                          <span className="flex-1">
                            <strong className="block text-slate-950">{context.organization_name}</strong>
                            <small className="block text-slate-600 mt-1">{context.site_name || 'Organization-wide'}{context.cohort_name ? ` · ${context.cohort_name}` : ''}</small>
                            <small className="block text-slate-500 mt-1">Role: {context.member_role.replaceAll('_', ' ')}</small>
                          </span>
                          {active && <CheckCircle2 size={19} className="text-emerald-700" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <section className={`rounded-2xl border p-4 text-sm ${backendActivity.state === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-200 bg-white text-slate-700'}`} aria-live="polite">
          <strong className="block">Connection status</strong>
          <span className="block mt-1">{localMessage || backendActivity.message}</span>
        </section>

        <section className="rounded-2xl bg-slate-950 text-white p-4">
          <p className="text-sm leading-6"><strong>Research-beta boundary:</strong> authentication and institution membership allow governed data persistence. They do not guarantee a commuter option, activate a route, create payment, or bypass administrative review.</p>
        </section>
      </main>
    </div>
  );
}
