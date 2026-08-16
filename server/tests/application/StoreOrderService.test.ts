import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import { Order } from '../../src/domain/Order.js';
import {
  NoSuitableLockerError,
  OrderAlreadyStoredError,
  OrderNotFoundError,
} from '../../src/domain/errors.js';
import { StorePackageService } from '../../src/application/StorePackageService.js';
import { StoreOrderService } from '../../src/application/StoreOrderService.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { InMemoryOrderRepository } from '../../src/infrastructure/InMemoryOrderRepository.js';
import { FixedClock, RecordingNotifier, SequenceCodeGenerator } from '../helpers/stubs.js';

const NOW = new Date('2026-08-15T10:00:00Z');

const order = (id: string, packageSize: 'SMALL' | 'MEDIUM' | 'LARGE' = 'MEDIUM') =>
  new Order(id, {
    customerName: 'Jane Tan',
    customerEmail: 'jane.tan@example.com',
    customerPhone: '+60 12-000 0001',
    packageSize,
  });

async function setup(lockers: Locker[], orders: Order[]) {
  const lockerRepository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await lockerRepository.add(locker);
  }
  const orderRepository = new InMemoryOrderRepository();
  for (const pending of orders) {
    await orderRepository.add(pending);
  }
  const notifier = new RecordingNotifier();
  const service = new StoreOrderService(
    orderRepository,
    new StorePackageService(
      lockerRepository,
      new SmallestSuitableLockerStrategy(),
      new SequenceCodeGenerator(['CODE01', 'CODE02']),
      new FixedClock(NOW),
      notifier,
    ),
  );
  return { service, notifier, orderRepository, lockerRepository };
}

describe('StoreOrderService', () => {
  it("stores the order's package by its size and emails the order's contact", async () => {
    const { service, notifier } = await setup(
      [new Locker('S-1', 'SMALL'), new Locker('M-1', 'MEDIUM')],
      [order('ORD-1001', 'MEDIUM')],
    );

    const result = await service.storeOrder('ORD-1001');

    expect(result.lockerId).toBe('M-1');
    expect(result.notification).toBe('sent');
    expect(result.order).toMatchObject({ id: 'ORD-1001', customerEmail: 'jane.tan@example.com' });
    expect(notifier.sent[0]).toMatchObject({
      to: 'jane.tan@example.com',
      lockerId: 'M-1',
      packageSize: 'MEDIUM',
    });
  });

  it('removes the order from the pending queue once stored', async () => {
    const { service, orderRepository } = await setup(
      [new Locker('M-1', 'MEDIUM')],
      [order('ORD-1001'), order('ORD-1002')],
    );

    await service.storeOrder('ORD-1001');

    const pending = await orderRepository.findPending();
    expect(pending.map((o) => o.id)).toEqual(['ORD-1002']);
  });

  it('rejects an unknown order without touching any locker', async () => {
    const { service, lockerRepository } = await setup([new Locker('M-1', 'MEDIUM')], []);

    await expect(service.storeOrder('ORD-9999')).rejects.toThrow(OrderNotFoundError);

    const lockers = await lockerRepository.findAll();
    expect(lockers.every((locker) => locker.isAvailable)).toBe(true);
  });

  it('rejects storing the same order twice', async () => {
    const { service } = await setup(
      [new Locker('M-1', 'MEDIUM'), new Locker('M-2', 'MEDIUM')],
      [order('ORD-1001')],
    );
    await service.storeOrder('ORD-1001');

    await expect(service.storeOrder('ORD-1001')).rejects.toThrow(OrderAlreadyStoredError);
  });

  it('keeps the order pending and sends nothing when no locker fits', async () => {
    const { service, notifier, orderRepository } = await setup(
      [new Locker('S-1', 'SMALL')],
      [order('ORD-1001', 'LARGE')],
    );

    await expect(service.storeOrder('ORD-1001')).rejects.toThrow(NoSuitableLockerError);

    expect(notifier.sent).toHaveLength(0);
    const pending = await orderRepository.findPending();
    expect(pending.map((o) => o.id)).toEqual(['ORD-1001']);
  });
});
