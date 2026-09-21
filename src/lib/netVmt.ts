export type NetVmtEvidenceState = 'modeled' | 'unsupported';
export type NetVmtStatus = 'positive' | 'non_positive' | 'unsupported';

export interface NetVmtInput {
  baselineSovMiles: number | null;
  incrementalEvDetourMiles: number | null;
}

export interface ModeledNetVmtResult {
  baselineSovMiles: number | null;
  incrementalEvDetourMiles: number | null;
  modeledNetVmtAvoided: number | null;
  methodologyVersion: string;
  evidenceState: NetVmtEvidenceState;
  status: NetVmtStatus;
  assumptions: string[];
  limitations: string[];
}

const METHODOLOGY_VERSION = 'Modeled net VMT v0.1';
const roundTenth = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

export function calculateModeledNetVmt({
  baselineSovMiles,
  incrementalEvDetourMiles,
}: NetVmtInput): ModeledNetVmtResult {
  const assumptions = [
    'The baseline gasoline SOV trip is fully displaced for the modeled trip.',
    'The planned BEV/PHEV route would have occurred without Relay Rider participation.',
    'Only the incremental planned-route detour is added to the modeled VMT balance.',
  ];

  if (baselineSovMiles === null || !Number.isFinite(baselineSovMiles) || baselineSovMiles < 0) {
    return {
      baselineSovMiles,
      incrementalEvDetourMiles,
      modeledNetVmtAvoided: null,
      methodologyVersion: METHODOLOGY_VERSION,
      evidenceState: 'unsupported',
      status: 'unsupported',
      assumptions,
      limitations: ['A valid baseline gasoline SOV trip distance is required before Relay Rider can estimate modeled net VMT.'],
    };
  }

  if (incrementalEvDetourMiles === null || !Number.isFinite(incrementalEvDetourMiles) || incrementalEvDetourMiles < 0) {
    return {
      baselineSovMiles,
      incrementalEvDetourMiles,
      modeledNetVmtAvoided: null,
      methodologyVersion: METHODOLOGY_VERSION,
      evidenceState: 'unsupported',
      status: 'unsupported',
      assumptions,
      limitations: ['A valid incremental planned-route detour distance is required before Relay Rider can estimate modeled net VMT.'],
    };
  }

  const modeledNetVmtAvoided = roundTenth(baselineSovMiles - incrementalEvDetourMiles);
  const positive = modeledNetVmtAvoided > 0;

  return {
    baselineSovMiles,
    incrementalEvDetourMiles,
    modeledNetVmtAvoided,
    methodologyVersion: METHODOLOGY_VERSION,
    evidenceState: 'modeled',
    status: positive ? 'positive' : 'non_positive',
    assumptions,
    limitations: positive
      ? [
          'This is a modeled vehicle-mile estimate, not a verified emissions reduction or certified environmental benefit.',
          'Actual outcomes require participant opt-in, administrative review, trip occurrence, and measurement.',
        ]
      : [
          'This modeled scenario does not represent a positive VMT opportunity because incremental planned-route travel is equal to or greater than the displaced gasoline SOV miles.',
          'Actual outcomes require participant opt-in, administrative review, trip occurrence, and measurement.',
        ],
  };
}
