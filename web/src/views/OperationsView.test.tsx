import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationsView } from './OperationsView';
import { ApiError } from '../api/client';
import type { AdminLockerView, OrderView } from '../api/client';

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

const incoming: OrderView[] = [
  {
    id: 'ORD-1005',
    customerName: 'Sara Lim',
    customerEmail: 'sara.lim@example.com',
    customerPhone: '+60 12-000 0005',
    size: 'MEDIUM',
  },
];

function renderView(overrides: Partial<Parameters<typeof OperationsView>[0]> = {}) {
  return render(
    <OperationsView
      lockers={lockers}
      incoming={incoming}
      onCreate={vi.fn()}
      onDispatch={vi.fn()}
      onMockOrder={vi.fn()}
      {...overrides}
    />,
  );
}

describe('OperationsView', () => {
  it('shows the pickup PIN and accrued charge for occupied lockers', () => {
    renderView();

    expect(screen.getByText('042731')).toBeInTheDocument();
    expect(screen.getByText(/accrued rm20/i)).toBeInTheDocument();
  });

  it('shows no PIN on available lockers and summarises capacity', () => {
    renderView();

    const overview = screen.getByRole('list', { name: /locker overview/i });
    expect(within(overview).getAllByText(/pin/i)).toHaveLength(1);
    expect(screen.getByText(/2 lockers · 1 available · 1 occupied/i)).toBeInTheDocument();
  });

  it('lists incoming platform orders and dispatches them to the station', async () => {
    const onDispatch = vi.fn().mockResolvedValue(incoming[0]);
    const user = userEvent.setup();
    renderView({ onDispatch });

    expect(screen.getByText('ORD-1005')).toBeInTheDocument();
    expect(screen.getByText(/sara lim/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dispatch order ord-1005/i }));

    expect(onDispatch).toHaveBeenCalledWith('ORD-1005');
    expect(await screen.findByText(/ord-1005 dispatched/i)).toBeInTheDocument();
  });

  it('shows an empty state when the platform has nothing to dispatch', () => {
    renderView({ incoming: [] });

    expect(screen.getByText(/no incoming orders/i)).toBeInTheDocument();
  });

  it('mocks a new incoming order from the platform', async () => {
    const onMockOrder = vi.fn().mockResolvedValue({
      id: 'ORD-1010',
      customerName: 'Ben Ong',
      customerEmail: 'ben.ong@example.com',
      customerPhone: '+60 12-345 6789',
      size: 'SMALL',
    });
    const user = userEvent.setup();
    renderView({ onMockOrder });

    await user.click(screen.getByRole('button', { name: /mock incoming order/i }));

    expect(onMockOrder).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/ord-1010.*arrived from the platform/i)).toBeInTheDocument();
  });

  it('tells the operator why no order can arrive when the station is full', async () => {
    const onMockOrder = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          'STATION_AT_CAPACITY',
          'The station cannot accept new orders right now: every locker size is at capacity, counting free lockers and undelivered orders.',
          409,
        ),
      );
    const user = userEvent.setup();
    renderView({ onMockOrder });

    await user.click(screen.getByRole('button', { name: /mock incoming order/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot accept new orders/i);
  });
});
