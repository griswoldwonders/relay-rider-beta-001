export type MapLocationKind = 'anchor' | 'ev-hub';

export interface MapLocation {
  id: string;
  name: string;
  kind: MapLocationKind;
  type: string;
  city: 'Pasadena' | 'Eagle Rock' | 'Glendale';
  address: string;
  lat: number;
  lng: number;
  reviewStatus: 'candidate' | 'partner-review';
  notes: string;
  sourceLabel: string;
  sourceUrl: string;
  chargerSummary?: string;
}

export const corridorPath: [number, number][] = [];

export const mapLocations: MapLocation[] = [];
