import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    render(<OperationsView lockers={lockers} onCreate={vi.fn()} onCreateOrder={vi.fn()} />);

    expect(screen.getByText('042731')).toBeInTheDocument();
    expect(screen.getByText(/accrued rm20/i)).toBeInTheDocument();
  });

  it('shows no PIN on available lockers and summarises capacity', () => {
    render(<OperationsView lockers={lockers} onCreate={vi.fn()} onCreateOrder={vi.fn()} />);

    const overview = screen.getByRole('list', { name: /locker overview/i });
    expect(within(overview).getAllByText(/pin/i)).toHaveLength(1);
    expect(screen.getByText(/2 lockers · 1 available · 1 occupied/i)).toBeInTheDocument();
  });

  it('renders the station wall preview alongside the overview', () => {
    render(<OperationsView lockers={lockers} onCreate={vi.fn()} onCreateOrder={vi.fn()} />);

    expect(screen.getByRole('img', { name: /locker s-1, small, occupied/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /locker s-2, small, available/i })).toBeInTheDocument();
  });

  it('registers an incoming order with the customer contact details', async () => {
    const onCreateOrder = vi.fn().mockResolvedValue({
      id: 'ORD-1005',
      customerName: 'Jane Tan',
      customerEmail: 'jane.tan@example.com',
      customerPhone: '+60 12-000 0001',
      size: 'MEDIUM',
    });
    const user = userEvent.setup();
    render(<OperationsView lockers={lockers} onCreate={vi.fn()} onCreateOrder={onCreateOrder} />);

    await user.type(screen.getByLabelText(/customer name/i), 'Jane Tan');
    await user.type(screen.getByLabelText(/customer email/i), 'jane.tan@example.com');
    await user.type(screen.getByLabelText(/customer phone/i), '+60 12-000 0001');
    await user.selectOptions(screen.getByLabelText(/order size/i), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: /register order/i }));

    expect(onCreateOrder).toHaveBeenCalledWith({
      customerName: 'Jane Tan',
      customerEmail: 'jane.tan@example.com',
      customerPhone: '+60 12-000 0001',
      size: 'MEDIUM',
    });
    expect(await screen.findByText(/ord-1005 registered/i)).toBeInTheDocument();
  });
});
