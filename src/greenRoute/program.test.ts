import { describe, expect, it } from 'vitest';
import {
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
