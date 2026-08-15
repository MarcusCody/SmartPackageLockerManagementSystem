import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import type { Package } from '../../src/domain/Package.js';
import type { LockerSize } from '../../src/domain/LockerSize.js';
import { LockerOccupiedError, PackageDoesNotFitError } from '../../src/domain/errors.js';

const makePackage = (size: LockerSize = 'SMALL', id = 'pkg-1'): Package => ({ id, size });
const NOW = new Date('2026-08-15T10:00:00Z');

describe('Locker', () => {
  it('is available when newly created', () => {
    const locker = new Locker('S-1', 'SMALL');

    expect(locker.isAvailable).toBe(true);
    expect(locker.activePickupCode).toBeNull();
  });

  it('can accommodate packages of its own size or smaller, never larger', () => {
    const medium = new Locker('M-1', 'MEDIUM');

    expect(medium.canAccommodate('SMALL')).toBe(true);
    expect(medium.canAccommodate('MEDIUM')).toBe(true);
    expect(medium.canAccommodate('LARGE')).toBe(false);
  });

  it('becomes unavailable once a package is stored', () => {
    const locker = new Locker('S-1', 'SMALL');

    locker.store(makePackage(), 'CODE01', NOW);

    expect(locker.isAvailable).toBe(false);
    expect(locker.activePickupCode).toBe('CODE01');
  });

  it('holds only one package at a time', () => {
    const locker = new Locker('L-1', 'LARGE');
    locker.store(makePackage(), 'CODE01', NOW);

    expect(() => locker.store(makePackage('SMALL', 'pkg-2'), 'CODE02', NOW)).toThrow(
      LockerOccupiedError,
    );
  });

  it('rejects a package larger than the locker', () => {
    const locker = new Locker('S-1', 'SMALL');

    expect(() => locker.store(makePackage('LARGE'), 'CODE01', NOW)).toThrow(
      PackageDoesNotFitError,
    );
    expect(locker.isAvailable).toBe(true);
  });
});
