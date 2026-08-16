/**
 * Computes what a customer owes for the time their package sat in a
 * locker. A policy so pricing can change without touching the retrieval
 * workflow.
 */
export interface StorageFeePolicy {
  calculate(storedAt: Date, retrievedAt: Date): number;
}

/**
 * One pricing band: `ratePerDay` applies to every day up to and including
 * `upToDay`. The final band omits `upToDay` and applies forever after.
 */
export interface FeeBand {
  upToDay?: number;
  ratePerDay: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Prices each started 24h window from the moment of storage against a
 * schedule of day bands, e.g. free for days 1-5, RM1/day for days 6-7,
 * RM2/day afterwards. A package retrieved within the first 24h is in
 * day 1.
 */
export class TieredStorageFeePolicy implements StorageFeePolicy {
  constructor(private readonly bands: readonly FeeBand[]) {
    if (bands.length === 0) {
      throw new Error('Fee schedule needs at least one band.');
    }
    bands.forEach((band, index) => {
      const isLast = index === bands.length - 1;
      if (isLast && band.upToDay !== undefined) {
        throw new Error('The final fee band must be open-ended (no upToDay).');
      }
      if (!isLast && band.upToDay === undefined) {
        throw new Error('Only the final fee band may be open-ended.');
      }
      if (band.ratePerDay < 0) {
        throw new Error('Fee band rates cannot be negative.');
      }
      const previous = bands[index - 1];
      if (
        previous?.upToDay !== undefined &&
        band.upToDay !== undefined &&
        band.upToDay <= previous.upToDay
      ) {
        throw new Error('Fee bands must be in ascending day order.');
      }
    });
  }

  calculate(storedAt: Date, retrievedAt: Date): number {
    const elapsedMs = retrievedAt.getTime() - storedAt.getTime();
    if (elapsedMs < 0) {
      throw new Error('Retrieval time cannot be before the storage time.');
    }

    const daysHeld = Math.max(1, Math.ceil(elapsedMs / DAY_MS));
    let total = 0;
    for (let day = 1; day <= daysHeld; day += 1) {
      total += this.rateForDay(day);
    }
    return total;
  }

  private rateForDay(day: number): number {
    for (const band of this.bands) {
      if (band.upToDay === undefined || day <= band.upToDay) {
        return band.ratePerDay;
      }
    }
    // Unreachable: the constructor guarantees the final band is open-ended.
    return 0;
  }
}
