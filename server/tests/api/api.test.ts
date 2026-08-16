import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Locker } from '../../src/domain/Locker.js';
import { buildTestApp } from '../helpers/app.js';

describe('REST API', () => {
  describe('POST /api/lockers', () => {
    it('creates a locker of the requested size', async () => {
      const { app } = await buildTestApp();

      const response = await request(app).post('/api/lockers').send({ size: 'MEDIUM' });

      expect(response.status).toBe(201);
      expect(response.body.locker).toEqual({ id: 'M-1', size: 'MEDIUM', available: true });
    });

    it('gives lockers sequential per-size identifiers', async () => {
      const { app } = await buildTestApp();

      await request(app).post('/api/lockers').send({ size: 'SMALL' });
      const second = await request(app).post('/api/lockers').send({ size: 'SMALL' });
      const large = await request(app).post('/api/lockers').send({ size: 'LARGE' });

      expect(second.body.locker.id).toBe('S-2');
      expect(large.body.locker.id).toBe('L-1');
    });

    it('rejects an invalid size', async () => {
      const { app } = await buildTestApp();

      const response = await request(app).post('/api/lockers').send({ size: 'HUGE' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/lockers', () => {
    it('lists all lockers with their availability status', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL'), new Locker('L-1', 'LARGE')]);

      await request(app).post('/api/packages').send({ size: 'SMALL' });
      const response = await request(app).get('/api/lockers');

      expect(response.status).toBe(200);
      expect(response.body.lockers).toEqual([
        { id: 'S-1', size: 'SMALL', available: false },
        { id: 'L-1', size: 'LARGE', available: true },
      ]);
    });
  });

  describe('POST /api/packages', () => {
    it('stores a package in the smallest suitable locker and returns the pickup code', async () => {
      const { app } = await buildTestApp([new Locker('L-1', 'LARGE'), new Locker('M-1', 'MEDIUM')]);

      const response = await request(app).post('/api/packages').send({ size: 'SMALL' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        lockerId: 'M-1',
        pickupCode: 'CODE01',
        packageId: expect.any(String),
        notification: 'none',
      });
    });

    it('emails the pickup PIN when a customer email is provided', async () => {
      const { app, notifier } = await buildTestApp([new Locker('S-1', 'SMALL')]);

      const response = await request(app)
        .post('/api/packages')
        .send({ size: 'SMALL', customerEmail: 'jane@example.com' });

      expect(response.status).toBe(201);
      expect(response.body.notification).toBe('sent');
      expect(notifier.sent).toHaveLength(1);
      expect(notifier.sent[0]).toMatchObject({
        to: 'jane@example.com',
        lockerId: 'S-1',
        pickupCode: response.body.pickupCode,
      });
    });

    it('rejects an invalid customer email', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL')]);

      const response = await request(app)
        .post('/api/packages')
        .send({ size: 'SMALL', customerEmail: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 with a clear message when no suitable locker is available', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL')]);

      const response = await request(app).post('/api/packages').send({ size: 'LARGE' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('NO_SUITABLE_LOCKER');
      expect(response.body.error.message).toMatch(/cannot be stored/i);
    });

    it('rejects an invalid package size', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL')]);

      const response = await request(app).post('/api/packages').send({ size: 'TINY' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('orders (the delivery work queue)', () => {
    const newOrder = {
      customerName: 'Jane Tan',
      customerEmail: 'jane.tan@example.com',
      customerPhone: '+60 12-000 0001',
      size: 'MEDIUM',
    };

    it('creates an order awaiting dispatch — not yet in the station queue', async () => {
      const { app } = await buildTestApp([new Locker('M-1', 'MEDIUM')]);

      const created = await request(app).post('/api/orders').send(newOrder);

      expect(created.status).toBe(201);
      expect(created.body.order).toEqual({
        id: 'ORD-1001',
        customerName: 'Jane Tan',
        customerEmail: 'jane.tan@example.com',
        customerPhone: '+60 12-000 0001',
        size: 'MEDIUM',
      });

      const awaiting = await request(app).get('/api/orders?status=awaiting-dispatch');
      expect(awaiting.body.orders).toEqual([created.body.order]);

      const pending = await request(app).get('/api/orders');
      expect(pending.body.orders).toEqual([]);
    });

    it("dispatching moves the order into the agent's pending queue", async () => {
      const { app } = await buildTestApp([new Locker('M-1', 'MEDIUM')]);
      await request(app).post('/api/orders').send(newOrder);

      const dispatched = await request(app).post('/api/orders/ORD-1001/dispatch').send();

      expect(dispatched.status).toBe(200);
      expect(dispatched.body.order.id).toBe('ORD-1001');

      const pending = await request(app).get('/api/orders');
      expect(pending.body.orders.map((o: { id: string }) => o.id)).toEqual(['ORD-1001']);

      const awaiting = await request(app).get('/api/orders?status=awaiting-dispatch');
      expect(awaiting.body.orders).toEqual([]);
    });

    it('rejects dispatching the same order twice', async () => {
      const { app } = await buildTestApp([new Locker('M-1', 'MEDIUM')]);
      await request(app).post('/api/orders').send(newOrder);
      await request(app).post('/api/orders/ORD-1001/dispatch').send();

      const replay = await request(app).post('/api/orders/ORD-1001/dispatch').send();

      expect(replay.status).toBe(409);
      expect(replay.body.error.code).toBe('ORDER_ALREADY_DISPATCHED');
    });

    it('rejects storing an order that was never dispatched to this station', async () => {
      const { app } = await buildTestApp([new Locker('M-1', 'MEDIUM')]);
      await request(app).post('/api/orders').send(newOrder);

      const response = await request(app).post('/api/orders/ORD-1001/store').send();

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ORDER_NOT_DISPATCHED');
    });

    it('rejects an order with an invalid email', async () => {
      const { app } = await buildTestApp();

      const response = await request(app)
        .post('/api/orders')
        .send({ ...newOrder, customerEmail: 'nope' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it("stores a pending order by its size and emails the order's contact", async () => {
      const { app, notifier } = await buildTestApp([
        new Locker('S-1', 'SMALL'),
        new Locker('M-1', 'MEDIUM'),
      ]);
      await request(app).post('/api/orders').send(newOrder);
      await request(app).post('/api/orders/ORD-1001/dispatch').send();

      const response = await request(app).post('/api/orders/ORD-1001/store').send();

      expect(response.status).toBe(201);
      expect(response.body.lockerId).toBe('M-1');
      expect(response.body.pickupCode).toBe('CODE01');
      expect(response.body.notification).toBe('sent');
      expect(response.body.order.id).toBe('ORD-1001');
      expect(notifier.sent[0]).toMatchObject({ to: 'jane.tan@example.com', lockerId: 'M-1' });

      const pending = await request(app).get('/api/orders');
      expect(pending.body.orders).toEqual([]);
    });

    it('rejects storing the same order twice', async () => {
      const { app } = await buildTestApp([new Locker('M-1', 'MEDIUM'), new Locker('M-2', 'MEDIUM')]);
      await request(app).post('/api/orders').send(newOrder);
      await request(app).post('/api/orders/ORD-1001/dispatch').send();
      await request(app).post('/api/orders/ORD-1001/store').send();

      const replay = await request(app).post('/api/orders/ORD-1001/store').send();

      expect(replay.status).toBe(409);
      expect(replay.body.error.code).toBe('ORDER_ALREADY_STORED');
    });

    it('returns 404 for an unknown order', async () => {
      const { app } = await buildTestApp();

      const response = await request(app).post('/api/orders/ORD-9999/store').send();

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('keeps the order pending when the locker filled up after the order was accepted', async () => {
      const { app } = await buildTestApp([new Locker('L-1', 'LARGE')]);
      // Accepted while L-1 was free…
      await request(app)
        .post('/api/orders')
        .send({ ...newOrder, size: 'LARGE' });
      await request(app).post('/api/orders/ORD-1001/dispatch').send();
      // …but a walk-in package takes the locker first.
      await request(app).post('/api/packages').send({ size: 'LARGE' });

      const response = await request(app).post('/api/orders/ORD-1001/store').send();

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('NO_SUITABLE_LOCKER');

      const pending = await request(app).get('/api/orders');
      expect(pending.body.orders).toHaveLength(1);
    });

    it('refuses an order beyond station capacity, counting undelivered orders', async () => {
      const { app } = await buildTestApp([new Locker('M-1', 'MEDIUM')]);

      const tooBig = await request(app).post('/api/orders').send({ ...newOrder, size: 'LARGE' });
      expect(tooBig.status).toBe(409);
      expect(tooBig.body.error.code).toBe('STATION_AT_CAPACITY');

      await request(app).post('/api/orders').send(newOrder); // takes the only slot
      const overbooked = await request(app).post('/api/orders').send(newOrder);
      expect(overbooked.status).toBe(409);
      expect(overbooked.body.error.code).toBe('STATION_AT_CAPACITY');
    });

    it('mocks an incoming platform order sized to the available capacity', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL')]);

      const mocked = await request(app).post('/api/orders/mock').send();

      expect(mocked.status).toBe(201);
      expect(mocked.body.order.size).toBe('SMALL'); // the only size with capacity
      expect(mocked.body.order.customerEmail).toMatch(/@example\.com$/);

      const awaiting = await request(app).get('/api/orders?status=awaiting-dispatch');
      expect(awaiting.body.orders).toHaveLength(1);
    });

    it('tells operations when the station is too full to mock an order', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL')]);
      await request(app).post('/api/orders/mock').send();

      const refused = await request(app).post('/api/orders/mock').send();

      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe('STATION_AT_CAPACITY');
      expect(refused.body.error.message).toMatch(/cannot accept new orders/i);
    });
  });

  describe('returns to warehouse (overdue packages)', () => {
    const newOrder = {
      customerName: 'Jane Tan',
      customerEmail: 'jane.tan@example.com',
      customerPhone: '+60 12-000 0001',
      size: 'MEDIUM',
    };

    async function storeOrderViaApi(app: Parameters<typeof request>[0]) {
      await request(app).post('/api/orders').send(newOrder);
      await request(app).post('/api/orders/ORD-1001/dispatch').send();
      return request(app).post('/api/orders/ORD-1001/store').send();
    }

    it('lists overdue packages once they sit past the threshold, then returns them', async () => {
      const { app, clock } = await buildTestApp([new Locker('M-1', 'MEDIUM')]);
      const stored = await storeOrderViaApi(app);

      const before = await request(app).get('/api/returns');
      expect(before.body.overdue).toEqual([]);

      clock.advanceHours(15 * 24);

      const after = await request(app).get('/api/returns');
      expect(after.body.overdue).toHaveLength(1);
      expect(after.body.overdue[0]).toMatchObject({
        lockerId: 'M-1',
        daysInLocker: 15,
        orderId: 'ORD-1001',
        customerName: 'Jane Tan',
      });

      const returned = await request(app).post('/api/lockers/M-1/return').send();
      expect(returned.status).toBe(200);
      expect(returned.body).toMatchObject({ returned: true, lockerId: 'M-1', orderId: 'ORD-1001' });

      // Locker is free again and the old PIN is dead.
      const board = await request(app).get('/api/lockers');
      expect(board.body.lockers[0].available).toBe(true);
      const pickup = await request(app)
        .post('/api/pickups')
        .send({ pickupCode: stored.body.pickupCode });
      expect(pickup.status).toBe(422);

      const emptied = await request(app).get('/api/returns');
      expect(emptied.body.overdue).toEqual([]);
    });

    it('refuses to return a package that is not yet overdue', async () => {
      const { app, clock } = await buildTestApp([new Locker('M-1', 'MEDIUM')]);
      await storeOrderViaApi(app);
      clock.advanceHours(24);

      const response = await request(app).post('/api/lockers/M-1/return').send();

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('PACKAGE_NOT_OVERDUE');
    });
  });

  describe('GET /api/admin/lockers (operations overview)', () => {
    it('shows PIN, storage time and accrued charge for occupied lockers only', async () => {
      const { app, clock } = await buildTestApp([
        new Locker('S-1', 'SMALL'),
        new Locker('S-2', 'SMALL'),
      ]);
      await request(app).post('/api/packages').send({ size: 'SMALL' });
      clock.advanceHours(25); // day 2 at X=10 → 20 accrued

      const response = await request(app).get('/api/admin/lockers');

      expect(response.status).toBe(200);
      expect(response.body.lockers).toEqual([
        {
          id: 'S-1',
          size: 'SMALL',
          available: false,
          pickupCode: 'CODE01',
          storedAt: '2026-08-15T10:00:00.000Z',
          accruedCharge: 20,
        },
        {
          id: 'S-2',
          size: 'SMALL',
          available: true,
          pickupCode: null,
          storedAt: null,
          accruedCharge: null,
        },
      ]);
    });
  });

  describe('POST /api/pickups', () => {
    it('opens the locker, returns the package and the storage charge, and frees the locker', async () => {
      const { app, clock } = await buildTestApp([new Locker('S-1', 'SMALL')]);
      const stored = await request(app).post('/api/packages').send({ size: 'SMALL' });

      clock.advanceHours(25); // into day 2 → 2 days at X=10
      const response = await request(app).post('/api/pickups').send({
        lockerId: stored.body.lockerId,
        pickupCode: stored.body.pickupCode,
      });

      expect(response.status).toBe(200);
      expect(response.body.opened).toBe(true);
      expect(response.body.package).toEqual({ id: stored.body.packageId, size: 'SMALL' });
      expect(response.body.storageCharge).toBe(20);

      const lockers = await request(app).get('/api/lockers');
      expect(lockers.body.lockers).toEqual([{ id: 'S-1', size: 'SMALL', available: true }]);
    });

    it('opens the right locker from the PIN alone — locker id is optional', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL'), new Locker('S-2', 'SMALL')]);
      await request(app).post('/api/packages').send({ size: 'SMALL' });
      const second = await request(app).post('/api/packages').send({ size: 'SMALL' });

      const response = await request(app)
        .post('/api/pickups')
        .send({ pickupCode: second.body.pickupCode });

      expect(response.status).toBe(200);
      expect(response.body.opened).toBe(true);
      expect(response.body.lockerId).toBe('S-2');
      expect(response.body.package.id).toBe(second.body.packageId);

      const board = await request(app).get('/api/lockers');
      expect(board.body.lockers).toEqual([
        { id: 'S-1', size: 'SMALL', available: false },
        { id: 'S-2', size: 'SMALL', available: true },
      ]);
    });

    it('returns 422 for a PIN that matches no stored package', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL')]);

      const response = await request(app).post('/api/pickups').send({ pickupCode: '000000' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('INVALID_PICKUP_CODE');
    });

    it('returns 404 for an unknown locker', async () => {
      const { app } = await buildTestApp();

      const response = await request(app)
        .post('/api/pickups')
        .send({ lockerId: 'S-9', pickupCode: 'CODE01' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LOCKER_NOT_FOUND');
    });

    it('returns 422 for a wrong pickup code and keeps the package stored', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL')]);
      await request(app).post('/api/packages').send({ size: 'SMALL' });

      const response = await request(app)
        .post('/api/pickups')
        .send({ lockerId: 'S-1', pickupCode: 'WRONG1' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('INVALID_PICKUP_CODE');

      const lockers = await request(app).get('/api/lockers');
      expect(lockers.body.lockers[0].available).toBe(false);
    });

    it('returns 422 when the locker is empty (including replayed codes)', async () => {
      const { app } = await buildTestApp([new Locker('S-1', 'SMALL')]);
      const stored = await request(app).post('/api/packages').send({ size: 'SMALL' });
      const pickup = {
        lockerId: stored.body.lockerId,
        pickupCode: stored.body.pickupCode,
      };
      await request(app).post('/api/pickups').send(pickup);

      const replay = await request(app).post('/api/pickups').send(pickup);

      expect(replay.status).toBe(422);
      expect(replay.body.error.code).toBe('LOCKER_EMPTY');
    });

    it('rejects requests with missing fields', async () => {
      const { app } = await buildTestApp();

      const response = await request(app).post('/api/pickups').send({ lockerId: 'S-1' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
