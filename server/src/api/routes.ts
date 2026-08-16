import { Router } from 'express';
import { z } from 'zod';
import { LOCKER_SIZES } from '../domain/LockerSize.js';
import type { Locker } from '../domain/Locker.js';
import type { Order } from '../domain/Order.js';
import type { LockerRepository, OrderRepository } from '../application/ports.js';
import type { LockerFactory } from '../application/LockerFactory.js';
import type { RegisterOrderService } from '../application/RegisterOrderService.js';
import type { MockOrderService } from '../application/MockOrderService.js';
import type { StorePackageService } from '../application/StorePackageService.js';
import type { StoreOrderService } from '../application/StoreOrderService.js';
import type { DispatchOrderService } from '../application/DispatchOrderService.js';
import type { ReturnPackageService } from '../application/ReturnPackageService.js';
import type { RetrievePackageService } from '../application/RetrievePackageService.js';
import type { LockerOverviewService } from '../application/LockerOverviewService.js';

const createLockerSchema = z.object({ size: z.enum(LOCKER_SIZES) });
const storePackageSchema = z.object({
  size: z.enum(LOCKER_SIZES),
  // Optional: when present, the pickup PIN is emailed to the customer.
  customerEmail: z.email().optional(),
});
const pickupSchema = z.object({
  pickupCode: z.string().trim().min(1),
  // Optional: PINs are unique among active packages, so the code alone
  // is enough; when provided, the locker+code pair is validated.
  lockerId: z.string().trim().min(1).optional(),
});
const createOrderSchema = z.object({
  customerName: z.string().trim().min(1),
  customerEmail: z.email(),
  customerPhone: z.string().trim().min(7),
  size: z.enum(LOCKER_SIZES),
});
const listOrdersSchema = z.object({
  status: z.enum(['pending', 'awaiting-dispatch']).default('pending'),
});

const toLockerView = (locker: Locker) => ({
  id: locker.id,
  size: locker.size,
  available: locker.isAvailable,
});

const toOrderView = (order: Order) => ({
  id: order.id,
  customerName: order.customerName,
  customerEmail: order.customerEmail,
  customerPhone: order.customerPhone,
  size: order.packageSize,
});

export interface ApiDependencies {
  lockerRepository: LockerRepository;
  lockerFactory: LockerFactory;
  orderRepository: OrderRepository;
  registerOrderService: RegisterOrderService;
  mockOrderService: MockOrderService;
  storePackageService: StorePackageService;
  storeOrderService: StoreOrderService;
  dispatchOrderService: DispatchOrderService;
  returnPackageService: ReturnPackageService;
  retrievePackageService: RetrievePackageService;
  lockerOverviewService: LockerOverviewService;
}

export function apiRoutes(deps: ApiDependencies): Router {
  const router = Router();

  router.get('/lockers', async (_req, res) => {
    const lockers = await deps.lockerRepository.findAll();
    res.json({ lockers: lockers.map(toLockerView) });
  });

  router.post('/lockers', async (req, res) => {
    const { size } = createLockerSchema.parse(req.body);
    const locker = deps.lockerFactory.create(size);
    await deps.lockerRepository.add(locker);
    res.status(201).json({ locker: toLockerView(locker) });
  });

  // Internal operations endpoint — would sit behind operator auth in production.
  router.get('/admin/lockers', async (_req, res) => {
    const overview = await deps.lockerOverviewService.overview();
    res.json({
      lockers: overview.map((locker) => ({
        ...locker,
        storedAt: locker.storedAt?.toISOString() ?? null,
      })),
    });
  });

  // Orders arrive from the e-commerce platform with the customer contact
  // details already attached. ?status=pending (default) is the agent's
  // work queue; ?status=awaiting-dispatch is the platform's outbox.
  router.get('/orders', async (req, res) => {
    const { status } = listOrdersSchema.parse(req.query);
    const orders =
      status === 'pending'
        ? await deps.orderRepository.findPending()
        : await deps.orderRepository.findAwaitingDispatch();
    res.json({ orders: orders.map(toOrderView) });
  });

  router.post('/orders/:orderId/dispatch', async (req, res) => {
    const order = await deps.dispatchOrderService.dispatch(req.params.orderId);
    res.json({ order: toOrderView(order) });
  });

  // The upstream platform registering a delivery — refused when the
  // station has no capacity for the size (see StationCapacityPolicy).
  router.post('/orders', async (req, res) => {
    const { customerName, customerEmail, customerPhone, size } = createOrderSchema.parse(req.body);
    const order = await deps.registerOrderService.register({
      customerName,
      customerEmail,
      customerPhone,
      packageSize: size,
    });
    res.status(201).json({ order: toOrderView(order) });
  });

  // Simulates the platform pushing a random new delivery to this station.
  router.post('/orders/mock', async (_req, res) => {
    const order = await deps.mockOrderService.mockIncomingOrder();
    res.status(201).json({ order: toOrderView(order) });
  });

  router.post('/orders/:orderId/store', async (req, res) => {
    const result = await deps.storeOrderService.storeOrder(req.params.orderId);
    res.status(201).json(result);
  });

  router.post('/packages', async (req, res) => {
    const { size, customerEmail } = storePackageSchema.parse(req.body);
    const result = await deps.storePackageService.store(size, customerEmail);
    res.status(201).json(result);
  });

  // Overdue packages the agent should return to the warehouse.
  router.get('/returns', async (_req, res) => {
    const overdue = await deps.returnPackageService.listOverdue();
    res.json({
      overdue: overdue.map((entry) => ({ ...entry, storedAt: entry.storedAt.toISOString() })),
    });
  });

  router.post('/lockers/:lockerId/return', async (req, res) => {
    const result = await deps.returnPackageService.returnToWarehouse(req.params.lockerId);
    res.json({ returned: true, ...result });
  });

  router.post('/pickups', async (req, res) => {
    const { pickupCode, lockerId } = pickupSchema.parse(req.body);
    const result = await deps.retrievePackageService.retrieve(pickupCode, lockerId);
    res.json({
      opened: true,
      lockerId: result.lockerId,
      package: result.package,
      storedAt: result.storedAt.toISOString(),
      retrievedAt: result.retrievedAt.toISOString(),
      storageCharge: result.storageCharge,
    });
  });

  return router;
}
