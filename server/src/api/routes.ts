import { Router } from 'express';
import { z } from 'zod';
import { LOCKER_SIZES } from '../domain/LockerSize.js';
import type { Locker } from '../domain/Locker.js';
import type { LockerRepository } from '../application/ports.js';
import type { LockerFactory } from '../application/LockerFactory.js';
import type { StorePackageService } from '../application/StorePackageService.js';
import type { RetrievePackageService } from '../application/RetrievePackageService.js';

const createLockerSchema = z.object({ size: z.enum(LOCKER_SIZES) });
const storePackageSchema = z.object({ size: z.enum(LOCKER_SIZES) });
const pickupSchema = z.object({
  lockerId: z.string().trim().min(1),
  pickupCode: z.string().trim().min(1),
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

  router.post('/packages', async (req, res) => {
    const { size } = storePackageSchema.parse(req.body);
    const result = await deps.storePackageService.store(size);
    res.status(201).json(result);
  });

  router.post('/pickups', async (req, res) => {
    const { lockerId, pickupCode } = pickupSchema.parse(req.body);
    const result = await deps.retrievePackageService.retrieve(lockerId, pickupCode);
    res.json({
      opened: true,
      package: result.package,
      storedAt: result.storedAt.toISOString(),
      retrievedAt: result.retrievedAt.toISOString(),
      storageCharge: result.storageCharge,
    });
  });

  return router;
}
