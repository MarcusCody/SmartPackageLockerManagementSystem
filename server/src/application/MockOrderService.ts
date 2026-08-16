import { randomInt } from 'node:crypto';
import type { Order } from '../domain/Order.js';
import { StationAtCapacityError } from '../domain/errors.js';
import type { LockerRepository, OrderRepository } from './ports.js';
import type { RegisterOrderService } from './RegisterOrderService.js';
import { acceptableSizes } from './policies/StationCapacityPolicy.js';

export type Pick = <T>(options: readonly T[]) => T;

const defaultPick: Pick = (options) => {
  const option = options[randomInt(options.length)];
  if (option === undefined) {
    throw new Error('pick called with no options');
  }
  return option;
};

const NAMES = [
  'Aina Zulkifli',
  'Ben Ong',
  'Chloe Wong',
  'Daniel Lim',
  'Farah Aziz',
  'Hana Ismail',
  'Jason Teo',
  'Nurul Huda',
  'Sam Raj',
  'Yuki Tan',
] as const;

/**
 * Simulates the e-commerce platform pushing a new delivery to this
 * station: random customer, random size — but only a size the station
 * can still absorb (see StationCapacityPolicy). Refuses loudly when the
 * station is full so operations knows why nothing arrived.
 */
export class MockOrderService {
  constructor(
    private readonly lockers: LockerRepository,
    private readonly orders: OrderRepository,
    private readonly registerOrders: RegisterOrderService,
    private readonly pick: Pick = defaultPick,
  ) {}

  async mockIncomingOrder(): Promise<Order> {
    const [lockers, pending, awaiting] = await Promise.all([
      this.lockers.findAll(),
      this.orders.findPending(),
      this.orders.findAwaitingDispatch(),
    ]);

    const sizes = acceptableSizes(lockers, [...pending, ...awaiting]);
    if (sizes.length === 0) {
      throw new StationAtCapacityError();
    }

    const customerName = this.pick(NAMES);
    const customerEmail = `${customerName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;
    const digits = () => this.pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const);
    const customerPhone = `+60 1${digits()}-${digits()}${digits()}${digits()} ${digits()}${digits()}${digits()}${digits()}`;

    return this.registerOrders.register({
      customerName,
      customerEmail,
      customerPhone,
      packageSize: this.pick(sizes),
    });
  }
}
