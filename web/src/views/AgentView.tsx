import { useState } from 'react';
import type { OrderView, StoreOrderResult } from '../api/client';
import { ApiError } from '../api/client';

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
    <section aria-labelledby="agent-heading">
      <h2 id="agent-heading">Pending deliveries</h2>
      {orders.length === 0 ? (
        <p className="board-empty">
          No pending orders — register one in the Operations tab to simulate the platform.
        </p>
      ) : (
        <ul className="order-list" aria-label="Pending orders">
          {orders.map((order) => (
            <li key={order.id} className="panel order-row">
              <div className="order-info">
                <div>
                  <strong>{order.id}</strong>{' '}
                  <span className="order-size">{SIZE_LABEL[order.size]}</span>
                </div>
                <div className="order-contact">
                  {order.customerName} · {order.customerEmail} · {order.customerPhone}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Store order ${order.id}`}
                onClick={() => void storeOrder(order.id)}
                disabled={busy}
              >
                Store
              </button>
            </li>
          ))}
        </ul>
      )}

      {result && (
        <div className="panel result-panel" role="status">
          <h3>Package stored — order {result.order.id}</h3>
          <p>
            Locker <strong className="highlight">{result.lockerId}</strong>
          </p>
          <p>
            Pickup code <code className="highlight">{result.pickupCode}</code>{' '}
            <button type="button" onClick={() => void copyCode(result.pickupCode)}>
              {copied ? 'Copied!' : 'Copy code'}
            </button>
          </p>
          {result.notification === 'sent' && (
            <p className="hint">PIN sent to {result.order.customerEmail}.</p>
          )}
          {result.notification === 'failed' && (
            <p className="hint">
              The email could not be sent — share the PIN with the customer manually.
            </p>
          )}
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
