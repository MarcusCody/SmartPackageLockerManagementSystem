import { describe, expect, it } from 'vitest';
import { compareBySize, fits, isLockerSize, LOCKER_SIZES } from '../../src/domain/LockerSize.js';
import type { LockerSize } from '../../src/domain/LockerSize.js';

describe('LockerSize', () => {
  it('defines exactly the three sizes from the spec', () => {
    expect(LOCKER_SIZES).toEqual(['SMALL', 'MEDIUM', 'LARGE']);
  });

  describe('fits', () => {
    it('lets a locker hold a package of its own size', () => {
      expect(fits('SMALL', 'SMALL')).toBe(true);
      expect(fits('MEDIUM', 'MEDIUM')).toBe(true);
      expect(fits('LARGE', 'LARGE')).toBe(true);
    });

    it('lets a larger locker hold a smaller package', () => {
      expect(fits('MEDIUM', 'SMALL')).toBe(true);
      expect(fits('LARGE', 'SMALL')).toBe(true);
      expect(fits('LARGE', 'MEDIUM')).toBe(true);
    });

    it('never lets a smaller locker hold a larger package', () => {
      expect(fits('SMALL', 'MEDIUM')).toBe(false);
      expect(fits('SMALL', 'LARGE')).toBe(false);
      expect(fits('MEDIUM', 'LARGE')).toBe(false);
    });
  });

  describe('compareBySize', () => {
    it('orders sizes ascending SMALL < MEDIUM < LARGE', () => {
      const shuffled: LockerSize[] = ['LARGE', 'SMALL', 'MEDIUM'];
      expect([...shuffled].sort(compareBySize)).toEqual(['SMALL', 'MEDIUM', 'LARGE']);
    });
  });

  describe('isLockerSize', () => {
    it('accepts valid sizes and rejects anything else', () => {
      expect(isLockerSize('SMALL')).toBe(true);
      expect(isLockerSize('LARGE')).toBe(true);
      expect(isLockerSize('HUGE')).toBe(false);
      expect(isLockerSize('small')).toBe(false);
      expect(isLockerSize('')).toBe(false);
    });
  });
});
