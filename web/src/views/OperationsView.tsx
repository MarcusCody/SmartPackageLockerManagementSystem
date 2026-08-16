import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AdminLockerView, LockerSize, LockerView } from '../api/client';
import { ApiError } from '../api/client';
import { AdminLockerBoard } from '../components/AdminLockerBoard';
import { LockerWall } from '../components/LockerWall';

interface OperationsViewProps {
  lockers: AdminLockerView[];
  onCreate: (size: LockerSize) => Promise<LockerView>;
}

/** Internal station-operator flow: add lockers, watch overall capacity. */
export function OperationsView({ lockers, onCreate }: OperationsViewProps) {
  const [size, setSize] = useState<LockerSize>('SMALL');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

      <h3 className="board-heading">Station preview</h3>
      <LockerWall lockers={lockers} />

      <h3 className="board-heading">Locker overview</h3>
      <AdminLockerBoard lockers={lockers} />
    </section>
  );
}
