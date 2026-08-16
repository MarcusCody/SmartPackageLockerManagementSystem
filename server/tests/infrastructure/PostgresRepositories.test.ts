import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { Locker } from '../../src/domain/Locker.js';
import { Order } from '../../src/domain/Order.js';
import { NoSuitableLockerError } from '../../src/domain/errors.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';
import { migrate } from '../../src/infrastructure/postgres/db.js';
import { PostgresLockerRepository } from '../../src/infrastructure/postgres/PostgresLockerRepository.js';
import { PostgresOrderRepository } from '../../src/infrastructure/postgres/PostgresOrderRepository.js';

const url = process.env.DATABASE_URL_TEST;
const NOW = new Date('2026-08-15T10:00:00Z');
const strategy = new SmallestSuitableLockerStrategy();

const orderDetails = {
  customerName: 'Jane Tan',
  customerEmail: 'jane.tan@example.com',
  customerPhone: '+60 12-000 0001',
  packageSize: 'MEDIUM' as const,
};

describe.skipIf(url === undefined)('Postgres repositories (DATABASE_URL_TEST)', () => {
  let pool: pg.Pool;
  let lockers: PostgresLockerRepository;
  let orders: PostgresOrderRepository;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await migrate(pool);
    lockers = new PostgresLockerRepository(pool);
    orders = new PostgresOrderRepository(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE lockers, orders');
  });

  it('round-trips lockers, including occupancy state', async () => {
    await lockers.add(new Locker('S-1', 'SMALL'));
    await lockers.add(
      Locker.restore('M-1', 'MEDIUM', {
        pkg: { id: 'pkg-1', size: 'SMALL' },
        pickupCode: '042731',
        storedAt: NOW,
      }),
    );

    const all = await lockers.findAll();
    expect(all).toHaveLength(2);

    const occupied = await lockers.findById('M-1');
    expect(occupied?.isAvailable).toBe(false);
    expect(occupied?.activePickupCode).toBe('042731');
    expect(occupied?.storedPackageId).toBe('pkg-1');
    expect(occupied?.storedSince).toEqual(NOW);

    const byCode = await lockers.findByActivePickupCode('042731');
    expect(byCode?.id).toBe('M-1');
  });

  it('persists a release via save — the point of the write-back seam', async () => {
    await lockers.add(
      Locker.restore('S-1', 'SMALL', {
        pkg: { id: 'pkg-1', size: 'SMALL' },
        pickupCode: '042731',
        storedAt: NOW,
      }),
    );

    const locker = await lockers.findById('S-1');
    locker?.retrieve('042731');
    await lockers.save(locker!);

    const reloaded = await lockers.findById('S-1');
    expect(reloaded?.isAvailable).toBe(true);
    expect(await lockers.findByActivePickupCode('042731')).toBeUndefined();
  });

  it('findAndReserve stores atomically and rejects when nothing fits', async () => {
    await lockers.add(new Locker('S-1', 'SMALL'));

    const reserved = await lockers.findAndReserve(
      { id: 'pkg-1', size: 'SMALL' },
      '042731',
      NOW,
      strategy,
    );
    expect(reserved.id).toBe('S-1');

    const reloaded = await lockers.findById('S-1');
    expect(reloaded?.isAvailable).toBe(false);

    await expect(
      lockers.findAndReserve({ id: 'pkg-2', size: 'SMALL' }, '042732', NOW, strategy),
    ).rejects.toThrow(NoSuitableLockerError);
  });

  it('never hands the same locker to concurrent reservations — a real DB transaction', async () => {
    for (let i = 1; i <= 3; i += 1) {
      await lockers.add(new Locker(`S-${i}`, 'SMALL'));
    }

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        lockers.findAndReserve(
          { id: `pkg-${i}`, size: 'SMALL' },
          `10000${i}`.slice(-6),
          NOW,
          strategy,
        ),
      ),
    );

    const reserved = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value.id);
    expect(reserved).toHaveLength(3);
    expect(new Set(reserved).size).toBe(3);
  });

  it('lets the database enforce PIN uniqueness among active packages', async () => {
    await lockers.add(
      Locker.restore('S-1', 'SMALL', {
        pkg: { id: 'pkg-1', size: 'SMALL' },
        pickupCode: '042731',
        storedAt: NOW,
      }),
    );

    await expect(
      lockers.add(
        Locker.restore('S-2', 'SMALL', {
          pkg: { id: 'pkg-2', size: 'SMALL' },
          pickupCode: '042731',
          storedAt: NOW,
        }),
      ),
    ).rejects.toThrow();
  });

  it('round-trips the order lifecycle through save', async () => {
    await orders.add(new Order('ORD-1001', orderDetails));

    expect((await orders.findAwaitingDispatch()).map((o) => o.id)).toEqual(['ORD-1001']);
    expect(await orders.findPending()).toEqual([]);

    const awaiting = await orders.findById('ORD-1001');
    awaiting?.dispatch();
    await orders.save(awaiting!);
    expect((await orders.findPending()).map((o) => o.id)).toEqual(['ORD-1001']);

    const pending = await orders.findById('ORD-1001');
    pending?.markStored('pkg-1');
    await orders.save(pending!);
    expect((await orders.findByPackageId('pkg-1'))?.id).toBe('ORD-1001');

    const stored = await orders.findById('ORD-1001');
    stored?.markReturned();
    await orders.save(stored!);
    expect((await orders.findById('ORD-1001'))?.status).toBe('RETURNED');
    expect(await orders.findPending()).toEqual([]);
    expect(await orders.findAwaitingDispatch()).toEqual([]);
    expect(await orders.findAll()).toHaveLength(1);
  });
});
