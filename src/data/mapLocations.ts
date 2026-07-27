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

export const corridorPath: [number, number][] = [
  [34.1440003, -118.1185206],
  [34.1477073, -118.1471483],
  [34.137431, -118.2133172],
  [34.1445446, -118.2516793],
  [34.1239105, -118.2585166],
];

export const mapLocations: MapLocation[] = [
  {
    id: 'pcc-colorado-campus',
    name: 'Pasadena City College',
    kind: 'anchor',
    type: 'Campus edge',
    city: 'Pasadena',
    address: '1570 E Colorado Blvd, Pasadena, CA 91106',
    lat: 34.1440003,
    lng: -118.1185206,
    reviewStatus: 'partner-review',
    notes: 'Public campus edge candidate with transit access. A specific connection area has not been approved.',
    sourceLabel: 'Pasadena City College',
    sourceUrl: 'https://www.pasadena.edu/about/directions.php',
  },
  {
    id: 'memorial-park-station',
    name: 'Memorial Park Station',
    kind: 'anchor',
    type: 'Transit station',
    city: 'Pasadena',
    address: '125 E Holly St, Pasadena, CA 91103',
    lat: 34.1477073,
    lng: -118.1471483,
    reviewStatus: 'candidate',
    notes: 'Transit-adjacent candidate in Old Pasadena. Exact meeting area requires field review.',
    sourceLabel: 'LA Metro system map',
    sourceUrl: 'https://www.metro.net/riding/schedules-2/',
  },
  {
    id: 'del-mar-station',
    name: 'Del Mar Station',
    kind: 'anchor',
    type: 'Transit station',
    city: 'Pasadena',
    address: '230 S Raymond Ave, Pasadena, CA 91105',
    lat: 34.1420267,
    lng: -118.1487536,
    reviewStatus: 'candidate',
    notes: 'Transit-adjacent candidate near a city parking garage and public EV charging.',
    sourceLabel: 'Pasadena Water and Power',
    sourceUrl: 'https://pwp.cityofpasadena.net/ev-construction-infrastructure/',
  },
  {
    id: 'eagle-rock-library',
    name: 'Eagle Rock Branch Library',
    kind: 'anchor',
    type: 'Public library',
    city: 'Eagle Rock',
    address: '5027 Caspar Ave, Los Angeles, CA 90041',
    lat: 34.137431,
    lng: -118.2133172,
    reviewStatus: 'partner-review',
    notes: 'Public, area-level candidate with parking and bike-rack access. Library operations must be respected.',
    sourceLabel: 'Los Angeles Public Library',
    sourceUrl: 'https://www.lapl.org/branches/eagle-rock',
  },
  {
    id: 'glendale-central-library',
    name: 'Glendale Central Library',
    kind: 'anchor',
    type: 'Public library',
    city: 'Glendale',
    address: '222 E Harvard St, Glendale, CA 91205',
    lat: 34.1445446,
    lng: -118.2516793,
    reviewStatus: 'partner-review',
    notes: 'Civic-area candidate near transit and public parking. No connection area is approved.',
    sourceLabel: 'City of Glendale Library',
    sourceUrl: 'https://www.eglendalelac.org/central-library',
  },
  {
    id: 'glendale-transportation-center',
    name: 'Glendale Transportation Center',
    kind: 'anchor',
    type: 'Regional transit hub',
    city: 'Glendale',
    address: '400 W Cerritos Ave, Glendale, CA 91204',
    lat: 34.1239105,
    lng: -118.2585166,
    reviewStatus: 'partner-review',
    notes: 'Multimodal public transportation hub. Site rules and a field safety review are required.',
    sourceLabel: 'City of Glendale Transportation',
    sourceUrl: 'https://www.glendaletransit.com/about/glendale-transportation-center',
  },
  {
    id: 'marengo-charging-plaza',
    name: 'Marengo Charging Plaza',
    kind: 'ev-hub',
    type: 'Public fast-charging hub',
    city: 'Pasadena',
    address: '155 E Green St, Pasadena, CA 91105',
    lat: 34.1450151,
    lng: -118.1467117,
    reviewStatus: 'candidate',
    chargerSummary: 'City fast chargers plus Tesla fast chargers; live availability varies.',
    notes: 'Charging infrastructure is verified. Relay Rider meeting use is not approved.',
    sourceLabel: 'Pasadena Water and Power',
    sourceUrl: 'https://pwp.cityofpasadena.net/ev-construction-infrastructure/',
  },
  {
    id: 'shoppers-lane-charging-depot',
    name: "Shopper's Lane Charging Depot",
    kind: 'ev-hub',
    type: 'Public fast-charging hub',
    city: 'Pasadena',
    address: 'Near S Mentor Ave & San Pasqual St, Pasadena, CA 91106',
    lat: 34.136887,
    lng: -118.131018,
    reviewStatus: 'candidate',
    chargerSummary: 'Eight city fast chargers and twelve Tesla fast chargers reported by PWP.',
    notes: 'Charging infrastructure is verified. Map position is an area-level marker for privacy-conscious planning.',
    sourceLabel: 'Pasadena Water and Power',
    sourceUrl: 'https://pwp.cityofpasadena.net/shoppers-lane-electric-vehicle-charging-depot-and-changes-to-ev-rebate-program/',
  },
  {
    id: 'glendale-marketplace-charging',
    name: 'Glendale Marketplace EV Charging',
    kind: 'ev-hub',
    type: 'Public parking-structure charging',
    city: 'Glendale',
    address: '120 S Artsakh St, Glendale, CA 91205',
    lat: 34.145103,
    lng: -118.2534873,
    reviewStatus: 'candidate',
    chargerSummary: 'Twenty-four Level 2 chargers and one DC fast charger reported by the City in 2023.',
    notes: 'Charging infrastructure is verified. Parking rules, access, and charger availability may change.',
    sourceLabel: 'City of Glendale',
    sourceUrl: 'https://www.glendaleca.gov/Home/Components/News/News/8728/16',
  },
];
