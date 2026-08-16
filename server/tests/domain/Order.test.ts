import { describe, expect, it } from 'vitest';
import { Order } from '../../src/domain/Order.js';
import {
  OrderAlreadyDispatchedError,
  OrderAlreadyStoredError,
  OrderNotDispatchedError,
} from '../../src/domain/errors.js';
import { OrderFactory } from '../../src/application/OrderFactory.js';

const details = {
  customerName: 'Jane Tan',
  customerEmail: 'jane.tan@example.com',
  customerPhone: '+60 12-000 0001',
  packageSize: 'SMALL' as const,
};

describe('Order lifecycle', () => {
  it('starts awaiting dispatch, carrying the customer contact details', () => {
    const order = new Order('ORD-1001', details);

    expect(order.status).toBe('AWAITING_DISPATCH');
    expect(order.isAwaitingDispatch).toBe(true);
    expect(order.isPending).toBe(false);
    expect(order.customerEmail).toBe('jane.tan@example.com');
    expect(order.customerPhone).toBe('+60 12-000 0001');
  });

  it('enters the station queue when dispatched', () => {
    const order = new Order('ORD-1001', details);

    order.dispatch();

    expect(order.status).toBe('PENDING');
    expect(order.isPending).toBe(true);
  });

  it('cannot be dispatched twice', () => {
    const order = new Order('ORD-1001', details);
    order.dispatch();

    expect(() => order.dispatch()).toThrow(OrderAlreadyDispatchedError);
  });

  it('cannot be stored before it was dispatched to the station', () => {
    const order = new Order('ORD-1001', details);

    expect(() => order.markStored('pkg-1')).toThrow(OrderNotDispatchedError);
  });

  it('records the package it was stored as', () => {
    const order = new Order('ORD-1001', details);
    order.dispatch();

    order.markStored('pkg-1');

    expect(order.status).toBe('STORED');
    expect(order.packageId).toBe('pkg-1');
  });

  it('cannot be stored twice', () => {
    const order = new Order('ORD-1001', details);
    order.dispatch();
    order.markStored('pkg-1');

    expect(() => order.markStored('pkg-2')).toThrow(OrderAlreadyStoredError);
  });

  it('can be returned to the warehouse once stored', () => {
    const order = new Order('ORD-1001', details);
    order.dispatch();
    order.markStored('pkg-1');

    order.markReturned();

    expect(order.status).toBe('RETURNED');
  });

  it('cannot be returned unless it is stored in a locker', () => {
    const order = new Order('ORD-1001', details);
    order.dispatch();

    expect(() => order.markReturned()).toThrow(/cannot be returned/i);
  });
});

describe('OrderFactory', () => {
  it('assigns sequential order ids', () => {
    const factory = new OrderFactory();

    expect(factory.create(details).id).toBe('ORD-1001');
    expect(factory.create(details).id).toBe('ORD-1002');
  });
});
