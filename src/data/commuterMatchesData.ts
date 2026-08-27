export type MatchVehicleType = 'EV' | 'PHEV' | 'Hybrid';

export interface CommuterMatchTemplate {
  id: string;
  title: string;
  vehicleType: MatchVehicleType;
  originArea: string;
  destinationArea: string;
  originKeywords: string[];
  destinationKeywords: string[];
  campusKeywords: string[];
  days: string[];
  timeBand: 'morning' | 'midday' | 'evening';
  departureWindow: string;
  accessPoint: string;
  walkingMinutes: number;
  estimatedDetourMinutes: number;
  routeOverlapScore: number;
  baseScore: number;
  incentiveLabel?: string;
  status: 'match-preview';
}

// 50 mock commuter route templates for research-beta demo purposes.
// Synthetic data only — no real participant information.
export const commuterMatchTemplates: CommuterMatchTemplate[] = [];
