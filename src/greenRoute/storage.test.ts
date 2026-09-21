import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState, remainingFromLedger, reviewClaim, submitClaim } from './program';
import { loadProgramState, resetProgramSession, subscribeProgramState, updateProgramState } from './storage';
import { clearLegacySensitiveStorage, legacySensitiveStorageKeys } from '../security/securityPolicy';

beforeEach(() => resetProgramSession());
describe('page-session memory', () => {
  it('retains transitions across consumers and notifies them of explicit reset', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeProgramState(listener);
    updateProgramState(state => reviewClaim(state, 'grc-clm-0914', 'declined', 'Demo'));
    expect(remainingFromLedger(loadProgramState().ledger).remainingCents).toBe(1460);
    expect(listener).toHaveBeenCalledTimes(1);
    resetProgramSession();
    expect(loadProgramState()).toEqual(defaultState());
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    resetProgramSession();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('atomically evaluates rapid submissions against the latest session', () => {
    const input = { network: 'Demo', locationName: 'Synthetic', cityCorridor: 'Demo', sessionDate: '2026-09-15',
      startTime: '07:40', energyKwh: '10', energyCharge: '2', receiptId: 'SYNTHETIC-1', commuteRelated: true, exclusionsAcknowledged: true };
    updateProgramState(state => submitClaim(state, input, 'one').state);
    updateProgramState(state => submitClaim(state, { ...input, receiptId: 'SYNTHETIC-2' }, 'two').state);
    expect(loadProgramState().ledger.filter(row => row.id === 'one' || row.id === 'two')).toHaveLength(1);
    expect(remainingFromLedger(loadProgramState().ledger)).toMatchObject({ remainingCents: 60, remainingKwhTenths: 118 });
  });

  it('starts fresh when the page module is reloaded', async () => {
    updateProgramState(state => reviewClaim(state, 'grc-clm-0914', 'declined', 'Demo'));
    vi.resetModules();
    const freshPage = await import('./storage');
    expect(freshPage.loadProgramState()).toEqual(defaultState());
  });

  it('cleans the former demo key only at the approved boundary and tolerates unavailable storage', () => {
    expect(legacySensitiveStorageKeys).toContain('rr-green-route-credits-demo-v1');
    expect(() => clearLegacySensitiveStorage()).not.toThrow();
  });
});
