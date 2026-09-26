export const PROGRAM = Object.freeze({
  name: 'Pasadena–Glendale Clean Commute Pilot',
  sponsor: 'Pasadena Corridor Employer Coalition',
  participant: 'Maya Chen',
  participantStatus: 'Eligible — Active',
  monthlyBenefitCents: 3000,
  monthlyKwhTenths: 500,
  sessionCapCents: 1200,
  period: '2026-09',
  resetLabel: 'Fixed September 2026 demo period — reset manually',
  demoVoucherCode: 'RR-PGC-9A7K-2026',
  demoVoucherExpiry: 'October 31, 2026',
});

export type PartnerSite = {
  id: string;
  name: string;
  networkLabel: string;
  chargers: number;
  level: string;
  hours: string;
  eligibility: string;
  corridor: string;
};

export const PARTNER_SITES: readonly PartnerSite[] = Object.freeze([
  {
    id: 'site-pasadena-transit',
    name: 'Pasadena Transit Hub Charging',
    networkLabel: 'Demo partner network',
    chargers: 8,
    level: 'DCFC + Level 2',
    hours: 'Weekdays 5:00 a.m.–10:00 p.m. · public access during posted hours',
    eligibility: 'Eligible partner site',
    corridor: 'Pasadena transit corridor',
  },
  {
    id: 'site-glendale-workplace',
    name: 'Glendale Workplace Charging Center',
    networkLabel: 'Demo partner network',
    chargers: 12,
    level: 'Level 2',
    hours: 'Employer-site access for enrolled staff, weekdays',
    eligibility: 'Eligible partner site',
    corridor: 'Glendale workplace corridor',
  },
  {
    id: 'site-eagle-rock',
    name: 'Eagle Rock Community Access Point',
    networkLabel: 'Demo partner network',
    chargers: 4,
    level: 'Level 2',
    hours: 'Shared community access, weekday commute window',
    eligibility: 'Eligible partner site',
    corridor: 'Eagle Rock / northeast corridor',
  },
]);

export const LEDGER_STATUSES = Object.freeze({
  issued: 'issued',
  pending: 'pending',
  approved: 'approved',
  redeemed: 'redeemed',
  reversed: 'reversed',
  expired: 'expired',
  declined: 'declined',
  flagged: 'flagged',
});

export type LedgerStatus = (typeof LEDGER_STATUSES)[keyof typeof LEDGER_STATUSES];

export type ClaimEstimate = {
  energyChargeCents: number;
  excludedCents: number;
  eligibleEnergyCents: number;
  sessionCapCents: number;
  estimatedCents: number;
};

export type LedgerEntry = {
  id: string;
  date: string;
  eventType: string;
  source: string;
  kwhTenths: number;
  amountCents: number;
  signedCents: number;
  status: LedgerStatus;
  referenceId: string;
  detail: string;
  network?: string;
  estimate?: ClaimEstimate;
  reviewNote?: string;
};

export type Campaign = {
  id: string;
  name: string;
  status: string;
  monthlyCapCents: number;
  sessionCapCents: number;
  weekdayOnly: boolean;
  sites: string[];
};

export type ReviewEvent = {
  claimId: string;
  from: LedgerStatus | null;
  to: LedgerStatus;
  note: string;
};

export type ProgramState = {
  ledger: LedgerEntry[];
  // Status projections live only in ledger; decision evidence is append-only until reset.
  reviewEvents: ReviewEvent[];
  campaigns: Campaign[];
};

export function dollars(cents: number) {
  const value = Number(cents) || 0;
  const sign = value < 0 ? '-' : '';
  return `${sign}$${(Math.abs(value) / 100).toFixed(2)}`;
}

export function kwhLabel(tenths: number) {
  const whole = Math.trunc(Number(tenths) / 10);
  const frac = Math.abs(Number(tenths) % 10);
  return frac ? `${whole}.${frac}` : String(whole);
}

function parseUnits(value: unknown, precision: number): number | null {
  const text = String(value ?? '').trim();
  const pattern = precision === 1 ? /^\d+(\.\d)?$/ : /^\d+(\.\d{1,2})?$/;
  if (!pattern.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const units = Number(whole) * 10 ** precision + Number(fraction.padEnd(precision, '0'));
  return Number.isSafeInteger(units) ? units : null;
}

export function parseKwhToTenths(value: unknown) {
  return parseUnits(value, 1);
}

export function parseMoneyToCents(value: unknown) {
  return parseUnits(String(value ?? '').trim().replace(/^\$/, ''), 2);
}

export function isWeekdayIsoDate(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || isoDate.startsWith('0000')) return false;
  const utc = new Date(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== isoDate) return false;
  const weekday = utc.getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function seedLedger(): LedgerEntry[] {
  return [
    {
      id: 'grc-iss-0901',
      date: '2026-09-01',
      eventType: 'Monthly sponsor benefit issued',
      source: 'Program allocation · Demo data',
      kwhTenths: 0,
      amountCents: 3000,
      signedCents: 3000,
      status: LEDGER_STATUSES.issued,
      referenceId: 'PGC-ISS-2026-09',
      detail: 'Simulated September allocation. Not cash or stored value.',
    },
    {
      id: 'grc-vch-0908',
      date: '2026-09-08',
      eventType: 'Partner voucher redemption',
      source: 'Pasadena Transit Hub Charging · Demo partner network',
      kwhTenths: 82,
      amountCents: 640,
      signedCents: -640,
      status: LEDGER_STATUSES.redeemed,
      referenceId: 'RR-PGC-9A7K-2026',
      detail: 'Simulated partner voucher. Not redeemable on a live network.',
    },
    {
      id: 'grc-clm-0911',
      date: '2026-09-11',
      eventType: 'Verified charging claim',
      source: 'Glendale Workplace Charging Center · generalized workplace corridor',
      kwhTenths: 104,
      amountCents: 900,
      signedCents: -900,
      status: LEDGER_STATUSES.approved,
      referenceId: 'CLM-0911-MAYA',
      detail: 'Demo claim approved in prototype review. Employer reporting remains aggregate.',
    },
    {
      id: 'grc-clm-0914',
      date: '2026-09-14',
      eventType: 'Charging claim',
      source: 'Other approved public network · Pasadena corridor',
      kwhTenths: 96,
      amountCents: 1200,
      signedCents: 0,
      status: LEDGER_STATUSES.pending,
      referenceId: 'CLM-0914-MAYA',
      detail: 'Pending administrative review. Pending amounts are not guaranteed.',
    },
  ];
}

export function remainingFromLedger(
  entries: LedgerEntry[],
  monthlyCents = PROGRAM.monthlyBenefitCents,
  monthlyKwhTenths = PROGRAM.monthlyKwhTenths,
) {
  const consumed = entries.filter(row => row.status === 'redeemed' || row.status === 'approved');
  const held = entries.filter(row => row.status === 'pending' || row.status === 'flagged');
  const sum = (rows: LedgerEntry[], key: 'amountCents' | 'kwhTenths') => rows.reduce((total, row) => total + row[key], 0);
  const consumedCents = sum(consumed, 'amountCents');
  const consumedKwhTenths = sum(consumed, 'kwhTenths');
  const heldCents = sum(held, 'amountCents');
  const heldKwhTenths = sum(held, 'kwhTenths');
  return {
    remainingCents: monthlyCents - consumedCents - heldCents,
    remainingKwhTenths: monthlyKwhTenths - consumedKwhTenths - heldKwhTenths,
    consumedCents, consumedKwhTenths, heldCents, heldKwhTenths,
  };
}

export function estimateClaim({
  energyChargeCents,
  idleFeeCents = 0,
  parkingFeeCents = 0,
  taxCents = 0,
  remainingCents,
  sessionCapCents = PROGRAM.sessionCapCents,
}: {
  energyChargeCents: number;
  idleFeeCents?: number;
  parkingFeeCents?: number;
  taxCents?: number;
  remainingCents: number;
  sessionCapCents?: number;
}): ClaimEstimate {
  const values = [energyChargeCents, idleFeeCents, parkingFeeCents, taxCents, remainingCents, sessionCapCents];
  const excludedCents = idleFeeCents + parkingFeeCents + taxCents;
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)
    || energyChargeCents === 0 || sessionCapCents === 0
    || !Number.isSafeInteger(energyChargeCents + excludedCents)) {
    throw new Error('Amounts must be safe integer cents, with positive energy and session cap.');
  }
  const eligibleEnergyCents = Math.max(0, energyChargeCents);
  const afterSessionCap = Math.min(eligibleEnergyCents, sessionCapCents);
  const estimatedCents = Math.min(afterSessionCap, Math.max(0, remainingCents));
  return {
    energyChargeCents,
    excludedCents,
    eligibleEnergyCents,
    sessionCapCents,
    estimatedCents,
  };
}

export type ClaimFormInput = {
  receiptId?: string;
  idleFee?: string;
  parkingFee?: string;
  tax?: string;
  note?: string;
  network?: string;
  locationName?: string;
  cityCorridor?: string;
  sessionDate?: string;
  startTime?: string;
  energyKwh?: string;
  energyCharge?: string;
  commuteRelated?: boolean;
  exclusionsAcknowledged?: boolean;
};

export function validateClaimForm(input: ClaimFormInput) {
  const errors: string[] = [];
  if (!input.network) errors.push('Select a charging network.');
  if (!String(input.locationName || '').trim()) errors.push('Enter a charging location name.');
  if (!String(input.cityCorridor || '').trim()) errors.push('Enter a city or corridor.');
  if (!input.sessionDate) errors.push('Enter a session date.');
  else if (!isWeekdayIsoDate(input.sessionDate)) errors.push('Weekday commute-related charging only.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime || '')) errors.push('Enter a valid session start time (HH:mm).');
  const kwhTenths = parseKwhToTenths(input.energyKwh);
  if (kwhTenths === null || kwhTenths <= 0) errors.push('Enter energy delivered in kWh.');
  const energyChargeCents = parseMoneyToCents(input.energyCharge);
  if (energyChargeCents === null || energyChargeCents <= 0) errors.push('Enter a positive energy charge amount.');
  if (!input.commuteRelated) errors.push('Confirm this session was commute-related.');
  if (!input.exclusionsAcknowledged) errors.push('Acknowledge excluded fees.');
  return { errors, kwhTenths, energyChargeCents };
}

export function defaultState(): ProgramState {
  const ledger = seedLedger();
  return {
    ledger,
    reviewEvents: ledger.map(row => ({ claimId: row.id, from: null, to: row.status, note: 'Synthetic seed record' })),
    campaigns: [
      {
        id: 'cmp-demo-1',
        name: 'September partner-site support',
        status: 'DRAFT-ONLY',
        monthlyCapCents: 3000,
        sessionCapCents: 1200,
        weekdayOnly: true,
        sites: PARTNER_SITES.map((site) => site.name),
      },
    ],
  };
}

/** Only pending/flagged claims can be reviewed. Terminal decisions are idempotent. */
export function reviewClaim(state: ProgramState, id: string, status: string, note: string): ProgramState {
  const target = state.ledger.find(row => row.id === id);
  if (!target || !['pending', 'flagged'].includes(target.status)
    || (status !== 'approved' && status !== 'declined' && status !== 'flagged')) return state;
  return { ...state,
    ledger: state.ledger.map(row => row.id === id ? { ...row, status, reviewNote: note,
      signedCents: status === 'approved' ? -row.amountCents : 0 } : row),
    reviewEvents: [...state.reviewEvents, { claimId: id, from: target.status, to: status, note }],
  };
}

export type CampaignDraftInput = { name: string; monthlyCap: string; sessionCap: string; weekdayOnly: boolean };

/** Draft metadata only; never consulted by claim eligibility or accounting. */
export function createCampaignDraft(state: ProgramState, input: CampaignDraftInput, id: string) {
  const monthlyCapCents = parseMoneyToCents(input.monthlyCap);
  const sessionCapCents = parseMoneyToCents(input.sessionCap);
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('Enter a draft campaign name.');
  if (monthlyCapCents == null || sessionCapCents == null || monthlyCapCents <= 0 || sessionCapCents <= 0) {
    errors.push('Draft caps must be finite positive amounts in whole cents.');
  } else if (sessionCapCents > monthlyCapCents) errors.push('Draft session cap cannot exceed its monthly cap.');
  if (!id || state.campaigns.some(row => row.id === id)) errors.push('Draft ID already exists or is missing.');
  if (errors.length || monthlyCapCents == null || sessionCapCents == null) return { state, errors };
  const draft: Campaign = { id, name: input.name.trim(), status: 'DRAFT-ONLY', monthlyCapCents, sessionCapCents,
    weekdayOnly: input.weekdayOnly, sites: PARTNER_SITES.map(site => site.name) };
  return { errors, state: { ...state, campaigns: [draft, ...state.campaigns] } };
}

export type ClaimResult = { state: ProgramState; errors: string[]; estimate?: ClaimEstimate };

/** Pure demo transition. No external fulfillment, storage, time, or ID generation. */
export function submitClaim(state: ProgramState, input: ClaimFormInput, id: string): ClaimResult {
  const checked = validateClaimForm(input);
  const errors = [...checked.errors];
  if (input.sessionDate?.slice(0, 7) !== PROGRAM.period) errors.push('Use a synthetic date in the September 2026 demo period.');
  const referenceId = input.receiptId?.trim();
  if (!referenceId) errors.push('Enter a synthetic receipt / session ID.');
  if (!id || state.ledger.some(row => row.id === id || row.referenceId === referenceId)) {
    errors.push('This claim ID or receipt / session reference already exists.');
  }
  const fees = [input.idleFee, input.parkingFee, input.tax].map(value => parseMoneyToCents(value?.trim() || '0'));
  if (fees.some(value => value === null)) errors.push('Fees must be valid nonnegative amounts.');
  if (errors.length || checked.energyChargeCents == null || checked.kwhTenths == null || !referenceId) return { state, errors };
  const remaining = remainingFromLedger(state.ledger);
  let estimate: ClaimEstimate;
  try {
    estimate = estimateClaim({ energyChargeCents: checked.energyChargeCents,
      idleFeeCents: fees[0]!, parkingFeeCents: fees[1]!, taxCents: fees[2]!,
      remainingCents: PROGRAM.monthlyBenefitCents });
  } catch {
    return { state, errors: ['Amounts or their total exceed safe integer cents.'] };
  }
  if (estimate.estimatedCents > remaining.remainingCents) errors.push('Claim exceeds available demo dollar benefit.');
  if (checked.kwhTenths > remaining.remainingKwhTenths) errors.push('Claim exceeds available demo kWh benefit.');
  if (errors.length) return { state, errors };
  const entry: LedgerEntry = {
    id, date: input.sessionDate!, eventType: 'Charging claim',
    source: `${input.locationName} · ${input.cityCorridor} · Synthetic data`,
    kwhTenths: checked.kwhTenths, amountCents: estimate.estimatedCents, signedCents: 0,
    status: 'pending', referenceId, network: input.network, estimate,
    detail: input.note || 'Synthetic claim pending demo review.',
  };
  return { errors: [], estimate, state: { ...state, ledger: [entry, ...state.ledger],
    reviewEvents: [...state.reviewEvents, { claimId: id, from: null, to: 'pending', note: 'Synthetic submission; both units held' }],
  } };
}
