import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LockerSize, LockerView } from '../api/client';
import { AgentView } from '../views/AgentView';
import { LockerBoard } from '../components/LockerBoard';

/** /delivery — the delivery agent stores packages and sees availability. */
export function DeliveryPage() {
  const [lockers, setLockers] = useState<LockerView[]>([]);

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

  const storePackage = useCallback(async (size: LockerSize) => {
    try {
      return await api.storePackage(size);
    } finally {
      setLockers(await api.listLockers());
    }
  }, []);

  return (
    <>
      <AgentView onStore={storePackage} />
      <section aria-labelledby="board-heading">
        <h2 id="board-heading">Locker status</h2>
        <LockerBoard lockers={lockers} />
      </section>
    </>
  );
}
