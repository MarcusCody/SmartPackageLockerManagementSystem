import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LockerView, OrderView, OverdueView } from '../api/client';
import { AgentView } from '../views/AgentView';
import { ReturnsView } from '../views/ReturnsView';
import { LockerBoard } from '../components/LockerBoard';

/** /delivery — the agent works the pending queue, returns overdue packages, sees availability. */
export function DeliveryPage() {
  const [lockers, setLockers] = useState<LockerView[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [overdue, setOverdue] = useState<OverdueView[]>([]);

  const refresh = useCallback(async () => {
    const [freshLockers, freshOrders, freshOverdue] = await Promise.all([
      api.listLockers(),
      api.listOrders(),
      api.listReturns(),
    ]);
    setLockers(freshLockers);
    setOrders(freshOrders);
    setOverdue(freshOverdue);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.listLockers(), api.listOrders(), api.listReturns()]).then(
      ([initialLockers, initialOrders, initialOverdue]) => {
        if (!cancelled) {
          setLockers(initialLockers);
          setOrders(initialOrders);
          setOverdue(initialOverdue);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const storeOrder = useCallback(
    async (orderId: string) => {
      try {
        return await api.storeOrder(orderId);
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  const returnToWarehouse = useCallback(
    async (lockerId: string) => {
      try {
        return await api.returnToWarehouse(lockerId);
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  return (
    <>
      <AgentView orders={orders} onStoreOrder={storeOrder} />
      <ReturnsView overdue={overdue} onReturn={returnToWarehouse} />
      <section aria-labelledby="board-heading" className="mt-8 space-y-4">
        <h2 id="board-heading" className="text-lg font-semibold">
          Locker status
        </h2>
        <LockerBoard lockers={lockers} />
      </section>
    </>
  );
}
