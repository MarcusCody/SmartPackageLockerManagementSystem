import type { Locker } from '../../domain/Locker.js';
import type { LockerSize } from '../../domain/LockerSize.js';
import { compareBySize } from '../../domain/LockerSize.js';

/**
 * Picks which locker a package should go into. A strategy so the
 * allocation rule can evolve (e.g. spread wear across lockers) without
 * touching the storage workflow.
 */
export interface LockerAllocationStrategy {
  select(packageSize: LockerSize, lockers: readonly Locker[]): Locker | undefined;
}

/**
 * The spec's rule: the smallest available locker that can accommodate the
 * package. Ties between equal-size lockers resolve by insertion order so
 * allocation is deterministic.
 */
export class SmallestSuitableLockerStrategy implements LockerAllocationStrategy {
  select(packageSize: LockerSize, lockers: readonly Locker[]): Locker | undefined {
    return lockers
      .filter((locker) => locker.isAvailable && locker.canAccommodate(packageSize))
      .sort((a, b) => compareBySize(a.size, b.size))[0];
  }
}
