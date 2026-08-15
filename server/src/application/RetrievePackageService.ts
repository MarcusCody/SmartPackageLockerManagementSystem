import type { Package } from '../domain/Package.js';
import { LockerNotFoundError } from '../domain/errors.js';
import type { LockerRepository } from './ports.js';

export interface RetrievePackageResult {
  package: Package;
  storedAt: Date;
}

/** Customer use case: validate locker id + pickup code, open the locker, release the package. */
export class RetrievePackageService {
  constructor(private readonly lockers: LockerRepository) {}

  async retrieve(lockerId: string, pickupCode: string): Promise<RetrievePackageResult> {
    const locker = await this.lockers.findById(lockerId);
    if (locker === undefined) {
      throw new LockerNotFoundError(lockerId);
    }

    const { pkg, storedAt } = locker.retrieve(pickupCode);
    return { package: pkg, storedAt };
  }
}
