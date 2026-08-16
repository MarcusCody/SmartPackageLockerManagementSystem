import type { Order, OrderDetails } from '../domain/Order.js';
import { StationAtCapacityError } from '../domain/errors.js';
import type { LockerRepository, OrderRepository } from './ports.js';
import type { OrderFactory } from './OrderFactory.js';
import { hasCapacityFor } from './policies/StationCapacityPolicy.js';

/**
 * Platform-side use case: register a delivery for this station. The
 * platform never accepts an order the station cannot absorb — free
 * lockers minus undelivered orders, size-aware.
 */
export class RegisterOrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly lockers: LockerRepository,
    private readonly orderFactory: OrderFactory,
  ) {}

  async register(details: OrderDetails): Promise<Order> {
    const [lockers, pending, awaiting] = await Promise.all([
      this.lockers.findAll(),
      this.orders.findPending(),
      this.orders.findAwaitingDispatch(),
    ]);

    if (!hasCapacityFor(details.packageSize, lockers, [...pending, ...awaiting])) {
      throw new StationAtCapacityError(details.packageSize);
    }

    const order = this.orderFactory.create(details);
    await this.orders.add(order);
    return order;
  }
}
