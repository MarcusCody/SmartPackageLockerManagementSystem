import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import { Order } from '../../src/domain/Order.js';
import {
  LockerEmptyError,
  LockerNotFoundError,
  PackageNotOverdueError,
} from '../../src/domain/errors.js';
import { StorePackageService } from '../../src/application/StorePackageService.js';
import { StoreOrderService } from '../../src/application/StoreOrderService.js';
import { ReturnPackageService } from '../../src/application/ReturnPackageService.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { InMemoryOrderRepository } from '../../src/infrastructure/InMemoryOrderRepository.js';
import { FixedClock, RecordingNotifier, SequenceCodeGenerator } from '../helpers/stubs.js';

const NOW = new Date('2026-08-15T10:00:00Z');
const THRESHOLD_DAYS = 15;

async function setup(lockers: Locker[] = [new Locker('M-1', 'MEDIUM')]) {
  const lockerRepository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await lockerRepository.add(locker);
  }
  const orderRepository = new InMemoryOrderRepository();
  const order = new Order('ORD-1001', {
    customerName: 'Jane Tan',
    customerEmail: 'jane.tan@example.com',
    customerPhone: '+60 12-000 0001',
    packageSize: 'MEDIUM',
  });
  order.dispatch();
  await orderRepository.add(order);

  const clock = new FixedClock(NOW);
  const storePackageService = new StorePackageService(
    lockerRepository,
    new SmallestSuitableLockerStrategy(),
    new SequenceCodeGenerator(['CODE01', 'CODE02']),
    clock,
    new RecordingNotifier(),
  );
  const storeOrderService = new StoreOrderService(orderRepository, storePackageService);
  const returnService = new ReturnPackageService(
    lockerRepository,
    orderRepository,
    clock,
    THRESHOLD_DAYS,
  );
  return {
    clock,
    order,
    lockerRepository,
    storeOrderService,
    storePackageService,
    returnService,
  };
}

describe('ReturnPackageService', () => {
  it('lists nothing before the threshold is reached', async () => {
    const { storeOrderService, returnService, clock } = await setup();
    await storeOrderService.storeOrder('ORD-1001');

    clock.advanceHours(THRESHOLD_DAYS * 24 - 1);

    expect(await returnService.listOverdue()).toEqual([]);
  });

  it('lists a package as overdue once it has sat the full threshold', async () => {
    const { storeOrderService, returnService, clock } = await setup();
    await storeOrderService.storeOrder('ORD-1001');

    clock.advanceHours(THRESHOLD_DAYS * 24);

    const overdue = await returnService.listOverdue();
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({
      lockerId: 'M-1',
      size: 'MEDIUM',
      storedAt: NOW,
      daysInLocker: 15,
      orderId: 'ORD-1001',
      customerName: 'Jane Tan',
    });
  });

  it('returns an overdue package: locker freed, PIN dead, order marked RETURNED', async () => {
    const { storeOrderService, returnService, clock, lockerRepository, order } = await setup();
    const stored = await storeOrderService.storeOrder('ORD-1001');
    clock.advanceHours(16 * 24);

    const result = await returnService.returnToWarehouse('M-1');

    expect(result).toEqual({ lockerId: 'M-1', packageId: stored.packageId, orderId: 'ORD-1001' });
    const locker = await lockerRepository.findById('M-1');
    expect(locker?.isAvailable).toBe(true);
    expect(locker?.activePickupCode).toBeNull();
    expect(order.status).toBe('RETURNED');
  });

  it('handles walk-in packages that have no order', async () => {
    const { storePackageService, returnService, clock } = await setup([
      new Locker('S-1', 'SMALL'),
    ]);
    await storePackageService.store('SMALL');
    clock.advanceHours(16 * 24);

    const overdue = await returnService.listOverdue();
    expect(overdue[0]).toMatchObject({ lockerId: 'S-1', orderId: null, customerName: null });

    const result = await returnService.returnToWarehouse('S-1');
    expect(result.orderId).toBeNull();
  });

  it('refuses to return a package that is not yet overdue', async () => {
    const { storeOrderService, returnService, clock } = await setup();
    await storeOrderService.storeOrder('ORD-1001');
    clock.advanceHours(24);

    await expect(returnService.returnToWarehouse('M-1')).rejects.toThrow(PackageNotOverdueError);
  });

  it('rejects an unknown locker', async () => {
    const { returnService } = await setup();

    await expect(returnService.returnToWarehouse('X-9')).rejects.toThrow(LockerNotFoundError);
  });

  it('rejects an empty locker', async () => {
    const { returnService } = await setup();

    await expect(returnService.returnToWarehouse('M-1')).rejects.toThrow(LockerEmptyError);
  });
});
