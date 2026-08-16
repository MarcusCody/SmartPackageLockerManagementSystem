import type {
  Clock,
  PickupCodeGenerator,
  PickupNotification,
  PickupNotifier,
} from '../../src/application/ports.js';

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

/** Records every notification instead of sending anything. */
export class RecordingNotifier implements PickupNotifier {
  readonly sent: PickupNotification[] = [];

  async sendPickupCode(notification: PickupNotification): Promise<void> {
    this.sent.push(notification);
  }
}

/** Simulates a provider outage: records the attempt, then throws. */
export class FailingNotifier implements PickupNotifier {
  readonly attempts: PickupNotification[] = [];

  async sendPickupCode(notification: PickupNotification): Promise<void> {
    this.attempts.push(notification);
    throw new Error('email provider unavailable');
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
