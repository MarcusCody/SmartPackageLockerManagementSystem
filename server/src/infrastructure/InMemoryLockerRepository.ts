import type { Locker } from '../domain/Locker.js';
import type { LockerRepository } from '../application/ports.js';

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
}
