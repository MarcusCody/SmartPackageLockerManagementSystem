import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLockerSize } from './domain/LockerSize.js';
import type { LockerSize } from './domain/LockerSize.js';
import { LockerFactory } from './application/LockerFactory.js';
import { OrderFactory } from './application/OrderFactory.js';
import { StorePackageService } from './application/StorePackageService.js';
import { StoreOrderService } from './application/StoreOrderService.js';
import { RegisterOrderService } from './application/RegisterOrderService.js';
import { MockOrderService } from './application/MockOrderService.js';
import { DispatchOrderService } from './application/DispatchOrderService.js';
import { ReturnPackageService } from './application/ReturnPackageService.js';
import { RetrievePackageService } from './application/RetrievePackageService.js';
import { LockerOverviewService } from './application/LockerOverviewService.js';
import { SmallestSuitableLockerStrategy } from './application/policies/LockerAllocationStrategy.js';
import { TieredStorageFeePolicy } from './application/policies/StorageFeePolicy.js';
import type { LockerRepository, OrderRepository } from './application/ports.js';
import { InMemoryLockerRepository } from './infrastructure/InMemoryLockerRepository.js';
import { InMemoryOrderRepository } from './infrastructure/InMemoryOrderRepository.js';
import { createPool, migrate } from './infrastructure/postgres/db.js';
import { PostgresLockerRepository } from './infrastructure/postgres/PostgresLockerRepository.js';
import { PostgresOrderRepository } from './infrastructure/postgres/PostgresOrderRepository.js';
import { RandomPickupCodeGenerator } from './infrastructure/RandomPickupCodeGenerator.js';
import { SystemClock } from './infrastructure/SystemClock.js';
import { ConsoleNotifier } from './infrastructure/notifications/ConsoleNotifier.js';
import { AcsEmailNotifier } from './infrastructure/notifications/AcsEmailNotifier.js';
import { RedirectingNotifier } from './infrastructure/notifications/RedirectingNotifier.js';
import type { PickupNotifier } from './application/ports.js';
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

/** Highest numeric suffix among ids like S-3 / ORD-1009, so sequences resume. */
function maxSuffix(ids: string[]): number {
  return ids.reduce((max, id) => {
    const suffix = Number(id.split('-')[1]);
    return Number.isInteger(suffix) && suffix > max ? suffix : max;
  }, 0);
}

async function buildStorage(): Promise<{
  repository: LockerRepository;
  orderRepository: OrderRepository;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) {
    console.log('Storage: in-memory (set DATABASE_URL to use PostgreSQL)');
    return { repository: new InMemoryLockerRepository(), orderRepository: new InMemoryOrderRepository() };
  }
  const pool = createPool(databaseUrl);
  await migrate(pool);
  console.log('Storage: PostgreSQL');
  return {
    repository: new PostgresLockerRepository(pool),
    orderRepository: new PostgresOrderRepository(pool),
  };
}

async function main(): Promise<void> {
  const { repository, orderRepository } = await buildStorage();

  // Seed only an empty station (first boot / in-memory); on a database
  // restart the existing rows win and the id sequences resume from them.
  const existingLockers = await repository.findAll();
  const factory = new LockerFactory({
    SMALL: maxSuffix(existingLockers.filter((l) => l.size === 'SMALL').map((l) => l.id)),
    MEDIUM: maxSuffix(existingLockers.filter((l) => l.size === 'MEDIUM').map((l) => l.id)),
    LARGE: maxSuffix(existingLockers.filter((l) => l.size === 'LARGE').map((l) => l.id)),
  });
  if (existingLockers.length === 0) {
    for (const { size, count } of parseSeed(SEED)) {
      for (let i = 0; i < count; i += 1) {
        await repository.add(factory.create(size));
      }
    }
  }

  const existingOrders = await orderRepository.findAll();
  const orderFactory = new OrderFactory(Math.max(1000, maxSuffix(existingOrders.map((o) => o.id))));
  if (existingOrders.length === 0) {
    for (const [index, sample] of SAMPLE_ORDERS.entries()) {
      const order = orderFactory.create(sample);
      if (index < DISPATCHED_SEEDS) {
        order.dispatch();
      }
      await orderRepository.add(order);
    }
  }

  const clock = new SystemClock();
  const feePolicy = new TieredStorageFeePolicy(STORAGE_FEE_SCHEDULE);
  const registerOrderService = new RegisterOrderService(orderRepository, repository, orderFactory);

  // Real email only when ACS is configured; otherwise emails render to
  // the console so the flow works with zero external dependencies.
  const acsConnectionString = process.env.ACS_CONNECTION_STRING;
  const emailSenderAddress = process.env.EMAIL_SENDER_ADDRESS;
  const usingAcs = acsConnectionString !== undefined && emailSenderAddress !== undefined;
  let notifier: PickupNotifier = usingAcs
    ? new AcsEmailNotifier(acsConnectionString, emailSenderAddress)
    : new ConsoleNotifier();
  console.log(
    usingAcs
      ? 'Email notifications: Azure Communication Services'
      : 'Email notifications: console only (set ACS_CONNECTION_STRING and EMAIL_SENDER_ADDRESS to send real email)',
  );
  // Demo mode: deliver every email to one real inbox instead of the
  // (sample) customer addresses.
  const redirectTo = process.env.EMAIL_REDIRECT_ALL_TO;
  if (redirectTo !== undefined && redirectTo !== '') {
    notifier = new RedirectingNotifier(notifier, redirectTo);
    console.log(`Email notifications: redirecting every message to ${redirectTo}`);
  }

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
      registerOrderService,
      mockOrderService: new MockOrderService(repository, orderRepository, registerOrderService),
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
