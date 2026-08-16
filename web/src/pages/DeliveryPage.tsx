import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LockerView, OrderView } from '../api/client';
import { AgentView } from '../views/AgentView';
import { LockerBoard } from '../components/LockerBoard';

/** /delivery — the agent works the pending-order queue and sees availability. */
export function DeliveryPage() {
  const [lockers, setLockers] = useState<LockerView[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.listLockers(), api.listOrders()]).then(([initialLockers, initialOrders]) => {
      if (!cancelled) {
        setLockers(initialLockers);
        setOrders(initialOrders);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const storeOrder = useCallback(async (orderId: string) => {
    try {
      return await api.storeOrder(orderId);
    } finally {
      const [freshLockers, freshOrders] = await Promise.all([api.listLockers(), api.listOrders()]);
      setLockers(freshLockers);
      setOrders(freshOrders);
    }
  }, []);

  return (
    <>
      <AgentView orders={orders} onStoreOrder={storeOrder} />
      <section aria-labelledby="board-heading">
        <h2 id="board-heading">Locker status</h2>
        <LockerBoard lockers={lockers} />
      </section>
    </>
  );
}
