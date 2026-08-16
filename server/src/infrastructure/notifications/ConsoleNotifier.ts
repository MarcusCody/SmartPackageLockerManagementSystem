import type { PickupNotification, PickupNotifier } from '../../application/ports.js';
import { buildPickupEmail } from '../../application/pickupEmail.js';

/**
 * Default notifier when no email provider is configured: renders the
 * email to stdout so the flow is fully demonstrable with zero external
 * dependencies or secrets.
 */
export class ConsoleNotifier implements PickupNotifier {
  async sendPickupCode(notification: PickupNotification): Promise<void> {
    const email = buildPickupEmail(notification);
    console.log(
      [
        '--- pickup email (console notifier — no provider configured) ---',
        `To:      ${notification.to}`,
        `Subject: ${email.subject}`,
        email.plainText,
        '----------------------------------------------------------------',
      ].join('\n'),
    );
  }
}
