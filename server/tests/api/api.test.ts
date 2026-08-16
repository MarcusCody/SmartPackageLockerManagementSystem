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
