import { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import type { OrderView, StoreOrderResult } from '../api/client';
import { ApiError } from '../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle } from '@/components/ui/alert';

interface AgentViewProps {
  orders: OrderView[];
  onStoreOrder: (orderId: string) => Promise<StoreOrderResult>;
}

const SIZE_LABEL: Record<OrderView['size'], string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
};

/**
 * Delivery agent flow: pick a pending order to store. The order carries
 * the customer's contact details, so the agent never types them — the
 * PIN is emailed automatically.
 */
export function AgentView({ orders, onStoreOrder }: AgentViewProps) {
  const [result, setResult] = useState<StoreOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function storeOrder(orderId: string) {
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      setResult(await onStoreOrder(orderId));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <section aria-labelledby="agent-heading" className="space-y-4">
      <h2 id="agent-heading" className="text-lg font-semibold">
        Pending deliveries
      </h2>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pending orders — register one in the Operations tab to simulate the platform.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Pending orders">
          {orders.map((order) => (
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
                aria-label={`Store order ${order.id}`}
                onClick={() => void storeOrder(order.id)}
                disabled={busy}
              >
                <PackagePlus className="size-4" aria-hidden="true" />
                Store
              </Button>
            </li>
          ))}
        </ul>
      )}

      {result && (
        <Alert role="status" variant="success">
          <AlertTitle>Package stored — order {result.order.id}</AlertTitle>
          <p className="mb-1">
            Locker <strong className="text-base">{result.lockerId}</strong>
          </p>
          <p className="mb-1 flex items-center gap-2">
            Pickup code{' '}
            <code className="rounded-md border border-green-200 bg-white px-2 py-0.5 text-base font-bold tracking-widest">
              {result.pickupCode}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyCode(result.pickupCode)}
            >
              {copied ? 'Copied!' : 'Copy code'}
            </Button>
          </p>
          {result.notification === 'sent' && (
            <p className="text-green-800/80">PIN sent to {result.order.customerEmail}.</p>
          )}
          {result.notification === 'failed' && (
            <p className="text-green-800/80">
              The email could not be sent — share the PIN with the customer manually.
            </p>
          )}
        </Alert>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}
    </section>
  );
}
