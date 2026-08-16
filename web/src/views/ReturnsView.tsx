import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import type { OverdueView, ReturnResult } from '../api/client';
import { ApiError } from '../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

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
    <section aria-labelledby="returns-heading" className="mt-8 space-y-4">
      <h2 id="returns-heading" className="text-lg font-semibold">
        Overdue — return to warehouse
      </h2>
      {overdue.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Overdue packages">
          {overdue.map((entry) => (
            <li
              key={entry.lockerId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <strong className="font-semibold">{entry.lockerId}</strong>
                  <Badge variant="muted">{entry.size.toLowerCase()}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {entry.daysInLocker} days in locker · stored{' '}
                  {new Date(entry.storedAt).toLocaleDateString()}
                  {entry.customerName === null
                    ? ' · walk-in package'
                    : ` · ${entry.customerName} (${entry.orderId})`}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                aria-label={`Return locker ${entry.lockerId} package to warehouse`}
                onClick={() => void returnPackage(entry.lockerId)}
                disabled={busy}
              >
                <Undo2 className="size-4" aria-hidden="true" />
                Return to warehouse
              </Button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <Alert role="status" variant="success">
          {message}
        </Alert>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
    </section>
  );
}
