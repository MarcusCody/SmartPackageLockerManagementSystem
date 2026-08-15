export const LOCKER_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;

export type LockerSize = (typeof LOCKER_SIZES)[number];

const ORDER: Record<LockerSize, number> = { SMALL: 0, MEDIUM: 1, LARGE: 2 };

/** A locker can hold any package of its own size or smaller. */
export function fits(lockerSize: LockerSize, packageSize: LockerSize): boolean {
  return ORDER[lockerSize] >= ORDER[packageSize];
}

export function compareBySize(a: LockerSize, b: LockerSize): number {
  return ORDER[a] - ORDER[b];
}

export function isLockerSize(value: string): value is LockerSize {
  return (LOCKER_SIZES as readonly string[]).includes(value);
}
