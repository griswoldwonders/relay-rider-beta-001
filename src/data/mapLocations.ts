export type MapLocationKind = 'anchor' | 'ev-hub' | 'school';

/**
 * official-source: operated/published by the institution, agency, or utility the
 *   location belongs to (a campus, a city utility, a charging network's own listing).
 * directory: a third-party aggregator or advocacy site, not the operator itself.
 * provisional-reference: a general-reference source (e.g. Wikipedia) standing in until
 *   an official-source or directory citation is confirmed.
 */
export type EvidenceSourceType = 'official-source' | 'directory' | 'provisional-reference';

export interface LocationEvidence {
  sourceType: EvidenceSourceType;
  /** ISO date this location's source link/details were last checked in this prototype. */
  checkedOn: string;
}

export interface MapLocation {
  id: string;
  name: string;
  kind: MapLocationKind;
  type: string;
  city: 'Pasadena' | 'Eagle Rock' | 'Glendale' | 'Highland Park' | 'South Pasadena';
  address: string;
  lat: number;
  lng: number;
  reviewStatus: 'candidate' | 'partner-review';
  /** Whether this location is a candidate Access Point (commute-need intake / route
   * registration site), independent of its `kind` or `type` label. EV charging hubs
   * are existing infrastructure, not candidate Access Points. */
  accessPointCandidate: boolean;
  evidence: LocationEvidence;
  notes: string;
  sourceLabel: string;
  sourceUrl: string;
  chargerSummary?: string;
  /** Present only for kind: 'school'. Transit-pass eligibility language is
   * informational and directs the user to verify with the school/agency —
   * Relay Rider does not administer GoPass/U-Pass. */
  transitPassProgram?: {
    label: string;
    summary: string;
  };
}

/** Candidate Access Points, defined by the per-location `accessPointCandidate` flag
 * rather than by matching on `kind`/`type` strings. */
export function selectAccessPointCandidates(locations: MapLocation[]): MapLocation[] {
  return locations.filter(location => location.accessPointCandidate);
}

export const corridorPath: [number, number][] = [
  [34.1636, -118.2437], // Glendale Community College
  [34.1445, -118.2551], // Americana at Brand
  [34.1263, -118.2115], // Occidental College (Eagle Rock)
  [34.1112, -118.1926], // Highland Park Station
  [34.0983, -118.2067], // Southwest Museum Station
  [34.1478, -118.1145], // Pasadena City College
  [34.1445, -118.1445], // Marengo Charging Plaza
  [34.1377, -118.1253], // Caltech
  [34.1327, -118.1436], // Fillmore Station
];

export const mapLocations: MapLocation[] = [
  // --- Schools / campuses (Access Point candidates for institution programs) ---
  {
    id: 'school-pcc',
    name: 'Pasadena City College',
    kind: 'school',
    type: 'Community college campus',
    city: 'Pasadena',
    address: '1570 E. Colorado Blvd, Pasadena, CA 91106',
    lat: 34.1478,
    lng: -118.1145,
    reviewStatus: 'candidate',
    accessPointCandidate: true,
    evidence: { sourceType: 'official-source', checkedOn: '2026-08-26' },
    notes: 'Candidate campus Access Point for commute-need intake and EV/hybrid route registration. Not yet an approved program site.',
    sourceLabel: 'PCC — Directions',
    sourceUrl: 'https://pasadena.edu/about/directions.php',
    chargerSummary: 'On-campus EV charging on the ChargePoint network — 6 dual-port Level 2 stations (12 total charge ports) across Staff Parking Lot 1 (4 ports) and Student Parking Lot 5, Level 3 (4 ports). A ChargePoint RFID card or app is required to start a session; posted pricing is $1.00/hour rising to $2.00/hour after an extended-session threshold. Verify current access rules and pricing with PCC.',
    transitPassProgram: {
      label: 'GoPass (Metro)',
      summary: 'PCC participates in Metro GoPass, giving eligible enrolled students free unlimited rides on Metro bus/rail and several partner transit operators. Verify current eligibility and activation steps with PCC Student Life — Relay Rider does not administer GoPass.',
    },
  },
  {
    id: 'school-caltech',
    name: 'California Institute of Technology (Caltech)',
    kind: 'school',
    type: 'Four-year university campus',
    city: 'Pasadena',
    address: '1200 E. California Blvd, Pasadena, CA 91125',
    lat: 34.1377,
    lng: -118.1253,
    reviewStatus: 'candidate',
    accessPointCandidate: true,
    evidence: { sourceType: 'official-source', checkedOn: '2026-08-26' },
    notes: 'Candidate campus Access Point near the Fillmore Station leg of the corridor. Not yet an approved program site.',
    sourceLabel: 'Caltech Parking & Commuter Services',
    sourceUrl: 'https://parking.caltech.edu/parking-info/electric-car-chargers',
    chargerSummary: 'Large on-campus network managed by an outside vendor, PowerFlex Systems, via a smartphone app (not a self-service ChargePoint network like PCC\'s) — 141 Level 2 chargers and 6 Level 3 (DC fast) chargers across multiple parking garages. A valid Caltech parking permit is required; posted rates are $0.20/kWh for Level 2 and $0.40/kWh for Level 3 (verify current pricing and permit rules with Caltech Parking Services).',
  },
  {
    id: 'school-occidental',
    name: 'Occidental College',
    kind: 'school',
    type: 'Four-year college campus',
    city: 'Eagle Rock',
    address: '1600 Campus Rd, Los Angeles, CA 90041',
    lat: 34.1263,
    lng: -118.2115,
    reviewStatus: 'candidate',
    accessPointCandidate: true,
    evidence: { sourceType: 'official-source', checkedOn: '2026-08-26' },
    notes: 'Candidate campus Access Point in Eagle Rock, between the Pasadena and Glendale legs of the corridor. Not yet an approved program site.',
    sourceLabel: 'Occidental College — Maps & Directions',
    sourceUrl: 'https://www.oxy.edu/contact-us/maps-directions',
    transitPassProgram: {
      label: 'U-Pass (Metro)',
      summary: 'Four-year colleges/universities in LA County can participate in Metro\'s U-Pass program (unlimited Metro bus/rail for a discounted semester fee). Verify whether Occidental currently participates, cost, and enrollment steps with the campus transportation office — Relay Rider does not administer U-Pass.',
    },
  },
  {
    id: 'school-glendale-cc',
    name: 'Glendale Community College',
    kind: 'school',
    type: 'Community college campus',
    city: 'Glendale',
    address: '1500 N. Verdugo Rd, Glendale, CA 91208',
    lat: 34.1636,
    lng: -118.2437,
    reviewStatus: 'candidate',
    accessPointCandidate: true,
    evidence: { sourceType: 'official-source', checkedOn: '2026-08-26' },
    notes: 'Candidate campus Access Point at the Glendale end of the corridor. Not yet an approved program site.',
    sourceLabel: 'Glendale Community College — Home',
    sourceUrl: 'https://www.glendale.edu/index.html',
    transitPassProgram: {
      label: 'GoPass (Metro)',
      summary: 'Community colleges in LA County can participate in Metro\'s GoPass program for free unlimited rides for enrolled students at participating schools. Verify current participation and eligibility with GCC — Relay Rider does not administer GoPass.',
    },
  },

  // --- Metro / transit Access Points ---
  {
    id: 'transit-fillmore',
    name: 'Fillmore Station (Metro A Line)',
    kind: 'anchor',
    type: 'Transit — Metro A Line light rail',
    city: 'Pasadena',
    address: '95 E. Fillmore St, Pasadena, CA 91105',
    lat: 34.1327,
    lng: -118.1436,
    reviewStatus: 'candidate',
    accessPointCandidate: true,
    evidence: { sourceType: 'directory', checkedOn: '2026-08-26' },
    notes: 'A Line light-rail station with on-site parking and bike racks. Candidate Access Point for park-and-ride style route matching. Verify live schedules and service alerts with Metro before travel.',
    sourceLabel: 'Metro — A Line',
    sourceUrl: 'https://foothillgoldline.org/cities_stations/pasadena/',
  },
  {
    id: 'transit-highland-park',
    name: 'Highland Park Station (Metro A Line)',
    kind: 'anchor',
    type: 'Transit — Metro A Line light rail',
    city: 'Highland Park',
    address: '151 N. Avenue 57, Los Angeles, CA 90042',
    lat: 34.1112,
    lng: -118.1926,
    reviewStatus: 'candidate',
    accessPointCandidate: true,
    evidence: { sourceType: 'provisional-reference', checkedOn: '2026-08-26' },
    notes: 'A Line light-rail station roughly midway along the corridor. Candidate Access Point. Verify live schedules and service alerts with Metro before travel.',
    sourceLabel: 'LA Metro — Highland Park Station',
    sourceUrl: 'https://en.wikipedia.org/wiki/Highland_Park_station_(Los_Angeles_Metro)',
  },
  {
    id: 'transit-southwest-museum',
    name: 'Southwest Museum Station (Metro A Line)',
    kind: 'anchor',
    type: 'Transit — Metro A Line light rail',
    city: 'Highland Park',
    address: '4600 Marmion Way, Los Angeles, CA 90065',
    lat: 34.0983,
    lng: -118.2067,
    reviewStatus: 'candidate',
    accessPointCandidate: true,
    evidence: { sourceType: 'provisional-reference', checkedOn: '2026-08-26' },
    notes: 'A Line light-rail station near the western leg of the corridor toward Eagle Rock/Glendale. Candidate Access Point. Verify live schedules and service alerts with Metro before travel.',
    sourceLabel: 'LA Metro / Wikipedia — Southwest Museum Station',
    sourceUrl: 'https://en.wikipedia.org/wiki/Southwest_Museum_station',
  },

  // --- EV / hybrid charging hubs ---
  {
    id: 'ev-hub-marengo-plaza',
    name: 'Marengo Charging Plaza',
    kind: 'ev-hub',
    type: 'Public EV fast-charging hub',
    city: 'Pasadena',
    address: '155 E. Green St, Pasadena, CA 91105',
    lat: 34.1445,
    lng: -118.1445,
    reviewStatus: 'candidate',
    accessPointCandidate: false,
    evidence: { sourceType: 'official-source', checkedOn: '2026-08-26' },
    notes: 'City of Pasadena Water & Power public charging plaza near Old Town/Paseo Colorado. Verify live stall availability and pricing before relying on a charge.',
    sourceLabel: 'Pasadena Water & Power — EV Charging',
    sourceUrl: 'https://pwp.cityofpasadena.net/ev-find-a-charging-station/',
    chargerSummary: 'Multiple DC fast and Level 2 stalls at a City of Pasadena public charging facility.',
  },
  {
    id: 'ev-hub-americana-brand',
    name: 'The Americana at Brand — ChargePoint hub',
    kind: 'ev-hub',
    type: 'Public EV charging hub',
    city: 'Glendale',
    address: '889 Americana Way, Glendale, CA 91210',
    lat: 34.1445,
    lng: -118.2551,
    reviewStatus: 'candidate',
    accessPointCandidate: false,
    evidence: { sourceType: 'directory', checkedOn: '2026-08-26' },
    notes: 'ChargePoint Level 2 charging at The Americana at Brand shopping/retail center. Verify live stall availability and pricing before relying on a charge.',
    sourceLabel: 'ChargePoint — The Americana at Brand',
    sourceUrl: 'https://chargehub.com/en/ev-charging-stations/united-states/california/glendale/the-americana-at-brand/electric-car-stations-near-me?locId=47974',
    chargerSummary: 'ChargePoint Level 2 stalls at a high-traffic Glendale retail destination.',
  },
  {
    id: 'ev-hub-south-pasadena',
    name: 'EVgo — South Pasadena',
    kind: 'ev-hub',
    type: 'Public EV fast-charging hub',
    city: 'South Pasadena',
    address: '820 Mound Ave, South Pasadena, CA 91030',
    lat: 34.1156,
    lng: -118.1553,
    reviewStatus: 'candidate',
    accessPointCandidate: false,
    evidence: { sourceType: 'official-source', checkedOn: '2026-08-26' },
    notes: 'EVgo DC fast-charging stalls just south of the Pasadena corridor leg. Verify live stall availability and pricing before relying on a charge.',
    sourceLabel: 'EVgo — Find a Charger',
    sourceUrl: 'https://www.evgo.com/find-a-charger/ca/south-pasadena/820-mound-ave-204665/',
    chargerSummary: '2 DC fast-charging stalls.',
  },
];
