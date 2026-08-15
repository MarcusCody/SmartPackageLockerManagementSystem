import { randomInt } from 'node:crypto';
import type { PickupCodeGenerator } from '../application/ports.js';

const PIN_LENGTH = 6;

/** Keypad-friendly 6-digit numeric PIN (leading zeros preserved). */
export class RandomPickupCodeGenerator implements PickupCodeGenerator {
  generate(): string {
    return randomInt(0, 10 ** PIN_LENGTH)
      .toString()
      .padStart(PIN_LENGTH, '0');
  }
}
