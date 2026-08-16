import type { Locker } from '../domain/Locker.js';
import type { Package } from '../domain/Package.js';
import { InvalidPickupCodeError, LockerNotFoundError } from '../domain/errors.js';
import type { Clock, LockerRepository } from './ports.js';
import type { StorageFeePolicy } from './policies/StorageFeePolicy.js';

export interface RetrievePackageResult {
  /** Which locker opened — essential when the customer collects by PIN alone. */
  lockerId: string;
  package: Package;
  storedAt: Date;
  retrievedAt: Date;
  /** What the customer owes for the time the package sat in the locker. */
  storageCharge: number;
}

/**
 * Customer use case: open the locker and release the package. PINs are
 * unique among active packages, so the code alone is enough; when a
 * locker id is also provided, the pair is validated.
 */
export class RetrievePackageService {
  constructor(
    private readonly lockers: LockerRepository,
    private readonly feePolicy: StorageFeePolicy,
    private readonly clock: Clock,
  ) {}

  async retrieve(pickupCode: string, lockerId?: string): Promise<RetrievePackageResult> {
    const locker =
      lockerId === undefined
        ? await this.lockerHoldingCode(pickupCode)
        : await this.lockerById(lockerId);

    const { pkg, storedAt } = locker.retrieve(pickupCode);
    await this.lockers.save(locker);
    const retrievedAt = this.clock.now();
    const storageCharge = this.feePolicy.calculate(storedAt, retrievedAt);

    return { lockerId: locker.id, package: pkg, storedAt, retrievedAt, storageCharge };
  }

  private async lockerHoldingCode(pickupCode: string): Promise<Locker> {
    const locker = await this.lockers.findByActivePickupCode(pickupCode);
    if (locker === undefined) {
      throw new InvalidPickupCodeError();
    }
    return locker;
  }

  private async lockerById(lockerId: string): Promise<Locker> {
    const locker = await this.lockers.findById(lockerId);
    if (locker === undefined) {
      throw new LockerNotFoundError(lockerId);
    }
    return locker;
  }
}
