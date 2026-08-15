import type { LockerSize } from './LockerSize.js';

export interface Package {
  readonly id: string;
  readonly size: LockerSize;
}
