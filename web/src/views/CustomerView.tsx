import { useState } from 'react';
import type { FormEvent } from 'react';
import type { PickupResult } from '../api/client';
import { ApiError } from '../api/client';

interface CustomerViewProps {
  onRetrieve: (lockerId: string, pickupCode: string) => Promise<PickupResult>;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  LOCKER_NOT_FOUND: "We couldn't find that locker. Check the locker ID and try again.",
  INVALID_PICKUP_CODE: "That pickup code doesn't match this locker. Check the code and try again.",
  LOCKER_EMPTY: 'This locker is empty. The package may have already been collected.',
};

/** Customer flow: enter locker id + pickup code, open the locker, see the storage charge. */
export function CustomerView({ onRetrieve }: CustomerViewProps) {
  const [lockerId, setLockerId] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [result, setResult] = useState<{ lockerId: string; pickup: PickupResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const trimmedLockerId = lockerId.trim().toUpperCase();
      const pickup = await onRetrieve(trimmedLockerId, pickupCode.trim().toUpperCase());
      setResult({ lockerId: trimmedLockerId, pickup });
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
        <label htmlFor="locker-id">Locker ID</label>
        <input
          id="locker-id"
          value={lockerId}
          onChange={(event) => setLockerId(event.target.value)}
          placeholder="e.g. S-1"
          autoComplete="off"
          required
        />
        <label htmlFor="pickup-code">Pickup code</label>
        <input
          id="pickup-code"
          value={pickupCode}
          onChange={(event) => setPickupCode(event.target.value)}
          placeholder="6-character code"
          autoComplete="off"
          required
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
            Storage charge: <strong className="highlight">{result.pickup.storageCharge} units</strong>
          </p>
          <p className="hint">
            Stored {new Date(result.pickup.storedAt).toLocaleString()} · Collected{' '}
            {new Date(result.pickup.retrievedAt).toLocaleString()}
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
