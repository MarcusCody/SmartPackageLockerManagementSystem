import { describe, expect, it } from 'vitest';
import { LockerFactory } from '../../src/application/LockerFactory.js';

describe('LockerFactory', () => {
  it('assigns sequential per-size identifiers', () => {
    const factory = new LockerFactory();

    expect(factory.create('SMALL').id).toBe('S-1');
    expect(factory.create('SMALL').id).toBe('S-2');
    expect(factory.create('LARGE').id).toBe('L-1');
  });

  it('can resume from persisted per-size counters', () => {
    const factory = new LockerFactory({ SMALL: 3, MEDIUM: 0, LARGE: 2 });

    expect(factory.create('SMALL').id).toBe('S-4');
    expect(factory.create('MEDIUM').id).toBe('M-1');
    expect(factory.create('LARGE').id).toBe('L-3');
  });
});
