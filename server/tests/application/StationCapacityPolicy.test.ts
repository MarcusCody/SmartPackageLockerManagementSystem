import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import { Order } from '../../src/domain/Order.js';
import {
  acceptableSizes,
  hasCapacityFor,
} from '../../src/application/policies/StationCapacityPolicy.js';

let orderSeq = 0;
const order = (size: 'SMALL' | 'MEDIUM' | 'LARGE', dispatched = false) => {
  orderSeq += 1;
  const created = new Order(`ORD-${orderSeq}`, {
    customerName: 'Jane Tan',
    customerEmail: 'jane.tan@example.com',
    customerPhone: '+60 12-000 0001',
    packageSize: size,
  });
  if (dispatched) {
    created.dispatch();
  }
  return created;
};

const occupied = (id: string, size: 'SMALL' | 'MEDIUM' | 'LARGE') => {
  const locker = new Locker(id, size);
  locker.store({ id: `pkg-${id}`, size }, '000000', new Date('2026-08-15T10:00:00Z'));
  return locker;
};

describe('StationCapacityPolicy', () => {
  it('accepts nothing when the station has no lockers', () => {
    expect(acceptableSizes([], [])).toEqual([]);
  });

  it('accepts only what fits: a free SMALL locker cannot absorb bigger orders', () => {
    const lockers = [new Locker('S-1', 'SMALL')];

    expect(hasCapacityFor('SMALL', lockers, [])).toBe(true);
    expect(hasCapacityFor('MEDIUM', lockers, [])).toBe(false);
    expect(hasCapacityFor('LARGE', lockers, [])).toBe(false);
  });

  it('lets a larger locker absorb smaller orders', () => {
    const lockers = [new Locker('L-1', 'LARGE')];

    expect(acceptableSizes(lockers, [])).toEqual(['SMALL', 'MEDIUM', 'LARGE']);
  });

  it('counts occupied lockers as unavailable', () => {
    const lockers = [occupied('L-1', 'LARGE'), new Locker('S-1', 'SMALL')];

    expect(hasCapacityFor('LARGE', lockers, [])).toBe(false);
    expect(hasCapacityFor('SMALL', lockers, [])).toBe(true);
  });

  it('counts awaiting-dispatch orders as committed demand', () => {
    const lockers = [new Locker('S-1', 'SMALL')];
    const unstored = [order('SMALL')]; // awaiting dispatch

    expect(hasCapacityFor('SMALL', lockers, unstored)).toBe(false);
  });

  it('counts pending (dispatched, not yet stored) orders as committed demand', () => {
    const lockers = [new Locker('L-1', 'LARGE')];
    const unstored = [order('LARGE', true)];

    expect(acceptableSizes(lockers, unstored)).toEqual([]);
  });

  it('ignores orders that are already stored or returned', () => {
    const stored = order('LARGE', true);
    stored.markStored('pkg-1');
    const lockers = [new Locker('L-1', 'LARGE')];

    expect(hasCapacityFor('LARGE', lockers, [stored])).toBe(true);
  });

  it('never lets small demand starve a big order, but big demand may consume upgrades', () => {
    // Free: 1 MEDIUM + 1 LARGE. A MEDIUM order is already committed.
    const lockers = [new Locker('M-1', 'MEDIUM'), new Locker('L-1', 'LARGE')];
    const unstored = [order('MEDIUM')];

    // A LARGE order still fits (the MEDIUM demand takes the MEDIUM locker).
    expect(hasCapacityFor('LARGE', lockers, unstored)).toBe(true);
    // A second MEDIUM also fits (one takes the LARGE locker as an upgrade).
    expect(hasCapacityFor('MEDIUM', lockers, unstored)).toBe(true);
    // But with two MEDIUMs committed, a LARGE no longer fits.
    expect(hasCapacityFor('LARGE', lockers, [order('MEDIUM'), order('MEDIUM')])).toBe(false);
  });
});
