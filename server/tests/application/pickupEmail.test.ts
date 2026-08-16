import { describe, expect, it } from 'vitest';
import { buildPickupEmail } from '../../src/application/pickupEmail.js';

const notification = {
  to: 'jane@example.com',
  lockerId: 'M-2',
  pickupCode: '042731',
  packageSize: 'MEDIUM' as const,
  storedAt: new Date('2026-08-15T10:00:00Z'),
};

describe('buildPickupEmail', () => {
  it('names the locker in the subject', () => {
    const email = buildPickupEmail(notification);

    expect(email.subject).toContain('M-2');
  });

  it('includes the PIN and locker in both plain-text and HTML bodies', () => {
    const email = buildPickupEmail(notification);

    expect(email.plainText).toContain('042731');
    expect(email.plainText).toContain('M-2');
    expect(email.html).toContain('042731');
    expect(email.html).toContain('M-2');
  });

  it('reminds the customer that charges apply after the free grace period', () => {
    const email = buildPickupEmail(notification);

    expect(email.plainText).toMatch(/first 5 days.*free/i);
    expect(email.html).toMatch(/first 5 days.*free/i);
  });
});
