import type { LockerSize } from './LockerSize.js';
import { OrderAlreadyStoredError } from './errors.js';

export type OrderStatus = 'PENDING' | 'STORED';

export interface OrderDetails {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  packageSize: LockerSize;
}

/**
 * A delivery order from the e-commerce platform. It carries the customer
 * contact details, so the delivery agent never types them: email is used
 * for the pickup PIN today, phone is reserved for a future SMS channel.
 */
export class Order {
  private status: OrderStatus = 'PENDING';

  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
  readonly packageSize: LockerSize;

  constructor(
    readonly id: string,
    details: OrderDetails,
  ) {
    this.customerName = details.customerName;
    this.customerEmail = details.customerEmail;
    this.customerPhone = details.customerPhone;
    this.packageSize = details.packageSize;
  }

  get isPending(): boolean {
    return this.status === 'PENDING';
  }

  markStored(): void {
    if (!this.isPending) {
      throw new OrderAlreadyStoredError(this.id);
    }
    this.status = 'STORED';
  }
}
