import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import type { Package } from '../../src/domain/Package.js';
import { NoSuitableLockerError } from '../../src/domain/errors.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';

const NOW = new Date('2026-08-15T10:00:00Z');
const strategy = new SmallestSuitableLockerStrategy();
const makePackage = (id: string): Package => ({ id, size: 'SMALL' });

async function repositoryWith(lockers: Locker[]): Promise<InMemoryLockerRepository> {
  const repository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await repository.add(locker);
  }
  return repository;
}

describe('InMemoryLockerRepository.findAndReserve', () => {
  it('reserves the strategy-selected locker and stores the package in it', async () => {
    const repository = await repositoryWith([new Locker('L-1', 'LARGE'), new Locker('S-1', 'SMALL')]);

    const locker = await repository.findAndReserve(makePackage('pkg-1'), 'CODE01', NOW, strategy);

    expect(locker.id).toBe('S-1');
    expect(locker.isAvailable).toBe(false);
    expect(locker.activePickupCode).toBe('CODE01');
  });

  it('throws NoSuitableLockerError when the strategy finds no locker', async () => {
    const repository = await repositoryWith([]);

    await expect(
      repository.findAndReserve(makePackage('pkg-1'), 'CODE01', NOW, strategy),
    ).rejects.toThrow(NoSuitableLockerError);
  });

  it('never hands the same locker to two concurrent reservations', async () => {
    const repository = await repositoryWith([
      new Locker('S-1', 'SMALL'),
      new Locker('S-2', 'SMALL'),
      new Locker('S-3', 'SMALL'),
    ]);

    const attempts = 10;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        repository.findAndReserve(makePackage(`pkg-${i}`), `CODE0${i}`, NOW, strategy),
      ),
    );

    const reserved = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value.id);
    const rejected = results.filter(
      (result) =>
        result.status === 'rejected' && result.reason instanceof NoSuitableLockerError,
    );

    expect(reserved).toHaveLength(3);
    expect(new Set(reserved).size).toBe(3);
    expect(rejected).toHaveLength(attempts - 3);
  });
});
