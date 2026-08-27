import { commuterMatchTemplates, type CommuterMatchTemplate } from '../data/commuterMatchesData';
import type { CommuteProfile } from './commuteRanking';

export interface RankedCommuterMatch extends CommuterMatchTemplate {
  rank: number;
  fitScore: number;
  scheduleFit: 'Strong' | 'Moderate' | 'Low';
  reasons: string[];
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchesAny = (value: string, candidates: string[]) => {
  const normalized = normalize(value);
  if (!normalized) return false;
  return candidates.some(candidate => {
    const token = normalize(candidate);
    return normalized.includes(token) || token.includes(normalized);
  });
};

export const inferTimeBand = (value: string): CommuterMatchTemplate['timeBand'] => {
  const normalized = normalize(value);
  if (normalized.includes('midday') || normalized.includes('noon')) return 'midday';
  if (normalized.includes('evening') || normalized.includes('night')) return 'evening';

  // Match against the raw (non-normalized) value: normalize() strips colons,
  // which corrupts times like "8:00 AM" into "8 00 am" and misparses the
  // hour as "00" instead of "8". Match case-insensitively on the original text.
  const match = value.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)/i);
  if (!match) return 'morning';
  const hour = Number(match[1]);
  const meridiem = match[2].toLowerCase();
  const hour24 = meridiem === 'pm' && hour !== 12 ? hour + 12 : meridiem === 'am' && hour === 12 ? 0 : hour;
  if (hour24 >= 11 && hour24 < 16) return 'midday';
  if (hour24 >= 16 || hour24 < 5) return 'evening';
  return 'morning';
};

export const walkingLimit = (value: string) => {
  if (value === 'under-5') return 5;
  if (value === '5-10') return 10;
  if (value === '10-15') return 15;
  return 15;
};

export function rankMatches(
  profile: CommuteProfile,
  templates: CommuterMatchTemplate[] = commuterMatchTemplates,
): RankedCommuterMatch[] {
  const requestedBand = inferTimeBand(profile.timeWindow);
  const maxWalk = walkingLimit(profile.maxWalkingDistance);

  return templates
    .map(template => {
      const originFit = matchesAny(profile.startingArea, template.originKeywords);
      const destinationFit = matchesAny(profile.destinationArea, template.destinationKeywords);
      const campusFit = matchesAny(profile.campusAffiliation, template.campusKeywords);
      const scheduleFit = template.timeBand === requestedBand;
      const dayOverlap = profile.daysOfWeek.length === 0
        ? 1
        : profile.daysOfWeek.filter(day => template.days.includes(day)).length;
      const walkFit = template.walkingMinutes <= maxWalk;
      const cleanVehicleFit = profile.evPreference === 'any'
        || template.vehicleType === 'EV'
        || (profile.evPreference === 'hybrid-ev' && ['EV', 'PHEV', 'Hybrid'].includes(template.vehicleType));

      const score = Math.max(35, Math.min(99, Math.round(
        template.baseScore
        + (originFit ? 5 : -8)
        + (destinationFit ? 5 : -9)
        + (campusFit ? 3 : -4)
        + (scheduleFit ? 3 : -8)
        + (dayOverlap > 0 ? 2 : -5)
        + (walkFit ? 2 : -4)
        + (cleanVehicleFit ? 2 : -6),
      )));

      const reasons: string[] = [];
      if (originFit && destinationFit) {
        reasons.push(`Strong modeled corridor compatibility with your ${profile.startingArea} → ${profile.destinationArea} commute.`);
      } else if (destinationFit || campusFit) {
        reasons.push('The planned route reaches your destination area, but the origin overlap is less direct.');
      } else {
        reasons.push('This is a lower-fit corridor preview included for comparison; it does not closely match both ends of your trip.');
      }

      reasons.push(scheduleFit
        ? `The registered route window overlaps your ${profile.timeWindow || 'selected'} travel period in this prototype model.`
        : `The route window is a weaker match for your ${profile.timeWindow || 'selected'} travel period.`);

      reasons.push(walkFit
        ? `The modeled ${template.walkingMinutes}-minute walk is within your selected walking tolerance.`
        : `The modeled ${template.walkingMinutes}-minute walk is above your selected walking tolerance.`);

      if (cleanVehicleFit) {
        reasons.push(`${template.vehicleType} participation aligns with your clean-vehicle preference.`);
      }

      reasons.push(`Estimated detour impact is ${template.estimatedDetourMinutes} minutes with ${template.routeOverlapScore}% modeled route overlap.`);
      reasons.push('This is a match preview only. Administrative review and program rules apply before any controlled commuter coordination.');

      const resolvedScheduleFit: RankedCommuterMatch['scheduleFit'] = scheduleFit && dayOverlap > 0
        ? 'Strong'
        : scheduleFit || dayOverlap > 0
          ? 'Moderate'
          : 'Low';

      return {
        ...template,
        rank: 0,
        fitScore: score,
        scheduleFit: resolvedScheduleFit,
        reasons,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore || b.routeOverlapScore - a.routeOverlapScore)
    .map((match, index) => ({ ...match, rank: index + 1 }));
}
