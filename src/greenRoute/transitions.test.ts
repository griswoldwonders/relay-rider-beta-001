import { describe, expect, it } from 'vitest';
import { defaultState, remainingFromLedger, reviewClaim, submitClaim, type ClaimFormInput } from './program';

const claim: ClaimFormInput = {
  network: 'Demo', locationName: 'Synthetic site', cityCorridor: 'Synthetic corridor',
  sessionDate: '2026-09-15', startTime: '07:40', energyKwh: '10', energyCharge: '2',
  receiptId: 'SYNTHETIC-1', commuteRelated: true, exclusionsAcknowledged: true,
};

describe('pure demo review', () => {
  it('keeps flagged holds, converts approval once, and preserves the complete trail', () => {
    const state = defaultState();
    const id = 'grc-clm-0914';
    const flagged = reviewClaim(state, id, 'flagged', 'Synthetic evidence needs review');
    expect(remainingFromLedger(flagged.ledger)).toEqual(remainingFromLedger(state.ledger));
    const approved = reviewClaim(flagged, id, 'approved', 'Demo decision');
    expect(remainingFromLedger(approved.ledger)).toEqual({ remainingCents: 260, remainingKwhTenths: 218,
      consumedCents: 2740, consumedKwhTenths: 282, heldCents: 0, heldKwhTenths: 0 });
    expect(approved.reviewEvents.slice(0, state.reviewEvents.length)).toEqual(state.reviewEvents);
    expect(approved.reviewEvents.slice(-2)).toEqual([
      { claimId: id, from: 'pending', to: 'flagged', note: 'Synthetic evidence needs review' },
      { claimId: id, from: 'flagged', to: 'approved', note: 'Demo decision' },
    ]);
    for (const status of ['approved', 'declined', 'flagged']) expect(reviewClaim(approved, id, status, 'repeat')).toBe(approved);
    expect(state).toEqual(defaultState());
  });

  it.each(['pending', 'flagged'])('decline releases both units once from %s', status => {
    const seed = defaultState();
    const state = status === 'flagged' ? reviewClaim(seed, 'grc-clm-0914', 'flagged', 'Review') : seed;
    const declined = reviewClaim(state, 'grc-clm-0914', 'declined', 'Demo decline');
    expect(remainingFromLedger(declined.ledger)).toEqual({ remainingCents: 1460, remainingKwhTenths: 314,
      consumedCents: 1540, consumedKwhTenths: 186, heldCents: 0, heldKwhTenths: 0 });
    for (const status of ['approved', 'declined', 'flagged']) expect(reviewClaim(declined, 'grc-clm-0914', status, 'repeat')).toBe(declined);
    expect(submitClaim(declined, { ...claim, energyCharge: '12', energyKwh: '30' }, 'new').errors).toEqual([]);
  });

  it.each([['missing', 'approved'], ['grc-clm-0914', 'bogus'], ['grc-clm-0914', 'issued'], ['grc-clm-0914', 'pending'],
    ['grc-iss-0901', 'approved'], ['grc-vch-0908', 'declined']])('ignores invalid review %s -> %s without mutation', (id, status) => {
    const state = defaultState();
    expect(reviewClaim(state, id, status, 'Invalid')).toBe(state);
  });
});

describe('pure demo submission', () => {
  it('reserves both units with append-only evidence and leaves the input untouched', () => {
    const state = defaultState();
    const before = structuredClone(state);
    const result = submitClaim(state, claim, 'claim-1');
    expect(result.errors).toEqual([]);
    expect(state).toEqual(before);
    expect(remainingFromLedger(result.state.ledger)).toMatchObject({ remainingCents: 60, remainingKwhTenths: 118, heldCents: 1400, heldKwhTenths: 196 });
    expect(result.state.reviewEvents.slice(0, state.reviewEvents.length)).toEqual(state.reviewEvents);
    expect(result.state.reviewEvents[result.state.reviewEvents.length - 1]).toMatchObject({ claimId: 'claim-1', from: null, to: 'pending' });
    expect(result.state).not.toHaveProperty('claims');
  });

  it('rejects sequential dollar overcommit rather than silently reducing the claim', () => {
    const first = submitClaim(defaultState(), claim, 'claim-1');
    const second = submitClaim(first.state, { ...claim, receiptId: 'SYNTHETIC-2' }, 'claim-2');
    expect(second.errors.join(' ')).toMatch(/available.*dollar/i);
    expect(second.state).toBe(first.state);
  });

  it('rejects sequential kWh overcommit without clamping', () => {
    const first = submitClaim(defaultState(), { ...claim, energyCharge: '0.01', energyKwh: '20' }, 'claim-1');
    const second = submitClaim(first.state, { ...claim, receiptId: 'SYNTHETIC-2' }, 'claim-2');
    expect(second.errors.join(' ')).toMatch(/available.*kWh/i);
    expect(second.state).toBe(first.state);
  });

  it('deduplicates receipt references and rejects ID collisions', () => {
    const first = submitClaim(defaultState(), claim, 'claim-1');
    for (const [input, id] of [[{ ...claim, receiptId: ' SYNTHETIC-1 ' }, 'claim-2'], [{ ...claim, receiptId: 'SYNTHETIC-2' }, 'claim-1']] as const) {
      const duplicate = submitClaim(first.state, input, id);
      expect(duplicate.errors.length).toBeGreaterThan(0);
      expect(duplicate.state).toBe(first.state);
    }
  });

  it.each([{ receiptId: '' }, { idleFee: 'bad' }, { parkingFee: '-1' }, { tax: 'Infinity' },
    { idleFee: '90071992547409.91', tax: '0.01' }, { energyKwh: '0' }, { energyKwh: '9007199254740992' },
    { sessionDate: '2026-09-31' }, { sessionDate: '2026-10-01' }, { sessionDate: '2026-08-31' }, { energyCharge: '0' }, { startTime: '24:00' }])('rejects invalid submission without mutation: %j', overrides => {
    const state = defaultState();
    const result = submitClaim(state, { ...claim, ...overrides }, 'claim-1');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.state).toBe(state);
  });

  it('caps sponsor support at the fixed session cap when monthly capacity permits', () => {
    const seed = defaultState();
    const state = { ...seed, ledger: seed.ledger.filter(row => row.status === 'issued') };
    const result = submitClaim(state, { ...claim, energyCharge: '14.80', idleFee: '1.50', parkingFee: '0.40', tax: '0.20' }, 'claim-1');
    expect(result.errors).toEqual([]);
    expect(result.estimate).toMatchObject({ estimatedCents: 1200, excludedCents: 210 });
    expect(remainingFromLedger(result.state.ledger).remainingCents).toBe(1800);
  });
});
