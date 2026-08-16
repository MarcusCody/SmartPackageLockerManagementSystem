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

  async findAll(): Promise<Order[]> {
    return [...this.orders.values()];
  }

  async findById(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async findPending(): Promise<Order[]> {
    return [...this.orders.values()].filter((order) => order.isPending);
  }

  async findAwaitingDispatch(): Promise<Order[]> {
    return [...this.orders.values()].filter((order) => order.isAwaitingDispatch);
  }

  async findByPackageId(packageId: string): Promise<Order | undefined> {
    return [...this.orders.values()].find((order) => order.packageId === packageId);
  }

  async save(_order: Order): Promise<void> {
    // Entities are shared references in memory — mutations are already visible.
  }
}
