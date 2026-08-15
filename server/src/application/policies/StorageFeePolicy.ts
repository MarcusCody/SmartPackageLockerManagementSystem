/**
 * Computes what a customer owes for the time their package sat in a
 * locker. A policy so pricing can change without touching the retrieval
 * workflow.
 */
export interface StorageFeePolicy {
  calculate(storedAt: Date, retrievedAt: Date): number;
}

export interface TieredStorageFeeConfig {
  /** X — units charged per day in the first tier. */
  ratePerDay: number;
  /** Last day charged at X (inclusive). */
  tier1EndDay: number;
  /** Last day charged at 2X (inclusive); 3X applies afterwards. */
  tier2EndDay: number;
  /** Grace days before charging starts. 0 = day 1 is charged, per the spec example. */
  freeDays: number;
}

const DEFAULTS: Omit<TieredStorageFeeConfig, 'ratePerDay'> = {
  tier1EndDay: 5,
  tier2EndDay: 10,
  freeDays: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The spec's example pricing: X/day for days 1-5, 2X/day for days 6-10,
 * 3X/day beyond. A "day" is each started 24h window from the moment of
 * storage, so a package retrieved within the first 24h is in day 1.
 */
export class TieredStorageFeePolicy implements StorageFeePolicy {
  private readonly config: TieredStorageFeeConfig;

  constructor(config: Partial<TieredStorageFeeConfig> & Pick<TieredStorageFeeConfig, 'ratePerDay'>) {
    this.config = { ...DEFAULTS, ...config };
  }

  calculate(storedAt: Date, retrievedAt: Date): number {
    const elapsedMs = retrievedAt.getTime() - storedAt.getTime();
    if (elapsedMs < 0) {
      throw new Error('Retrieval time cannot be before the storage time.');
    }

    const daysHeld = Math.max(1, Math.ceil(elapsedMs / DAY_MS));
    let total = 0;
    for (let day = this.config.freeDays + 1; day <= daysHeld; day += 1) {
      total += this.rateForDay(day);
    }
    return total;
  }

  private rateForDay(day: number): number {
    const { ratePerDay, tier1EndDay, tier2EndDay } = this.config;
    if (day <= tier1EndDay) return ratePerDay;
    if (day <= tier2EndDay) return 2 * ratePerDay;
    return 3 * ratePerDay;
  }
}
