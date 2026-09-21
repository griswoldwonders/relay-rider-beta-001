import { describe, expect, it } from 'vitest';
import {
  defaultState,
  dollars,
  estimateClaim,
  isWeekdayIsoDate,
  kwhLabel,
  parseKwhToTenths,
  parseMoneyToCents,
  remainingFromLedger,
  seedLedger,
  validateClaimForm,
} from './program';

describe('Green Route Credits program math', () => {
  it('reconciles seed consumption and holds in both units without snapshot overrides', () => {
    const state = defaultState();
    expect(remainingFromLedger(state.ledger)).toEqual({
      remainingCents: 260, remainingKwhTenths: 218,
      consumedCents: 1540, consumedKwhTenths: 186,
      heldCents: 1200, heldKwhTenths: 96,
    });
    expect(state).not.toHaveProperty('remainingCents');
    expect(state).not.toHaveProperty('remainingKwhTenths');
    const flagged = state.ledger.map(row => row.status === 'pending' ? { ...row, status: 'flagged' as const } : row);
    expect(remainingFromLedger(flagged)).toEqual(remainingFromLedger(state.ledger));
  });
  it('excludes idle parking and tax and applies session and remaining caps', () => {
    const result = estimateClaim({
      energyChargeCents: 1480,
      idleFeeCents: 150,
      parkingFeeCents: 40,
      taxCents: 20,
      remainingCents: 1860,
    });
    expect(result.excludedCents).toBe(210);
    expect(result.eligibleEnergyCents).toBe(1480);
    expect(result.estimatedCents).toBe(1200);
  });

  it('never exceeds remaining monthly dollars', () => {
    const result = estimateClaim({ energyChargeCents: 1480, remainingCents: 800 });
    expect(result.estimatedCents).toBe(800);
  });

  it('enforces weekday commute dates', () => {
    expect(isWeekdayIsoDate('2026-09-14')).toBe(true);
    expect(isWeekdayIsoDate('2026-09-13')).toBe(false);
  });

  it('parses integer money and kWh tenths', () => {
    expect(parseMoneyToCents('14.80')).toBe(1480);
    expect(parseKwhToTenths('31.4')).toBe(314);
    expect(dollars(1860)).toBe('$18.60');
    expect(kwhLabel(314)).toBe('31.4');
  });

  it('seeds the specified demo activity', () => {
    const ledger = seedLedger();
    expect(ledger[0].amountCents).toBe(3000);
    expect(ledger.find((row) => row.date === '2026-09-08')?.status).toBe('redeemed');
    const remaining = remainingFromLedger(ledger);
    expect(remaining.consumedCents).toBeGreaterThanOrEqual(640);
  });

  it.each(['2026-02-30', '2026-09-31', '2026-13-01', '2026-9-15', '0000-01-01'])('rejects impossible or malformed dates: %s', date => {
    expect(isWeekdayIsoDate(date)).toBe(false);
  });

  it.each(['9007199254740992', 'Infinity', 'NaN', '-1', '1e2'])('rejects unsafe numeric input: %s', value => {
    expect(parseMoneyToCents(value)).toBeNull();
    expect(parseKwhToTenths(value)).toBeNull();
  });

  it('rejects unsupported kWh precision instead of silently truncating', () => {
    expect(parseKwhToTenths('1.25')).toBeNull();
  });

  it.each([{ energyChargeCents: NaN }, { energyChargeCents: 0 }, { energyChargeCents: 1.5 },
    { idleFeeCents: -1 }, { taxCents: Infinity },
    { idleFeeCents: Number.MAX_SAFE_INTEGER, parkingFeeCents: 1 }])('rejects invalid or overflowing estimate inputs: %j', overrides => {
    expect(() => estimateClaim({ energyChargeCents: 100, remainingCents: 3000, ...overrides })).toThrow();
  });

  it.each([{ startTime: '24:00' }, { startTime: '7:40' }, { startTime: '07:60' }, { energyCharge: '0' }])('rejects invalid time or zero charge: %j', overrides => {
    expect(validateClaimForm({ network: 'Demo', locationName: 'Synthetic', cityCorridor: 'Demo', sessionDate: '2026-09-15',
      startTime: '07:40', energyKwh: '1', energyCharge: '1', commuteRelated: true, exclusionsAcknowledged: true, ...overrides }).errors.length).toBeGreaterThan(0);
  });

  it('requires commute attestation and exclusions', () => {
    const invalid = validateClaimForm({ network: '', locationName: '', commuteRelated: false, exclusionsAcknowledged: false });
    expect(invalid.errors.length).toBeGreaterThan(3);
    const valid = validateClaimForm({
      network: 'Demo Partner Network',
      locationName: 'Pasadena Transit Hub Charging',
      cityCorridor: 'Pasadena corridor',
      sessionDate: '2026-09-15',
      startTime: '07:40',
      energyKwh: '9.6',
      energyCharge: '14.80',
      commuteRelated: true,
      exclusionsAcknowledged: true,
    });
    expect(valid.errors.length).toBe(0);
    expect(valid.energyChargeCents).toBe(1480);
  });
});
