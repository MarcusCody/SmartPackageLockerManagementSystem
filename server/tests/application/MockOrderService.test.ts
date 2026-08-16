import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import { StationAtCapacityError } from '../../src/domain/errors.js';
import { MockOrderService } from '../../src/application/MockOrderService.js';
import { RegisterOrderService } from '../../src/application/RegisterOrderService.js';
import { OrderFactory } from '../../src/application/OrderFactory.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { InMemoryOrderRepository } from '../../src/infrastructure/InMemoryOrderRepository.js';

// Deterministic "randomness": always the first option.
const firstPick = <T>(options: readonly T[]): T => {
  const option = options[0];
  if (option === undefined) {
    throw new Error('pick called with no options');
  }
  return option;
};

async function setup(lockers: Locker[]) {
  const lockerRepository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await lockerRepository.add(locker);
  }
  const orderRepository = new InMemoryOrderRepository();
  const service = new MockOrderService(
    lockerRepository,
    orderRepository,
    new RegisterOrderService(orderRepository, lockerRepository, new OrderFactory()),
    firstPick,
  );
  return { service, orderRepository };
}

describe('MockOrderService', () => {
  it('creates a realistic incoming order sized to what the station can absorb', async () => {
    const { service, orderRepository } = await setup([new Locker('S-1', 'SMALL')]);

    const order = await service.mockIncomingOrder();

    expect(order.packageSize).toBe('SMALL'); // the only acceptable size
    expect(order.isAwaitingDispatch).toBe(true);
    expect(order.customerName.length).toBeGreaterThan(0);
    expect(order.customerEmail).toMatch(/^[a-z.]+@example\.com$/);
    expect(order.customerPhone).toMatch(/^\+60/);
    expect(await orderRepository.findAwaitingDispatch()).toHaveLength(1);
  });

  it('refuses to mock an order when every size is at capacity', async () => {
    const { service } = await setup([new Locker('S-1', 'SMALL')]);
    await service.mockIncomingOrder(); // consumes the only slot

    await expect(service.mockIncomingOrder()).rejects.toThrow(StationAtCapacityError);
    await expect(service.mockIncomingOrder()).rejects.toThrow(/cannot accept new orders/i);
  });
});
