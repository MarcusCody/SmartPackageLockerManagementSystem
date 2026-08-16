import { Order } from '../domain/Order.js';
import type { OrderDetails } from '../domain/Order.js';

/**
 * Assigns sequential, human-readable order ids. Stands in for the
 * upstream e-commerce platform, which would supply its own ids.
 */
export class OrderFactory {
  private sequence = 1000;

  create(details: OrderDetails): Order {
    this.sequence += 1;
    return new Order(`ORD-${this.sequence}`, details);
  }
}
