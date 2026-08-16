import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AdminLockerView, LockerSize, LockerView, OrderView } from '../api/client';
import { ApiError } from '../api/client';
import { AdminLockerBoard } from '../components/AdminLockerBoard';

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
    <section aria-labelledby="operations-heading">
      <h2 id="operations-heading">Station operations</h2>
      <p className="hint">
        {lockers.length} lockers · {available} available · {lockers.length - available} occupied
      </p>
      <form onSubmit={handleSubmit} className="panel form-row">
        <label htmlFor="locker-size">New locker size</label>
        <select
          id="locker-size"
          value={size}
          onChange={(event) => setSize(event.target.value as LockerSize)}
        >
          <option value="SMALL">Small</option>
          <option value="MEDIUM">Medium</option>
          <option value="LARGE">Large</option>
        </select>
        <button type="submit" disabled={busy}>
          Add locker
        </button>
      </form>
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

      <h3 className="board-heading">Incoming from platform</h3>
      <p className="hint">
        Orders registered by the e-commerce platform, waiting to be dispatched to this station.
        The platform only accepts orders the station can absorb (free lockers minus undelivered
        orders, size-aware).
      </p>
      <p>
        <button type="button" onClick={() => void mockOrder()} disabled={busy}>
          Mock incoming order
        </button>
      </p>
      {incoming.length === 0 ? (
        <p className="board-empty">No incoming orders from the platform right now.</p>
      ) : (
        <ul className="order-list" aria-label="Incoming orders">
          {incoming.map((order) => (
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
                aria-label={`Dispatch order ${order.id} to this station`}
                onClick={() => void dispatchOrder(order.id)}
                disabled={busy}
              >
                Dispatch to station
              </button>
            </li>
          ))}
        </ul>
      )}
      {dispatchMessage && (
        <p className="panel result-panel" role="status">
          {dispatchMessage}
        </p>
      )}
      {dispatchError && (
        <p className="panel error-panel" role="alert">
          {dispatchError}
        </p>
      )}

      <h3 className="board-heading">Locker overview</h3>
      <AdminLockerBoard lockers={lockers} />
    </section>
  );
}
