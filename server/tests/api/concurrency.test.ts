import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Locker } from '../../src/domain/Locker.js';
import { buildTestApp } from '../helpers/app.js';

const manyCodes = (count: number) =>
  Array.from({ length: count }, (_, i) => `CODE${String(i).padStart(4, '0')}`);

describe('Level 4: concurrent storage requests', () => {
  it('assigns each locker to exactly one of many simultaneous requests', async () => {
    const lockers = Array.from({ length: 4 }, (_, i) => new Locker(`S-${i + 1}`, 'SMALL'));
    const { app } = await buildTestApp(lockers, manyCodes(50));

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => request(app).post('/api/packages').send({ size: 'SMALL' })),
    );

    const succeeded = responses.filter((response) => response.status === 201);
    const refused = responses.filter((response) => response.status === 409);

    // Only the 4 available lockers are assigned; everyone else is told
    // no suitable locker is available — never an error or a hang.
    expect(succeeded).toHaveLength(4);
    expect(refused).toHaveLength(6);
    for (const response of refused) {
      expect(response.body.error.code).toBe('NO_SUITABLE_LOCKER');
    }

    // Two different requests never receive the same locker.
    const assignedLockers = succeeded.map((response) => response.body.lockerId as string);
    expect(new Set(assignedLockers).size).toBe(4);

    // Availability stays correct: exactly the assigned lockers are occupied.
    const board = await request(app).get('/api/lockers');
    const occupied = board.body.lockers
      .filter((locker: { available: boolean }) => !locker.available)
      .map((locker: { id: string }) => locker.id);
    expect(occupied.sort()).toEqual(assignedLockers.sort());
  });

  it('stays consistent under a large interleaved store/retrieve load', async () => {
    const lockers = Array.from({ length: 8 }, (_, i) => new Locker(`S-${i + 1}`, 'SMALL'));
    const { app } = await buildTestApp(lockers, manyCodes(500));

    // Each task tries to store and, if it got a locker, immediately picks
    // its own package up with its own code. If a locker were ever handed
    // to two requests at once, one of them would find a different package
    // (or none) behind its code and this pickup would fail.
    const task = async () => {
      const stored = await request(app).post('/api/packages').send({ size: 'SMALL' });
      if (stored.status !== 201) {
        expect(stored.status).toBe(409);
        expect(stored.body.error.code).toBe('NO_SUITABLE_LOCKER');
        return { storedOk: false, pickupOk: undefined };
      }
      const pickup = await request(app).post('/api/pickups').send({
        lockerId: stored.body.lockerId,
        pickupCode: stored.body.pickupCode,
      });
      return {
        storedOk: true,
        pickupOk: pickup.status === 200 && pickup.body.package.id === stored.body.packageId,
      };
    };

    // 120 tasks in concurrent waves of 30 — full contention within each
    // wave, while keeping the number of simultaneous sockets below OS
    // limits so the test never flakes on ephemeral-port exhaustion.
    const results: Awaited<ReturnType<typeof task>>[] = [];
    for (let wave = 0; wave < 4; wave += 1) {
      results.push(...(await Promise.all(Array.from({ length: 30 }, task))));
    }

    const storedCount = results.filter((result) => result.storedOk).length;
    expect(storedCount).toBeGreaterThan(0);
    for (const result of results) {
      if (result.storedOk) {
        expect(result.pickupOk).toBe(true);
      }
    }

    // Every package was collected, so the whole station must be free again.
    const board = await request(app).get('/api/lockers');
    expect(
      board.body.lockers.every((locker: { available: boolean }) => locker.available),
    ).toBe(true);
  });
});
