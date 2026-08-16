import type { LockerSize } from './LockerSize.js';

/**
 * Base class for all domain rule violations. The `code` gives adapters
 * (REST, UI) a stable identifier to map onto their own error formats.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NoSuitableLockerError extends DomainError {
  readonly code = 'NO_SUITABLE_LOCKER';

  constructor(packageSize: LockerSize) {
    super(
      `No suitable locker is available for a ${packageSize} package. The package cannot be stored.`,
    );
  }
}

export class LockerOccupiedError extends DomainError {
  readonly code = 'LOCKER_OCCUPIED';

  constructor(lockerId: string) {
    super(`Locker ${lockerId} already holds a package.`);
  }
}

export class PackageDoesNotFitError extends DomainError {
  readonly code = 'PACKAGE_DOES_NOT_FIT';

  constructor(lockerId: string, packageSize: LockerSize) {
    super(`A ${packageSize} package does not fit in locker ${lockerId}.`);
  }
}

export class LockerNotFoundError extends DomainError {
  readonly code = 'LOCKER_NOT_FOUND';

  constructor(lockerId: string) {
    super(`Locker ${lockerId} does not exist.`);
  }
}

export class LockerEmptyError extends DomainError {
  readonly code = 'LOCKER_EMPTY';

  constructor(lockerId: string) {
    super(`Locker ${lockerId} has no package to retrieve.`);
  }
}

export class OrderNotFoundError extends DomainError {
  readonly code = 'ORDER_NOT_FOUND';

  constructor(orderId: string) {
    super(`Order ${orderId} does not exist.`);
  }
}

export class OrderAlreadyStoredError extends DomainError {
  readonly code = 'ORDER_ALREADY_STORED';

  constructor(orderId: string) {
    super(`Order ${orderId} has already been stored.`);
  }
}

export class OrderNotDispatchedError extends DomainError {
  readonly code = 'ORDER_NOT_DISPATCHED';

  constructor(orderId: string) {
    super(`Order ${orderId} has not been dispatched to this station yet.`);
  }
}

export class OrderAlreadyDispatchedError extends DomainError {
  readonly code = 'ORDER_ALREADY_DISPATCHED';

  constructor(orderId: string) {
    super(`Order ${orderId} has already been dispatched.`);
  }
}

export class StationAtCapacityError extends DomainError {
  readonly code = 'STATION_AT_CAPACITY';

  constructor(size?: LockerSize) {
    super(
      size === undefined
        ? 'The station cannot accept new orders right now: every locker size is at capacity, counting free lockers and undelivered orders.'
        : `The station cannot accept a ${size} order right now: no locker of that size (or larger) is free once undelivered orders are counted.`,
    );
  }
}

export class PackageNotOverdueError extends DomainError {
  readonly code = 'PACKAGE_NOT_OVERDUE';

  constructor(lockerId: string, thresholdDays: number) {
    super(
      `The package in locker ${lockerId} is not overdue yet — returns are allowed after ${thresholdDays} days.`,
    );
  }
}

export class InvalidPickupCodeError extends DomainError {
  readonly code = 'INVALID_PICKUP_CODE';

  constructor(lockerId?: string) {
    super(
      lockerId === undefined
        ? 'The pickup code does not match any stored package.'
        : `The pickup code is not valid for locker ${lockerId}.`,
    );
  }
}
