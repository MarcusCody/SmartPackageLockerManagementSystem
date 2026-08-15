import { describe, expect, it } from 'vitest';
import { RandomPickupCodeGenerator } from '../../src/infrastructure/RandomPickupCodeGenerator.js';

describe('RandomPickupCodeGenerator', () => {
  it('generates 6-digit numeric PINs, preserving leading zeros', () => {
    const generator = new RandomPickupCodeGenerator();

    for (let i = 0; i < 500; i += 1) {
      expect(generator.generate()).toMatch(/^\d{6}$/);
    }
  });

  it('does not generate the same PIN every time', () => {
    const generator = new RandomPickupCodeGenerator();
    const pins = new Set(Array.from({ length: 100 }, () => generator.generate()));

    expect(pins.size).toBeGreaterThan(1);
  });
});
