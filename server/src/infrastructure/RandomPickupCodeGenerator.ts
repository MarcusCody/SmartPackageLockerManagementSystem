import { randomInt } from 'node:crypto';
import type { PickupCodeGenerator } from '../application/ports.js';

// No 0/O or 1/I — customers read these codes off a phone screen.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export class RandomPickupCodeGenerator implements PickupCodeGenerator {
  generate(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += ALPHABET[randomInt(ALPHABET.length)];
    }
    return code;
  }
}
