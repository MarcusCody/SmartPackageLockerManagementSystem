import { Router } from 'express';
import { z } from 'zod';
import { LOCKER_SIZES } from '../domain/LockerSize.js';
import type { Locker } from '../domain/Locker.js';
import type { LockerRepository } from '../application/ports.js';
import type { LockerFactory } from '../application/LockerFactory.js';
import type { StorePackageService } from '../application/StorePackageService.js';
import type { RetrievePackageService } from '../application/RetrievePackageService.js';
import type { LockerOverviewService } from '../application/LockerOverviewService.js';

const createLockerSchema = z.object({ size: z.enum(LOCKER_SIZES) });
const storePackageSchema = z.object({ size: z.enum(LOCKER_SIZES) });
const pickupSchema = z.object({
  pickupCode: z.string().trim().min(1),
  // Optional: PINs are unique among active packages, so the code alone
  // is enough; when provided, the locker+code pair is validated.
  lockerId: z.string().trim().min(1).optional(),
});

const toLockerView = (locker: Locker) => ({
  id: locker.id,
  size: locker.size,
  available: locker.isAvailable,
});

export interface ApiDependencies {
  lockerRepository: LockerRepository;
  lockerFactory: LockerFactory;
  storePackageService: StorePackageService;
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

  router.post('/packages', async (req, res) => {
    const { size } = storePackageSchema.parse(req.body);
    const result = await deps.storePackageService.store(size);
    res.status(201).json(result);
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
