export type EvidenceState = 'observed' | 'calculated' | 'modeled' | 'unsupported';

export interface PasadenaMetric {
  label: string;
  value: string;
  detail: string;
  evidence: EvidenceState;
}

export interface PasadenaCorridor {
  id: string;
  name: string;
  gasolineSov: number;
  plannedEvRoutes: number;
  availableSeats: number;
  highFitPreviews: number;
  medianDetourMinutes: number;
  medianRouteOverlap: number;
  accessPointCompatible: number;
  scheduleCompatible: number;
  priority: 'High' | 'Medium';
}

export const pasadenaDemoMeta = {
  title: 'Pasadena Clean Commute Demonstration',
  subtitle: 'Synthetic institutional TDM dataset · demonstration environment',
  methodologyVersion: 'Clean commute intervention router v0.1 · SOV-to-EV compatibility v0.1',
  disclaimer:
    'All values on this screen are synthetic demonstration data. Match previews are simulated commuter options and do not guarantee transportation, route operation, acceptance, or measured environmental outcomes.',
};

export const pasadenaMetrics: PasadenaMetric[] = [
  { label: 'Commuters analyzed', value: '500', detail: 'Across city, employer, campus, and hospital demonstration cohorts', evidence: 'observed' },
  { label: 'Gasoline SOV commuters', value: '218', detail: 'Drive-alone + gasoline/diesel baseline records', evidence: 'calculated' },
  { label: 'BEV/PHEV commuters', value: '67', detail: 'Current synthetic clean-vehicle participants', evidence: 'observed' },
  { label: 'Planned EV routes', value: '31', detail: 'Already-planned BEV/PHEV commute routes', evidence: 'observed' },
  { label: 'Available route seats', value: '54', detail: 'Capacity declared on synthetic planned routes', evidence: 'calculated' },
  { label: 'High-fit SOV candidates', value: '46', detail: 'Eligible commuters meeting modeled compatibility threshold', evidence: 'modeled' },
  { label: 'High-priority corridors', value: '4', detail: 'Ranked by demand, EV supply, schedule fit, and detour', evidence: 'modeled' },
  { label: 'Charging-readiness cohort', value: '58', detail: 'Current/future EV demand warranting feasibility investigation', evidence: 'modeled' },
];

export const pasadenaFunnel = [
  { label: 'Gasoline SOV', value: 218 },
  { label: 'Compatible time windows', value: 137 },
  { label: 'Shared corridor with EV supply', value: 82 },
  { label: 'Pass capacity + detour gates', value: 59 },
  { label: 'High-fit previews', value: 46 },
];

export const pasadenaCorridors: PasadenaCorridor[] = [
  { id: 'eagle-rock-pasadena', name: 'Eagle Rock → Pasadena', gasolineSov: 42, plannedEvRoutes: 9, availableSeats: 17, highFitPreviews: 13, medianDetourMinutes: 3.2, medianRouteOverlap: 88, accessPointCompatible: 24, scheduleCompatible: 31, priority: 'High' },
  { id: 'glendale-pasadena', name: 'Glendale → Pasadena', gasolineSov: 51, plannedEvRoutes: 11, availableSeats: 19, highFitPreviews: 16, medianDetourMinutes: 4.1, medianRouteOverlap: 84, accessPointCompatible: 29, scheduleCompatible: 36, priority: 'High' },
  { id: 'highland-park-pasadena', name: 'Highland Park → Pasadena', gasolineSov: 27, plannedEvRoutes: 4, availableSeats: 7, highFitPreviews: 5, medianDetourMinutes: 5.8, medianRouteOverlap: 76, accessPointCompatible: 12, scheduleCompatible: 17, priority: 'Medium' },
  { id: 'alhambra-pasadena', name: 'Alhambra → Pasadena', gasolineSov: 23, plannedEvRoutes: 3, availableSeats: 5, highFitPreviews: 4, medianDetourMinutes: 4.9, medianRouteOverlap: 79, accessPointCompatible: 10, scheduleCompatible: 14, priority: 'Medium' },
];

export const eagleRockDecision = {
  corridor: 'Eagle Rock → Pasadena',
  opportunity: 'High',
  gasolineSov: 42,
  primaryScheduleWindow: '7:30–8:30 AM',
  scheduleCompatible: 31,
  regularParkingUsers: 26,
  plannedRoutes: 9,
  seats: 17,
  recurringRoutes: 8,
  highFit: 13,
  moderateFit: 7,
  unsupported: 22,
  medianDetourMinutes: 3.2,
  medianRouteOverlap: 88,
  accessPointCompatible: 24,
  recommendation: 'Evaluate an institution-sponsored Eagle Rock → Pasadena clean-commute cohort using reviewed Access Points and planned BEV/PHEV routes.',
};

export const chargingReadiness = {
  signal: 'High',
  confidence: 'Moderate',
  currentBevPhev: 67,
  limitedHomeCharging: 29,
  workplaceChargingInterest: 58,
  onsiteThreePlusDays: 44,
  sixPlusHourDwell: 36,
  gasolineSovEvPurchaseInterest: 41,
};
