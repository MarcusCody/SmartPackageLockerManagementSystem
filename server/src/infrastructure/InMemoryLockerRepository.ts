import type { Locker } from '../domain/Locker.js';
import type { Package } from '../domain/Package.js';
import { NoSuitableLockerError } from '../domain/errors.js';
import type { LockerRepository } from '../application/ports.js';
import type { LockerAllocationStrategy } from '../application/policies/LockerAllocationStrategy.js';

export class InMemoryLockerRepository implements LockerRepository {
  private readonly lockers = new Map<string, Locker>();

  async add(locker: Locker): Promise<void> {
    if (this.lockers.has(locker.id)) {
      throw new Error(`Duplicate locker id: ${locker.id}`);
    }
    this.lockers.set(locker.id, locker);
  }

  async findAll(): Promise<Locker[]> {
    return [...this.lockers.values()];
  }

  async findById(id: string): Promise<Locker | undefined> {
    return this.lockers.get(id);
  }

  async findByActivePickupCode(pickupCode: string): Promise<Locker | undefined> {
    return [...this.lockers.values()].find(
      (locker) => locker.activePickupCode === pickupCode,
    );
  }

  async findAndReserve(
    pkg: Package,
    pickupCode: string,
    storedAt: Date,
    strategy: LockerAllocationStrategy,
  ): Promise<Locker> {
    // Critical section: select and reserve with no awaits in between.
    // Node runs this block without interleaving, so concurrent requests
    // observe reservations from every earlier request. In a multi-instance
    // deployment this method is where a database transaction would go.
    const locker = strategy.select(pkg.size, [...this.lockers.values()]);
    if (locker === undefined) {
      throw new NoSuitableLockerError(pkg.size);
    }
    locker.store(pkg, pickupCode, storedAt);
    return locker;
  }
}
