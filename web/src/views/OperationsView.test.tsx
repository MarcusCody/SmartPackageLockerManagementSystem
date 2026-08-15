import { render, screen } from '@testing-library/react';
import { OperationsView } from './OperationsView';
import type { AdminLockerView } from '../api/client';

const lockers: AdminLockerView[] = [
  {
    id: 'S-1',
    size: 'SMALL',
    available: false,
    pickupCode: '042731',
    storedAt: '2026-08-15T10:00:00.000Z',
    accruedCharge: 20,
  },
  {
    id: 'S-2',
    size: 'SMALL',
    available: true,
    pickupCode: null,
    storedAt: null,
    accruedCharge: null,
  },
];

describe('OperationsView', () => {
  it('shows the pickup PIN and accrued charge for occupied lockers', () => {
    render(<OperationsView lockers={lockers} onCreate={vi.fn()} />);

    expect(screen.getByText('042731')).toBeInTheDocument();
    expect(screen.getByText(/20 units/i)).toBeInTheDocument();
  });

  it('shows no PIN on available lockers and summarises capacity', () => {
    render(<OperationsView lockers={lockers} onCreate={vi.fn()} />);

    expect(screen.getAllByText(/pin/i)).toHaveLength(1);
    expect(screen.getByText(/2 lockers · 1 available · 1 occupied/i)).toBeInTheDocument();
  });
});
