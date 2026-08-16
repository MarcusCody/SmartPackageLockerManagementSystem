import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AdminLockerView, LockerSize, OrderView } from '../api/client';
import { OperationsView } from '../views/OperationsView';

/** /operation — internal station management: dispatch, lockers, PINs, accrued charges. */
export function OperationPage() {
  const [lockers, setLockers] = useState<AdminLockerView[]>([]);
  const [incoming, setIncoming] = useState<OrderView[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.adminLockers(), api.listIncomingOrders()]).then(
      ([initialLockers, initialIncoming]) => {
        if (!cancelled) {
          setLockers(initialLockers);
          setIncoming(initialIncoming);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const createLocker = useCallback(async (size: LockerSize) => {
    try {
      return await api.createLocker(size);
    } finally {
      setLockers(await api.adminLockers());
    }
  }, []);

  const dispatchOrder = useCallback(async (orderId: string) => {
    try {
      return await api.dispatchOrder(orderId);
    } finally {
      setIncoming(await api.listIncomingOrders());
    }
  }, []);

  return (
    <OperationsView
      lockers={lockers}
      incoming={incoming}
      onCreate={createLocker}
      onDispatch={dispatchOrder}
    />
  );
}
