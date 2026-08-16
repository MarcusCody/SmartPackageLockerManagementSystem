export type LockerSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface LockerView {
  id: string;
  size: LockerSize;
  available: boolean;
}

/** Operations-only view — includes the PIN and the charge accrued so far. */
export interface AdminLockerView extends LockerView {
  pickupCode: string | null;
  storedAt: string | null;
  accruedCharge: number | null;
}

export interface StoreResult {
  lockerId: string;
  pickupCode: string;
  packageId: string;
}

export interface PickupResult {
  opened: boolean;
  /** Which locker opened — the customer may have collected by PIN alone. */
  lockerId: string;
  package: { id: string; size: LockerSize };
  storedAt: string;
  retrievedAt: string;
  storageCharge: number;
}

/** Error shape the server guarantees: {error: {code, message}} with a meaningful status. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new ApiError(
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }
  return body as T;
}

export const api = {
  async listLockers(): Promise<LockerView[]> {
    const { lockers } = await requestJson<{ lockers: LockerView[] }>('/api/lockers');
    return lockers;
  },

  async adminLockers(): Promise<AdminLockerView[]> {
    const { lockers } = await requestJson<{ lockers: AdminLockerView[] }>('/api/admin/lockers');
    return lockers;
  },

  async createLocker(size: LockerSize): Promise<LockerView> {
    const { locker } = await requestJson<{ locker: LockerView }>('/api/lockers', {
      method: 'POST',
      body: JSON.stringify({ size }),
    });
    return locker;
  },

  storePackage(size: LockerSize): Promise<StoreResult> {
    return requestJson<StoreResult>('/api/packages', {
      method: 'POST',
      body: JSON.stringify({ size }),
    });
  },

  retrievePackage(pickupCode: string, lockerId?: string): Promise<PickupResult> {
    return requestJson<PickupResult>('/api/pickups', {
      method: 'POST',
      body: JSON.stringify(lockerId === undefined ? { pickupCode } : { pickupCode, lockerId }),
    });
  },
};
