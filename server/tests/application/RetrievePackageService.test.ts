import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import {
  InvalidPickupCodeError,
  LockerEmptyError,
  LockerNotFoundError,
} from '../../src/domain/errors.js';
import { StorePackageService } from '../../src/application/StorePackageService.js';
import { RetrievePackageService } from '../../src/application/RetrievePackageService.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';
import { TieredStorageFeePolicy } from '../../src/application/policies/StorageFeePolicy.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { FixedClock, RecordingNotifier, SequenceCodeGenerator } from '../helpers/stubs.js';

const NOW = new Date('2026-08-15T10:00:00Z');

async function setup(lockers: Locker[] = [new Locker('S-1', 'SMALL')]) {
  const repository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await repository.add(locker);
  }
  const clock = new FixedClock(NOW);
  const storeService = new StorePackageService(
    repository,
    new SmallestSuitableLockerStrategy(),
    new SequenceCodeGenerator(['CODE01', 'CODE02', 'CODE03']),
    clock,
    new RecordingNotifier(),
  );
  // The spec-example schedule (10/day days 1-5, 20/day days 6-10, 30/day
  // beyond) keeps the charge expectations below meaningful.
  const retrieveService = new RetrievePackageService(
    repository,
    new TieredStorageFeePolicy([
      { upToDay: 5, ratePerDay: 10 },
      { upToDay: 10, ratePerDay: 20 },
      { ratePerDay: 30 },
    ]),
    clock,
  );
  return { repository, storeService, retrieveService, clock };
}

describe('RetrievePackageService', () => {
  describe('with pickup code only (locker id optional)', () => {
    it('finds the right locker from the code alone and reports which locker opened', async () => {
      const { storeService, retrieveService } = await setup([
        new Locker('S-1', 'SMALL'),
        new Locker('S-2', 'SMALL'),
      ]);
      await storeService.store('SMALL');
      const second = await storeService.store('SMALL');

      const result = await retrieveService.retrieve(second.pickupCode);

      expect(result.lockerId).toBe(second.lockerId);
      expect(result.package.id).toBe(second.packageId);
    });

    it('rejects a code that matches no stored package', async () => {
      const { retrieveService } = await setup();

      await expect(retrieveService.retrieve('000000')).rejects.toThrow(InvalidPickupCodeError);
    });

    it('rejects a replayed code once its package was collected', async () => {
      const { storeService, retrieveService } = await setup();
      const stored = await storeService.store('SMALL');
      await retrieveService.retrieve(stored.pickupCode);

      await expect(retrieveService.retrieve(stored.pickupCode)).rejects.toThrow(
        InvalidPickupCodeError,
      );
    });
  });

  describe('with locker id provided (validated as a pair)', () => {
    it('returns the package for a valid locker id + pickup code', async () => {
      const { storeService, retrieveService } = await setup();
      const stored = await storeService.store('SMALL');

      const result = await retrieveService.retrieve(stored.pickupCode, stored.lockerId);

      expect(result.lockerId).toBe(stored.lockerId);
      expect(result.package.id).toBe(stored.packageId);
      expect(result.package.size).toBe('SMALL');
    });

    it('rejects an unknown locker id', async () => {
      const { retrieveService } = await setup();

      await expect(retrieveService.retrieve('CODE01', 'NOPE-1')).rejects.toThrow(
        LockerNotFoundError,
      );
    });

    it('rejects a wrong pickup code and leaves the package in place', async () => {
      const { storeService, retrieveService, repository } = await setup();
      const stored = await storeService.store('SMALL');

      await expect(retrieveService.retrieve('WRONG1', stored.lockerId)).rejects.toThrow(
        InvalidPickupCodeError,
      );

      const locker = await repository.findById(stored.lockerId);
      expect(locker?.isAvailable).toBe(false);
    });

    it('rejects a valid code presented at the wrong locker', async () => {
      const { storeService, retrieveService } = await setup([
        new Locker('S-1', 'SMALL'),
        new Locker('S-2', 'SMALL'),
      ]);
      const first = await storeService.store('SMALL');
      const second = await storeService.store('SMALL');

      await expect(retrieveService.retrieve(first.pickupCode, second.lockerId)).rejects.toThrow(
        InvalidPickupCodeError,
      );
    });

    it('rejects retrieval from an empty locker', async () => {
      const { retrieveService } = await setup();

      await expect(retrieveService.retrieve('CODE01', 'S-1')).rejects.toThrow(LockerEmptyError);
    });
  });

  it('frees the locker so it can take a future delivery', async () => {
    const { storeService, retrieveService, repository } = await setup();
    const stored = await storeService.store('SMALL');

    await retrieveService.retrieve(stored.pickupCode);

    const locker = await repository.findById(stored.lockerId);
    expect(locker?.isAvailable).toBe(true);

    const next = await storeService.store('SMALL');
    expect(next.lockerId).toBe(stored.lockerId);
  });

  describe('storage charges (Level 3)', () => {
    it('returns the storage charge with the pickup confirmation', async () => {
      const { storeService, retrieveService, clock } = await setup();
      const stored = await storeService.store('SMALL');

      clock.advanceHours(2);
      const result = await retrieveService.retrieve(stored.pickupCode);

      expect(result.storageCharge).toBe(10); // day 1 at X = 10
      expect(result.storedAt).toEqual(NOW);
      expect(result.retrievedAt).toEqual(clock.now());
    });

    it('charges for the full duration the package stayed, across tiers', async () => {
      const { storeService, retrieveService, clock } = await setup();
      const stored = await storeService.store('SMALL');

      clock.advanceHours(6 * 24); // exactly 6 days: 5 at X + 1 at 2X
      const result = await retrieveService.retrieve(stored.pickupCode);

      expect(result.storageCharge).toBe(70);
    });

    it('charges each stored package from its own storage time', async () => {
      const { storeService, retrieveService, clock } = await setup([
        new Locker('S-1', 'SMALL'),
        new Locker('S-2', 'SMALL'),
      ]);
      const first = await storeService.store('SMALL');
      clock.advanceHours(3 * 24); // first has been in 3 days when second arrives
      const second = await storeService.store('SMALL');
      clock.advanceHours(1);

      const firstResult = await retrieveService.retrieve(first.pickupCode);
      const secondResult = await retrieveService.retrieve(second.pickupCode);

      expect(firstResult.storageCharge).toBe(40); // 4 days at X
      expect(secondResult.storageCharge).toBe(10); // 1 day at X
    });
  });
});
