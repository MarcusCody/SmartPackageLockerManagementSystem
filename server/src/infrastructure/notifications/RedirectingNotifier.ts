import type { PickupNotification, PickupNotifier } from '../../application/ports.js';

/**
 * Demo/sandbox decorator: delivers every notification to one real inbox
 * (EMAIL_REDIRECT_ALL_TO) instead of the customer's address, so flows
 * exercised with sample data produce inspectable real emails. Wraps any
 * notifier — ACS in the cloud, console locally.
 */
export class RedirectingNotifier implements PickupNotifier {
  constructor(
    private readonly inner: PickupNotifier,
    private readonly redirectTo: string,
  ) {}

  async sendPickupCode(notification: PickupNotification): Promise<void> {
    console.log(
      `[email-redirect] message for ${notification.to} delivered to ${this.redirectTo}`,
    );
    await this.inner.sendPickupCode({ ...notification, to: this.redirectTo });
  }
}
