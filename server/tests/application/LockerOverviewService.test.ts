import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import { LockerOverviewService } from '../../src/application/LockerOverviewService.js';
import { TieredStorageFeePolicy } from '../../src/application/policies/StorageFeePolicy.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { FixedClock } from '../helpers/stubs.js';

const NOW = new Date('2026-08-15T10:00:00Z');

async function setup(lockers: Locker[]) {
  const repository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await repository.add(locker);
  }
  const clock = new FixedClock(NOW);
  const service = new LockerOverviewService(
    repository,
    new TieredStorageFeePolicy([
      { upToDay: 5, ratePerDay: 10 },
      { upToDay: 10, ratePerDay: 20 },
      { ratePerDay: 30 },
    ]),
    clock,
  );
  return { service, clock };
}

describe('LockerOverviewService (operations view)', () => {
  it('lists every locker with its availability', async () => {
    const { service } = await setup([new Locker('S-1', 'SMALL'), new Locker('L-1', 'LARGE')]);

    const overview = await service.overview();

    expect(overview).toHaveLength(2);
    expect(overview[0]).toMatchObject({ id: 'S-1', size: 'SMALL', available: true });
  });

  it('exposes the PIN, storage time and live accrued charge for occupied lockers', async () => {
    const occupied = new Locker('S-1', 'SMALL');
    occupied.store({ id: 'pkg-1', size: 'SMALL' }, '123456', NOW);
    const { service, clock } = await setup([occupied]);

    clock.advanceHours(25); // day 2 at X=10 → 20 accrued if picked up now

    const [view] = await service.overview();

    expect(view).toMatchObject({
      id: 'S-1',
      available: false,
      pickupCode: '123456',
      storedAt: NOW,
      accruedCharge: 20,
    });
  });

  it('exposes no PIN or charge for available lockers', async () => {
    const { service } = await setup([new Locker('S-1', 'SMALL')]);

    const [view] = await service.overview();

    expect(view.pickupCode).toBeNull();
    expect(view.storedAt).toBeNull();
    expect(view.accruedCharge).toBeNull();
  });
});
