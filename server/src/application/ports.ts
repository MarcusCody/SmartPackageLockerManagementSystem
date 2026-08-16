import type { Locker } from '../domain/Locker.js';
import type { Package } from '../domain/Package.js';
import type { LockerSize } from '../domain/LockerSize.js';
import type { LockerAllocationStrategy } from './policies/LockerAllocationStrategy.js';

/** Time source, injected so time-dependent behaviour is deterministic in tests. */
export interface Clock {
  now(): Date;
}

export interface PickupNotification {
  to: string;
  lockerId: string;
  pickupCode: string;
  packageSize: LockerSize;
  storedAt: Date;
}

/**
 * Sends the pickup PIN to the customer. Channel-agnostic on purpose:
 * email today (Azure Communication Services in production, console in
 * dev), and an SMS adapter would implement this same port.
 */
export interface PickupNotifier {
  sendPickupCode(notification: PickupNotification): Promise<void>;
}

/**
 * Produces candidate pickup codes. Uniqueness among active packages is
 * enforced by the caller, which knows the currently active codes.
 */
export interface PickupCodeGenerator {
  generate(): string;
}

/**
 * Persistence seam for lockers. In-memory today; a database adapter would
 * implement this same port without touching the domain or services.
 */
export interface LockerRepository {
  add(locker: Locker): Promise<void>;
  findAll(): Promise<Locker[]>;
  findById(id: string): Promise<Locker | undefined>;
  /** The locker currently holding this pickup code, if any — PINs are unique among active packages. */
  findByActivePickupCode(pickupCode: string): Promise<Locker | undefined>;

  /**
   * Atomically selects a locker via the strategy and stores the package
   * in it, so two concurrent requests can never reserve the same locker.
   * Placing check-and-act behind the repository boundary keeps the
   * guarantee structural: this is exactly where a database adapter would
   * use a transaction or optimistic locking.
   *
   * @throws NoSuitableLockerError when no available locker fits.
   */
  findAndReserve(
    pkg: Package,
    pickupCode: string,
    storedAt: Date,
    strategy: LockerAllocationStrategy,
  ): Promise<Locker>;
}
