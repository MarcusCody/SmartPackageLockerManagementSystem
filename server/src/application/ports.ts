import type { Locker } from '../domain/Locker.js';

/** Time source, injected so time-dependent behaviour is deterministic in tests. */
export interface Clock {
  now(): Date;
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
}
