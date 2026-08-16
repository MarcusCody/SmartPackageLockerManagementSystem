import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReturnsView } from './ReturnsView';
import type { OverdueView } from '../api/client';

const overdue: OverdueView[] = [
  {
    lockerId: 'M-1',
    size: 'MEDIUM',
    storedAt: '2026-08-01T10:00:00.000Z',
    daysInLocker: 16,
    orderId: 'ORD-1001',
    customerName: 'Jane Tan',
  },
];

describe('ReturnsView', () => {
  it('lists overdue packages with how long they have sat in the locker', () => {
    render(<ReturnsView overdue={overdue} onReturn={vi.fn()} />);

    expect(screen.getByText('M-1')).toBeInTheDocument();
    expect(screen.getByText(/16 days in locker/i)).toBeInTheDocument();
    expect(screen.getByText(/jane tan/i)).toBeInTheDocument();
  });

  it('returns the package to the warehouse', async () => {
    const onReturn = vi.fn().mockResolvedValue({
      returned: true,
      lockerId: 'M-1',
      packageId: 'pkg-1',
      orderId: 'ORD-1001',
    });
    const user = userEvent.setup();
    render(<ReturnsView overdue={overdue} onReturn={onReturn} />);

    await user.click(screen.getByRole('button', { name: /return locker m-1/i }));

    expect(onReturn).toHaveBeenCalledWith('M-1');
    expect(await screen.findByText(/returned to the warehouse/i)).toBeInTheDocument();
  });

  it('renders nothing when no packages are overdue', () => {
    render(<ReturnsView overdue={[]} onReturn={vi.fn()} />);

    expect(screen.queryByText(/return to warehouse/i)).not.toBeInTheDocument();
  });
});
