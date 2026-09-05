import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PasadenaAdminScreen } from '../PasadenaAdminScreen';

describe('PasadenaAdminScreen', () => {
  it('shows the synthetic intervention assessment and modeled net VMT evidence', () => {
    render(<PasadenaAdminScreen onBack={vi.fn()} />);

    expect(screen.getByText('Intervention Assessment')).toBeInTheDocument();
    expect(screen.getByText(/C-1042/)).toBeInTheDocument();
    expect(screen.getByText('PLANNED EV ROUTE STRONGER')).toBeInTheDocument();
    expect(screen.getByText('91 / 100')).toBeInTheDocument();
    expect(screen.getByText('8.8 mi')).toBeInTheDocument();
    expect(screen.getAllByText(/SYNTHETIC DEMONSTRATION DATA/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Administrative review required/i)).toBeInTheDocument();
  });

  it('keeps charging readiness bounded to feasibility investigation', () => {
    render(<PasadenaAdminScreen onBack={vi.fn()} />);

    expect(screen.getByText(/Workplace charging feasibility investigation warranted/i)).toBeInTheDocument();
    expect(screen.getByText(/does not evaluate electrical capacity/i)).toBeInTheDocument();
  });
});
