import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import type { Package } from '../../src/domain/Package.js';
import type { LockerSize } from '../../src/domain/LockerSize.js';
import {
  InvalidPickupCodeError,
  LockerEmptyError,
  LockerOccupiedError,
  PackageDoesNotFitError,
} from '../../src/domain/errors.js';

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

  it('exposes when the current package was stored, and null when empty', () => {
    const locker = new Locker('S-1', 'SMALL');
    expect(locker.storedSince).toBeNull();

    locker.store(makePackage(), 'CODE01', NOW);

    expect(locker.storedSince).toEqual(NOW);
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

  describe('restore (rehydration from persistence)', () => {
    it('restores an occupied locker with its package, PIN and storage time', () => {
      const locker = Locker.restore('S-1', 'SMALL', {
        pkg: { id: 'pkg-1', size: 'SMALL' },
        pickupCode: '042731',
        storedAt: NOW,
      });

      expect(locker.isAvailable).toBe(false);
      expect(locker.activePickupCode).toBe('042731');
      expect(locker.storedPackageId).toBe('pkg-1');
      expect(locker.storedSince).toEqual(NOW);
    });

    it('restores an empty locker', () => {
      const locker = Locker.restore('S-1', 'SMALL');

      expect(locker.isAvailable).toBe(true);
    });
  });

  describe('retrieve', () => {
    it('returns the stored package and its storage time for the matching pickup code', () => {
      const locker = new Locker('S-1', 'SMALL');
      const pkg = makePackage();
      locker.store(pkg, 'CODE01', NOW);

      const retrieved = locker.retrieve('CODE01');

      expect(retrieved.pkg).toBe(pkg);
      expect(retrieved.storedAt).toEqual(NOW);
    });

    it('becomes available again after retrieval', () => {
      const locker = new Locker('S-1', 'SMALL');
      locker.store(makePackage(), 'CODE01', NOW);

      locker.retrieve('CODE01');

      expect(locker.isAvailable).toBe(true);
      expect(locker.activePickupCode).toBeNull();
    });

    it('can store a new package after the previous one was retrieved', () => {
      const locker = new Locker('S-1', 'SMALL');
      locker.store(makePackage('SMALL', 'pkg-1'), 'CODE01', NOW);
      locker.retrieve('CODE01');

      locker.store(makePackage('SMALL', 'pkg-2'), 'CODE02', NOW);

      expect(locker.isAvailable).toBe(false);
      expect(locker.activePickupCode).toBe('CODE02');
    });

    it('rejects a wrong pickup code and keeps the package', () => {
      const locker = new Locker('S-1', 'SMALL');
      locker.store(makePackage(), 'CODE01', NOW);

      expect(() => locker.retrieve('WRONG1')).toThrow(InvalidPickupCodeError);
      expect(locker.isAvailable).toBe(false);
    });

    it('rejects retrieval from an empty locker', () => {
      const locker = new Locker('S-1', 'SMALL');

      expect(() => locker.retrieve('CODE01')).toThrow(LockerEmptyError);
    });

    it('rejects a pickup code that was already used', () => {
      const locker = new Locker('S-1', 'SMALL');
      locker.store(makePackage(), 'CODE01', NOW);
      locker.retrieve('CODE01');

      expect(() => locker.retrieve('CODE01')).toThrow(LockerEmptyError);
    });
  });
});
