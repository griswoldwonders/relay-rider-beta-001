export type MarketplaceFilter = 'best-fit' | 'morning' | 'ev-only' | 'low-detour';

export interface MatchFactor {
  label: string;
  value: number;
  detail: string;
}

export interface MarketplaceMatch {
  id: string;
  driverFirstName: string;
  vehicle: string;
  vehicleStatus: 'EV' | 'PHEV' | 'Hybrid';
  startArea: string;
  endArea: string;
  days: string;
  departureWindow: string;
  seats: number;
  detourMinutes: number;
  anchorPoint: string;
  suggestedContribution: number;
  totalScore: number;
  filters: MarketplaceFilter[];
  factors: MatchFactor[];
  adminStatus: 'Pilot Review Required' | 'Pending Verification';
}

export const marketplaceMatches: MarketplaceMatch[] = [
  {
    id: 'match-pas-gl-01',
    driverFirstName: 'Maya',
    vehicle: 'Hyundai Ioniq 5',
    vehicleStatus: 'EV',
    startArea: 'Pasadena',
    endArea: 'Glendale',
    days: 'Mon, Wed, Fri',
    departureWindow: '7:40–8:05 AM',
    seats: 2,
    detourMinutes: 4,
    anchorPoint: 'Memorial Park Station',
    suggestedContribution: 8,
    totalScore: 91,
    filters: ['best-fit', 'morning', 'ev-only', 'low-detour'],
    factors: [
      { label: 'Route overlap', value: 94, detail: 'Strong overlap through Eagle Rock' },
      { label: 'Time fit', value: 90, detail: 'Within the selected morning window' },
      { label: 'Detour impact', value: 92, detail: 'Modeled four-minute route impact' },
      { label: 'Anchor Point fit', value: 88, detail: 'Shared public-location preference' },
      { label: 'Bid signal', value: 87, detail: 'Suggested contribution aligns with route value' },
      { label: 'Verification', value: 92, detail: 'Demo EV profile; admin review still required' },
    ],
    adminStatus: 'Pilot Review Required',
  },
  {
    id: 'match-er-gl-02',
    driverFirstName: 'Andre',
    vehicle: 'Toyota RAV4 Prime',
    vehicleStatus: 'PHEV',
    startArea: 'Eagle Rock',
    endArea: 'Glendale',
    days: 'Tue, Thu',
    departureWindow: '8:00–8:30 AM',
    seats: 1,
    detourMinutes: 6,
    anchorPoint: 'Eagle Rock Branch Library',
    suggestedContribution: 6,
    totalScore: 84,
    filters: ['best-fit', 'morning'],
    factors: [
      { label: 'Route overlap', value: 89, detail: 'Direct shared corridor segment' },
      { label: 'Time fit', value: 82, detail: 'Partial fit with the selected window' },
      { label: 'Detour impact', value: 80, detail: 'Modeled six-minute route impact' },
      { label: 'Anchor Point fit', value: 90, detail: 'Same public Anchor Point preference' },
      { label: 'Bid signal', value: 81, detail: 'Suggested contribution is near route target' },
      { label: 'Verification', value: 80, detail: 'PHEV profile pending pilot verification' },
    ],
    adminStatus: 'Pending Verification',
  },
  {
    id: 'match-pcc-gl-03',
    driverFirstName: 'Jordan',
    vehicle: 'Kia Niro',
    vehicleStatus: 'Hybrid',
    startArea: 'PCC area',
    endArea: 'Glendale',
    days: 'Weekdays',
    departureWindow: '5:10–5:45 PM',
    seats: 2,
    detourMinutes: 8,
    anchorPoint: 'Pasadena City College',
    suggestedContribution: 7,
    totalScore: 76,
    filters: [],
    factors: [
      { label: 'Route overlap', value: 82, detail: 'Moderate corridor overlap' },
      { label: 'Time fit', value: 74, detail: 'Evening window only' },
      { label: 'Detour impact', value: 70, detail: 'Modeled eight-minute route impact' },
      { label: 'Anchor Point fit', value: 84, detail: 'Campus-edge preference aligns' },
      { label: 'Bid signal', value: 78, detail: 'Suggested contribution aligns with route value' },
      { label: 'Verification', value: 68, detail: 'Hybrid profile pending verification' },
    ],
    adminStatus: 'Pending Verification',
  },
];
