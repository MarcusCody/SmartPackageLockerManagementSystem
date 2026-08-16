import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import { StationAtCapacityError } from '../../src/domain/errors.js';
import { RegisterOrderService } from '../../src/application/RegisterOrderService.js';
import { OrderFactory } from '../../src/application/OrderFactory.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { InMemoryOrderRepository } from '../../src/infrastructure/InMemoryOrderRepository.js';

const details = {
  customerName: 'Jane Tan',
  customerEmail: 'jane.tan@example.com',
  customerPhone: '+60 12-000 0001',
  packageSize: 'MEDIUM' as const,
};

async function setup(lockers: Locker[]) {
  const lockerRepository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await lockerRepository.add(locker);
  }
  const orderRepository = new InMemoryOrderRepository();
  const service = new RegisterOrderService(orderRepository, lockerRepository, new OrderFactory());
  return { service, orderRepository };
}

describe('RegisterOrderService', () => {
  it('registers an order awaiting dispatch when the station has capacity', async () => {
    const { service, orderRepository } = await setup([new Locker('M-1', 'MEDIUM')]);

    const order = await service.register(details);

    expect(order.id).toBe('ORD-1001');
    expect(order.isAwaitingDispatch).toBe(true);
    expect(await orderRepository.findAwaitingDispatch()).toHaveLength(1);
  });

  it('refuses an order the station cannot absorb', async () => {
    const { service, orderRepository } = await setup([new Locker('S-1', 'SMALL')]);

    await expect(service.register(details)).rejects.toThrow(StationAtCapacityError);
    expect(await orderRepository.findAwaitingDispatch()).toHaveLength(0);
  });

  it('counts earlier unstored orders against capacity', async () => {
    const { service } = await setup([new Locker('M-1', 'MEDIUM')]);
    await service.register(details);

    await expect(service.register(details)).rejects.toThrow(StationAtCapacityError);
  });
});
