import type { Locker } from '../domain/Locker.js';
import type { LockerSize } from '../domain/LockerSize.js';
import { LockerNotFoundError, PackageNotOverdueError } from '../domain/errors.js';
import type { Clock, LockerRepository, OrderRepository } from './ports.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface OverduePackageView {
  lockerId: string;
  size: LockerSize;
  storedAt: Date;
  /** Full days the package has sat in the locker. */
  daysInLocker: number;
  /** Null for walk-in packages stored without an order. */
  orderId: string | null;
  customerName: string | null;
}

export interface ReturnResult {
  lockerId: string;
  packageId: string;
  orderId: string | null;
}

/**
 * Agent use case: packages that sat past the threshold are overdue and
 * go back to the warehouse. The locker opens via a staff override (no
 * PIN), becomes available again, and the linked order — when there is
 * one — is marked RETURNED.
 */
export class ReturnPackageService {
  constructor(
    private readonly lockers: LockerRepository,
    private readonly orders: OrderRepository,
    private readonly clock: Clock,
    private readonly thresholdDays: number,
  ) {}

  async listOverdue(): Promise<OverduePackageView[]> {
    const now = this.clock.now().getTime();
    const all = await this.lockers.findAll();

    const overdue: OverduePackageView[] = [];
    for (const locker of all) {
      const storedAt = locker.storedSince;
      if (storedAt === null || !this.isOverdue(storedAt, now)) {
        continue;
      }
      const order = await this.orderForLocker(locker);
      overdue.push({
        lockerId: locker.id,
        size: locker.size,
        storedAt,
        daysInLocker: Math.floor((now - storedAt.getTime()) / DAY_MS),
        orderId: order?.id ?? null,
        customerName: order?.customerName ?? null,
      });
    }
    return overdue;
  }

  async returnToWarehouse(lockerId: string): Promise<ReturnResult> {
    const locker = await this.lockers.findById(lockerId);
    if (locker === undefined) {
      throw new LockerNotFoundError(lockerId);
    }

    const storedAt = locker.storedSince;
    if (storedAt !== null && !this.isOverdue(storedAt, this.clock.now().getTime())) {
      throw new PackageNotOverdueError(lockerId, this.thresholdDays);
    }

    const order = await this.orderForLocker(locker);
    // Throws LockerEmptyError when there is nothing to return.
    const { pkg } = locker.removeForReturn();
    order?.markReturned();

    return { lockerId: locker.id, packageId: pkg.id, orderId: order?.id ?? null };
  }

  private isOverdue(storedAt: Date, nowMs: number): boolean {
    return nowMs - storedAt.getTime() >= this.thresholdDays * DAY_MS;
  }

  private async orderForLocker(locker: Locker) {
    const packageId = locker.storedPackageId;
    return packageId === null ? undefined : this.orders.findByPackageId(packageId);
  }
}
