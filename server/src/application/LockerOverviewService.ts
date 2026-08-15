import type { LockerSize } from '../domain/LockerSize.js';
import type { Clock, LockerRepository } from './ports.js';
import type { StorageFeePolicy } from './policies/StorageFeePolicy.js';

export interface AdminLockerView {
  id: string;
  size: LockerSize;
  available: boolean;
  /** PIN of the package inside — operations staff only; null when available. */
  pickupCode: string | null;
  storedAt: Date | null;
  /** What the customer would owe if they picked up right now. */
  accruedCharge: number | null;
}

/**
 * Station-operator use case: the full picture of every locker, including
 * the pickup PIN and the storage charge accrued so far. Internal — in
 * production this sits behind operator authentication.
 */
export class LockerOverviewService {
  constructor(
    private readonly lockers: LockerRepository,
    private readonly feePolicy: StorageFeePolicy,
    private readonly clock: Clock,
  ) {}

  async overview(): Promise<AdminLockerView[]> {
    const all = await this.lockers.findAll();
    const now = this.clock.now();

    return all.map((locker) => {
      const storedAt = locker.storedSince;
      return {
        id: locker.id,
        size: locker.size,
        available: locker.isAvailable,
        pickupCode: locker.activePickupCode,
        storedAt,
        accruedCharge: storedAt === null ? null : this.feePolicy.calculate(storedAt, now),
      };
    });
  }
}
