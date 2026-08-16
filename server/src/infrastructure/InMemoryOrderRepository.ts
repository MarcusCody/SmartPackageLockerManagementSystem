import type { Order } from '../domain/Order.js';
import type { OrderRepository } from '../application/ports.js';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async add(order: Order): Promise<void> {
    if (this.orders.has(order.id)) {
      throw new Error(`Duplicate order id: ${order.id}`);
    }
    this.orders.set(order.id, order);
  }

  async findById(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async findPending(): Promise<Order[]> {
    return [...this.orders.values()].filter((order) => order.isPending);
  }
}
