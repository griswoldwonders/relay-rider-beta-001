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

export const commuterMatchTemplates: CommuterMatchTemplate[] = [
  {
    id: 'planned-ev-eagle-rock-pcc',
    title: 'Planned EV route A',
    vehicleType: 'EV',
    originArea: 'Eagle Rock',
    destinationArea: 'Pasadena City College',
    originKeywords: ['Eagle Rock', 'Highland Park', 'Glendale'],
    destinationKeywords: ['Pasadena City College', 'PCC', 'Pasadena'],
    campusKeywords: ['Pasadena City College', 'PCC'],
    days: ['Monday', 'Wednesday', 'Friday'],
    timeBand: 'morning',
    departureWindow: '7:35–8:05 AM',
    accessPoint: 'Eagle Rock Plaza area',
    walkingMinutes: 6,
    estimatedDetourMinutes: 4,
    routeOverlapScore: 94,
    baseScore: 88,
    incentiveLabel: '+2 Green Route Credits after eligible participation review',
    status: 'match-preview',
  },
  {
    id: 'planned-hybrid-highland-pcc',
    title: 'Planned hybrid route B',
    vehicleType: 'Hybrid',
    originArea: 'Highland Park',
    destinationArea: 'Pasadena / PCC',
    originKeywords: ['Highland Park', 'Eagle Rock', 'Northeast Los Angeles'],
    destinationKeywords: ['Pasadena City College', 'PCC', 'Pasadena'],
    campusKeywords: ['Pasadena City College', 'PCC', 'Caltech'],
    days: ['Tuesday', 'Thursday'],
    timeBand: 'morning',
    departureWindow: '7:25–8:10 AM',
    accessPoint: 'Highland Park transit area',
    walkingMinutes: 9,
    estimatedDetourMinutes: 6,
    routeOverlapScore: 89,
    baseScore: 84,
    incentiveLabel: 'Clean-route participation may qualify for capped program benefits',
    status: 'match-preview',
  },
  {
    id: 'planned-phev-glendale-pcc',
    title: 'Planned PHEV route C',
    vehicleType: 'PHEV',
    originArea: 'Glendale',
    destinationArea: 'Pasadena',
    originKeywords: ['Glendale', 'Eagle Rock', 'Burbank'],
    destinationKeywords: ['Pasadena', 'Pasadena City College', 'PCC', 'Caltech'],
    campusKeywords: ['Pasadena City College', 'PCC', 'Caltech'],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    timeBand: 'morning',
    departureWindow: '7:20–8:00 AM',
    accessPoint: 'Glendale civic / transit area',
    walkingMinutes: 12,
    estimatedDetourMinutes: 8,
    routeOverlapScore: 82,
    baseScore: 79,
    incentiveLabel: 'Access Point feedback may qualify for a promotional participation benefit',
    status: 'match-preview',
  },
  {
    id: 'planned-ev-pasadena-gcc',
    title: 'Planned EV route D',
    vehicleType: 'EV',
    originArea: 'Pasadena',
    destinationArea: 'Glendale Community College',
    originKeywords: ['Pasadena', 'Eagle Rock'],
    destinationKeywords: ['Glendale Community College', 'GCC', 'Glendale'],
    campusKeywords: ['Glendale Community College', 'GCC'],
    days: ['Monday', 'Wednesday', 'Friday'],
    timeBand: 'morning',
    departureWindow: '7:30–8:15 AM',
    accessPoint: 'Pasadena civic / Metro area',
    walkingMinutes: 10,
    estimatedDetourMinutes: 7,
    routeOverlapScore: 78,
    baseScore: 75,
    incentiveLabel: '+1 Green Route Credit after eligible research participation review',
    status: 'match-preview',
  },
];
