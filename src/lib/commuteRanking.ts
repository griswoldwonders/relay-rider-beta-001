import { CommuteOptionTemplate, CommuteTimeBand } from '../data/commuteOptionsData';
import { RouteSignal } from '../types';

export interface CommuteProfile {
  id: string;
  campusAffiliation: string;
  startingArea: string;
  destinationArea: string;
  timeWindow: string;
  daysOfWeek: string[];
  transitOptions: string[];
  studentTransitPass: 'yes' | 'no' | 'not-sure';
  incentiveInterests: string[];
  maxWalkingDistance: string;
  evPreference: 'ev-only' | 'hybrid-ev' | 'any';
  source: 'submitted' | 'demo';
}

export interface RankedCommuteFactor {
  label: string;
  value: number;
  detail: string;
}

export interface RankedCommuteOption extends CommuteOptionTemplate {
  rank: number;
  fitScore: number;
  scheduleFit: 'Strong' | 'Moderate' | 'Low';
  reasons: string[];
  factors: RankedCommuteFactor[];
  resolvedCostLabel: string;
  resolvedBenefitLabel?: string;
}

export const pccDemoProfile: CommuteProfile = {
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

export function profileFromRouteSignal(signal: RouteSignal): CommuteProfile {
  return {
    id: signal.id,
    campusAffiliation: signal.campusAffiliation,
    startingArea: signal.startingArea,
    destinationArea: signal.destinationArea,
    timeWindow: signal.timeWindow,
    daysOfWeek: signal.daysOfWeek,
    transitOptions: signal.transitOptions,
    studentTransitPass: signal.studentTransitPass,
    incentiveInterests: signal.incentiveInterests,
    maxWalkingDistance: signal.maxWalkingDistance,
    evPreference: signal.evPreference,
    source: 'submitted',
  };
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const textMatches = (value: string, keywords: string[]) => {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return false;

  return keywords.some(keyword => {
    const normalizedKeyword = normalize(keyword);
    return normalizedValue.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedValue);
  });
};

const inferTimeBand = (timeWindow: string): CommuteTimeBand => {
  const value = normalize(timeWindow);
  if (value.includes('morning')) return 'morning';
  if (value.includes('midday') || value.includes('noon')) return 'midday';
  if (value.includes('evening') || value.includes('night')) return 'evening';

  const match = value.match(/(\d{1,2})(?::\d{2})?\s*(am|pm)/);
  if (!match) return 'any';

  const hour = Number(match[1]);
  const meridiem = match[2];
  const hour24 = meridiem === 'pm' && hour !== 12 ? hour + 12 : meridiem === 'am' && hour === 12 ? 0 : hour;

  if (hour24 >= 5 && hour24 < 11) return 'morning';
  if (hour24 >= 11 && hour24 < 16) return 'midday';
  return 'evening';
};

const walkingLimitMinutes = (value: string) => {
  if (value === 'under-5') return 5;
  if (value === '5-10') return 10;
  if (value === '10-15') return 15;
  return 15;
};

const providerPreferenceFit = (profile: CommuteProfile, option: CommuteOptionTemplate) => {
  if (option.kind === 'relay') {
    if (profile.evPreference === 'ev-only' || profile.evPreference === 'hybrid-ev') return 95;
    return 80;
  }

  if (profile.transitOptions.length === 0) return 75;

  const preferences = normalize(profile.transitOptions.join(' '));
  const provider = normalize(option.provider);
  const title = normalize(option.title);

  if (provider.includes('metro') && preferences.includes('metro')) return 100;
  if (provider.includes('pasadena') && preferences.includes('pasadena transit')) return 100;
  if (provider.includes('glendale') && preferences.includes('glendale beeline')) return 100;
  if (title.includes('rail') && preferences.includes('rail')) return 95;
  if (title.includes('bus') && preferences.includes('bus')) return 95;
  return 70;
};

const incentiveFit = (profile: CommuteProfile, option: CommuteOptionTemplate) => {
  if (profile.incentiveInterests.length === 0) return 70;

  const selected = profile.incentiveInterests.map(normalize);
  const supported = option.incentiveTags.map(normalize);
  const overlap = selected.filter(item => supported.some(tag => item.includes(tag) || tag.includes(item))).length;

  if (overlap >= 2) return 100;
  if (overlap === 1) return 90;
  return 55;
};

const resolveCostLabel = (profile: CommuteProfile, option: CommuteOptionTemplate) => {
  if (option.kind === 'relay') return option.costLabel;

  if (profile.studentTransitPass === 'yes') {
    return 'Student pass selected · verify that this agency and trip are covered';
  }

  if (profile.studentTransitPass === 'no') {
    return 'No student pass selected · check current fare and campus eligibility';
  }

  return option.costLabel;
};

const resolveBenefitLabel = (profile: CommuteProfile, option: CommuteOptionTemplate) => {
  if (!option.benefitLabel) return undefined;

  const fit = incentiveFit(profile, option);
  if (fit >= 90) return `${option.benefitLabel} · matches your selected incentive interests`;
  return option.benefitLabel;
};

export function rankCommuteOptions(
  profile: CommuteProfile,
  templates: CommuteOptionTemplate[],
): RankedCommuteOption[] {
  const requestedBand = inferTimeBand(profile.timeWindow);
  const walkLimit = walkingLimitMinutes(profile.maxWalkingDistance);

  const ranked = templates.map(option => {
    const campusMatches = textMatches(profile.campusAffiliation, option.campusMatches);
    const originMatches = textMatches(profile.startingArea, option.originKeywords);
    const destinationMatches = textMatches(profile.destinationArea, option.destinationKeywords);
    const routeFit = Math.round(((campusMatches ? 100 : 55) + (originMatches ? 100 : 50) + (destinationMatches ? 100 : 50)) / 3);

    const timeMatches = requestedBand === 'any' || option.timeBands.includes('any') || option.timeBands.includes(requestedBand);
    const scheduleValue = timeMatches ? 96 : 58;
    const scheduleFit: RankedCommuteOption['scheduleFit'] = scheduleValue >= 90 ? 'Strong' : scheduleValue >= 70 ? 'Moderate' : 'Low';

    const walkingValue = option.walkingMinutes <= walkLimit
      ? clamp(100 - Math.max(0, option.walkingMinutes - 4) * 3)
      : clamp(70 - (option.walkingMinutes - walkLimit) * 5);
    const transferValue = clamp(100 - option.transferCount * 24);
    const preferenceValue = providerPreferenceFit(profile, option);
    const benefitValue = incentiveFit(profile, option);
    const programValue = option.kind === 'relay'
      ? (profile.campusAffiliation && !normalize(profile.campusAffiliation).includes('not affiliated') ? 96 : 72)
      : (profile.studentTransitPass === 'yes' ? 94 : profile.studentTransitPass === 'not-sure' ? 76 : 66);
    const baselineValue = clamp(option.baseScore + 25);

    const fitScore = Math.round(clamp(
      routeFit * 0.28
      + scheduleValue * 0.17
      + walkingValue * 0.12
      + transferValue * 0.12
      + preferenceValue * 0.09
      + benefitValue * 0.08
      + programValue * 0.07
      + baselineValue * 0.07,
      30,
      99,
    ));

    const reasons: string[] = [];
    if (campusMatches) reasons.push(`Matches ${profile.campusAffiliation || 'your campus'} as the destination institution.`);
    if (originMatches && destinationMatches) reasons.push(`Matches the ${profile.startingArea} → ${profile.destinationArea} corridor you entered.`);
    else if (destinationMatches) reasons.push(`Serves the destination area you entered; the origin connection is less direct.`);
    if (timeMatches) reasons.push(`Compatible with your ${profile.timeWindow || 'selected'} travel window in this prototype model.`);
    else reasons.push(`Schedule fit is weaker for your ${profile.timeWindow || 'selected'} travel window.`);
    reasons.push(`Modeled access burden: about ${option.walkingMinutes} min walking and ${option.transferCount} transfer${option.transferCount === 1 ? '' : 's'}.`);
    if (option.kind === 'relay') reasons.push('Relay Rider college-program participation is modeled at $0 for eligible participants; activation still requires administrative review.');
    if (option.kind === 'transit' && profile.studentTransitPass !== 'no') reasons.push('A student pass may reduce the fare, but school and agency eligibility must be verified.');
    if (benefitValue >= 90) reasons.push('This option aligns with one or more incentive interests you selected.');

    const factors: RankedCommuteFactor[] = [
      {
        label: 'School + corridor fit',
        value: routeFit,
        detail: campusMatches && originMatches && destinationMatches
          ? 'Strong match to your institution, origin, and destination.'
          : 'Partial match; one or more location signals are less direct.',
      },
      {
        label: 'Schedule fit',
        value: scheduleValue,
        detail: timeMatches
          ? `Modeled for the ${requestedBand === 'any' ? 'selected' : requestedBand} period; not a live arrival prediction.`
          : 'The modeled service window is not a strong match for the time you entered.',
      },
      {
        label: 'Walking fit',
        value: walkingValue,
        detail: `About ${option.walkingMinutes} modeled walking minutes versus your selected walking tolerance.`,
      },
      {
        label: 'Transfer simplicity',
        value: transferValue,
        detail: `${option.transferCount} modeled transfer${option.transferCount === 1 ? '' : 's'} for this demonstration bundle.`,
      },
      {
        label: 'Preference fit',
        value: preferenceValue,
        detail: option.kind === 'relay'
          ? 'Reflects your EV/hybrid preference for planned-route previews.'
          : 'Reflects the local transit modes you asked Relay Rider to compare.',
      },
      {
        label: 'Incentive fit',
        value: benefitValue,
        detail: benefitValue >= 90
          ? 'Matches at least one selected incentive interest.'
          : 'No strong incentive-interest match was detected.',
      },
    ];

    return {
      ...option,
      rank: 0,
      fitScore,
      scheduleFit,
      reasons,
      factors,
      resolvedCostLabel: resolveCostLabel(profile, option),
      resolvedBenefitLabel: resolveBenefitLabel(profile, option),
    };
  });

  return ranked
    .sort((a, b) => b.fitScore - a.fitScore || a.modeledDurationMinutes - b.modeledDurationMinutes)
    .map((option, index) => ({ ...option, rank: index + 1 }));
}
