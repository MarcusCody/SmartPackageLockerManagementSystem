import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AdminLockerView, LockerSize, LockerView, NewOrder, OrderView } from '../api/client';
import { ApiError } from '../api/client';
import { AdminLockerBoard } from '../components/AdminLockerBoard';
import { LockerWall } from '../components/LockerWall';

interface OperationsViewProps {
  lockers: AdminLockerView[];
  onCreate: (size: LockerSize) => Promise<LockerView>;
  onCreateOrder: (order: NewOrder) => Promise<OrderView>;
}

/** Internal station-operator flow: add lockers, register orders, watch capacity. */
export function OperationsView({ lockers, onCreate, onCreateOrder }: OperationsViewProps) {
  const [size, setSize] = useState<LockerSize>('SMALL');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [orderName, setOrderName] = useState('');
  const [orderEmail, setOrderEmail] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderSize, setOrderSize] = useState<LockerSize>('SMALL');
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

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

  async function handleOrderSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setOrderMessage(null);
    setOrderError(null);
    try {
      const order = await onCreateOrder({
        customerName: orderName.trim(),
        customerEmail: orderEmail.trim(),
        customerPhone: orderPhone.trim(),
        size: orderSize,
      });
      setOrderMessage(`${order.id} registered — it is now in the delivery agent's queue.`);
      setOrderName('');
      setOrderEmail('');
      setOrderPhone('');
    } catch (cause) {
      setOrderError(
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

      <h3 className="board-heading">Register incoming order</h3>
      <p className="hint">
        Simulates the e-commerce platform handing a delivery (with the customer&apos;s contact
        details) to this station.
      </p>
      <form onSubmit={handleOrderSubmit} className="panel form-grid">
        <label htmlFor="order-name">Customer name</label>
        <input
          id="order-name"
          value={orderName}
          onChange={(event) => setOrderName(event.target.value)}
          autoComplete="off"
          required
        />
        <label htmlFor="order-email">Customer email</label>
        <input
          id="order-email"
          type="email"
          value={orderEmail}
          onChange={(event) => setOrderEmail(event.target.value)}
          placeholder="customer@example.com"
          autoComplete="off"
          required
        />
        <label htmlFor="order-phone">Customer phone</label>
        <input
          id="order-phone"
          value={orderPhone}
          onChange={(event) => setOrderPhone(event.target.value)}
          placeholder="+60 12-345 6789"
          autoComplete="off"
          required
        />
        <label htmlFor="order-size">Order size</label>
        <select
          id="order-size"
          value={orderSize}
          onChange={(event) => setOrderSize(event.target.value as LockerSize)}
        >
          <option value="SMALL">Small</option>
          <option value="MEDIUM">Medium</option>
          <option value="LARGE">Large</option>
        </select>
        <button type="submit" disabled={busy}>
          Register order
        </button>
      </form>
      {orderMessage && (
        <p className="panel result-panel" role="status">
          {orderMessage}
        </p>
      )}
      {orderError && (
        <p className="panel error-panel" role="alert">
          {orderError}
        </p>
      )}

      <h3 className="board-heading">Station preview</h3>
      <LockerWall lockers={lockers} />

      <h3 className="board-heading">Locker overview</h3>
      <AdminLockerBoard lockers={lockers} />
    </section>
  );
}
