import { randomUUID } from 'node:crypto';
import type { Package } from '../domain/Package.js';
import type { LockerSize } from '../domain/LockerSize.js';
import type { Clock, LockerRepository, PickupCodeGenerator, PickupNotifier } from './ports.js';
import type { LockerAllocationStrategy } from './policies/LockerAllocationStrategy.js';

const MAX_CODE_ATTEMPTS = 100;

export type NotificationStatus = 'sent' | 'failed' | 'none';

export interface StorePackageResult {
  lockerId: string;
  pickupCode: string;
  packageId: string;
  notification: NotificationStatus;
}

/** Delivery-agent use case: find a locker, store the package, hand back the pickup code. */
export class StorePackageService {
  constructor(
    private readonly lockers: LockerRepository,
    private readonly strategy: LockerAllocationStrategy,
    private readonly codeGenerator: PickupCodeGenerator,
    private readonly clock: Clock,
    private readonly notifier: PickupNotifier,
  ) {}

  async store(packageSize: LockerSize, customerEmail?: string): Promise<StorePackageResult> {
    const all = await this.lockers.findAll();
    const pickupCode = this.uniquePickupCode(all);
    const pkg: Package = { id: randomUUID(), size: packageSize };
    const storedAt = this.clock.now();

    // Selection + reservation happen atomically inside the repository so
    // concurrent requests can never be handed the same locker (Level 4).
    const locker = await this.lockers.findAndReserve(pkg, pickupCode, storedAt, this.strategy);

    const notification = await this.notify(customerEmail, {
      lockerId: locker.id,
      pickupCode,
      packageSize,
      storedAt,
    });

    return { lockerId: locker.id, pickupCode, packageId: pkg.id, notification };
  }

  /**
   * The locker is already reserved by now, so a provider outage must not
   * fail the store — the agent is told instead, and can share the PIN
   * manually.
   */
  private async notify(
    customerEmail: string | undefined,
    details: { lockerId: string; pickupCode: string; packageSize: LockerSize; storedAt: Date },
  ): Promise<NotificationStatus> {
    if (customerEmail === undefined) {
      return 'none';
    }
    try {
      await this.notifier.sendPickupCode({ to: customerEmail, ...details });
      return 'sent';
    } catch (error) {
      console.error(`Failed to send pickup notification for locker ${details.lockerId}`, error);
      return 'failed';
    }
  }

  private uniquePickupCode(lockers: readonly { activePickupCode: string | null }[]): string {
    const activeCodes = new Set(
      lockers.map((locker) => locker.activePickupCode).filter((code) => code !== null),
    );
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = this.codeGenerator.generate();
      if (!activeCodes.has(code)) {
        return code;
      }
    }
    throw new Error('Unable to generate a unique pickup code.');
  }
}
