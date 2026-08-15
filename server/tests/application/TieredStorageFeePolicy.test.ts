import { describe, expect, it } from 'vitest';
import { TieredStorageFeePolicy } from '../../src/application/policies/StorageFeePolicy.js';

const STORED_AT = new Date('2026-08-15T10:00:00Z');
const HOUR = 60 * 60 * 1000;
const after = (hours: number) => new Date(STORED_AT.getTime() + hours * HOUR);

// X = 10 units/day for days 1-5, 2X for days 6-10, 3X from day 11 — the
// tiered example from the spec. A day is 24h from the time of storage.
const policy = new TieredStorageFeePolicy({ ratePerDay: 10 });

describe('TieredStorageFeePolicy', () => {
  it('charges one day at X when picked up within the first 24 hours', () => {
    expect(policy.calculate(STORED_AT, after(1))).toBe(10);
    expect(policy.calculate(STORED_AT, after(23))).toBe(10);
  });

  it('charges one day at exactly the 24-hour boundary', () => {
    expect(policy.calculate(STORED_AT, after(24))).toBe(10);
  });

  it('starts the second day the moment 24 hours have passed', () => {
    expect(policy.calculate(STORED_AT, after(25))).toBe(20);
  });

  it('charges X per day through day 5', () => {
    expect(policy.calculate(STORED_AT, after(5 * 24))).toBe(50);
  });

  it('charges 2X per day for days 6-10', () => {
    expect(policy.calculate(STORED_AT, after(5 * 24 + 1))).toBe(50 + 20);
    expect(policy.calculate(STORED_AT, after(10 * 24))).toBe(50 + 100);
  });

  it('charges 3X per day from day 11 onward', () => {
    expect(policy.calculate(STORED_AT, after(10 * 24 + 1))).toBe(150 + 30);
    expect(policy.calculate(STORED_AT, after(13 * 24))).toBe(150 + 90);
  });

  it('treats an instant pickup as one day, matching "X/day for the first 5 days"', () => {
    expect(policy.calculate(STORED_AT, STORED_AT)).toBe(10);
  });

  it('supports a configurable grace period before charges start', () => {
    const withGrace = new TieredStorageFeePolicy({ ratePerDay: 10, freeDays: 1 });

    expect(withGrace.calculate(STORED_AT, after(23))).toBe(0);
    expect(withGrace.calculate(STORED_AT, after(25))).toBe(10);
    // day 1 free, days 2-5 at X, day 6 at 2X
    expect(withGrace.calculate(STORED_AT, after(6 * 24))).toBe(40 + 20);
  });

  it('rejects a retrieval time before the storage time', () => {
    expect(() => policy.calculate(STORED_AT, after(-1))).toThrow(
      /retrieval time.*before.*storage time/i,
    );
  });
});
