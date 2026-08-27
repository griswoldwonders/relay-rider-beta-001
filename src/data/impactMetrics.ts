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

export const impactMetrics: ImpactMetric[] = [];

export const impactMethodology = [
  '22 modeled shared-route opportunities in the Pasadena–Eagle Rock–Glendale demonstration corridor',
  '13 average avoided duplicate-drive miles per modeled opportunity',
  '0.32 kg CO₂e planning factor per avoided vehicle mile',
  'No lifecycle, charging-source, induced-travel, or rebound adjustment is included',
];
