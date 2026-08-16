import { describe, expect, it } from 'vitest';
import { Locker } from '../../src/domain/Locker.js';
import { NoSuitableLockerError } from '../../src/domain/errors.js';
import { StorePackageService } from '../../src/application/StorePackageService.js';
import { SmallestSuitableLockerStrategy } from '../../src/application/policies/LockerAllocationStrategy.js';
import { InMemoryLockerRepository } from '../../src/infrastructure/InMemoryLockerRepository.js';
import { FailingNotifier, FixedClock, RecordingNotifier, SequenceCodeGenerator } from '../helpers/stubs.js';
import type { PickupNotifier } from '../../src/application/ports.js';

const NOW = new Date('2026-08-15T10:00:00Z');

async function setup(
  lockers: Locker[],
  codes: string[] = ['CODE01', 'CODE02', 'CODE03'],
  notifier: PickupNotifier = new RecordingNotifier(),
) {
  const repository = new InMemoryLockerRepository();
  for (const locker of lockers) {
    await repository.add(locker);
  }
  const service = new StorePackageService(
    repository,
    new SmallestSuitableLockerStrategy(),
    new SequenceCodeGenerator(codes),
    new FixedClock(NOW),
    notifier,
  );
  return { repository, service, notifier };
}

describe('StorePackageService', () => {
  it('stores the package in the smallest suitable locker and returns locker id + pickup code', async () => {
    const { service } = await setup([new Locker('L-1', 'LARGE'), new Locker('S-1', 'SMALL')]);

    const result = await service.store('SMALL');

    expect(result.lockerId).toBe('S-1');
    expect(result.pickupCode).toBe('CODE01');
    expect(result.packageId).toEqual(expect.any(String));
  });

  it('marks the assigned locker as unavailable', async () => {
    const { service, repository } = await setup([new Locker('S-1', 'SMALL')]);

    await service.store('SMALL');

    const locker = await repository.findById('S-1');
    expect(locker?.isAvailable).toBe(false);
  });

  it('assigns a distinct package id per stored package', async () => {
    const { service } = await setup([new Locker('S-1', 'SMALL'), new Locker('S-2', 'SMALL')]);

    const first = await service.store('SMALL');
    const second = await service.store('SMALL');

    expect(first.packageId).not.toBe(second.packageId);
  });

  it('tells the caller the package cannot be stored when no locker fits', async () => {
    const { service } = await setup([new Locker('S-1', 'SMALL')]);

    await expect(service.store('LARGE')).rejects.toThrow(NoSuitableLockerError);
    await expect(service.store('LARGE')).rejects.toThrow(/cannot be stored/i);
  });

  it('tells the caller the package cannot be stored when all suitable lockers are occupied', async () => {
    const { service } = await setup([new Locker('S-1', 'SMALL')]);
    await service.store('SMALL');

    await expect(service.store('SMALL')).rejects.toThrow(NoSuitableLockerError);
  });

  it('regenerates the pickup code until it is unique among active packages', async () => {
    const { service } = await setup(
      [new Locker('S-1', 'SMALL'), new Locker('S-2', 'SMALL')],
      ['DUPLICATE', 'DUPLICATE', 'FRESH1'],
    );

    const first = await service.store('SMALL');
    const second = await service.store('SMALL');

    expect(first.pickupCode).toBe('DUPLICATE');
    expect(second.pickupCode).toBe('FRESH1');
  });

  describe('pickup notification (email)', () => {
    it('emails the PIN and locker to the customer when an email is provided', async () => {
      const notifier = new RecordingNotifier();
      const { service } = await setup([new Locker('S-1', 'SMALL')], undefined, notifier);

      const result = await service.store('SMALL', 'jane@example.com');

      expect(result.notification).toBe('sent');
      expect(notifier.sent).toHaveLength(1);
      expect(notifier.sent[0]).toEqual({
        to: 'jane@example.com',
        lockerId: 'S-1',
        pickupCode: 'CODE01',
        packageSize: 'SMALL',
        storedAt: NOW,
      });
    });

    it('sends nothing when no email is provided', async () => {
      const notifier = new RecordingNotifier();
      const { service } = await setup([new Locker('S-1', 'SMALL')], undefined, notifier);

      const result = await service.store('SMALL');

      expect(result.notification).toBe('none');
      expect(notifier.sent).toHaveLength(0);
    });

    it('still stores the package when the email provider fails', async () => {
      const notifier = new FailingNotifier();
      const { service, repository } = await setup([new Locker('S-1', 'SMALL')], undefined, notifier);

      const result = await service.store('SMALL', 'jane@example.com');

      expect(result.notification).toBe('failed');
      expect(result.pickupCode).toBe('CODE01');
      expect(notifier.attempts).toHaveLength(1);

      const locker = await repository.findById('S-1');
      expect(locker?.isAvailable).toBe(false); // reservation survives the email outage
    });
  });
});
