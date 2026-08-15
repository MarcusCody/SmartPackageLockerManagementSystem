import { randomUUID } from 'node:crypto';
import type { Package } from '../domain/Package.js';
import type { LockerSize } from '../domain/LockerSize.js';
import type { Clock, LockerRepository, PickupCodeGenerator } from './ports.js';
import type { LockerAllocationStrategy } from './policies/LockerAllocationStrategy.js';

const MAX_CODE_ATTEMPTS = 100;

export interface StorePackageResult {
  lockerId: string;
  pickupCode: string;
  packageId: string;
}

/** Delivery-agent use case: find a locker, store the package, hand back the pickup code. */
export class StorePackageService {
  constructor(
    private readonly lockers: LockerRepository,
    private readonly strategy: LockerAllocationStrategy,
    private readonly codeGenerator: PickupCodeGenerator,
    private readonly clock: Clock,
  ) {}

  async store(packageSize: LockerSize): Promise<StorePackageResult> {
    const all = await this.lockers.findAll();
    const pickupCode = this.uniquePickupCode(all);
    const pkg: Package = { id: randomUUID(), size: packageSize };

    // Selection + reservation happen atomically inside the repository so
    // concurrent requests can never be handed the same locker (Level 4).
    const locker = await this.lockers.findAndReserve(
      pkg,
      pickupCode,
      this.clock.now(),
      this.strategy,
    );

    return { lockerId: locker.id, pickupCode, packageId: pkg.id };
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
