import { describe, expect, it } from 'vitest';
import { rankMatches, inferTimeBand, walkingLimit } from '../commuterMatchRanking';
import { commuterMatchTemplates, type CommuterMatchTemplate } from '../../data/commuterMatchesData';
import type { CommuteProfile } from '../commuteRanking';

const baseProfile: CommuteProfile = {
  id: 'test-profile',
  campusAffiliation: 'Pasadena City College',
  startingArea: 'Eagle Rock',
  destinationArea: 'Pasadena City College',
  timeWindow: '8:00 AM',
  daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
  transitOptions: [],
  studentTransitPass: 'not-sure',
  incentiveInterests: [],
  maxWalkingDistance: '10-15',
  evPreference: 'any',
  source: 'demo',
};

const baseTemplate: CommuterMatchTemplate = {
  id: 'test-match',
  title: 'Test EV route',
  vehicleType: 'EV',
  originArea: 'Eagle Rock',
  destinationArea: 'Pasadena City College',
  originKeywords: ['eagle rock'],
  destinationKeywords: ['pasadena city college', 'pcc'],
  campusKeywords: ['pasadena city college', 'pcc'],
  days: ['Monday', 'Wednesday', 'Friday'],
  timeBand: 'morning',
  departureWindow: '8:00 AM',
  accessPoint: 'PCC Lot 5',
  walkingMinutes: 6,
  estimatedDetourMinutes: 4,
  routeOverlapScore: 86,
  baseScore: 78,
  status: 'match-preview',
};

describe('commuterMatchesData', () => {
  it('is populated with entries, not left as an empty stub', () => {
    expect(commuterMatchTemplates.length).toBeGreaterThan(0);
  });

  it('every template has a vehicleType and a non-empty days array', () => {
    for (const template of commuterMatchTemplates) {
      expect(['EV', 'PHEV', 'Hybrid']).toContain(template.vehicleType);
      expect(template.days.length).toBeGreaterThan(0);
    }
  });
});

describe('inferTimeBand', () => {
  it('recognizes explicit morning/midday/evening keywords', () => {
    expect(inferTimeBand('midday')).toBe('midday');
    expect(inferTimeBand('evening')).toBe('evening');
  });

  it('infers band from a clock time', () => {
    expect(inferTimeBand('8:00 AM')).toBe('morning');
    expect(inferTimeBand('12:30 PM')).toBe('midday');
    expect(inferTimeBand('6:00 PM')).toBe('evening');
  });

  it('defaults to morning when no time signal is present', () => {
    expect(inferTimeBand('')).toBe('morning');
  });
});

describe('walkingLimit', () => {
  it('maps known buckets to minute limits', () => {
    expect(walkingLimit('under-5')).toBe(5);
    expect(walkingLimit('5-10')).toBe(10);
    expect(walkingLimit('10-15')).toBe(15);
  });

  it('defaults unknown values to the most permissive limit', () => {
    expect(walkingLimit('unrecognized')).toBe(15);
  });
});

describe('rankMatches', () => {
  it('ranks matches 1..N with no gaps or duplicates', () => {
    const ranked = rankMatches(baseProfile, commuterMatchTemplates);
    const ranks = ranked.map(match => match.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(Array.from({ length: commuterMatchTemplates.length }, (_, i) => i + 1));
  });

  it('sorts by descending fitScore', () => {
    const ranked = rankMatches(baseProfile, commuterMatchTemplates);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1].fitScore).toBeGreaterThanOrEqual(ranked[i].fitScore);
    }
  });

  it('scores a fully-matching template higher than a non-matching one', () => {
    const nonMatchingTemplate: CommuterMatchTemplate = {
      ...baseTemplate,
      id: 'test-non-matching',
      originArea: 'Glendale',
      destinationArea: 'Glendale Community College',
      originKeywords: ['glendale'],
      destinationKeywords: ['glendale community college', 'gcc'],
      campusKeywords: ['glendale community college', 'gcc'],
      days: ['Tuesday'],
      timeBand: 'evening',
    };

    const ranked = rankMatches(baseProfile, [baseTemplate, nonMatchingTemplate]);
    const matching = ranked.find(match => match.id === baseTemplate.id)!;
    const nonMatching = ranked.find(match => match.id === nonMatchingTemplate.id)!;
    expect(matching.fitScore).toBeGreaterThan(nonMatching.fitScore);
  });

  it('always includes the required administrative-review disclaimer in reasons', () => {
    const ranked = rankMatches(baseProfile, [baseTemplate]);
    expect(ranked[0].reasons.some(reason => reason.includes('Administrative review'))).toBe(true);
  });

  it('marks schedule fit Strong only when both time band and day overlap match', () => {
    const ranked = rankMatches(baseProfile, [baseTemplate]);
    expect(ranked[0].scheduleFit).toBe('Strong');

    const wrongDayProfile: CommuteProfile = { ...baseProfile, daysOfWeek: ['Sunday'] };
    const rankedWrongDay = rankMatches(wrongDayProfile, [baseTemplate]);
    expect(rankedWrongDay[0].scheduleFit).not.toBe('Strong');
  });

  it('never lets fitScore fall outside the 35-99 clamp range', () => {
    const emptyProfile: CommuteProfile = {
      ...baseProfile,
      startingArea: '',
      destinationArea: '',
      campusAffiliation: '',
      timeWindow: '',
      daysOfWeek: [],
    };
    const ranked = rankMatches(emptyProfile, commuterMatchTemplates);
    for (const match of ranked) {
      expect(match.fitScore).toBeGreaterThanOrEqual(35);
      expect(match.fitScore).toBeLessThanOrEqual(99);
    }
  });

  it('defaults to the module-level commuterMatchTemplates when no templates arg is passed', () => {
    const ranked = rankMatches(baseProfile);
    expect(ranked.length).toBe(commuterMatchTemplates.length);
  });
});
