import type { Locker } from '../../src/domain/Locker.js';
import { StorePackageService } from '../../src/application/StorePackageService.js';
import { RetrievePackageService } from '../../src/application/RetrievePackageService.js';
import { StoreOrderService } from '../../src/application/StoreOrderService.js';
import { DispatchOrderService } from '../../src/application/DispatchOrderService.js';
import { ReturnPackageService } from '../../src/application/ReturnPackageService.js';
import { LockerOverviewService } from '../../src/application/LockerOverviewService.js';
import { LockerFactory } from '../../src/application/LockerFactory.js';
import { OrderFactory } from '../../src/application/OrderFactory.js';
import { RegisterOrderService } from '../../src/application/RegisterOrderService.js';
import { MockOrderService } from '../../src/application/MockOrderService.js';
import { InMemoryOrderRepository } from '../../src/infrastructure/InMemoryOrderRepository.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';
import { TieredStorageFeePolicy } from '../../src/application/policies/StorageFeePolicy.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { createApp } from '../../src/api/server.js';
import { FixedClock, RecordingNotifier, SequenceCodeGenerator } from './stubs.js';

export const TEST_NOW = new Date('2026-08-15T10:00:00Z');

/** Full app wired with deterministic test doubles for clock and codes. */
export async function buildTestApp(
  lockers: Locker[] = [],
  codes: string[] = ['CODE01', 'CODE02', 'CODE03', 'CODE04', 'CODE05'],
  returnAfterDays = 15,
) {
  const repository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await repository.add(locker);
  }
  const clock = new FixedClock(TEST_NOW);
  const notifier = new RecordingNotifier();
  const orderRepository = new InMemoryOrderRepository();
  // Spec-example schedule so integration tests exercise non-zero charges.
  const feePolicy = new TieredStorageFeePolicy([
    { upToDay: 5, ratePerDay: 10 },
    { upToDay: 10, ratePerDay: 20 },
    { ratePerDay: 30 },
  ]);
  const storePackageService = new StorePackageService(
    repository,
    new SmallestSuitableLockerStrategy(),
    new SequenceCodeGenerator(codes),
    clock,
    notifier,
  );
  const registerOrderService = new RegisterOrderService(
    orderRepository,
    repository,
    new OrderFactory(),
  );
  const app = createApp({
    lockerRepository: repository,
    lockerFactory: new LockerFactory(),
    orderRepository,
    registerOrderService,
    mockOrderService: new MockOrderService(repository, orderRepository, registerOrderService),
    storePackageService,
    storeOrderService: new StoreOrderService(orderRepository, storePackageService),
    dispatchOrderService: new DispatchOrderService(orderRepository),
    returnPackageService: new ReturnPackageService(
      repository,
      orderRepository,
      clock,
      returnAfterDays,
    ),
    retrievePackageService: new RetrievePackageService(repository, feePolicy, clock),
    lockerOverviewService: new LockerOverviewService(repository, feePolicy, clock),
  });
  return { app, clock, repository, notifier, orderRepository };
}
