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

export const simulatedCommuterDemand: CommuterDemandZone[] = [];

export const simulatedPlannedRoutes: PlannedRouteBand[] = [];

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
    const destinationLabel = destination?.label ?? 'Unresolved area';

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
