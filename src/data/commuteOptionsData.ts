export type CommuteOptionFilter = 'best-fit' | 'morning' | 'ev-hybrid' | 'transit' | 'free-college';

export type CommuteTimeBand = 'morning' | 'midday' | 'evening' | 'any';

export interface CommuteOptionTemplate {
  id: string;
  kind: 'relay' | 'transit';
  provider: string;
  title: string;
  subtitle: string;
  startArea: string;
  endArea: string;
  days: string;
  departureWindow: string;
  accessPoint: string;
  costLabel: string;
  benefitLabel?: string;
  filters: CommuteOptionFilter[];
  sourceUrl?: string;
  sourceLabel?: string;
  status: string;
  campusMatches: string[];
  originKeywords: string[];
  destinationKeywords: string[];
  timeBands: CommuteTimeBand[];
  walkingMinutes: number;
  transferCount: number;
  modeledDurationMinutes: number;
  incentiveTags: string[];
  baseScore: number;
}

export const commuteOptions: CommuteOptionTemplate[] = [];
