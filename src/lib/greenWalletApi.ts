import type { ChargingHub, GreenRouteCredit, RedemptionRequest } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://127.0.0.1:8877/api';

export class GreenWalletApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = 'GreenWalletApiError';
    this.status = status;
    this.details = details;
  }
}

type BackendCredit = {
  id: number | string;
  estimated_miles_reduced: string | number;
  estimated_co2_lbs_reduced: string | number;
  note: string;
  created_at: string;
};

type BackendHub = {
  id: number | string;
  name: string;
  network: string;
  city: string;
  stalls: number;
  connector_types: string[];
  status: ChargingHub['status'];
  evidence_label: ChargingHub['evidenceLabel'];
};

type BackendRequest = {
  id: number | string;
  credit: number | string;
  profile: number | string | null;
  charging_hub: number | string;
  requested_units: string | number;
  unit_label: string;
  status: RedemptionRequest['status'];
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string;
  review_note: string;
};

const jsonHeaders = () => ({ 'Content-Type': 'application/json', Accept: 'application/json' });

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { ...jsonHeaders(), ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.detail || body?.message || `Green Wallet API request failed (${response.status})`;
    throw new GreenWalletApiError(message, response.status, body);
  }
  return body as T;
}

const toCredit = (credit: BackendCredit): GreenRouteCredit => ({
  id: String(credit.id),
  activity: credit.note || 'Relay Rider participation',
  amount: Number(credit.estimated_miles_reduced || 0),
  status: 'approved',
  date: new Date(credit.created_at).toLocaleDateString(),
});

const toHub = (hub: BackendHub): ChargingHub => ({
  id: String(hub.id),
  name: hub.name,
  network: hub.network,
  city: hub.city,
  stalls: hub.stalls,
  connectorTypes: hub.connector_types,
  status: hub.status,
  evidenceLabel: hub.evidence_label,
});

const toRequest = (request: BackendRequest): RedemptionRequest => ({
  id: String(request.id),
  creditId: String(request.credit),
  participantId: request.profile ? String(request.profile) : 'unassigned',
  chargingHubId: String(request.charging_hub),
  requestedUnits: Number(request.requested_units),
  unitLabel: request.unit_label,
  status: request.status,
  requestedAt: request.requested_at,
  reviewedAt: request.reviewed_at || undefined,
  reviewedBy: request.reviewed_by || undefined,
  reviewNote: request.review_note || undefined,
});

export const greenWalletApi = {
  async listCredits(profileId?: string): Promise<GreenRouteCredit[]> {
    const query = profileId ? `?profile=${encodeURIComponent(profileId)}` : '';
    const credits = await request<BackendCredit[]>(`/green-route-credits/${query}`);
    return credits.map(toCredit);
  },

  async listChargingHubs(): Promise<ChargingHub[]> {
    const hubs = await request<BackendHub[]>('/charging-hubs/');
    return hubs.map(toHub);
  },

  async listRedemptionRequests(profileId?: string): Promise<RedemptionRequest[]> {
    const query = profileId ? `?profile=${encodeURIComponent(profileId)}` : '';
    const requests = await request<BackendRequest[]>(`/redemption-requests/${query}`);
    return requests.map(toRequest);
  },

  async createRedemptionRequest(input: { creditId: string; participantId: string; chargingHubId: string; requestedUnits: number; unitLabel: string }): Promise<RedemptionRequest> {
    const created = await request<BackendRequest>('/redemption-requests/', {
      method: 'POST',
      body: JSON.stringify({ credit: input.creditId, profile: input.participantId, charging_hub: input.chargingHubId, requested_units: input.requestedUnits, unit_label: input.unitLabel, status: 'requested' }),
    });
    return toRequest(created);
  },

  async reviewRedemptionRequest(id: string, decision: 'fulfilled' | 'denied', reviewNote: string): Promise<RedemptionRequest> {
    const updated = await request<BackendRequest>(`/redemption-requests/${encodeURIComponent(id)}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status: decision, review_note: reviewNote, reviewed_at: new Date().toISOString(), reviewed_by: 'authenticated-admin' }),
    });
    return toRequest(updated);
  },
};
