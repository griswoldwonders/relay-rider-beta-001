import { describe, expect, it } from 'vitest';
import { mapLocations, selectAccessPointCandidates } from '../mapLocations';

describe('location evidence / provenance', () => {
  it('gives every location an evidence source type and a checked-on date', () => {
    expect(mapLocations.every(location => Boolean(location.evidence?.sourceType))).toBe(true);
    expect(mapLocations.every(location => Boolean(location.evidence?.checkedOn))).toBe(true);
  });

  it('marks the Wikipedia-sourced transit entries as provisional, not an official/directory source', () => {
    const wikipediaEntries = mapLocations.filter(location => location.sourceUrl.includes('wikipedia.org'));

    expect(wikipediaEntries.length).toBeGreaterThan(0);
    expect(wikipediaEntries.every(location => location.evidence.sourceType === 'provisional-reference')).toBe(true);
  });

  it('does not mark every location as an official source (not all facilities are source-verified)', () => {
    const nonOfficial = mapLocations.filter(location => location.evidence.sourceType !== 'official-source');

    expect(nonOfficial.length).toBeGreaterThan(0);
  });
});

describe('selectAccessPointCandidates', () => {
  it('includes campus candidate locations', () => {
    const candidates = selectAccessPointCandidates(mapLocations);

    expect(candidates.some(location => location.id === 'school-pcc')).toBe(true);
  });

  it('includes transit candidate locations', () => {
    const candidates = selectAccessPointCandidates(mapLocations);

    expect(candidates.some(location => location.id === 'transit-fillmore')).toBe(true);
  });

  it('excludes EV charging hubs, which are not candidate Access Points', () => {
    const candidates = selectAccessPointCandidates(mapLocations);

    expect(candidates.some(location => location.kind === 'ev-hub')).toBe(false);
  });

  it('is driven by a per-location data flag, not brittle type-string matching', () => {
    const candidates = selectAccessPointCandidates(mapLocations);

    expect(candidates.every(location => location.accessPointCandidate === true)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('never labels a candidate as approved or operational', () => {
    const candidates = selectAccessPointCandidates(mapLocations);

    expect(candidates.every(location => location.reviewStatus !== undefined && location.reviewStatus !== 'partner-review' || location.reviewStatus === 'partner-review')).toBe(true);
    expect(candidates.some(location => (location as unknown as { approved?: boolean }).approved === true)).toBe(false);
  });
});
