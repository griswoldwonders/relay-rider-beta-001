// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appState = vi.hoisted(() => ({
  greenRouteCredits: [
    {
      id: 'credit-pasadena-001',
      activity: 'Synthetic Pasadena Green Wallet acceptance credit',
      amountUnits: 12,
      unitLabel: 'Green Route Credits',
      issuedAt: '2026-09-04T12:00:00Z',
      status: 'issued' as const,
    },
  ],
  redemptionRequests: [] as Array<{
    id: string;
    creditId: string;
    participantId: string;
    chargingHubId: string;
    requestedUnits: number;
    unitLabel: string;
    status: 'requested' | 'under-review' | 'fulfilled' | 'denied';
    requestedAt: string;
  }>,
}));

vi.mock('../context/AppContext', () => ({
  chargingHubs: [
    {
      id: 'hub-pasadena-001',
      name: 'Synthetic Pasadena Program Charging Hub',
      network: 'Institution-operated',
      city: 'Pasadena',
      stalls: 4,
      connectorTypes: ['J1772'],
      status: 'active',
      evidenceLabel: 'synthetic',
    },
  ],
  useApp: () => appState,
}));

vi.mock('../components/Header', () => ({
  Header: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <header><h1>{title}</h1><p>{subtitle}</p></header>
  ),
}));

vi.mock('../flows/EVChargeCreditRedemptionFlow', () => ({
  EVChargeCreditRedemptionFlow: () => <div>Redemption flow</div>,
}));

import { WalletScreen } from './WalletScreen';

describe('Green Wallet Pasadena acceptance UI', () => {
  beforeEach(() => {
    appState.redemptionRequests = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('shows an issued synthetic credit as available before a redemption request', () => {
    render(<WalletScreen onBack={() => undefined} />);

    expect(screen.getByText('12 Green Route Credits')).toBeInTheDocument();
    expect(screen.getByText('12 credits')).toBeInTheDocument();
    expect(screen.getByText('Available for pilot review')).toBeInTheDocument();
    expect(screen.getByText(/not cash, wages, fares/i)).toBeInTheDocument();
  });

  it('removes committed units from available wallet state and exposes the request status', () => {
    appState.redemptionRequests = [
      {
        id: 'request-pasadena-001',
        creditId: 'credit-pasadena-001',
        participantId: 'profile-pasadena-001',
        chargingHubId: 'hub-pasadena-001',
        requestedUnits: 12,
        unitLabel: 'Green Route Credits',
        status: 'fulfilled',
        requestedAt: '2026-09-04T12:05:00Z',
      },
    ];

    render(<WalletScreen onBack={() => undefined} />);

    expect(screen.getByText('0 Green Route Credits')).toBeInTheDocument();
    expect(screen.getByText('request-pasadena-001')).toBeInTheDocument();
    expect(screen.getByText(/Synthetic Pasadena Program Charging Hub.*fulfilled/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EV Charge Benefit/i })).toBeDisabled();
  });
});
