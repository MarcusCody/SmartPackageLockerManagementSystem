import { useState } from 'react';
import type { FormEvent } from 'react';
import type { PickupResult } from '../api/client';
import { ApiError } from '../api/client';

interface CustomerViewProps {
  onRetrieve: (pickupCode: string, lockerId?: string) => Promise<PickupResult>;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  LOCKER_NOT_FOUND: "We couldn't find that locker. Check the locker ID and try again.",
  INVALID_PICKUP_CODE: "That pickup code doesn't match any stored package. Check the code and try again.",
  LOCKER_EMPTY: 'This locker is empty. The package may have already been collected.',
};

/**
 * Customer flow: the PIN is enough on its own — PINs are unique per
 * active package, so the system finds and opens the right locker. The
 * locker id is optional; when given, it is validated together.
 */
export function CustomerView({ onRetrieve }: CustomerViewProps) {
  const [pickupCode, setPickupCode] = useState('');
  const [lockerId, setLockerId] = useState('');
  const [result, setResult] = useState<PickupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const trimmedLockerId = lockerId.trim().toUpperCase();
      const pickup = await onRetrieve(
        pickupCode.trim(),
        trimmedLockerId === '' ? undefined : trimmedLockerId,
      );
      setResult(pickup);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(FRIENDLY_ERRORS[cause.code] ?? cause.message);
      } else {
        setError('Something went wrong. Please retry.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="customer-heading">
      <h2 id="customer-heading">Collect your package</h2>
      <form onSubmit={handleSubmit} className="panel form-grid">
        <label htmlFor="pickup-code">Pickup code</label>
        <input
          id="pickup-code"
          value={pickupCode}
          onChange={(event) => setPickupCode(event.target.value)}
          placeholder="6-digit PIN"
          inputMode="numeric"
          autoComplete="off"
          required
        />
        <label htmlFor="locker-id">Locker ID (optional)</label>
        <input
          id="locker-id"
          value={lockerId}
          onChange={(event) => setLockerId(event.target.value)}
          placeholder="e.g. S-1"
          autoComplete="off"
        />
        <button type="submit" disabled={busy}>
          Open locker
        </button>
      </form>

      {result && (
        <div className="panel result-panel" role="status">
          <h3>
            Locker {result.lockerId} is open — collect your package{' '}
            <span aria-hidden="true">📦</span>
          </h3>
          <p>
            Storage charge:{' '}
            <strong className="highlight">
              {result.storageCharge === 0
                ? 'Free — collected within the grace period'
                : `RM${result.storageCharge}`}
            </strong>
          </p>
          <p className="hint">
            Stored {new Date(result.storedAt).toLocaleString()} · Collected{' '}
            {new Date(result.retrievedAt).toLocaleString()}
          </p>
        </div>
      )}

      {error && (
        <p className="panel error-panel" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
