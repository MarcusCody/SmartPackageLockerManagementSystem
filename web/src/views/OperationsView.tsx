import { useState } from 'react';
import type { FormEvent } from 'react';
import { PlusCircle, Send, Sparkles } from 'lucide-react';
import type { AdminLockerView, LockerSize, LockerView, OrderView } from '../api/client';
import { ApiError } from '../api/client';
import { AdminLockerBoard } from '../components/AdminLockerBoard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface OperationsViewProps {
  lockers: AdminLockerView[];
  incoming: OrderView[];
  onCreate: (size: LockerSize) => Promise<LockerView>;
  onDispatch: (orderId: string) => Promise<OrderView>;
  onMockOrder: () => Promise<OrderView>;
}

const SIZE_LABEL: Record<LockerSize, string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
};

const selectClass =
  'h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Internal station-operator flow: dispatch platform orders, add lockers, watch capacity. */
export function OperationsView({
  lockers,
  incoming,
  onCreate,
  onDispatch,
  onMockOrder,
}: OperationsViewProps) {
  const [size, setSize] = useState<LockerSize>('SMALL');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const available = lockers.filter((locker) => locker.available).length;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const locker = await onCreate(size);
      setMessage(`Locker ${locker.id} (${locker.size.toLowerCase()}) added.`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function dispatchOrder(orderId: string) {
    setBusy(true);
    setDispatchMessage(null);
    setDispatchError(null);
    try {
      const order = await onDispatch(orderId);
      setDispatchMessage(`${order.id} dispatched — it is now in the delivery agent's queue.`);
    } catch (cause) {
      setDispatchError(
        cause instanceof ApiError ? cause.message : 'Something went wrong. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function mockOrder() {
    setBusy(true);
    setDispatchMessage(null);
    setDispatchError(null);
    try {
      const order = await onMockOrder();
      setDispatchMessage(
        `${order.id} (${order.size.toLowerCase()}, ${order.customerName}) arrived from the platform.`,
      );
    } catch (cause) {
      setDispatchError(
        cause instanceof ApiError ? cause.message : 'Something went wrong. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="operations-heading" className="space-y-4">
      <div>
        <h2 id="operations-heading" className="text-lg font-semibold">
          Station operations
        </h2>
        <p className="text-sm text-muted-foreground">
          {lockers.length} lockers · {available} available · {lockers.length - available} occupied
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
      >
        <Label htmlFor="locker-size">New locker size</Label>
        <select
          id="locker-size"
          className={selectClass}
          value={size}
          onChange={(event) => setSize(event.target.value as LockerSize)}
        >
          <option value="SMALL">Small</option>
          <option value="MEDIUM">Medium</option>
          <option value="LARGE">Large</option>
        </select>
        <Button type="submit" disabled={busy}>
          <PlusCircle className="size-4" aria-hidden="true" />
          Add locker
        </Button>
      </form>
      {message && (
        <Alert role="status" variant="success">
          {message}
        </Alert>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="pt-4">
        <h3 className="font-semibold">Incoming from platform</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Orders registered by the e-commerce platform, waiting to be dispatched to this station.
          The platform only accepts orders the station can absorb (free lockers minus undelivered
          orders, size-aware).
        </p>
        <p className="mb-3">
          <Button type="button" variant="secondary" onClick={() => void mockOrder()} disabled={busy}>
            <Sparkles className="size-4" aria-hidden="true" />
            Mock incoming order
          </Button>
        </p>
        {incoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No incoming orders from the platform right now.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Incoming orders">
            {incoming.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <strong className="font-semibold">{order.id}</strong>
                    <Badge variant="secondary">{SIZE_LABEL[order.size]}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.customerName} · {order.customerEmail} · {order.customerPhone}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Dispatch order ${order.id} to this station`}
                  onClick={() => void dispatchOrder(order.id)}
                  disabled={busy}
                >
                  <Send className="size-4" aria-hidden="true" />
                  Dispatch to station
                </Button>
              </li>
            ))}
          </ul>
        )}
        {dispatchMessage && (
          <Alert role="status" variant="success" className="mt-3">
            {dispatchMessage}
          </Alert>
        )}
        {dispatchError && (
          <Alert variant="destructive" className="mt-3">
            {dispatchError}
          </Alert>
        )}
      </div>

      <div className="pt-4">
        <h3 className="mb-3 font-semibold">Locker overview</h3>
        <AdminLockerBoard lockers={lockers} />
      </div>
    </section>
  );
}
