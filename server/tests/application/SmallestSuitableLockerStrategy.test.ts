import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';

const NOW = new Date('2026-08-15T10:00:00Z');
const strategy = new SmallestSuitableLockerStrategy();

describe('SmallestSuitableLockerStrategy', () => {
  it('picks the exact-size locker when one is available', () => {
    const lockers = [new Locker('L-1', 'LARGE'), new Locker('M-1', 'MEDIUM'), new Locker('S-1', 'SMALL')];

    expect(strategy.select('SMALL', lockers)?.id).toBe('S-1');
  });

  it('falls back to the smallest larger locker when no exact size exists', () => {
    const lockers = [new Locker('L-1', 'LARGE'), new Locker('M-1', 'MEDIUM')];

    expect(strategy.select('SMALL', lockers)?.id).toBe('M-1');
  });

  it('skips occupied lockers', () => {
    const small = new Locker('S-1', 'SMALL');
    small.store({ id: 'pkg-1', size: 'SMALL' }, 'CODE01', NOW);
    const lockers = [small, new Locker('M-1', 'MEDIUM')];

    expect(strategy.select('SMALL', lockers)?.id).toBe('M-1');
  });

  it('returns undefined when no locker is big enough', () => {
    const lockers = [new Locker('S-1', 'SMALL'), new Locker('M-1', 'MEDIUM')];

    expect(strategy.select('LARGE', lockers)).toBeUndefined();
  });

  it('returns undefined when every suitable locker is occupied', () => {
    const large = new Locker('L-1', 'LARGE');
    large.store({ id: 'pkg-1', size: 'LARGE' }, 'CODE01', NOW);

    expect(strategy.select('LARGE', [large])).toBeUndefined();
  });

  it('breaks ties between equal-size lockers by insertion order, deterministically', () => {
    const lockers = [new Locker('S-2', 'SMALL'), new Locker('S-1', 'SMALL')];

    expect(strategy.select('SMALL', lockers)?.id).toBe('S-2');
  });
});
