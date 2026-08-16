import type { Locker } from '../../domain/Locker.js';
import type { Order } from '../../domain/Order.js';
import type { LockerSize } from '../../domain/LockerSize.js';
import { LOCKER_SIZES } from '../../domain/LockerSize.js';

// Largest first: a locker can absorb its own size or anything smaller,
// so capacity must be checked cumulatively from the top tier down.
const TIERS: readonly LockerSize[] = [...LOCKER_SIZES].reverse();

/** Orders that still need a locker at this station. */
const needsLocker = (order: Order) => order.isAwaitingDispatch || order.isPending;

/**
 * Can the station absorb one more order of `size`, counting free lockers
 * against committed demand (undelivered orders)? For nested sizes the
 * sufficient condition is cumulative: for every tier from LARGE down,
 * demand at-or-above the tier must not exceed free lockers at-or-above it
 * — this allows upgrades (a SMALL order in a LARGE locker) without ever
 * double-booking a locker.
 */
export function hasCapacityFor(
  size: LockerSize,
  lockers: readonly Locker[],
  orders: readonly Order[],
): boolean {
  const unstored = orders.filter(needsLocker);

  let cumulativeDemand = 0;
  let cumulativeSupply = 0;
  for (const tier of TIERS) {
    cumulativeDemand +=
      unstored.filter((order) => order.packageSize === tier).length + (size === tier ? 1 : 0);
    cumulativeSupply += lockers.filter(
      (locker) => locker.isAvailable && locker.size === tier,
    ).length;
    if (cumulativeDemand > cumulativeSupply) {
      return false;
    }
  }
  return true;
}

/** The sizes the station can still accept an order for. */
export function acceptableSizes(
  lockers: readonly Locker[],
  orders: readonly Order[],
): LockerSize[] {
  return LOCKER_SIZES.filter((size) => hasCapacityFor(size, lockers, orders));
}
