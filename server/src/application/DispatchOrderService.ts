import type { Order } from '../domain/Order.js';
import { OrderNotFoundError } from '../domain/errors.js';
import type { OrderRepository } from './ports.js';

/**
 * Operations use case: the platform's order is dispatched to this
 * station, joining the delivery agent's pending queue.
 */
export class DispatchOrderService {
  constructor(private readonly orders: OrderRepository) {}

  async dispatch(orderId: string): Promise<Order> {
    const order = await this.orders.findById(orderId);
    if (order === undefined) {
      throw new OrderNotFoundError(orderId);
    }
    order.dispatch();
    return order;
  }
}
