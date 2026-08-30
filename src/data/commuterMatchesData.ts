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

// There is no backend endpoint yet that returns real commuter-match records
// (see backend/relay/views.py / backend/relay/urls.py -- there is no
// matches viewset, only Profile/RouteSignal/EVParticipantSignal submission
// endpoints and read-only reference data for RelayZone/Corridor/ChargingHub).
// This file previously shipped ten fully fictional "commuter match" records
// (commented in the source as "synthetic... fictional composites") that
// stood in for that missing backend. They have been removed rather than
// presented to users as if they were real matches. CommuterMatchesScreen
// now renders an explicit "No commuter matches yet" empty state instead of
// fabricating any, until a real matches endpoint exists.
export const commuterMatchTemplates: CommuterMatchTemplate[] = [];
