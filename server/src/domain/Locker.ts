import type { LockerSize } from './LockerSize.js';
import { fits } from './LockerSize.js';
import type { Package } from './Package.js';
import { LockerOccupiedError, PackageDoesNotFitError } from './errors.js';

interface StoredPackage {
  readonly pkg: Package;
  readonly pickupCode: string;
  readonly storedAt: Date;
}

/**
 * A physical locker. Enforces the two invariants the spec cares about:
 * it holds at most one package, and only packages that fit its size.
 */
export class Locker {
  private stored: StoredPackage | null = null;

  constructor(
    readonly id: string,
    readonly size: LockerSize,
  ) {}

  get isAvailable(): boolean {
    return this.stored === null;
  }

  /** The pickup code of the package currently inside, if any. */
  get activePickupCode(): string | null {
    return this.stored?.pickupCode ?? null;
  }

  canAccommodate(packageSize: LockerSize): boolean {
    return fits(this.size, packageSize);
  }

  store(pkg: Package, pickupCode: string, storedAt: Date): void {
    if (this.stored !== null) {
      throw new LockerOccupiedError(this.id);
    }
    if (!this.canAccommodate(pkg.size)) {
      throw new PackageDoesNotFitError(this.id, pkg.size);
    }
    this.stored = { pkg, pickupCode, storedAt };
  }
}
