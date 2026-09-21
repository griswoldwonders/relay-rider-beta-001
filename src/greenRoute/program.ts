export const STORAGE_KEY = 'rr-green-route-credits-demo-v1';

export const PROGRAM = Object.freeze({
  name: 'Pasadena–Glendale Clean Commute Pilot',
  sponsor: 'Pasadena Corridor Employer Coalition',
  participant: 'Maya Chen',
  participantStatus: 'Eligible — Active',
  monthlyBenefitCents: 3000,
  monthlyKwhTenths: 500,
  sessionCapCents: 1200,
  resetLabel: 'Resets October 1, 2026',
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

export type ProgramState = {
  ledger: LedgerEntry[];
  remainingCents: number;
  remainingKwhTenths: number;
  claims: LedgerEntry[];
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

export function parseKwhToTenths(value: unknown) {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 10 + Number((fraction + '0').slice(0, 1));
}

export function parseMoneyToCents(value: unknown) {
  const text = String(value ?? '').trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
}

export function isWeekdayIsoDate(isoDate: string) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  if (!year || !month || !day) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
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
  const consumedCents = entries
    .filter((row) => row.status === LEDGER_STATUSES.redeemed || row.status === LEDGER_STATUSES.approved)
    .reduce((sum, row) => sum + row.amountCents, 0);
  const consumedKwh = entries
    .filter(
      (row) =>
        row.status === LEDGER_STATUSES.redeemed
        || row.status === LEDGER_STATUSES.approved
        || row.status === LEDGER_STATUSES.pending,
    )
    .reduce((sum, row) => sum + (row.kwhTenths || 0), 0);
  return {
    remainingCents: Math.max(0, monthlyCents - consumedCents),
    remainingKwhTenths: Math.max(0, monthlyKwhTenths - consumedKwh),
    consumedCents,
    consumedKwhTenths: consumedKwh,
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
  const excludedCents = idleFeeCents + parkingFeeCents + taxCents;
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
  if (!input.startTime) errors.push('Enter a session start time.');
  const kwhTenths = parseKwhToTenths(input.energyKwh);
  if (kwhTenths === null || kwhTenths <= 0) errors.push('Enter energy delivered in kWh.');
  const energyChargeCents = parseMoneyToCents(input.energyCharge);
  if (energyChargeCents === null) errors.push('Enter the energy charge amount.');
  if (!input.commuteRelated) errors.push('Confirm this session was commute-related.');
  if (!input.exclusionsAcknowledged) errors.push('Acknowledge excluded fees.');
  return { errors, kwhTenths, energyChargeCents };
}

export function defaultState(): ProgramState {
  const ledger = seedLedger();
  const remaining = remainingFromLedger(ledger);
  remaining.remainingCents = 1860;
  remaining.remainingKwhTenths = 314;
  return {
    ledger,
    remainingCents: remaining.remainingCents,
    remainingKwhTenths: remaining.remainingKwhTenths,
    claims: ledger
      .filter((row) => row.eventType.includes('claim') || row.eventType.includes('Claim'))
      .map((row) => ({
        ...row,
        reviewNote: '',
      })),
    campaigns: [
      {
        id: 'cmp-demo-1',
        name: 'September partner-site support',
        status: 'Simulated — draft campaign',
        monthlyCapCents: 3000,
        sessionCapCents: 1200,
        weekdayOnly: true,
        sites: PARTNER_SITES.map((site) => site.name),
      },
    ],
  };
}
