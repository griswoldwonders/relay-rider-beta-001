// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

// Allow cold lazy imports to resolve on Windows without mocking route surfaces.
configure({ asyncUtilTimeout: 4000 });

const openPreview = (route: string) => {
  window.history.replaceState({}, '', `/?screen=${route}`);
  render(<App />);
};

const expectEmbeddedWallet = async () => {
  expect(await screen.findByText('$18.60 remaining')).toBeInTheDocument();
  expect(screen.getByText(/Pasadena–Glendale Clean Commute Pilot/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open hub redemption wallet' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open hub review queue' })).toBeInTheDocument();
};

describe('App Green Wallet routing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('opens the embedded Green Wallet at the wallet preview route', async () => {
    openPreview('wallet');
    await expectEmbeddedWallet();
  });

  it('keeps onboarding completion pointed at the embedded wallet', async () => {
    openPreview('wallet-onboarding');
    fireEvent.click(await screen.findByRole('button', { name: 'Skip introduction' }));
    await expectEmbeddedWallet();
  });

  it('opens the unchanged classic hub wallet inside the app', async () => {
    openPreview('wallet');
    fireEvent.click(await screen.findByRole('button', { name: 'Open hub redemption wallet' }));
    expect(await screen.findByText('Available research-beta benefit')).toBeInTheDocument();
    expect(screen.getByText('EV Charge Benefit')).toBeInTheDocument();
  });

  it('opens the existing hub review queue and returns to the embedded wallet', async () => {
    openPreview('wallet');
    fireEvent.click(await screen.findByRole('button', { name: 'Open hub review queue' }));
    expect(await screen.findByRole('heading', { name: 'Review redemption requests' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return to wallet' }));
    await expectEmbeddedWallet();
  });

  it('preserves the direct wallet-admin preview route', async () => {
    openPreview('wallet-admin');
    expect(await screen.findByRole('heading', { name: 'Review redemption requests' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return to wallet' }));
    await expectEmbeddedWallet();
  });
});
