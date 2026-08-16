import { describe, expect, it } from 'vitest';
import { Order } from '../../src/domain/Order.js';
import { OrderAlreadyDispatchedError, OrderNotFoundError } from '../../src/domain/errors.js';
import { DispatchOrderService } from '../../src/application/DispatchOrderService.js';
import { InMemoryOrderRepository } from '../../src/infrastructure/InMemoryOrderRepository.js';

const details = {
  customerName: 'Jane Tan',
  customerEmail: 'jane.tan@example.com',
  customerPhone: '+60 12-000 0001',
  packageSize: 'SMALL' as const,
};

async function setup(orders: Order[]) {
  const repository = new InMemoryOrderRepository();
  for (const order of orders) {
    await repository.add(order);
  }
  return { repository, service: new DispatchOrderService(repository) };
}

describe('DispatchOrderService', () => {
  it("moves an awaiting order into the station's pending queue", async () => {
    const { service, repository } = await setup([new Order('ORD-1001', details)]);

    const order = await service.dispatch('ORD-1001');

    expect(order.isPending).toBe(true);
    const pending = await repository.findPending();
    expect(pending.map((o) => o.id)).toEqual(['ORD-1001']);
    const awaiting = await repository.findAwaitingDispatch();
    expect(awaiting).toEqual([]);
  });

  it('rejects an unknown order', async () => {
    const { service } = await setup([]);

    await expect(service.dispatch('ORD-9999')).rejects.toThrow(OrderNotFoundError);
  });

  it('rejects dispatching the same order twice', async () => {
    const { service } = await setup([new Order('ORD-1001', details)]);
    await service.dispatch('ORD-1001');

    await expect(service.dispatch('ORD-1001')).rejects.toThrow(OrderAlreadyDispatchedError);
  });
});
