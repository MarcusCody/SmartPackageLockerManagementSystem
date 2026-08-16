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
