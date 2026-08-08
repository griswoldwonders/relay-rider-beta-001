export type CommuteOptionFilter = 'best-fit' | 'morning' | 'ev-hybrid' | 'transit' | 'free-college';

export interface CommuteFactor {
  label: string;
  value: number;
  detail: string;
}

export interface CommuteOption {
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
  fitScore?: number;
  filters: CommuteOptionFilter[];
  factors?: CommuteFactor[];
  sourceUrl?: string;
  sourceLabel?: string;
  status: string;
}

export const commuteOptions: CommuteOption[] = [
  {
    id: 'relay-pas-gl-01',
    kind: 'relay',
    provider: 'Relay Rider',
    title: 'Planned EV route preview',
    subtitle: 'Simulated commuter option · administrative review required',
    startArea: 'Pasadena',
    endArea: 'Glendale',
    days: 'Mon, Wed, Fri',
    departureWindow: '7:40–8:05 AM',
    accessPoint: 'Memorial Park area',
    costLabel: '$0 for eligible college participants',
    benefitLabel: '+2 Green Route Credits after eligible participation review',
    fitScore: 91,
    filters: ['best-fit', 'morning', 'ev-hybrid', 'free-college'],
    factors: [
      { label: 'Route overlap', value: 94, detail: 'Strong modeled overlap through the Pasadena–Eagle Rock–Glendale corridor' },
      { label: 'Time fit', value: 90, detail: 'Within the selected morning commute window' },
      { label: 'Detour impact', value: 92, detail: 'Modeled four-minute route impact' },
      { label: 'Access Point fit', value: 88, detail: 'Compatible public-location preference' },
      { label: 'Program eligibility', value: 90, detail: 'College-program participation is modeled at no rider charge' },
      { label: 'Verification', value: 92, detail: 'Demo EV profile; administrative review remains required' },
    ],
    status: 'Match preview · review required',
  },
  {
    id: 'metro-180',
    kind: 'transit',
    provider: 'LA Metro',
    title: 'Metro Bus Line 180',
    subtitle: 'Regional bus option serving Pasadena, Eagle Rock, Glendale, and Hollywood',
    startArea: 'Pasadena',
    endArea: 'Eagle Rock / Glendale / Hollywood',
    days: 'Check current Metro schedule',
    departureWindow: 'Multiple daily departures',
    accessPoint: 'Local Metro bus stops along the corridor',
    costLabel: 'Student fare may be $0 with an eligible GoPass',
    benefitLabel: 'Transit participation may qualify for campus or Green Route incentives',
    filters: ['morning', 'transit', 'free-college'],
    sourceUrl: 'https://www.metro.net/riding/schedules-2/',
    sourceLabel: 'LA Metro schedules',
    status: 'External transit option',
  },
  {
    id: 'metro-a-line',
    kind: 'transit',
    provider: 'LA Metro',
    title: 'Metro A Line',
    subtitle: 'Rail option for Pasadena and Highland Park with regional connections',
    startArea: 'Pasadena stations',
    endArea: 'Highland Park / regional connections',
    days: 'Check current Metro schedule',
    departureWindow: 'Frequent rail service',
    accessPoint: 'Memorial Park, Del Mar, Lake, Allen, and other A Line stations',
    costLabel: 'Student fare may be $0 with an eligible GoPass',
    benefitLabel: 'Pair with a local bus, bike, walk, or Access Point connection',
    filters: ['morning', 'transit', 'free-college'],
    sourceUrl: 'https://www.metro.net/riding/schedules-2/',
    sourceLabel: 'LA Metro schedules',
    status: 'External transit option',
  },
  {
    id: 'pasadena-transit',
    kind: 'transit',
    provider: 'Pasadena Transit',
    title: 'Pasadena Transit',
    subtitle: 'Local Pasadena bus service for campus, civic, and neighborhood connections',
    startArea: 'Pasadena / PCC area',
    endArea: 'Local Pasadena destinations',
    days: 'Check current Pasadena Transit schedule',
    departureWindow: 'Varies by route',
    accessPoint: 'Local Pasadena Transit stops',
    costLabel: 'Check student fare or pass eligibility',
    benefitLabel: 'Useful first/last-mile connection to campus and Metro',
    filters: ['transit'],
    sourceUrl: 'https://www.cityofpasadena.net/transportation/transit/pasadena-transit/',
    sourceLabel: 'Pasadena Transit',
    status: 'External transit option',
  },
  {
    id: 'glendale-beeline',
    kind: 'transit',
    provider: 'Glendale Beeline',
    title: 'Glendale Beeline',
    subtitle: 'Local Glendale circulator service with connections to regional Metro routes',
    startArea: 'Glendale',
    endArea: 'Local Glendale destinations / regional connections',
    days: 'Check current Beeline timetable',
    departureWindow: 'Varies by route',
    accessPoint: 'Glendale Beeline stops and Glendale Transportation Center',
    costLabel: 'GoPass provides free rides for students at participating schools',
    benefitLabel: 'Local connection option for Glendale campus and employment trips',
    filters: ['transit', 'free-college'],
    sourceUrl: 'https://www.glendaletransit.com/services/beeline-bus',
    sourceLabel: 'Glendale Beeline',
    status: 'External transit option',
  },
];
