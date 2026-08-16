import type { LockerSize } from '../domain/LockerSize.js';
import { OrderAlreadyStoredError, OrderNotFoundError } from '../domain/errors.js';
import type { OrderRepository } from './ports.js';
import type { StorePackageResult, StorePackageService } from './StorePackageService.js';

export interface StoreOrderResult extends StorePackageResult {
  order: {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    packageSize: LockerSize;
  };
}

/**
 * Delivery-agent use case: pick a pending order and store its package.
 * Composes StorePackageService — the order supplies the size and the
 * customer contact, so the agent never types them.
 */
export class StoreOrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly storePackages: StorePackageService,
  ) {}

  async storeOrder(orderId: string): Promise<StoreOrderResult> {
    const order = await this.orders.findById(orderId);
    if (order === undefined) {
      throw new OrderNotFoundError(orderId);
    }
    if (!order.isPending) {
      throw new OrderAlreadyStoredError(orderId);
    }

    const stored = await this.storePackages.store(order.packageSize, order.customerEmail);
    order.markStored();

    return {
      ...stored,
      order: {
        id: order.id,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        packageSize: order.packageSize,
      },
    };
  }
}
