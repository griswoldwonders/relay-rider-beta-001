// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import L from 'leaflet';
import { CorridorMap } from '../CorridorMap';
import { screen } from '@testing-library/react';
import type { MapLocation } from '../../data/mapLocations';

afterEach(cleanup);

const locationA: MapLocation = {
  id: 'loc-a',
  name: 'Location A',
  kind: 'school',
  type: 'Community college campus',
  city: 'Pasadena',
  address: '1 Test Way',
  lat: 34.14,
  lng: -118.14,
  reviewStatus: 'candidate',
  accessPointCandidate: true,
  evidence: { sourceType: 'official-source', checkedOn: '2026-08-26' },
  notes: 'Test notes',
  sourceLabel: 'Test source',
  sourceUrl: 'https://example.com',
};

const locationB: MapLocation = {
  ...locationA,
  id: 'loc-b',
  name: 'Location B',
  lat: 34.16,
  lng: -118.2,
};

describe('CorridorMap viewport stability', () => {
  it('does not call fitBounds when only the selection changes', async () => {
    const fitBoundsSpy = vi.spyOn(L.Map.prototype, 'fitBounds');

    const { rerender } = render(
      <CorridorMap
        locations={[locationA, locationB]}
        demandZones={[]}
        plannedRoutes={[]}
        selectedFeatureKey={null}
        onSelectFeature={() => {}}
      />,
    );

    const callsAfterInitialLoad = fitBoundsSpy.mock.calls.length;
    expect(callsAfterInitialLoad).toBeGreaterThan(0);

    rerender(
      <CorridorMap
        locations={[locationA, locationB]}
        demandZones={[]}
        plannedRoutes={[]}
        selectedFeatureKey={`location:${locationA.id}`}
        onSelectFeature={() => {}}
      />,
    );

    expect(fitBoundsSpy.mock.calls.length).toBe(callsAfterInitialLoad);

    fitBoundsSpy.mockRestore();
  });

  it('reframes when the visible location set intentionally changes', () => {
    const fitBoundsSpy = vi.spyOn(L.Map.prototype, 'fitBounds');

    const { rerender } = render(
      <CorridorMap
        locations={[locationA]}
        demandZones={[]}
        plannedRoutes={[]}
        selectedFeatureKey={null}
        onSelectFeature={() => {}}
      />,
    );

    const callsAfterInitialLoad = fitBoundsSpy.mock.calls.length;

    rerender(
      <CorridorMap
        locations={[locationA, locationB]}
        demandZones={[]}
        plannedRoutes={[]}
        selectedFeatureKey={null}
        onSelectFeature={() => {}}
      />,
    );

    expect(fitBoundsSpy.mock.calls.length).toBeGreaterThan(callsAfterInitialLoad);

    fitBoundsSpy.mockRestore();
  });
});

describe('CorridorMap OSM tile resilience', () => {
  it('shows an accessible degraded-map message when tiles fail to load, without a third-party map key', async () => {
    let tileLayer: L.TileLayer | undefined;
    render(
      <CorridorMap
        locations={[locationA]}
        demandZones={[]}
        plannedRoutes={[]}
        selectedFeatureKey={null}
        onSelectFeature={() => {}}
        onTileLayerReady={layer => {
          tileLayer = layer;
        }}
      />,
    );

    expect(tileLayer).toBeTruthy();

    tileLayer?.fire('tileerror');

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.textContent).toMatch(/tiles are temporarily unavailable/i);
    });
  });
});
