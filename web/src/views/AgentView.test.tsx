import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentView } from './AgentView';
import { ApiError } from '../api/client';
import type { OrderView } from '../api/client';

const orders: OrderView[] = [
  {
    id: 'ORD-1001',
    customerName: 'Jane Tan',
    customerEmail: 'jane.tan@example.com',
    customerPhone: '+60 12-000 0001',
    size: 'SMALL',
  },
  {
    id: 'ORD-1002',
    customerName: 'Adam Lee',
    customerEmail: 'adam.lee@example.com',
    customerPhone: '+60 12-000 0002',
    size: 'MEDIUM',
  },
];

const storeOrderResult = (overrides: Record<string, unknown> = {}) => ({
  lockerId: 'S-1',
  pickupCode: '042731',
  packageId: 'pkg-1',
  notification: 'sent' as const,
  order: {
    id: 'ORD-1001',
    customerName: 'Jane Tan',
    customerEmail: 'jane.tan@example.com',
    customerPhone: '+60 12-000 0001',
    packageSize: 'SMALL' as const,
  },
  ...overrides,
});

describe('AgentView', () => {
  it('lists pending orders with the customer contact that came with them', () => {
    render(<AgentView orders={orders} onStoreOrder={vi.fn()} />);

    expect(screen.getByText('ORD-1001')).toBeInTheDocument();
    expect(screen.getByText(/jane tan/i)).toBeInTheDocument();
    expect(screen.getByText(/jane\.tan@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/\+60 12-000 0001/)).toBeInTheDocument();
    expect(screen.getByText('ORD-1002')).toBeInTheDocument();
  });

  it('stores the selected order and confirms locker, PIN and email', async () => {
    const onStoreOrder = vi.fn().mockResolvedValue(storeOrderResult());
    const user = userEvent.setup();
    render(<AgentView orders={orders} onStoreOrder={onStoreOrder} />);

    await user.click(screen.getByRole('button', { name: /store order ord-1001/i }));

    expect(onStoreOrder).toHaveBeenCalledWith('ORD-1001');
    expect(await screen.findByText('S-1')).toBeInTheDocument();
    expect(screen.getByText('042731')).toBeInTheDocument();
    expect(screen.getByText(/pin sent to jane\.tan@example\.com/i)).toBeInTheDocument();
  });

  it('warns the agent to share the PIN manually when the email fails', async () => {
    const onStoreOrder = vi.fn().mockResolvedValue(storeOrderResult({ notification: 'failed' }));
    const user = userEvent.setup();
    render(<AgentView orders={orders} onStoreOrder={onStoreOrder} />);

    await user.click(screen.getByRole('button', { name: /store order ord-1001/i }));

    expect(
      await screen.findByText(/share the pin with the customer manually/i),
    ).toBeInTheDocument();
  });

  it('shows an empty state when there are no pending orders', () => {
    render(<AgentView orders={[]} onStoreOrder={vi.fn()} />);

    expect(screen.getByText(/no pending orders/i)).toBeInTheDocument();
  });

  it('tells the agent when no suitable locker is available for the order', async () => {
    const onStoreOrder = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          'NO_SUITABLE_LOCKER',
          'No suitable locker is available for a MEDIUM package. The package cannot be stored.',
          409,
        ),
      );
    const user = userEvent.setup();
    render(<AgentView orders={orders} onStoreOrder={onStoreOrder} />);

    await user.click(screen.getByRole('button', { name: /store order ord-1002/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be stored/i);
  });
});
