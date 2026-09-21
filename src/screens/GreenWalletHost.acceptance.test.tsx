// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../context/AppContext', () => ({
  chargingHubs: [],
  useApp: () => ({ greenRouteCredits: [], redemptionRequests: [] }),
}));

vi.mock('../components/Header', () => ({
  Header: ({ title }: { title: string }) => <header><h1>{title}</h1></header>,
}));

import { GreenWalletHost } from './GreenWalletHost';

describe('Green Wallet host in Relay Rider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the Green Route Credits prototype as the in-app wallet', () => {
    render(<GreenWalletHost onBack={() => undefined} onOpenAdmin={() => undefined} />);
    expect(screen.getByText('$18.60 remaining')).toBeInTheDocument();
    expect(screen.getByText(/Pasadena–Glendale Clean Commute Pilot/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open hub redemption wallet' })).toBeInTheDocument();
  });

  it('can open the classic hub-redemption wallet without leaving Relay Rider', () => {
    render(<GreenWalletHost onBack={() => undefined} onOpenAdmin={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open hub redemption wallet' }));
    expect(screen.getByText('Green Wallet')).toBeInTheDocument();
    expect(screen.getByText('EV Charge Benefit')).toBeInTheDocument();
  });
});
