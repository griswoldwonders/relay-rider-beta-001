export type CommuteOptionFilter = 'best-fit' | 'morning' | 'ev-hybrid' | 'transit' | 'free-college';

export type CommuteTimeBand = 'morning' | 'midday' | 'evening' | 'any';

export interface CommuteOptionTemplate {
  id: string;
  kind: 'relay' | 'transit';
  provider: string;
  title: string;
  subtitle: string;
  startArea: string;
  endArea: string;
  days: string;
  departureWindow: string;
  accessPoint: string;
  costLabel: string;
  benefitLabel?: string;
  filters: CommuteOptionFilter[];
  sourceUrl?: string;
  sourceLabel?: string;
  status: string;
  campusMatches: string[];
  originKeywords: string[];
  destinationKeywords: string[];
  timeBands: CommuteTimeBand[];
  walkingMinutes: number;
  transferCount: number;
  modeledDurationMinutes: number;
  incentiveTags: string[];
  baseScore: number;
}

export const commuteOptions: CommuteOptionTemplate[] = [
  {
    id: 'relay-eagle-rock-pcc',
    kind: 'relay',
    provider: 'Relay Rider',
    title: 'Planned EV/hybrid route preview',
    subtitle: 'Simulated planned-route option using an existing commuter corridor · administrative review required',
    startArea: 'Eagle Rock area',
    endArea: 'Pasadena City College area',
    days: 'Weekday demo pattern',
    departureWindow: '7:35–8:10 AM modeled window',
    accessPoint: 'Eagle Rock public Access Point → PCC campus-edge Access Point',
    costLabel: '$0 for eligible college participants',
    benefitLabel: 'Green Route Credits may be available after eligible participation review',
    filters: ['best-fit', 'morning', 'ev-hybrid', 'free-college'],
    status: 'Match preview · review required',
    campusMatches: ['pasadena city college', 'pcc'],
    originKeywords: ['eagle rock', '90041', '90042'],
    destinationKeywords: ['pasadena city college', 'pcc', 'colorado boulevard', 'pasadena'],
    timeBands: ['morning'],
    walkingMinutes: 6,
    transferCount: 0,
    modeledDurationMinutes: 24,
    incentiveTags: ['green route credits', 'ev / clean-route recognition', 'access point participation rewards', 'campus commute challenges'],
    baseScore: 60,
  },
  {
    id: 'metro-180-pcc',
    kind: 'transit',
    provider: 'LA Metro',
    title: 'Metro Bus Line 180',
    subtitle: 'Regional bus option along the Pasadena–Eagle Rock–Glendale corridor',
    startArea: 'Eagle Rock / Glendale / Pasadena corridor',
    endArea: 'Pasadena / PCC area',
    days: 'Verify current service day and timetable',
    departureWindow: 'Multiple daily departures · live schedule not connected',
    accessPoint: 'Local Line 180 stop → PCC / Colorado Boulevard area',
    costLabel: 'Potential $0 student fare with an eligible GoPass; verify eligibility',
    benefitLabel: 'Transit participation may qualify for campus-sponsored or Green Route incentives',
    filters: ['best-fit', 'morning', 'transit', 'free-college'],
    sourceUrl: 'https://www.metro.net/riding/schedules-2/',
    sourceLabel: 'LA Metro schedules',
    status: 'External transit option',
    campusMatches: ['pasadena city college', 'pcc', 'caltech'],
    originKeywords: ['eagle rock', 'glendale', 'pasadena', 'hollywood'],
    destinationKeywords: ['pasadena city college', 'pcc', 'pasadena', 'colorado boulevard', 'caltech'],
    timeBands: ['morning', 'midday', 'evening'],
    walkingMinutes: 5,
    transferCount: 0,
    modeledDurationMinutes: 31,
    incentiveTags: ['transit participation rewards', 'green route credits', 'campus commute challenges'],
    baseScore: 58,
  },
  {
    id: 'metro-a-line-pcc',
    kind: 'transit',
    provider: 'LA Metro',
    title: 'Metro A Line + local connection',
    subtitle: 'Rail-based alternative using Highland Park or Pasadena stations with a local connection to campus',
    startArea: 'Eagle Rock / Highland Park connection',
    endArea: 'Pasadena / PCC area',
    days: 'Verify current rail and connecting-service schedules',
    departureWindow: 'Frequent rail service · connection timing varies',
    accessPoint: 'Connection to A Line → Pasadena station → walk/bus connection to PCC',
    costLabel: 'Potential $0 student fare with an eligible GoPass; verify eligibility',
    benefitLabel: 'Useful multimodal fallback when a direct planned route is unavailable',
    filters: ['morning', 'transit', 'free-college'],
    sourceUrl: 'https://www.metro.net/riding/schedules-2/',
    sourceLabel: 'LA Metro schedules',
    status: 'External transit option',
    campusMatches: ['pasadena city college', 'pcc', 'caltech', 'cal state la'],
    originKeywords: ['eagle rock', 'highland park', 'pasadena', 'south pasadena', 'los angeles'],
    destinationKeywords: ['pasadena city college', 'pcc', 'pasadena', 'caltech', 'cal state la'],
    timeBands: ['morning', 'midday', 'evening'],
    walkingMinutes: 10,
    transferCount: 1,
    modeledDurationMinutes: 38,
    incentiveTags: ['transit participation rewards', 'green route credits', 'campus commute challenges'],
    baseScore: 50,
  },
  {
    id: 'pasadena-transit-pcc',
    kind: 'transit',
    provider: 'Pasadena Transit',
    title: 'Pasadena Transit campus connection',
    subtitle: 'Local Pasadena bus service that can support first/last-mile access to PCC and nearby Metro stops',
    startArea: 'Pasadena local connection',
    endArea: 'PCC / east Pasadena area',
    days: 'Verify current Pasadena Transit route and schedule',
    departureWindow: 'Varies by route · live schedule not connected',
    accessPoint: 'Metro or local Pasadena stop → PCC campus area',
    costLabel: 'Check current student fare or pass eligibility',
    benefitLabel: 'Can pair with Metro or walking for a multimodal campus trip',
    filters: ['transit'],
    sourceUrl: 'https://www.cityofpasadena.net/transportation/transit/pasadena-transit/',
    sourceLabel: 'Pasadena Transit',
    status: 'External transit option',
    campusMatches: ['pasadena city college', 'pcc', 'caltech', 'artcenter college of design'],
    originKeywords: ['pasadena', 'eagle rock', 'highland park', 'south pasadena'],
    destinationKeywords: ['pasadena city college', 'pcc', 'pasadena', 'caltech', 'artcenter'],
    timeBands: ['morning', 'midday', 'evening'],
    walkingMinutes: 8,
    transferCount: 1,
    modeledDurationMinutes: 42,
    incentiveTags: ['transit participation rewards', 'green route credits', 'campus commute challenges'],
    baseScore: 45,
  },
  {
    id: 'relay-pasadena-gcc',
    kind: 'relay',
    provider: 'Relay Rider',
    title: 'Pasadena–Glendale planned-route preview',
    subtitle: 'Simulated EV/hybrid planned-route option for a compatible existing commuter pattern',
    startArea: 'Pasadena / Eagle Rock area',
    endArea: 'Glendale Community College area',
    days: 'Weekday demo pattern',
    departureWindow: '7:20–8:20 AM modeled window',
    accessPoint: 'Public corridor Access Point → GCC campus-edge Access Point',
    costLabel: '$0 for eligible college participants',
    benefitLabel: 'Green Route Credits may be available after eligible participation review',
    filters: ['best-fit', 'morning', 'ev-hybrid', 'free-college'],
    status: 'Match preview · review required',
    campusMatches: ['glendale community college', 'gcc'],
    originKeywords: ['pasadena', 'eagle rock', 'glendale'],
    destinationKeywords: ['glendale community college', 'gcc', 'glendale'],
    timeBands: ['morning'],
    walkingMinutes: 7,
    transferCount: 0,
    modeledDurationMinutes: 28,
    incentiveTags: ['green route credits', 'ev / clean-route recognition', 'access point participation rewards', 'campus commute challenges'],
    baseScore: 58,
  },
  {
    id: 'glendale-beeline-gcc',
    kind: 'transit',
    provider: 'Glendale Beeline',
    title: 'Glendale Beeline local connection',
    subtitle: 'Local Glendale transit option with connections to regional services',
    startArea: 'Glendale / regional connection',
    endArea: 'Glendale campus and local destinations',
    days: 'Verify current Beeline timetable',
    departureWindow: 'Varies by route · live schedule not connected',
    accessPoint: 'Glendale Beeline stop or Transportation Center connection',
    costLabel: 'GoPass may provide free rides for students at participating schools; verify eligibility',
    benefitLabel: 'Local transit participation may qualify for campus-sponsored incentives',
    filters: ['transit', 'free-college'],
    sourceUrl: 'https://www.glendaletransit.com/services/beeline-bus',
    sourceLabel: 'Glendale Beeline',
    status: 'External transit option',
    campusMatches: ['glendale community college', 'gcc'],
    originKeywords: ['glendale', 'eagle rock', 'pasadena'],
    destinationKeywords: ['glendale community college', 'gcc', 'glendale'],
    timeBands: ['morning', 'midday', 'evening'],
    walkingMinutes: 7,
    transferCount: 1,
    modeledDurationMinutes: 36,
    incentiveTags: ['transit participation rewards', 'green route credits', 'campus commute challenges'],
    baseScore: 48,
  },
];
