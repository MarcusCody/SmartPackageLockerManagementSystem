import { EmailClient, KnownEmailSendStatus } from '@azure/communication-email';
import type { PickupNotification, PickupNotifier } from '../../application/ports.js';
import { buildPickupEmail } from '../../application/pickupEmail.js';

/**
 * Sends the pickup PIN through Azure Communication Services Email.
 * Configured via ACS_CONNECTION_STRING and EMAIL_SENDER_ADDRESS (the
 * MailFrom address of a verified/managed ACS email domain).
 */
export class AcsEmailNotifier implements PickupNotifier {
  private readonly client: EmailClient;

  constructor(
    connectionString: string,
    private readonly senderAddress: string,
  ) {
    this.client = new EmailClient(connectionString);
  }

  async sendPickupCode(notification: PickupNotification): Promise<void> {
    const content = buildPickupEmail(notification);

    const poller = await this.client.beginSend({
      senderAddress: this.senderAddress,
      recipients: { to: [{ address: notification.to }] },
      content,
    });
    const result = await poller.pollUntilDone();

    if (result.status !== KnownEmailSendStatus.Succeeded) {
      throw new Error(`ACS email send finished with status "${result.status}".`);
    }
  }
}
