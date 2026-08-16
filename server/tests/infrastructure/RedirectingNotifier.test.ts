import { describe, expect, it } from 'vitest';
import { RedirectingNotifier } from '../../src/infrastructure/notifications/RedirectingNotifier.js';
import { FailingNotifier, RecordingNotifier } from '../helpers/stubs.js';

const notification = {
  to: 'jane.tan@example.com',
  lockerId: 'S-1',
  pickupCode: '042731',
  packageSize: 'SMALL' as const,
  storedAt: new Date('2026-08-15T10:00:00Z'),
};

describe('RedirectingNotifier (demo inbox override)', () => {
  it('sends every notification to the configured inbox instead of the customer', async () => {
    const inner = new RecordingNotifier();
    const notifier = new RedirectingNotifier(inner, 'demo-inbox@example.com');

    await notifier.sendPickupCode(notification);

    expect(inner.sent).toHaveLength(1);
    expect(inner.sent[0]?.to).toBe('demo-inbox@example.com');
    // Everything else passes through untouched.
    expect(inner.sent[0]).toMatchObject({
      lockerId: 'S-1',
      pickupCode: '042731',
      packageSize: 'SMALL',
    });
  });

  it('propagates provider failures unchanged', async () => {
    const notifier = new RedirectingNotifier(new FailingNotifier(), 'demo-inbox@example.com');

    await expect(notifier.sendPickupCode(notification)).rejects.toThrow(/unavailable/);
  });
});
