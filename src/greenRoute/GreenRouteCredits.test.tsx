// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '../context/AppContext';
import { GreenRouteCredits } from './GreenRouteCredits';
import { loadProgramState, resetProgramSession } from './storage';

beforeEach(() => resetProgramSession());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });

describe('Green Wallet session workflow', () => {

  it('resets demo state and clears it through the application privacy action', () => {
    function SessionClear() {
      const { clearSessionData } = useApp();
      return <button onClick={clearSessionData}>Clear app session</button>;
    }
    render(<AppProvider><GreenRouteCredits /><SessionClear /></AppProvider>);
    click('Program administrator view'); click('Claim review'); click('Decline');
    click('Commuter view');
    expect(screen.getByText('$14.60 remaining')).toBeInTheDocument();
    click('Reset demo');
    expect(screen.getByText('$2.60 remaining')).toBeInTheDocument();
    click('Program administrator view'); click('Claim review'); click('Decline');
    click('Commuter view'); click('Clear app session');
    expect(screen.getByText('$2.60 remaining')).toBeInTheDocument();
    click('Submit claim');
    expect(screen.getByLabelText('Upload receipt (disabled in demo)')).toBeDisabled();
    expect(screen.getByText(/Use synthetic data only/)).toBeInTheDocument();
  });

  it('does not report copied when the clipboard rejects the request', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) } });
    render(<GreenRouteCredits />);
    click('Partner voucher');
    fireEvent.click(screen.getAllByRole('button', { name: 'Use voucher' })[0]);
    click('Copy demo code');
    expect(await screen.findByText('Copy unavailable — select the demo code manually.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
  });


  it('labels drafts as non-operative and reports invalid caps', () => {
    render(<GreenRouteCredits />);
    click('Program administrator view');
    click('Voucher campaigns');
    expect(screen.getByText(/does not change demo claim eligibility or caps/)).toBeInTheDocument();
    fill('Campaign name', 'Synthetic draft');
    fill('Monthly cap', '0');
    click('Save campaign draft');
    expect(screen.getByText(/finite positive amounts/)).toBeInTheDocument();
    fill('Monthly cap', '5');
    fill('Per-session cap', '1');
    click('Save campaign draft');
    expect(screen.getByText('Synthetic draft')).toBeInTheDocument();
    click('Commuter view');
    expect(screen.getByText('$2.60 remaining')).toBeInTheDocument();
  });

  it('holds a claim once, retains it across remount, and releases it on decline', () => {
    const mounted = render(<GreenRouteCredits />);
    expect(screen.getByText('$2.60 remaining')).toBeInTheDocument();
    click('Submit claim');
    fill('Charging location name', 'Synthetic site');
    fill('Energy charge amount', '2');
    fill('Energy delivered (kWh)', '10');
    fill('Receipt / session ID', 'SYNTHETIC-UI-1');
    fireEvent.click(screen.getByLabelText(/This session was related/));
    fireEvent.click(screen.getByLabelText(/I understand that idle fees/));
    click('Submit for demo review');
    expect(screen.getByText('Estimated Green Route Credit: $2.00')).toBeInTheDocument();
    expect(screen.getByText('Original submission status: Pending administrative review. See Credit activity for the current decision.')).toBeInTheDocument();
    click('Submit for demo review');
    expect(screen.getByText(/reference already exists/)).toBeInTheDocument();
    expect(loadProgramState().ledger.filter(row => row.referenceId === 'SYNTHETIC-UI-1')).toHaveLength(1);
    click('Dashboard');
    expect(screen.getByText('$0.60 remaining')).toBeInTheDocument();
    mounted.unmount();
    render(<GreenRouteCredits />);
    expect(screen.getByText('$0.60 remaining')).toBeInTheDocument();
    click('Program administrator view');
    click('Claim review');
    fireEvent.click(screen.getAllByRole('button', { name: 'Decline' })[0]);
    click('Commuter view');
    expect(screen.getByText('$2.60 remaining')).toBeInTheDocument();
    expect(screen.getByText(/21.8 kWh remaining/)).toBeInTheDocument();
  });
});
