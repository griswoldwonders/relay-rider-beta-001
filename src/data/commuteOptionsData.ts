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

// Real, source-verified local transit lines (see each entry's sourceUrl).
// Relay Rider "planned-route" previews (kind: 'relay') are intentionally NOT
// included here: there is no backend endpoint yet that returns real
// participant-planned routes (see backend/relay/views.py /
// backend/relay/urls.py -- Corridor is the closest model, but it does not
// carry the schedule/Access Point/cost fields this UI needs). Previously
// this file also shipped four fictional 'relay-*' template entries
// (fabricated schedules, Access Points, and scores) that stood in for that
// missing backend data; they have been removed rather than presented as if
// real. CommuteOptionsScreen shows an explicit empty-state note for the
// relay/planned-route category until a real endpoint exists.
export const commuteOptions: CommuteOptionTemplate[] = [
  // --- Local transit (real operators; verify schedules/fares directly) ---
  {
    id: 'transit-metro-a-line-fillmore-pcc',
    kind: 'transit',
    provider: 'LA Metro',
    title: 'Metro A Line — Fillmore Station to PCC',
    subtitle: 'Light rail with a short walk/connection to campus',
    startArea: 'Highland Park',
    endArea: 'Pasadena City College',
    days: 'Daily',
    departureWindow: 'Every 6–12 min, peak service',
    accessPoint: 'Fillmore Station (Metro A Line)',
    costLabel: 'Standard Metro fare; GoPass may apply for eligible PCC students',
    filters: ['transit', 'morning'],
    sourceUrl: 'https://www.metro.net/riding/schedules/',
    sourceLabel: 'LA Metro — Schedules',
    status: 'match-preview',
    campusMatches: ['Pasadena City College', 'PCC'],
    originKeywords: ['highland park', 'pasadena'],
    destinationKeywords: ['pasadena city college', 'pcc'],
    timeBands: ['any'],
    walkingMinutes: 12,
    transferCount: 0,
    modeledDurationMinutes: 24,
    incentiveTags: [],
    baseScore: 58,
  },
  {
    id: 'transit-metro-a-line-southwest-museum-occidental',
    kind: 'transit',
    provider: 'LA Metro',
    title: 'Metro A Line — Southwest Museum Station to Occidental',
    subtitle: 'Light rail with a walk to the Eagle Rock campus',
    startArea: 'Highland Park',
    endArea: 'Occidental College',
    days: 'Daily',
    departureWindow: 'Every 6–12 min, peak service',
    accessPoint: 'Southwest Museum Station (Metro A Line)',
    costLabel: 'Standard Metro fare; U-Pass may apply where offered',
    filters: ['transit'],
    sourceUrl: 'https://www.metro.net/riding/schedules/',
    sourceLabel: 'LA Metro — Schedules',
    status: 'match-preview',
    campusMatches: ['Occidental College', 'Occidental'],
    originKeywords: ['highland park'],
    destinationKeywords: ['occidental', 'eagle rock'],
    timeBands: ['any'],
    walkingMinutes: 15,
    transferCount: 0,
    modeledDurationMinutes: 20,
    incentiveTags: [],
    baseScore: 54,
  },
  {
    id: 'transit-metro-bus-180-colorado',
    kind: 'transit',
    provider: 'LA Metro',
    title: 'Metro Bus Line 180 — Colorado Blvd corridor',
    subtitle: 'Local bus service along Colorado Blvd toward PCC and Caltech',
    startArea: 'Eagle Rock',
    endArea: 'Pasadena City College',
    days: 'Daily',
    departureWindow: 'Every 10–20 min, peak service',
    accessPoint: 'Colorado Blvd bus stops',
    costLabel: 'Standard Metro fare; GoPass may apply for eligible students',
    filters: ['transit', 'morning'],
    sourceUrl: 'https://www.metro.net/riding/schedules/',
    sourceLabel: 'LA Metro — Bus Line 180',
    status: 'match-preview',
    campusMatches: ['Pasadena City College', 'PCC', 'Caltech'],
    originKeywords: ['eagle rock'],
    destinationKeywords: ['pasadena city college', 'pcc', 'caltech'],
    timeBands: ['any'],
    walkingMinutes: 8,
    transferCount: 0,
    modeledDurationMinutes: 30,
    incentiveTags: [],
    baseScore: 50,
  },
  {
    id: 'transit-pasadena-transit-pcc-caltech',
    kind: 'transit',
    provider: 'Pasadena Transit',
    title: 'Pasadena Transit local route — PCC to Caltech',
    subtitle: 'City circulator connecting PCC, Old Town, and Caltech',
    startArea: 'Pasadena City College',
    endArea: 'Caltech',
    days: 'Mon–Sat',
    departureWindow: 'Every 15–30 min',
    accessPoint: 'PCC transit stop',
    costLabel: 'Local Pasadena Transit fare; verify current rate',
    filters: ['transit'],
    sourceUrl: 'https://www.cityofpasadena.net/transportation/pasadena-transit/',
    sourceLabel: 'City of Pasadena — Pasadena Transit',
    status: 'match-preview',
    campusMatches: ['Pasadena City College', 'PCC', 'Caltech'],
    originKeywords: ['pasadena city college', 'pcc', 'pasadena'],
    destinationKeywords: ['caltech'],
    timeBands: ['any'],
    walkingMinutes: 6,
    transferCount: 0,
    modeledDurationMinutes: 14,
    incentiveTags: [],
    baseScore: 52,
  },
  {
    id: 'transit-glendale-beeline-gcc',
    kind: 'transit',
    provider: 'Glendale Beeline',
    title: 'Glendale Beeline — local route to GCC',
    subtitle: 'City circulator serving Glendale Community College',
    startArea: 'Glendale',
    endArea: 'Glendale Community College',
    days: 'Mon–Sat',
    departureWindow: 'Every 20–30 min',
    accessPoint: 'Glendale Community College transit stop',
    costLabel: 'Local Beeline fare; GoPass may apply for eligible students',
    filters: ['transit'],
    sourceUrl: 'https://www.glendaleca.gov/government/departments/public-works/glendale-beeline',
    sourceLabel: 'City of Glendale — Beeline',
    status: 'match-preview',
    campusMatches: ['Glendale Community College', 'GCC'],
    originKeywords: ['glendale'],
    destinationKeywords: ['glendale community college', 'gcc'],
    timeBands: ['any'],
    walkingMinutes: 7,
    transferCount: 0,
    modeledDurationMinutes: 16,
    incentiveTags: [],
    baseScore: 51,
  },
];
