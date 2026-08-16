import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLockerSize } from './domain/LockerSize.js';
import type { LockerSize } from './domain/LockerSize.js';
import { LockerFactory } from './application/LockerFactory.js';
import { StorePackageService } from './application/StorePackageService.js';
import { RetrievePackageService } from './application/RetrievePackageService.js';
import { LockerOverviewService } from './application/LockerOverviewService.js';
import { SmallestSuitableLockerStrategy } from './application/policies/LockerAllocationStrategy.js';
import { TieredStorageFeePolicy } from './application/policies/StorageFeePolicy.js';
import { InMemoryLockerRepository } from './infrastructure/InMemoryLockerRepository.js';
import { RandomPickupCodeGenerator } from './infrastructure/RandomPickupCodeGenerator.js';
import { SystemClock } from './infrastructure/SystemClock.js';
import { ConsoleNotifier } from './infrastructure/notifications/ConsoleNotifier.js';
import { AcsEmailNotifier } from './infrastructure/notifications/AcsEmailNotifier.js';
import { createApp } from './api/server.js';

const PORT = Number(process.env.PORT ?? 3000);
// Lockers available at startup so the station works out of the box.
const SEED = process.env.SEED_LOCKERS ?? 'SMALL:3,MEDIUM:3,LARGE:2';

// Pricing (amounts in RM): first 5 days free as a grace period, RM1/day
// for days 6-7, RM2/day from day 8 onward.
const STORAGE_FEE_SCHEDULE = [
  { upToDay: 5, ratePerDay: 0 },
  { upToDay: 7, ratePerDay: 1 },
  { ratePerDay: 2 },
];

function parseSeed(seed: string): Array<{ size: LockerSize; count: number }> {
  return seed
    .split(',')
    .filter((entry) => entry.trim() !== '')
    .map((entry) => {
      const [size, countRaw] = entry.split(':').map((part) => part.trim());
      const count = Number(countRaw);
      if (size === undefined || !isLockerSize(size) || !Number.isInteger(count) || count < 0) {
        throw new Error(`Invalid SEED_LOCKERS entry: "${entry}" (expected e.g. "SMALL:3")`);
      }
      return { size, count };
    });
}

async function main(): Promise<void> {
  const repository = new InMemoryLockerRepository();
  const factory = new LockerFactory();

  for (const { size, count } of parseSeed(SEED)) {
    for (let i = 0; i < count; i += 1) {
      await repository.add(factory.create(size));
    }
  }

  const clock = new SystemClock();
  const feePolicy = new TieredStorageFeePolicy(STORAGE_FEE_SCHEDULE);

  // Real email only when ACS is configured; otherwise emails render to
  // the console so the flow works with zero external dependencies.
  const acsConnectionString = process.env.ACS_CONNECTION_STRING;
  const emailSenderAddress = process.env.EMAIL_SENDER_ADDRESS;
  const usingAcs = acsConnectionString !== undefined && emailSenderAddress !== undefined;
  const notifier = usingAcs
    ? new AcsEmailNotifier(acsConnectionString, emailSenderAddress)
    : new ConsoleNotifier();
  console.log(
    usingAcs
      ? 'Email notifications: Azure Communication Services'
      : 'Email notifications: console only (set ACS_CONNECTION_STRING and EMAIL_SENDER_ADDRESS to send real email)',
  );

  const app = createApp(
    {
      lockerRepository: repository,
      lockerFactory: factory,
      storePackageService: new StorePackageService(
        repository,
        new SmallestSuitableLockerStrategy(),
        new RandomPickupCodeGenerator(),
        clock,
        notifier,
      ),
      retrievePackageService: new RetrievePackageService(repository, feePolicy, clock),
      lockerOverviewService: new LockerOverviewService(repository, feePolicy, clock),
    },
    {
      webDistPath: path.resolve(fileURLToPath(import.meta.url), '../../../web/dist'),
    },
  );

  app.listen(PORT, () => {
    console.log(`Smart Package Locker server listening on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
