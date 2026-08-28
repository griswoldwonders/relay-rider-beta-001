import { afterEach, describe, expect, it, vi } from 'vitest';
import { GreenWalletApiError, greenWalletApi } from './greenWalletApi';

afterEach(() => {
  vi.restoreAllMocks();
});

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

describe('greenWalletApi', () => {
  it('maps charging hubs from the backend contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([
        {
          id: 7,
          name: 'Pilot Hub',
          network: 'Pilot Network',
          city: 'Pasadena',
          stalls: 8,
          connector_types: ['CCS'],
          status: 'verified',
          evidence_label: 'verified',
        },
      ]),
    );

    await expect(greenWalletApi.listChargingHubs()).resolves.toEqual([
      {
        id: '7',
        name: 'Pilot Hub',
        network: 'Pilot Network',
        city: 'Pasadena',
        stalls: 8,
        connectorTypes: ['CCS'],
        status: 'verified',
        evidenceLabel: 'verified',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/charging-hubs/'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('maps credits and uses the profile filter', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([
        {
          id: 12,
          estimated_miles_reduced: '14.50',
          estimated_co2_lbs_reduced: '22.00',
          note: 'Commute activity',
          created_at: '2026-08-26T12:00:00Z',
        },
      ]),
    );

    const credits = await greenWalletApi.listCredits('profile-4');
    expect(credits[0]).toMatchObject({ id: '12', amount: 14.5, activity: 'Commute activity', status: 'approved' });
    expect(fetchMock.mock.calls[0][0]).toEqual(expect.stringContaining('profile=profile-4'));
  });

  it('sends a kWh-equivalent redemption request and maps the response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        id: 31,
        credit: 12,
        profile: 4,
        charging_hub: 7,
        requested_units: '5.00',
        unit_label: 'kWh-equivalent',
        status: 'requested',
        requested_at: '2026-08-26T12:30:00Z',
        reviewed_at: null,
        reviewed_by: '',
        review_note: '',
      }, 201),
    );

    await expect(
      greenWalletApi.createRedemptionRequest({
        creditId: '12',
        participantId: '4',
        chargingHubId: '7',
        requestedUnits: 5,
        unitLabel: 'kWh-equivalent',
      }),
    ).resolves.toMatchObject({ id: '31', creditId: '12', participantId: '4', requestedUnits: 5, status: 'requested' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/redemption-requests/'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          credit: '12',
          profile: '4',
          charging_hub: '7',
          requested_units: 5,
          unit_label: 'kWh-equivalent',
          status: 'requested',
        }),
      }),
    );
  });

  it('converts API errors into GreenWalletApiError with response details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ detail: 'Not authorized' }, 403));

    const promise = greenWalletApi.listRedemptionRequests('profile-9');
    await expect(promise).rejects.toBeInstanceOf(GreenWalletApiError);
    await expect(promise).rejects.toMatchObject({ status: 403, message: 'Not authorized', details: { detail: 'Not authorized' } });
  });
});
