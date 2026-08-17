const RELAY_BACKEND_URL = (
  import.meta.env.VITE_RELAY_BACKEND_URL ?? 'https://dzrqrqfxcihvufvyctbt.supabase.co'
).replace(/\/$/, '');

const RELAY_BACKEND_PUBLISHABLE_KEY =
  import.meta.env.VITE_RELAY_BACKEND_PUBLISHABLE_KEY ??
  'sb_publishable_hLCfTlWFEQRkwKUwz5Wv2g_DwoVqPy1';

export type RelayAuthUser = {
  id: string;
  email?: string | null;
};

export type RelayAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: RelayAuthUser;
};

export type ProgramContext = {
  organization_id: string;
  organization_name: string;
  organization_type: string;
  organization_status: string;
  member_role: string;
  member_status: string;
  site_id: string | null;
  site_name: string | null;
  cohort_id: string | null;
  cohort_name: string | null;
};

export type ParticipantAccessPoint = {
  id: string;
  organization_id: string | null;
  name: string;
  address_label: string | null;
  access_point_type: string;
  review_status: 'candidate' | 'under_review' | 'designated' | 'institutionally_approved' | 'rejected' | 'inactive';
};

export type ParticipantMatchPreview = {
  id: string;
  organization_id: string;
  commuter_need_id: string;
  planned_route_id: string;
  origin_zone: string;
  destination_zone: string;
  compatibility_score: number | null;
  route_fit_score: number | null;
  estimated_detour_minutes: number | null;
  estimated_detour_miles: number | null;
  time_window_fit: string | null;
  contribution_compatibility: string | null;
  ev_hybrid_indicator: string | null;
  explanation: Record<string, unknown>;
  match_status: string;
  generated_at: string;
  expires_at: string | null;
  review_decision: 'pending' | 'request_changes' | 'approved_for_review' | 'declined' | 'withdrawn' | null;
  review_rationale: string | null;
  review_conditions: Record<string, unknown>;
  reviewed_at: string | null;
  access_point_id: string | null;
  access_point_name: string | null;
  access_point_address_label: string | null;
  access_point_review_status: string | null;
};

export type CommuterNeedInput = {
  organizationId: string;
  cohortId?: string | null;
  originZone: string;
  destinationZone: string;
  travelDays: number[];
  windowStart?: string | null;
  windowEnd?: string | null;
  flexibilityMinutes?: number;
  accessPointWillingness?: boolean;
  evHybridPreference?: 'ev_only' | 'ev_or_hybrid' | 'preferred' | 'no_preference';
  accessibilityPreferences?: Record<string, unknown>;
  privacySetting?: 'zone_only' | 'access_point_only' | 'limited_detail';
};

export type PlannedRouteInput = {
  organizationId: string;
  cohortId?: string | null;
  originZone: string;
  destinationZone: string;
  travelDays: number[];
  windowStart?: string | null;
  windowEnd?: string | null;
  availableCapacity?: number;
  maximumDetourMinutes?: number;
  vehicleType?: 'ev' | 'hybrid' | 'plug_in_hybrid' | 'other' | 'unspecified';
  vehicleDetails?: Record<string, unknown>;
  verificationWillingness?: boolean;
  privacySetting?: 'zone_only' | 'access_point_only' | 'limited_detail';
};

export type SignUpResult =
  | { status: 'authenticated'; session: RelayAuthSession }
  | { status: 'email_confirmation_required'; user: RelayAuthUser };

function publicHeaders() {
  return {
    apikey: RELAY_BACKEND_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function authenticatedHeaders(session: RelayAuthSession) {
  return {
    ...publicHeaders(),
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
    const message =
      (record?.message as string | undefined) ??
      (record?.msg as string | undefined) ??
      (record?.error_description as string | undefined) ??
      (record?.error as string | undefined) ??
      `Relay backend request failed (${response.status})`;
    throw new Error(message);
  }

  return body as T;
}

async function rpc<T>(session: RelayAuthSession, name: string, body: Record<string, unknown> = {}): Promise<T> {
  return parseResponse<T>(await fetch(`${RELAY_BACKEND_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: authenticatedHeaders(session),
    body: JSON.stringify(body),
  }));
}

export async function signInToRelayProgram(email: string, password: string): Promise<RelayAuthSession> {
  return parseResponse<RelayAuthSession>(await fetch(`${RELAY_BACKEND_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: publicHeaders(),
    body: JSON.stringify({ email: email.trim(), password }),
  }));
}

export async function signUpForRelayProgram(email: string, password: string): Promise<SignUpResult> {
  const result = await parseResponse<Partial<RelayAuthSession> & { user: RelayAuthUser }>(
    await fetch(`${RELAY_BACKEND_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: publicHeaders(),
      body: JSON.stringify({ email: email.trim(), password }),
    }),
  );

  if (result.access_token && result.refresh_token && result.user) {
    return { status: 'authenticated', session: result as RelayAuthSession };
  }
  return { status: 'email_confirmation_required', user: result.user };
}

export async function signOutOfRelayProgram(session: RelayAuthSession): Promise<void> {
  const response = await fetch(`${RELAY_BACKEND_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: authenticatedHeaders(session),
  });
  if (!response.ok && response.status !== 401) {
    await parseResponse(response);
  }
}

export async function acceptInstitutionInvitation(session: RelayAuthSession, inviteToken: string): Promise<string> {
  return rpc<string>(session, 'accept_organization_invitation', { invite_token: inviteToken.trim() });
}

export async function getProgramContexts(session: RelayAuthSession): Promise<ProgramContext[]> {
  return rpc<ProgramContext[]>(session, 'get_participant_program_context');
}

export async function submitCommuterNeed(session: RelayAuthSession, input: CommuterNeedInput): Promise<string> {
  return rpc<string>(session, 'submit_participant_commuter_need', {
    org_id: input.organizationId,
    cohort_id: input.cohortId ?? null,
    origin_zone: input.originZone,
    destination_zone: input.destinationZone,
    travel_days: input.travelDays,
    window_start: input.windowStart ?? null,
    window_end: input.windowEnd ?? null,
    flexibility_minutes: input.flexibilityMinutes ?? 0,
    access_point_willingness: input.accessPointWillingness ?? true,
    ev_hybrid_preference: input.evHybridPreference ?? 'no_preference',
    accessibility_preferences: input.accessibilityPreferences ?? {},
    privacy_setting: input.privacySetting ?? 'zone_only',
  });
}

export async function submitPlannedRoute(session: RelayAuthSession, input: PlannedRouteInput): Promise<string> {
  return rpc<string>(session, 'submit_participant_planned_route', {
    org_id: input.organizationId,
    cohort_id: input.cohortId ?? null,
    origin_zone: input.originZone,
    destination_zone: input.destinationZone,
    travel_days: input.travelDays,
    window_start: input.windowStart ?? null,
    window_end: input.windowEnd ?? null,
    available_capacity: input.availableCapacity ?? 1,
    maximum_detour_minutes: input.maximumDetourMinutes ?? 10,
    vehicle_type: input.vehicleType ?? 'unspecified',
    vehicle_details: input.vehicleDetails ?? {},
    verification_willingness: input.verificationWillingness ?? false,
    privacy_setting: input.privacySetting ?? 'zone_only',
  });
}

export async function getParticipantMatchPreviews(session: RelayAuthSession): Promise<ParticipantMatchPreview[]> {
  return rpc<ParticipantMatchPreview[]>(session, 'get_participant_match_previews');
}

export async function listParticipantAccessPoints(
  session: RelayAuthSession,
  organizationId: string,
): Promise<ParticipantAccessPoint[]> {
  const query = new URLSearchParams({
    organization_id: `eq.${organizationId}`,
    review_status: 'in.(designated,institutionally_approved)',
    select: 'id,organization_id,name,address_label,access_point_type,review_status',
    order: 'name.asc',
  });
  return parseResponse<ParticipantAccessPoint[]>(await fetch(
    `${RELAY_BACKEND_URL}/rest/v1/access_points?${query.toString()}`,
    { headers: authenticatedHeaders(session) },
  ));
}

export const relayBackendContract = Object.freeze({
  url: RELAY_BACKEND_URL,
  projectRef: 'dzrqrqfxcihvufvyctbt',
  contractVersion: 'participant_client_contract_v1',
  participantMatchGeneration: 'institutional_reviewer_only' as const,
});
