import type { Locker } from '../../src/domain/Locker.js';
import { StorePackageService } from '../../src/application/StorePackageService.js';
import { RetrievePackageService } from '../../src/application/RetrievePackageService.js';
import { LockerOverviewService } from '../../src/application/LockerOverviewService.js';
import { LockerFactory } from '../../src/application/LockerFactory.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';
import { TieredStorageFeePolicy } from '../../src/application/policies/StorageFeePolicy.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { createApp } from '../../src/api/server.js';
import { FixedClock, SequenceCodeGenerator } from './stubs.js';

export const TEST_NOW = new Date('2026-08-15T10:00:00Z');

/** Full app wired with deterministic test doubles for clock and codes. */
export async function buildTestApp(
  lockers: Locker[] = [],
  codes: string[] = ['CODE01', 'CODE02', 'CODE03', 'CODE04', 'CODE05'],
) {
  const repository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await repository.add(locker);
  }
  const clock = new FixedClock(TEST_NOW);
  // Spec-example schedule so integration tests exercise non-zero charges.
  const feePolicy = new TieredStorageFeePolicy([
    { upToDay: 5, ratePerDay: 10 },
    { upToDay: 10, ratePerDay: 20 },
    { ratePerDay: 30 },
  ]);
  const app = createApp({
    lockerRepository: repository,
    lockerFactory: new LockerFactory(),
    storePackageService: new StorePackageService(
      repository,
      new SmallestSuitableLockerStrategy(),
      new SequenceCodeGenerator(codes),
      clock,
    ),
    retrievePackageService: new RetrievePackageService(repository, feePolicy, clock),
    lockerOverviewService: new LockerOverviewService(repository, feePolicy, clock),
  });
  return { app, clock, repository };
}
