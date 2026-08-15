import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';
import type { LockerSize, LockerView } from './api/client';
import { LockerBoard } from './components/LockerBoard';
import { OperationsView } from './views/OperationsView';
import { AgentView } from './views/AgentView';
import { CustomerView } from './views/CustomerView';

const ROLES = [
  { key: 'agent', label: 'Delivery Agent' },
  { key: 'customer', label: 'Customer' },
  { key: 'operations', label: 'Operations' },
] as const;

type Role = (typeof ROLES)[number]['key'];

export function App() {
  const [role, setRole] = useState<Role>('agent');
  const [lockers, setLockers] = useState<LockerView[]>([]);

  const refreshLockers = useCallback(async () => {
    setLockers(await api.listLockers());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api.listLockers().then((initial) => {
      if (!cancelled) {
        setLockers(initial);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Views get thin wrappers so the board refreshes after every action.
  const storePackage = useCallback(
    async (size: LockerSize) => {
      try {
        return await api.storePackage(size);
      } finally {
        await refreshLockers();
      }
    },
    [refreshLockers],
  );

  const retrievePackage = useCallback(
    async (lockerId: string, pickupCode: string) => {
      try {
        return await api.retrievePackage(lockerId, pickupCode);
      } finally {
        await refreshLockers();
      }
    },
    [refreshLockers],
  );

  const createLocker = useCallback(
    async (size: LockerSize) => {
      try {
        return await api.createLocker(size);
      } finally {
        await refreshLockers();
      }
    },
    [refreshLockers],
  );

  return (
    <div className="app">
      <header>
        <h1>Smart Package Locker</h1>
        <nav aria-label="Role">
          <div role="tablist" className="tabs">
            {ROLES.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={role === key}
                className={role === key ? 'tab is-active' : 'tab'}
                onClick={() => setRole(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main>
        {role === 'agent' && <AgentView onStore={storePackage} />}
        {role === 'customer' && <CustomerView onRetrieve={retrievePackage} />}
        {role === 'operations' && <OperationsView lockers={lockers} onCreate={createLocker} />}

        <section aria-labelledby="board-heading">
          <h2 id="board-heading">Locker status</h2>
          <LockerBoard lockers={lockers} />
        </section>
      </main>
    </div>
  );
}
