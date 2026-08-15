import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AdminLockerView, LockerSize } from '../api/client';
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

  return <OperationsView lockers={lockers} onCreate={createLocker} />;
}
