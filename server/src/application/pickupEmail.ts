import type { PickupNotification } from './ports.js';

export interface PickupEmailContent {
  subject: string;
  plainText: string;
  html: string;
}

/** Pure content builder so the email copy is testable without any provider. */
export function buildPickupEmail(notification: PickupNotification): PickupEmailContent {
  const { lockerId, pickupCode, packageSize, storedAt } = notification;
  const sizeLabel = packageSize.toLowerCase();
  const storedAtText = storedAt.toUTCString();

  const subject = `Your package is ready for collection — locker ${lockerId}`;

  const plainText = [
    `Your ${sizeLabel} package has been stored at the locker station.`,
    '',
    `Locker: ${lockerId}`,
    `Pickup PIN: ${pickupCode}`,
    `Stored at: ${storedAtText}`,
    '',
    'Enter the PIN at the locker station to collect your package.',
    'The first 5 days of storage are free; storage charges apply after that.',
  ].join('\n');

  const html = `
    <p>Your ${sizeLabel} package has been stored at the locker station.</p>
    <p>
      Locker: <strong>${lockerId}</strong><br />
      Pickup PIN: <strong style="font-size: 1.2em; letter-spacing: 0.1em;">${pickupCode}</strong><br />
      Stored at: ${storedAtText}
    </p>
    <p>Enter the PIN at the locker station to collect your package.</p>
    <p>The first 5 days of storage are free; storage charges apply after that.</p>
  `;

  return { subject, plainText, html };
}
