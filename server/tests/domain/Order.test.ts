import { describe, expect, it } from 'vitest';
import { Order } from '../../src/domain/Order.js';
import { OrderAlreadyStoredError } from '../../src/domain/errors.js';
import { OrderFactory } from '../../src/application/OrderFactory.js';

const details = {
  customerName: 'Jane Tan',
  customerEmail: 'jane.tan@example.com',
  customerPhone: '+60 12-000 0001',
  packageSize: 'SMALL' as const,
};

describe('Order', () => {
  it('starts pending and carries the customer contact details', () => {
    const order = new Order('ORD-1001', details);

    expect(order.isPending).toBe(true);
    expect(order.customerEmail).toBe('jane.tan@example.com');
    expect(order.customerPhone).toBe('+60 12-000 0001');
    expect(order.packageSize).toBe('SMALL');
  });

  it('is no longer pending once marked stored', () => {
    const order = new Order('ORD-1001', details);

    order.markStored();

    expect(order.isPending).toBe(false);
  });

  it('cannot be stored twice', () => {
    const order = new Order('ORD-1001', details);
    order.markStored();

    expect(() => order.markStored()).toThrow(OrderAlreadyStoredError);
  });
});

describe('OrderFactory', () => {
  it('assigns sequential order ids', () => {
    const factory = new OrderFactory();

    expect(factory.create(details).id).toBe('ORD-1001');
    expect(factory.create(details).id).toBe('ORD-1002');
  });
});
