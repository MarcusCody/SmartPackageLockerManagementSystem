import { useState } from 'react';
import type { FormEvent } from 'react';
import type { LockerSize, StoreResult } from '../api/client';
import { ApiError } from '../api/client';

interface AgentViewProps {
  onStore: (size: LockerSize) => Promise<StoreResult>;
}

/** Delivery agent flow: pick the package size, store it, hand the code to the customer. */
export function AgentView({ onStore }: AgentViewProps) {
  const [size, setSize] = useState<LockerSize>('SMALL');
  const [result, setResult] = useState<StoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      setResult(await onStore(size));
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
      <h2 id="agent-heading">Store a package</h2>
      <form onSubmit={handleSubmit} className="panel form-row">
        <label htmlFor="package-size">Package size</label>
        <select
          id="package-size"
          value={size}
          onChange={(event) => setSize(event.target.value as LockerSize)}
        >
          <option value="SMALL">Small</option>
          <option value="MEDIUM">Medium</option>
          <option value="LARGE">Large</option>
        </select>
        <button type="submit" disabled={busy}>
          Store package
        </button>
      </form>

      {result && (
        <div className="panel result-panel" role="status">
          <h3>Package stored</h3>
          <p>
            Locker <strong className="highlight">{result.lockerId}</strong>
          </p>
          <p>
            Pickup code <code className="highlight">{result.pickupCode}</code>{' '}
            <button type="button" onClick={() => void copyCode(result.pickupCode)}>
              {copied ? 'Copied!' : 'Copy code'}
            </button>
          </p>
          <p className="hint">
            Share this code with the customer — in production it would be sent by SMS/email.
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
