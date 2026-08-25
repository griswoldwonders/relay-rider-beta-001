export type UserRole = 'route-need' | 'ev-participant' | null;

export interface RouteSignal {
  id: string;
  corridor: string;
  startingArea: string;
  destinationArea: string;
  campusAffiliation: string;
  daysOfWeek: string[];
  timeWindow: string;
  routeType: 'recurring' | 'occasional' | 'event' | 'medical' | 'campus' | 'other';
  relayZoneType: string[];
  transitOptions: string[];
  studentTransitPass: 'yes' | 'no' | 'not-sure';
  incentiveInterests: string[];
  evPreference: 'ev-only' | 'hybrid-ev' | 'any';
  maxWalkingDistance: string;
  privacyPreference: string;
  status: 'draft' | 'submitted' | 'in-research' | 'needs-signals' | 'needs-participant' | 'partner-review' | 'legal-review' | 'not-active';
  routeFit: 'high' | 'moderate' | 'low';
  greenRouteCredit: number;
  createdAt: string;
  modeled?: {
    overlapPotential: 'high' | 'medium' | 'low';
    timeCompatibility: 'strong' | 'moderate' | 'needs-data';
    relayZoneFit: 'strong' | 'moderate' | 'needs-review';
    evHybridSupply: 'available' | 'needs-more';
    parkingPressure: 'low' | 'medium' | 'high';
    pilotReadiness: 'research-only' | 'partner-review' | 'not-ready';
  };
}

export interface EVParticipantSignal {
  id: string;
  vehicleType: 'ev' | 'phev' | 'hybrid' | 'other';
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  startingArea: string;
  destinationArea: string;
  travelDays: string[];
  timeWindow: string;
  maxDetour: string;
  relayZoneTypes: string[];
  feedbackCallWilling: boolean;
  reviewsAccepted: string[];
  status: 'submitted' | 'in-review' | 'approved' | 'rejected';
  createdAt: string;
}

export interface RelayZone {
  id: string;
  name: string;
  type: string;
  corridor: string;
  address: string;
  reviewStatus: 'candidate' | 'needs-partner' | 'needs-safety' | 'needs-property' | 'needs-legal' | 'not-approved';
  suggestedByCount: number;
  partnerReviewNeeded: boolean;
  safetyReviewNeeded: boolean;
  propertyReviewNeeded: boolean;
  notes: string;
}

export interface CorridorData {
  id: string;
  name: string;
  routeSignals: number;
  evParticipants: number;
  relayZones: number;
  parkingPressure: 'low' | 'medium-high' | 'high';
  pilotReadiness: 'research' | 'partner-review' | 'needs-legal' | 'future';
}

export interface GreenRouteCredit {
  id: string;
  activity: string;
  amount: number;
  status: 'pending' | 'approved' | 'redeemed' | 'expired';
  date: string;
}

export type RedemptionRequestStatus = 'requested' | 'under-review' | 'fulfilled' | 'denied';

export interface ChargingHub {
  id: string;
  name: string;
  network: string;
  city: string;
  stalls: number;
  connectorTypes: string[];
  status: 'candidate' | 'verified' | 'active';
  evidenceLabel: 'synthetic' | 'modeled' | 'verified';
}

export interface RedemptionRequest {
  id: string;
  creditId: string;
  participantId: string;
  chargingHubId: string;
  requestedUnits: number;
  unitLabel: string;
  status: RedemptionRequestStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  adultConfirmed: boolean;
  researchConsentGiven: boolean;
  preferredCorridor: string;
  preferredRelayZoneType: string;
  evHybridPreference: string;
  privacyPreference: string;
  notificationPreference: boolean;
}
