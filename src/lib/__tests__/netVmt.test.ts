import { describe, expect, it } from 'vitest';
import { calculateModeledNetVmt } from '../netVmt';

describe('calculateModeledNetVmt', () => {
  it('returns a positive modeled net VMT opportunity', () => {
    const result = calculateModeledNetVmt({ baselineSovMiles: 10.2, incrementalEvDetourMiles: 1.4 });

    expect(result.modeledNetVmtAvoided).toBe(8.8);
    expect(result.status).toBe('positive');
    expect(result.evidenceState).toBe('modeled');
    expect(result.assumptions.join(' ')).toContain('fully displaced');
  });

  it('does not describe zero net VMT as a positive opportunity', () => {
    const result = calculateModeledNetVmt({ baselineSovMiles: 5, incrementalEvDetourMiles: 5 });

    expect(result.modeledNetVmtAvoided).toBe(0);
    expect(result.status).toBe('non_positive');
  });

  it('does not describe negative net VMT as a positive opportunity', () => {
    const result = calculateModeledNetVmt({ baselineSovMiles: 4, incrementalEvDetourMiles: 5.5 });

    expect(result.modeledNetVmtAvoided).toBe(-1.5);
    expect(result.status).toBe('non_positive');
    expect(result.limitations.join(' ')).toContain('does not represent a positive VMT opportunity');
  });

  it('returns unsupported when baseline SOV miles are missing', () => {
    const result = calculateModeledNetVmt({ baselineSovMiles: null, incrementalEvDetourMiles: 1.4 });

    expect(result.modeledNetVmtAvoided).toBeNull();
    expect(result.status).toBe('unsupported');
    expect(result.evidenceState).toBe('unsupported');
    expect(result.limitations.join(' ')).toContain('baseline');
  });
});
