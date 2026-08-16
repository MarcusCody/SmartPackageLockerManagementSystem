import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLockerSize } from './domain/LockerSize.js';
import type { LockerSize } from './domain/LockerSize.js';
import { LockerFactory } from './application/LockerFactory.js';
import { OrderFactory } from './application/OrderFactory.js';
import { StorePackageService } from './application/StorePackageService.js';
import { StoreOrderService } from './application/StoreOrderService.js';
import { DispatchOrderService } from './application/DispatchOrderService.js';
import { ReturnPackageService } from './application/ReturnPackageService.js';
import { RetrievePackageService } from './application/RetrievePackageService.js';
import { LockerOverviewService } from './application/LockerOverviewService.js';
import { SmallestSuitableLockerStrategy } from './application/policies/LockerAllocationStrategy.js';
import { TieredStorageFeePolicy } from './application/policies/StorageFeePolicy.js';
import { InMemoryLockerRepository } from './infrastructure/InMemoryLockerRepository.js';
import { InMemoryOrderRepository } from './infrastructure/InMemoryOrderRepository.js';
import { RandomPickupCodeGenerator } from './infrastructure/RandomPickupCodeGenerator.js';
import { SystemClock } from './infrastructure/SystemClock.js';
import { ConsoleNotifier } from './infrastructure/notifications/ConsoleNotifier.js';
import { AcsEmailNotifier } from './infrastructure/notifications/AcsEmailNotifier.js';
import { createApp } from './api/server.js';

const PORT = Number(process.env.PORT ?? 3000);
// Lockers available at startup so the station works out of the box.
const SEED = process.env.SEED_LOCKERS ?? 'SMALL:3,MEDIUM:3,LARGE:2';
// Packages sitting this many days become overdue and returnable to the
// warehouse. Set RETURN_AFTER_DAYS=0 to demo the return flow instantly.
const RETURN_AFTER_DAYS = Number(process.env.RETURN_AFTER_DAYS ?? 15);

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

// Sample platform orders so both queues are demonstrable out of the box:
// the first DISPATCHED_SEEDS go straight to the agent's pending queue,
// the rest sit with the platform awaiting dispatch from /operation.
const SAMPLE_ORDERS = [
  { customerName: 'Jane Tan', customerEmail: 'jane.tan@example.com', customerPhone: '+60 12-000 0001', packageSize: 'SMALL' },
  { customerName: 'Adam Lee', customerEmail: 'adam.lee@example.com', customerPhone: '+60 12-000 0002', packageSize: 'MEDIUM' },
  { customerName: 'Priya Nair', customerEmail: 'priya.nair@example.com', customerPhone: '+60 12-000 0003', packageSize: 'LARGE' },
  { customerName: 'Wei Chen', customerEmail: 'wei.chen@example.com', customerPhone: '+60 12-000 0004', packageSize: 'SMALL' },
  { customerName: 'Sara Lim', customerEmail: 'sara.lim@example.com', customerPhone: '+60 12-000 0005', packageSize: 'MEDIUM' },
  { customerName: 'Omar Hakim', customerEmail: 'omar.hakim@example.com', customerPhone: '+60 12-000 0006', packageSize: 'SMALL' },
  { customerName: 'Mei Ling', customerEmail: 'mei.ling@example.com', customerPhone: '+60 12-000 0007', packageSize: 'LARGE' },
  { customerName: 'Ravi Kumar', customerEmail: 'ravi.kumar@example.com', customerPhone: '+60 12-000 0008', packageSize: 'MEDIUM' },
  { customerName: 'Aisha Rahman', customerEmail: 'aisha.rahman@example.com', customerPhone: '+60 12-000 0009', packageSize: 'SMALL' },
] as const;
const DISPATCHED_SEEDS = 3;

async function main(): Promise<void> {
  const repository = new InMemoryLockerRepository();
  const factory = new LockerFactory();

  for (const { size, count } of parseSeed(SEED)) {
    for (let i = 0; i < count; i += 1) {
      await repository.add(factory.create(size));
    }
  }

  const orderRepository = new InMemoryOrderRepository();
  const orderFactory = new OrderFactory();
  for (const [index, sample] of SAMPLE_ORDERS.entries()) {
    const order = orderFactory.create(sample);
    if (index < DISPATCHED_SEEDS) {
      order.dispatch();
    }
    await orderRepository.add(order);
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

  const storePackageService = new StorePackageService(
    repository,
    new SmallestSuitableLockerStrategy(),
    new RandomPickupCodeGenerator(),
    clock,
    notifier,
  );

  const app = createApp(
    {
      lockerRepository: repository,
      lockerFactory: factory,
      orderRepository,
      orderFactory,
      storePackageService,
      storeOrderService: new StoreOrderService(orderRepository, storePackageService),
      dispatchOrderService: new DispatchOrderService(orderRepository),
      returnPackageService: new ReturnPackageService(
        repository,
        orderRepository,
        clock,
        RETURN_AFTER_DAYS,
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
