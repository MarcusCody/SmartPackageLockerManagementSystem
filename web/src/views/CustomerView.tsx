import { useState } from 'react';
import type { FormEvent } from 'react';
import { LockOpen } from 'lucide-react';
import type { PickupResult } from '../api/client';
import { ApiError } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle } from '@/components/ui/alert';

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
    <section aria-labelledby="customer-heading" className="space-y-4">
      <h2 id="customer-heading" className="text-lg font-semibold">
        Collect your package
      </h2>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Enter your pickup PIN</CardTitle>
          <CardDescription>The PIN from your email is all you need.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pickup-code">Pickup code</Label>
              <Input
                id="pickup-code"
                value={pickupCode}
                onChange={(event) => setPickupCode(event.target.value)}
                placeholder="6-digit PIN"
                inputMode="numeric"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="locker-id">Locker ID (optional)</Label>
              <Input
                id="locker-id"
                value={lockerId}
                onChange={(event) => setLockerId(event.target.value)}
                placeholder="e.g. S-1"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={busy}>
              <LockOpen className="size-4" aria-hidden="true" />
              Open locker
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Alert role="status" variant="success" className="max-w-md">
          <AlertTitle>
            Locker {result.lockerId} is open — collect your package{' '}
            <span aria-hidden="true">📦</span>
          </AlertTitle>
          <p className="mb-1">
            Storage charge:{' '}
            <strong>
              {result.storageCharge === 0
                ? 'Free — collected within the grace period'
                : `RM${result.storageCharge}`}
            </strong>
          </p>
          <p className="text-green-800/80">
            Stored {new Date(result.storedAt).toLocaleString()} · Collected{' '}
            {new Date(result.retrievedAt).toLocaleString()}
          </p>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="max-w-md">
          {error}
        </Alert>
      )}
    </section>
  );
}
