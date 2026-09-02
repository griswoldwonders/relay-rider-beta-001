import type { ChargingHub, GreenRouteCredit, RedemptionRequest } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://127.0.0.1:8877/api';

export class GreenWalletApiError extends Error {
  status: number; details: unknown;
  constructor(message: string, status: number, details: unknown = null) { super(message); this.name = 'GreenWalletApiError'; this.status = status; this.details = details; }
}

type BackendCredit = { id: number | string; amount_units: string | number; unit_label: string; status: GreenRouteCredit['status']; note: string; created_at: string; };
type BackendHub = { id: number | string; name: string; network: string; city: string; stalls: number; connector_types: string[]; status: ChargingHub['status']; evidence_label: ChargingHub['evidenceLabel']; };
type BackendRequest = { id: number | string; credit: number | string; profile: number | string | null; charging_hub: number | string; requested_units: string | number; unit_label: string; status: RedemptionRequest['status']; requested_at: string; reviewed_at: string | null; reviewed_by: string; review_note: string; };

const jsonHeaders = () => ({ 'Content-Type': 'application/json', Accept: 'application/json' });
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', ...init, headers: { ...jsonHeaders(), ...(init.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new GreenWalletApiError(body?.detail || body?.message || `Green Wallet API request failed (${response.status})`, response.status, body);
  return body as T;
}

const toCredit = (credit: BackendCredit): GreenRouteCredit => ({
  id: String(credit.id),
  activity: credit.note || 'Relay Rider participation',
  amountUnits: Number(credit.amount_units || 0),
  unitLabel: credit.unit_label,
  status: credit.status,
  issuedAt: credit.created_at,
});
const toHub = (hub: BackendHub): ChargingHub => ({ id: String(hub.id), name: hub.name, network: hub.network, city: hub.city, stalls: hub.stalls, connectorTypes: hub.connector_types, status: hub.status, evidenceLabel: hub.evidence_label });
const toRequest = (r: BackendRequest): RedemptionRequest => ({ id: String(r.id), creditId: String(r.credit), participantId: r.profile ? String(r.profile) : 'unassigned', chargingHubId: String(r.charging_hub), requestedUnits: Number(r.requested_units), unitLabel: r.unit_label, status: r.status, requestedAt: r.requested_at, reviewedAt: r.reviewed_at || undefined, reviewedBy: r.reviewed_by || undefined, reviewNote: r.review_note || undefined });

export const greenWalletApi = {
  async listCredits(): Promise<GreenRouteCredit[]> { return (await request<BackendCredit[]>('/green-route-credits/')).map(toCredit); },
  async listChargingHubs(): Promise<ChargingHub[]> { return (await request<BackendHub[]>('/charging-hubs/')).map(toHub); },
  async listRedemptionRequests(): Promise<RedemptionRequest[]> { return (await request<BackendRequest[]>('/redemption-requests/')).map(toRequest); },
  async createRedemptionRequest(input: { creditId: string; participantId: string; chargingHubId: string; requestedUnits: number }): Promise<RedemptionRequest> {
    return toRequest(await request<BackendRequest>('/redemption-requests/', { method: 'POST', body: JSON.stringify({ credit: input.creditId, profile: input.participantId, charging_hub: input.chargingHubId, requested_units: input.requestedUnits }) }));
  },
  async startRedemptionReview(id: string): Promise<RedemptionRequest> {
    return toRequest(await request<BackendRequest>(`/redemption-requests/${encodeURIComponent(id)}/`, { method: 'PATCH', body: JSON.stringify({ status: 'under-review' }) }));
  },
  async reviewRedemptionRequest(id: string, decision: 'fulfilled' | 'denied', reviewNote: string): Promise<RedemptionRequest> {
    return toRequest(await request<BackendRequest>(`/redemption-requests/${encodeURIComponent(id)}/`, { method: 'PATCH', body: JSON.stringify({ status: decision, review_note: reviewNote }) }));
  },
};
