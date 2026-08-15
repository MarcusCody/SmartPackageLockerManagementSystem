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
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { FixedClock, SequenceCodeGenerator } from '../helpers/stubs.js';

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
  );
  const retrieveService = new RetrievePackageService(repository);
  return { repository, storeService, retrieveService, clock };
}

describe('RetrievePackageService', () => {
  it('returns the package for a valid locker id + pickup code', async () => {
    const { storeService, retrieveService } = await setup();
    const stored = await storeService.store('SMALL');

    const result = await retrieveService.retrieve(stored.lockerId, stored.pickupCode);

    expect(result.package.id).toBe(stored.packageId);
    expect(result.package.size).toBe('SMALL');
  });

  it('frees the locker so it can take a future delivery', async () => {
    const { storeService, retrieveService, repository } = await setup();
    const stored = await storeService.store('SMALL');

    await retrieveService.retrieve(stored.lockerId, stored.pickupCode);

    const locker = await repository.findById(stored.lockerId);
    expect(locker?.isAvailable).toBe(true);

    const next = await storeService.store('SMALL');
    expect(next.lockerId).toBe(stored.lockerId);
  });

  it('rejects an unknown locker id', async () => {
    const { retrieveService } = await setup();

    await expect(retrieveService.retrieve('NOPE-1', 'CODE01')).rejects.toThrow(
      LockerNotFoundError,
    );
  });

  it('rejects a wrong pickup code and leaves the package in place', async () => {
    const { storeService, retrieveService, repository } = await setup();
    const stored = await storeService.store('SMALL');

    await expect(retrieveService.retrieve(stored.lockerId, 'WRONG1')).rejects.toThrow(
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

    await expect(retrieveService.retrieve(second.lockerId, first.pickupCode)).rejects.toThrow(
      InvalidPickupCodeError,
    );
  });

  it('rejects retrieval from an empty locker', async () => {
    const { retrieveService } = await setup();

    await expect(retrieveService.retrieve('S-1', 'CODE01')).rejects.toThrow(LockerEmptyError);
  });

  it('rejects a pickup code that was already used', async () => {
    const { storeService, retrieveService } = await setup();
    const stored = await storeService.store('SMALL');
    await retrieveService.retrieve(stored.lockerId, stored.pickupCode);

    await expect(retrieveService.retrieve(stored.lockerId, stored.pickupCode)).rejects.toThrow(
      LockerEmptyError,
    );
  });
});
