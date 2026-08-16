import type { LockerSize } from './LockerSize.js';
import {
  OrderAlreadyDispatchedError,
  OrderAlreadyStoredError,
  OrderNotDispatchedError,
} from './errors.js';

export type OrderStatus = 'AWAITING_DISPATCH' | 'PENDING' | 'STORED' | 'RETURNED';

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
 *
 * Lifecycle: AWAITING_DISPATCH → (dispatch to a station) → PENDING →
 * (agent stores the package) → STORED → (overdue, returned) → RETURNED.
 */
export class Order {
  private state: OrderStatus = 'AWAITING_DISPATCH';
  private storedPackageId: string | null = null;

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

  get status(): OrderStatus {
    return this.state;
  }

  get isAwaitingDispatch(): boolean {
    return this.state === 'AWAITING_DISPATCH';
  }

  get isPending(): boolean {
    return this.state === 'PENDING';
  }

  /** The package this order was stored as, once stored. */
  get packageId(): string | null {
    return this.storedPackageId;
  }

  /** The platform hands the order to a station: it joins the agent's queue. */
  dispatch(): void {
    if (this.state !== 'AWAITING_DISPATCH') {
      throw new OrderAlreadyDispatchedError(this.id);
    }
    this.state = 'PENDING';
  }

  markStored(packageId: string): void {
    if (this.state === 'AWAITING_DISPATCH') {
      throw new OrderNotDispatchedError(this.id);
    }
    if (this.state !== 'PENDING') {
      throw new OrderAlreadyStoredError(this.id);
    }
    this.state = 'STORED';
    this.storedPackageId = packageId;
  }

  markReturned(): void {
    if (this.state !== 'STORED') {
      throw new Error(`Order ${this.id} cannot be returned: it is not stored in a locker.`);
    }
    this.state = 'RETURNED';
  }
}
