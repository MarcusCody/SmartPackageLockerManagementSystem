import { Locker } from '../domain/Locker.js';
import type { LockerSize } from '../domain/LockerSize.js';

const PREFIX: Record<LockerSize, string> = { SMALL: 'S', MEDIUM: 'M', LARGE: 'L' };

/**
 * Single place lockers are created, so identifiers stay human-friendly
 * (S-1, M-2, ...) and sequential per size — customers type these ids at
 * the locker station.
 */
export class LockerFactory {
  private readonly counters: Record<LockerSize, number>;

  /** Pass persisted per-size counters to resume the sequences after a restart. */
  constructor(startFrom: Partial<Record<LockerSize, number>> = {}) {
    this.counters = { SMALL: 0, MEDIUM: 0, LARGE: 0, ...startFrom };
  }

  create(size: LockerSize): Locker {
    this.counters[size] += 1;
    return new Locker(`${PREFIX[size]}-${this.counters[size]}`, size);
  }
}
