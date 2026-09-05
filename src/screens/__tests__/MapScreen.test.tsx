// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { AppProvider } from '../../context/AppContext';
import { MapScreen } from '../MapScreen';

afterEach(cleanup);

function renderMapScreen() {
  return render(
    <AppProvider>
      <MapScreen />
    </AppProvider>,
  );
}

describe('MapScreen — Access Point suggestion honesty', () => {
  it('renders the Access Point suggestion control as disabled, not a functional button', () => {
    renderMapScreen();
    expect(screen.getByRole('button', { name: /suggest an access point/i })).toBeDisabled();
  });

  it('explains that formal Access Point submissions are not open in the research beta', () => {
    renderMapScreen();
    expect(screen.getByText(/not open in the research beta/i)).toBeInTheDocument();
  });
});

describe('MapScreen — map slice guardrails', () => {
  it('shows candidate labels with not-approved wording and preserves source links outside buttons', () => {
    renderMapScreen();

    expect(screen.queryByText(/synthetic aggregate layers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/all locations are source-verified/i)).not.toBeInTheDocument();
    const candidateLabels = screen.getAllByText(/candidate access point/i);
    expect(candidateLabels.length).toBeGreaterThan(0);
    expect(candidateLabels.some(label => (label.textContent ?? '').includes('not approved'))).toBe(true);

    const sourceLinks = screen.getAllByRole('link', { name: /verify with/i });
    expect(sourceLinks.some(link => link.closest('button') === null)).toBe(true);
    expect(screen.getAllByText(/provisional source/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/source-documented charging infrastructure/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/official source/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/checked 2026-08-26/i).length).toBeGreaterThan(0);
  });

  it('avoids unconditional simulated-data claims in the research beta banner', () => {
    renderMapScreen();

    expect(screen.queryByText(/include simulated aggregate data for demonstration/i)).not.toBeInTheDocument();
    expect(screen.getByText(/may contain simulated aggregate demonstration data when shown/i)).toBeInTheDocument();
    expect(screen.getByText(/source documentation is shown on each location card/i)).toBeInTheDocument();
    expect(screen.getByText(/approval is not implied/i)).toBeInTheDocument();
  });

  it('makes infrastructure, demand-zone, and planned-route list selections keyboard operable', () => {
    renderMapScreen();

    const accessPointsButton = screen.getByRole('button', { name: /access points/i });
    fireEvent.keyDown(accessPointsButton, { key: 'Enter', code: 'Enter' });
    fireEvent.keyUp(accessPointsButton, { key: 'Enter', code: 'Enter' });
    expect(screen.getAllByText(/candidate access point/i).length).toBeGreaterThan(0);

    const demandButton = screen.getByRole('button', { name: /commuters/i });
    fireEvent.keyDown(demandButton, { key: 'Enter', code: 'Enter' });
    fireEvent.keyUp(demandButton, { key: 'Enter', code: 'Enter' });
    expect(screen.getByText(/no generalized commuter-demand signals are available in this session/i)).toBeInTheDocument();

    const plannedRoutesButton = screen.getByRole('button', { name: /ev routes/i });
    fireEvent.keyDown(plannedRoutesButton, { key: 'Enter', code: 'Enter' });
    fireEvent.keyUp(plannedRoutesButton, { key: 'Enter', code: 'Enter' });
    expect(screen.getAllByText(/no generalized route-interest signals are available in this session/i).length).toBeGreaterThan(0);
  });

  it('keeps the selected detail drawer reachable and scroll-safe', () => {
    renderMapScreen();

    fireEvent.click(screen.getByText('Pasadena City College'));
    const drawer = screen.getByRole('complementary', { name: /selected map feature details/i });
    expect(drawer).toHaveClass('max-h-[calc(100vh-6rem)]');
    expect(drawer).toHaveClass('overflow-y-auto');
    expect(screen.getByRole('button', { name: /close map details/i })).toBeVisible();
  });
});
