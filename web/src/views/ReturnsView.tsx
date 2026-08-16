import { useState } from 'react';
import type { OverdueView, ReturnResult } from '../api/client';
import { ApiError } from '../api/client';

interface ReturnsViewProps {
  overdue: OverdueView[];
  onReturn: (lockerId: string) => Promise<ReturnResult>;
}

/**
 * Overdue packages the agent should clear: past the return threshold,
 * the customer never collected — the package goes back to the warehouse
 * and the locker is freed for new deliveries.
 */
export function ReturnsView({ overdue, onReturn }: ReturnsViewProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (overdue.length === 0 && message === null && error === null) {
    return null;
  }

  async function returnPackage(lockerId: string) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await onReturn(lockerId);
      setMessage(
        result.orderId === null
          ? `Locker ${result.lockerId} cleared — the package was returned to the warehouse.`
          : `Locker ${result.lockerId} cleared — order ${result.orderId} was returned to the warehouse.`,
      );
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="returns-heading">
      <h2 id="returns-heading">Overdue — return to warehouse</h2>
      {overdue.length > 0 && (
        <ul className="order-list" aria-label="Overdue packages">
          {overdue.map((entry) => (
            <li key={entry.lockerId} className="panel order-row">
              <div className="order-info">
                <div>
                  <strong>{entry.lockerId}</strong>{' '}
                  <span className="order-size">{entry.size.toLowerCase()}</span>
                </div>
                <div className="order-contact">
                  {entry.daysInLocker} days in locker · stored{' '}
                  {new Date(entry.storedAt).toLocaleDateString()}
                  {entry.customerName === null
                    ? ' · walk-in package'
                    : ` · ${entry.customerName} (${entry.orderId})`}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Return locker ${entry.lockerId} package to warehouse`}
                onClick={() => void returnPackage(entry.lockerId)}
                disabled={busy}
              >
                Return to warehouse
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p className="panel result-panel" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="panel error-panel" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
