import type { EVParticipantSignal, RouteSignal } from '../types';
import type { CommuterNeedInput, PlannedRouteInput, ProgramContext } from './relayBackend';

const dayIndex: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function minutesToTime(minutes: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function parseClock(value: string): number | null {
  const trimmed = value.trim();
  const twentyFour = trimmed.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour && !/\b(am|pm)\b/i.test(trimmed)) {
    return Number(twentyFour[1]) * 60 + Number(twentyFour[2]);
  }

  const twelve = trimmed.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (!twelve) return null;
  let hour = Number(twelve[1]) % 12;
  if (twelve[3].toLowerCase() === 'pm') hour += 12;
  return hour * 60 + Number(twelve[2] ?? 0);
}

function extractClocks(value: string): number[] {
  const matches = value.match(/(?:\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b)/gi) ?? [];
  return matches.map(parseClock).filter((item): item is number => item != null);
}

function scheduleWindow(value: string): { start: string | null; end: string | null; flexibility: number } {
  const clocks = extractClocks(value);
  const flexibilityMatch = value.match(/±\s*(\d{1,3})\s*min/i);
  const flexibility = flexibilityMatch ? Math.min(240, Number(flexibilityMatch[1])) : 0;

  if (clocks.length >= 2) {
    const start = Math.min(clocks[0], clocks[1]);
    const end = Math.max(clocks[0], clocks[1]);
    return { start: minutesToTime(start), end: minutesToTime(end), flexibility };
  }
  if (clocks.length === 1) {
    return {
      start: minutesToTime(clocks[0] - flexibility),
      end: minutesToTime(clocks[0] + flexibility),
      flexibility,
    };
  }
  return { start: null, end: null, flexibility };
}

function travelDays(days: string[]) {
  return [...new Set(days.map(day => dayIndex[day]).filter((item): item is number => item != null))].sort((a, b) => a - b);
}

function evPreference(value: RouteSignal['evPreference']): CommuterNeedInput['evHybridPreference'] {
  if (value === 'ev-only') return 'ev_only';
  if (value === 'hybrid-ev') return 'ev_or_hybrid';
  return 'no_preference';
}

function vehicleType(value: EVParticipantSignal['vehicleType']): PlannedRouteInput['vehicleType'] {
  if (value === 'phev') return 'plug_in_hybrid';
  if (value === 'ev' || value === 'hybrid' || value === 'other') return value;
  return 'unspecified';
}

function maxDetour(value: string) {
  if (value === '0-5') return 5;
  if (value === '5-10') return 10;
  if (value === '10-15') return 15;
  return 10;
}

export function routeSignalToCommuterNeed(signal: RouteSignal, context: ProgramContext): CommuterNeedInput {
  const window = scheduleWindow(signal.timeWindow);
  return {
    organizationId: context.organization_id,
    cohortId: context.cohort_id,
    originZone: signal.startingArea.trim(),
    destinationZone: signal.destinationArea.trim(),
    travelDays: travelDays(signal.daysOfWeek),
    windowStart: window.start,
    windowEnd: window.end,
    flexibilityMinutes: window.flexibility,
    accessPointWillingness: signal.relayZoneType.length > 0,
    evHybridPreference: evPreference(signal.evPreference),
    accessibilityPreferences: {
      max_walking_distance: signal.maxWalkingDistance,
      transit_preferences: signal.transitOptions,
      student_transit_pass: signal.studentTransitPass,
    },
    privacySetting: 'zone_only',
  };
}

export function evSignalToPlannedRoute(signal: EVParticipantSignal, context: ProgramContext): PlannedRouteInput {
  const window = scheduleWindow(signal.timeWindow);
  return {
    organizationId: context.organization_id,
    cohortId: context.cohort_id,
    originZone: signal.startingArea.trim(),
    destinationZone: signal.destinationArea.trim(),
    travelDays: travelDays(signal.travelDays),
    windowStart: window.start,
    windowEnd: window.end,
    availableCapacity: 1,
    maximumDetourMinutes: maxDetour(signal.maxDetour),
    vehicleType: vehicleType(signal.vehicleType),
    vehicleDetails: {
      make: signal.vehicleMake,
      model: signal.vehicleModel,
      year: signal.vehicleYear,
    },
    verificationWillingness: signal.reviewsAccepted.length > 0,
    privacySetting: 'zone_only',
  };
}

export const participantMapperContract = Object.freeze({
  dayEncoding: 'Sunday=0 ... Saturday=6',
  scheduleConvention: 'Current client v1 maps its generic time window into the backend earliest/latest departure fields used by deterministic-v1.',
  preciseAddressCollection: false,
});
