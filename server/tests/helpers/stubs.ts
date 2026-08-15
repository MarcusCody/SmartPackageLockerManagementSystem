import type { Clock, PickupCodeGenerator } from '../../src/application/ports.js';

/** Deterministic clock for tests; can be advanced to simulate elapsed storage time. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  set(date: Date): void {
    this.current = date;
  }

  advanceHours(hours: number): void {
    this.current = new Date(this.current.getTime() + hours * 60 * 60 * 1000);
  }
}

/** Returns pre-seeded codes in order; throws when exhausted so tests fail loudly. */
export class SequenceCodeGenerator implements PickupCodeGenerator {
  private index = 0;

  constructor(private readonly codes: readonly string[]) {}

  generate(): string {
    const code = this.codes[this.index];
    if (code === undefined) {
      throw new Error('SequenceCodeGenerator exhausted — seed more codes in the test');
    }
    this.index += 1;
    return code;
  }
}
