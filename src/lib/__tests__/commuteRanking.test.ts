import { describe, expect, it } from 'vitest';
import { profileFromRouteSignal, rankCommuteOptions, type CommuteProfile } from '../commuteRanking';
import { commuteOptions, type CommuteOptionTemplate } from '../../data/commuteOptionsData';
import type { RouteSignal } from '../../types';

// Local test-only fixture (not exported from commuteRanking.ts -- production
// screens must use a real submitted RouteSignal or show an empty state, never
// a silently-injected demo profile). Mirrors the shape pccDemoProfile used to
// have when it lived in the production module.
const pccDemoProfile: CommuteProfile = {
  id: 'demo-pcc-eagle-rock-0800',
  campusAffiliation: 'Pasadena City College',
  startingArea: 'Eagle Rock',
  destinationArea: 'Pasadena City College',
  timeWindow: '8:00 AM',
  daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
  transitOptions: ['LA Metro bus', 'LA Metro rail', 'Pasadena Transit'],
  studentTransitPass: 'not-sure',
  incentiveInterests: ['Green Route Credits', 'Transit participation rewards', 'Campus commute challenges'],
  maxWalkingDistance: '10-15',
  evPreference: 'hybrid-ev',
  source: 'demo',
};

const baseOption: CommuteOptionTemplate = {
  id: 'test-relay-option',
  kind: 'relay',
  provider: 'Relay Rider',
  title: 'Test relay option',
  subtitle: 'Test subtitle',
  startArea: 'Eagle Rock',
  endArea: 'Pasadena City College',
  days: 'Mon · Wed · Fri',
  departureWindow: '8:00 AM',
  accessPoint: 'PCC Lot 5',
  costLabel: '$0 for eligible college participants',
  filters: ['best-fit', 'morning'],
  status: 'match-preview',
  campusMatches: ['Pasadena City College', 'PCC'],
  originKeywords: ['eagle rock'],
  destinationKeywords: ['pasadena city college', 'pcc'],
  timeBands: ['morning'],
  walkingMinutes: 6,
  transferCount: 0,
  modeledDurationMinutes: 22,
  incentiveTags: ['Green Route Credits'],
  baseScore: 68,
};

const transitOption: CommuteOptionTemplate = {
  ...baseOption,
  id: 'test-transit-option',
  kind: 'transit',
  provider: 'LA Metro',
  title: 'Test transit option',
  costLabel: 'Standard Metro fare',
  benefitLabel: undefined,
  incentiveTags: [],
  sourceUrl: 'https://www.metro.net/riding/schedules/',
  sourceLabel: 'LA Metro — Schedules',
};

describe('commuteOptionsData', () => {
  it('is populated with real entries, not left as an empty stub', () => {
    expect(commuteOptions.length).toBeGreaterThan(0);
  });

  it('every transit-kind option cites a source URL for verification', () => {
    const transitOptions = commuteOptions.filter(option => option.kind === 'transit');
    expect(transitOptions.length).toBeGreaterThan(0);
    for (const option of transitOptions) {
      expect(option.sourceUrl, `${option.id} should cite a sourceUrl`).toBeTruthy();
      expect(option.sourceLabel, `${option.id} should cite a sourceLabel`).toBeTruthy();
    }
  });

  it('every relay-kind option frames cost as $0 college-program participation, not a fare', () => {
    // commuteOptionsData.ts intentionally ships zero relay-kind entries right
    // now: there is no backend endpoint yet for real participant-planned
    // relay routes, so the fictional 'relay-*' demo entries that used to
    // live here were removed rather than presented as if real (see that
    // file's header comment). This test still guards the underlying rule --
    // if/when a real relay-kind option is added back (e.g. once a backend
    // endpoint exists), it must frame cost as $0 participation, not a fare.
    const relayOptions = commuteOptions.filter(option => option.kind === 'relay');
    for (const option of relayOptions) {
      expect(option.costLabel.toLowerCase()).toContain('$0');
    }
  });

  it('has no relay-kind options until a real backend endpoint exists', () => {
    // Documents current intended state; update this test once relay routes
    // are backed by a real API instead of hardcoded demo data.
    const relayOptions = commuteOptions.filter(option => option.kind === 'relay');
    expect(relayOptions.length).toBe(0);
  });
});

describe('rankCommuteOptions', () => {
  it('ranks options 1..N with no gaps or duplicates', () => {
    const ranked = rankCommuteOptions(pccDemoProfile, commuteOptions);
    const ranks = ranked.map(option => option.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(Array.from({ length: commuteOptions.length }, (_, i) => i + 1));
  });

  it('sorts by descending fitScore', () => {
    const ranked = rankCommuteOptions(pccDemoProfile, commuteOptions);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1].fitScore).toBeGreaterThanOrEqual(ranked[i].fitScore);
    }
  });

  it('scores an origin+destination+campus match higher than a non-matching option', () => {
    const profile: CommuteProfile = {
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

    const nonMatchingOption: CommuteOptionTemplate = {
      ...baseOption,
      id: 'test-non-matching-option',
      startArea: 'Glendale',
      endArea: 'Glendale Community College',
      campusMatches: ['Glendale Community College', 'GCC'],
      originKeywords: ['glendale'],
      destinationKeywords: ['glendale community college', 'gcc'],
    };

    const ranked = rankCommuteOptions(profile, [baseOption, nonMatchingOption]);
    const matching = ranked.find(option => option.id === baseOption.id)!;
    const nonMatching = ranked.find(option => option.id === nonMatchingOption.id)!;
    expect(matching.fitScore).toBeGreaterThan(nonMatching.fitScore);
  });

  it('resolves transit cost label based on studentTransitPass status', () => {
    const profileWithPass: CommuteProfile = {
      id: 'p1',
      campusAffiliation: 'PCC',
      startingArea: 'Eagle Rock',
      destinationArea: 'PCC',
      timeWindow: '8:00 AM',
      daysOfWeek: [],
      transitOptions: [],
      studentTransitPass: 'yes',
      incentiveInterests: [],
      maxWalkingDistance: '10-15',
      evPreference: 'any',
      source: 'demo',
    };
    const profileWithoutPass: CommuteProfile = { ...profileWithPass, studentTransitPass: 'no' };

    const rankedWithPass = rankCommuteOptions(profileWithPass, [transitOption]);
    const rankedWithoutPass = rankCommuteOptions(profileWithoutPass, [transitOption]);

    expect(rankedWithPass[0].resolvedCostLabel.toLowerCase()).toContain('student pass selected');
    expect(rankedWithoutPass[0].resolvedCostLabel.toLowerCase()).toContain('no student pass selected');
  });

  it('never lets fitScore fall outside the 30-99 clamp range', () => {
    const emptyProfile: CommuteProfile = {
      id: 'p-empty',
      campusAffiliation: '',
      startingArea: '',
      destinationArea: '',
      timeWindow: '',
      daysOfWeek: [],
      transitOptions: [],
      studentTransitPass: 'not-sure',
      incentiveInterests: [],
      maxWalkingDistance: '',
      evPreference: 'any',
      source: 'demo',
    };
    const ranked = rankCommuteOptions(emptyProfile, commuteOptions);
    for (const option of ranked) {
      expect(option.fitScore).toBeGreaterThanOrEqual(30);
      expect(option.fitScore).toBeLessThanOrEqual(99);
    }
  });
});

describe('profileFromRouteSignal', () => {
  it('maps a submitted RouteSignal into a CommuteProfile marked as submitted', () => {
    const signal: RouteSignal = {
      id: 'signal-1',
      corridor: 'Eagle Rock - PCC',
      startingArea: 'Eagle Rock',
      destinationArea: 'Pasadena City College',
      campusAffiliation: 'Pasadena City College',
      daysOfWeek: ['Monday'],
      timeWindow: '8:00 AM',
      routeType: 'recurring',
      relayZoneType: ['campus'],
      transitOptions: ['LA Metro bus'],
      studentTransitPass: 'yes',
      incentiveInterests: ['Green Route Credits'],
      evPreference: 'hybrid-ev',
      maxWalkingDistance: '10-15',
      privacyPreference: 'approximate-zone',
      status: 'submitted',
      routeFit: 'high',
      greenRouteCredit: 0,
      createdAt: new Date().toISOString(),
    };

    const profile = profileFromRouteSignal(signal);
    expect(profile.source).toBe('submitted');
    expect(profile.startingArea).toBe('Eagle Rock');
    expect(profile.id).toBe('signal-1');
  });
});
