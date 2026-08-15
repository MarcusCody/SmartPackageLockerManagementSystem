import type { Package } from '../domain/Package.js';
import { LockerNotFoundError } from '../domain/errors.js';
import type { Clock, LockerRepository } from './ports.js';
import type { StorageFeePolicy } from './policies/StorageFeePolicy.js';

export interface RetrievePackageResult {
  package: Package;
  storedAt: Date;
  retrievedAt: Date;
  /** What the customer owes for the time the package sat in the locker. */
  storageCharge: number;
}

/** Customer use case: validate locker id + pickup code, open the locker, release the package. */
export class RetrievePackageService {
  constructor(
    private readonly lockers: LockerRepository,
    private readonly feePolicy: StorageFeePolicy,
    private readonly clock: Clock,
  ) {}

  async retrieve(lockerId: string, pickupCode: string): Promise<RetrievePackageResult> {
    const locker = await this.lockers.findById(lockerId);
    if (locker === undefined) {
      throw new LockerNotFoundError(lockerId);
    }

    const { pkg, storedAt } = locker.retrieve(pickupCode);
    const retrievedAt = this.clock.now();
    const storageCharge = this.feePolicy.calculate(storedAt, retrievedAt);

    return { package: pkg, storedAt, retrievedAt, storageCharge };
  }
}
