export type ImpactMetricStatus = 'Pilot estimate' | 'Demo metric' | 'Research signal';

export interface ImpactMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  description: string;
  status: ImpactMetricStatus;
  progress: number;
}

export const impactMetrics: ImpactMetric[] = [
  {
    id: 'avoided-miles',
    label: 'Estimated avoided miles',
    value: '286',
    unit: 'vehicle miles / month',
    description: 'Modeled from 22 shared-route opportunities replacing a duplicate drive on the pilot corridor.',
    status: 'Pilot estimate',
    progress: 64,
  },
  {
    id: 'emissions',
    label: 'Estimated emissions reduction',
    value: '92',
    unit: 'kg CO₂e / month',
    description: 'Illustrative avoided tailpipe emissions using a planning assumption of 0.32 kg CO₂e per avoided mile.',
    status: 'Pilot estimate',
    progress: 52,
  },
  {
    id: 'ev-share',
    label: 'EV/hybrid planned-route share',
    value: '78',
    unit: '% of demo route posts',
    description: 'Share of sample planned-route posts identified as battery electric, plug-in hybrid, or hybrid.',
    status: 'Demo metric',
    progress: 78,
  },
  {
    id: 'access-points',
    label: 'Access Point usage',
    value: '86',
    unit: '% of match previews',
    description: 'Share of modeled match previews using a public Access Point instead of an exact home location.',
    status: 'Research signal',
    progress: 86,
  },
];

export const impactMethodology = [
  '22 modeled shared-route opportunities in the Pasadena–Eagle Rock–Glendale demonstration corridor',
  '13 average avoided duplicate-drive miles per modeled opportunity',
  '0.32 kg CO₂e planning factor per avoided vehicle mile',
  'No lifecycle, charging-source, induced-travel, or rebound adjustment is included',
];
