import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AdminLockerView, LockerSize, NewOrder } from '../api/client';
import { OperationsView } from '../views/OperationsView';

/** /operation — internal station management with PINs and accrued charges. */
export function OperationPage() {
  const [lockers, setLockers] = useState<AdminLockerView[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.adminLockers().then((initial) => {
      if (!cancelled) {
        setLockers(initial);
      }
    });
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

  const createOrder = useCallback((order: NewOrder) => api.createOrder(order), []);

  return <OperationsView lockers={lockers} onCreate={createLocker} onCreateOrder={createOrder} />;
}
