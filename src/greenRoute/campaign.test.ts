import { describe, expect, it } from 'vitest';
import { createCampaignDraft, defaultState, PROGRAM, remainingFromLedger, submitClaim } from './program';

const draft = { name: 'Synthetic draft', monthlyCap: '5.00', sessionCap: '1.00', weekdayOnly: false };
describe('draft-only campaigns', () => {
  it('records a draft without altering effective demo policy or balances', () => {
    const state = defaultState();
    const result = createCampaignDraft(state, draft, 'draft-1');
    expect(result.errors).toEqual([]);
    expect(result.state.campaigns[0]).toMatchObject({ name: draft.name, status: 'DRAFT-ONLY', monthlyCapCents: 500, sessionCapCents: 100, weekdayOnly: false });
    expect(result.state.ledger).toBe(state.ledger);
    expect(result.state.reviewEvents).toBe(state.reviewEvents);
    expect(remainingFromLedger(result.state.ledger)).toEqual(remainingFromLedger(state.ledger));
    const input = { network: 'Demo', locationName: 'Synthetic', cityCorridor: 'Demo', sessionDate: '2026-09-15',
      startTime: '07:40', energyKwh: '1', energyCharge: '2', receiptId: 'SYNTHETIC', commuteRelated: true, exclusionsAcknowledged: true };
    expect(submitClaim(result.state, input, 'claim-1').estimate?.estimatedCents).toBe(200);
    expect(submitClaim(result.state, { ...input, sessionDate: '2026-09-13' }, 'claim-1').errors.length).toBeGreaterThan(0);
    expect(PROGRAM).toMatchObject({ monthlyBenefitCents: 3000, monthlyKwhTenths: 500, sessionCapCents: 1200 });
  });

  it.each([{ monthlyCap: '0' }, { sessionCap: '0' }, { monthlyCap: 'NaN' }, { sessionCap: 'Infinity' },
    { monthlyCap: '-1' }, { sessionCap: '9007199254740992' }, { monthlyCap: '1', sessionCap: '2' },
    { monthlyCap: '' }, { sessionCap: '0.001' }, { name: ' ' }])('rejects invalid draft instead of defaulting: %j', overrides => {
    const state = defaultState();
    const result = createCampaignDraft(state, { ...draft, ...overrides }, 'draft-1');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.state).toBe(state);
  });
});
