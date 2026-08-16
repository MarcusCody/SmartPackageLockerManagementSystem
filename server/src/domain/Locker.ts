import type { LockerSize } from './LockerSize.js';
import { fits } from './LockerSize.js';
import type { Package } from './Package.js';
import {
  InvalidPickupCodeError,
  LockerEmptyError,
  LockerOccupiedError,
  PackageDoesNotFitError,
} from './errors.js';

export interface StoredPackage {
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

  /** Rehydrates a locker from persistence without bypassing invariants. */
  static restore(id: string, size: LockerSize, stored?: StoredPackage): Locker {
    const locker = new Locker(id, size);
    if (stored !== undefined) {
      locker.store(stored.pkg, stored.pickupCode, stored.storedAt);
    }
    return locker;
  }

  get isAvailable(): boolean {
    return this.stored === null;
  }

  /** The pickup code of the package currently inside, if any. */
  get activePickupCode(): string | null {
    return this.stored?.pickupCode ?? null;
  }

  /** When the current package was stored, if any. */
  get storedSince(): Date | null {
    return this.stored?.storedAt ?? null;
  }

  /** The id of the package currently inside, if any. */
  get storedPackageId(): string | null {
    return this.stored?.pkg.id ?? null;
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

  /**
   * Opens the locker for the matching pickup code: hands the package
   * (and when it was stored) back and frees the locker. A used code
   * cannot be replayed because the locker is empty afterwards.
   */
  retrieve(pickupCode: string): { pkg: Package; storedAt: Date } {
    if (this.stored === null) {
      throw new LockerEmptyError(this.id);
    }
    if (this.stored.pickupCode !== pickupCode) {
      throw new InvalidPickupCodeError(this.id);
    }
    const { pkg, storedAt } = this.stored;
    this.stored = null;
    return { pkg, storedAt };
  }

  /**
   * Staff override for warehouse returns: empties the locker without a
   * PIN. The old PIN dies with it — the locker no longer holds anything.
   */
  removeForReturn(): { pkg: Package; storedAt: Date } {
    if (this.stored === null) {
      throw new LockerEmptyError(this.id);
    }
    const { pkg, storedAt } = this.stored;
    this.stored = null;
    return { pkg, storedAt };
  }
}
