import { describe, expect, it } from 'vitest';
import { TieredStorageFeePolicy } from '../../src/application/policies/StorageFeePolicy.js';

const STORED_AT = new Date('2026-08-15T10:00:00Z');
const HOUR = 60 * 60 * 1000;
const after = (hours: number) => new Date(STORED_AT.getTime() + hours * HOUR);

// The deployed schedule: first 5 days free (grace period), RM1/day for
// days 6-7, RM2/day from day 8. A day is each started 24h window from the
// moment of storage.
const DEPLOYED_SCHEDULE = [
  { upToDay: 5, ratePerDay: 0 },
  { upToDay: 7, ratePerDay: 1 },
  { ratePerDay: 2 },
];

describe('TieredStorageFeePolicy — deployed schedule', () => {
  const policy = new TieredStorageFeePolicy(DEPLOYED_SCHEDULE);

  it('is free within the 5-day grace period', () => {
    expect(policy.calculate(STORED_AT, STORED_AT)).toBe(0);
    expect(policy.calculate(STORED_AT, after(2))).toBe(0);
    expect(policy.calculate(STORED_AT, after(5 * 24))).toBe(0);
  });

  it('charges RM1 per day for days 6 and 7', () => {
    expect(policy.calculate(STORED_AT, after(5 * 24 + 1))).toBe(1); // day 6
    expect(policy.calculate(STORED_AT, after(7 * 24))).toBe(2); // through day 7
  });

  it('charges RM2 per day from day 8 onward', () => {
    expect(policy.calculate(STORED_AT, after(7 * 24 + 1))).toBe(4); // 1+1+2
    expect(policy.calculate(STORED_AT, after(12 * 24))).toBe(12); // 2 + 5×2
  });

  it('rejects a retrieval time before the storage time', () => {
    expect(() => policy.calculate(STORED_AT, after(-1))).toThrow(
      /retrieval time.*before.*storage time/i,
    );
  });
});

describe('TieredStorageFeePolicy — the spec example stays one config away', () => {
  // X=10/day for days 1-5, 2X for days 6-10, 3X beyond: the challenge
  // PDF's example pricing, expressed with the same band mechanism.
  const policy = new TieredStorageFeePolicy([
    { upToDay: 5, ratePerDay: 10 },
    { upToDay: 10, ratePerDay: 20 },
    { ratePerDay: 30 },
  ]);

  it('charges day 1 within the first 24 hours and rolls at each 24h boundary', () => {
    expect(policy.calculate(STORED_AT, after(1))).toBe(10);
    expect(policy.calculate(STORED_AT, after(24))).toBe(10);
    expect(policy.calculate(STORED_AT, after(25))).toBe(20);
  });

  it('applies the tier boundaries at days 5/6 and 10/11', () => {
    expect(policy.calculate(STORED_AT, after(5 * 24))).toBe(50);
    expect(policy.calculate(STORED_AT, after(5 * 24 + 1))).toBe(70);
    expect(policy.calculate(STORED_AT, after(10 * 24))).toBe(150);
    expect(policy.calculate(STORED_AT, after(10 * 24 + 1))).toBe(180);
    expect(policy.calculate(STORED_AT, after(13 * 24))).toBe(240);
  });
});

describe('TieredStorageFeePolicy — schedule validation', () => {
  it('rejects an empty schedule', () => {
    expect(() => new TieredStorageFeePolicy([])).toThrow(/at least one band/i);
  });

  it('rejects a schedule whose final band is not open-ended', () => {
    expect(() => new TieredStorageFeePolicy([{ upToDay: 5, ratePerDay: 1 }])).toThrow(
      /final.*open-ended/i,
    );
  });

  it('rejects bands that are not in ascending day order', () => {
    expect(
      () =>
        new TieredStorageFeePolicy([
          { upToDay: 7, ratePerDay: 0 },
          { upToDay: 5, ratePerDay: 1 },
          { ratePerDay: 2 },
        ]),
    ).toThrow(/ascending/i);
  });
});
