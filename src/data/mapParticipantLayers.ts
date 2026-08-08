import { EVParticipantSignal, RouteSignal } from '../types';

export interface CommuterDemandZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  commuterCount: number;
  peakWindow: string;
  accessPointWillingCount: number;
  evHybridPreferenceCount: number;
  parkingPressure: 'low' | 'medium' | 'high';
  topDestinations: string[];
  source: 'simulated' | 'session';
}

export interface PlannedRouteBand {
  id: string;
  name: string;
  path: [number, number][];
  routeCount: number;
  evCount: number;
  hybridCount: number;
  peakWindow: string;
  detourLabel: string;
  accessPointCandidateCount: number;
  capacityLabel: string;
  source: 'simulated' | 'session';
}

export const simulatedCommuterDemand: CommuterDemandZone[] = [
  {
    id: 'demand-pasadena-east',
    name: 'Pasadena East / PCC area',
    lat: 34.144,
    lng: -118.1185,
    commuterCount: 12,
    peakWindow: '7:30–8:30 AM',
    accessPointWillingCount: 8,
    evHybridPreferenceCount: 7,
    parkingPressure: 'high',
    topDestinations: ['Glendale', 'Eagle Rock', 'PCC area'],
    source: 'simulated',
  },
  {
    id: 'demand-pasadena-central',
    name: 'Central Pasadena',
    lat: 34.1454,
    lng: -118.149,
    commuterCount: 10,
    peakWindow: '7:00–9:00 AM',
    accessPointWillingCount: 7,
    evHybridPreferenceCount: 6,
    parkingPressure: 'medium',
    topDestinations: ['Glendale', 'Eagle Rock', 'Pasadena campuses'],
    source: 'simulated',
  },
  {
    id: 'demand-eagle-rock',
    name: 'Eagle Rock',
    lat: 34.1374,
    lng: -118.2133,
    commuterCount: 9,
    peakWindow: '7:30–9:00 AM',
    accessPointWillingCount: 6,
    evHybridPreferenceCount: 5,
    parkingPressure: 'medium',
    topDestinations: ['Pasadena', 'Glendale', 'PCC area'],
    source: 'simulated',
  },
  {
    id: 'demand-glendale-central',
    name: 'Central Glendale',
    lat: 34.145,
    lng: -118.252,
    commuterCount: 11,
    peakWindow: '7:00–8:30 AM',
    accessPointWillingCount: 8,
    evHybridPreferenceCount: 7,
    parkingPressure: 'high',
    topDestinations: ['Pasadena', 'Eagle Rock', 'Glendale campuses'],
    source: 'simulated',
  },
];

export const simulatedPlannedRoutes: PlannedRouteBand[] = [
  {
    id: 'planned-pasadena-glendale',
    name: 'Pasadena → Eagle Rock → Glendale',
    path: [
      [34.144, -118.1185],
      [34.1477, -118.1471],
      [34.1374, -118.2133],
      [34.1445, -118.2517],
    ],
    routeCount: 8,
    evCount: 6,
    hybridCount: 2,
    peakWindow: '7:00–9:00 AM',
    detourLabel: 'Typical stated tolerance: 5–10 min',
    accessPointCandidateCount: 5,
    capacityLabel: 'Capacity not yet operationally verified',
    source: 'simulated',
  },
  {
    id: 'planned-eagle-rock-pasadena',
    name: 'Eagle Rock → Pasadena',
    path: [
      [34.1374, -118.2133],
      [34.1429, -118.177],
      [34.1454, -118.149],
      [34.144, -118.1185],
    ],
    routeCount: 6,
    evCount: 4,
    hybridCount: 2,
    peakWindow: '7:30–9:00 AM',
    detourLabel: 'Typical stated tolerance: 5–10 min',
    accessPointCandidateCount: 4,
    capacityLabel: 'Capacity not yet operationally verified',
    source: 'simulated',
  },
  {
    id: 'planned-glendale-pasadena',
    name: 'Glendale → Pasadena',
    path: [
      [34.1445, -118.2517],
      [34.1374, -118.2133],
      [34.1454, -118.149],
    ],
    routeCount: 4,
    evCount: 3,
    hybridCount: 1,
    peakWindow: '4:30–6:30 PM',
    detourLabel: 'Typical stated tolerance: 5–15 min',
    accessPointCandidateCount: 4,
    capacityLabel: 'Capacity not yet operationally verified',
    source: 'simulated',
  },
];

const areaCentroids: Array<{ terms: string[]; point: [number, number]; label: string }> = [
  { terms: ['pcc', 'pasadena city college'], point: [34.144, -118.1185], label: 'PCC area' },
  { terms: ['caltech'], point: [34.1377, -118.1253], label: 'Caltech area' },
  { terms: ['pasadena'], point: [34.1454, -118.149], label: 'Pasadena' },
  { terms: ['eagle rock'], point: [34.1374, -118.2133], label: 'Eagle Rock' },
  { terms: ['glendale transportation'], point: [34.1239, -118.2585], label: 'Glendale Transportation Center area' },
  { terms: ['glendale'], point: [34.145, -118.252], label: 'Glendale' },
];

function resolveArea(value: string): { point: [number, number]; label: string } | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  return areaCentroids.find(area => area.terms.some(term => normalized.includes(term))) ?? null;
}

export function sessionDemandZones(signals: RouteSignal[]): CommuterDemandZone[] {
  return signals.flatMap(signal => {
    const start = resolveArea(signal.startingArea);
    if (!start) return [];

    const destination = resolveArea(signal.destinationArea);
    const accessPointWilling = signal.relayZoneType.length > 0 ? 1 : 0;
    const evPreference = signal.evPreference === 'any' ? 0 : 1;
    const destinationLabel = destination?.label ?? (signal.destinationArea || 'Destination area not resolved');

    return [{
      id: `session-demand-${signal.id}`,
      name: `${start.label} · your session signal`,
      lat: start.point[0],
      lng: start.point[1],
      commuterCount: 1,
      peakWindow: signal.timeWindow || 'Time window not provided',
      accessPointWillingCount: accessPointWilling,
      evHybridPreferenceCount: evPreference,
      parkingPressure: signal.modeled?.parkingPressure ?? 'medium',
      topDestinations: [destinationLabel],
      source: 'session' as const,
    }];
  });
}

export function sessionPlannedRoutes(signals: EVParticipantSignal[]): PlannedRouteBand[] {
  return signals.flatMap(signal => {
    const start = resolveArea(signal.startingArea);
    const destination = resolveArea(signal.destinationArea);
    if (!start || !destination) return [];

    const vehicleIsEv = signal.vehicleType === 'ev';
    const vehicleIsHybrid = signal.vehicleType === 'phev' || signal.vehicleType === 'hybrid';

    return [{
      id: `session-planned-${signal.id}`,
      name: `${start.label} → ${destination.label} · your session route`,
      path: [start.point, destination.point],
      routeCount: 1,
      evCount: vehicleIsEv ? 1 : 0,
      hybridCount: vehicleIsHybrid ? 1 : 0,
      peakWindow: signal.timeWindow || 'Time window not provided',
      detourLabel: signal.maxDetour ? `Stated detour comfort: ${signal.maxDetour}` : 'Detour comfort not provided',
      accessPointCandidateCount: signal.relayZoneTypes.length,
      capacityLabel: 'Available capacity is not collected in the current intake flow',
      source: 'session' as const,
    }];
  });
}
