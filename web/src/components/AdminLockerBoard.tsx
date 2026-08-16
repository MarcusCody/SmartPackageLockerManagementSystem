import type { AdminLockerView } from '../api/client';

const SIZE_LABEL: Record<AdminLockerView['size'], string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
};

/**
 * Operations-only board: occupied lockers show their pickup PIN, when the
 * package went in, and the storage charge accrued so far.
 */
export function AdminLockerBoard({ lockers }: { lockers: AdminLockerView[] }) {
  if (lockers.length === 0) {
    return <p className="board-empty">No lockers yet. Add one above.</p>;
  }

  return (
    <ul className="locker-board" aria-label="Locker overview with pickup PINs">
      {lockers.map((locker) => (
        <li
          key={locker.id}
          className={`locker-card ${locker.available ? 'is-available' : 'is-occupied'}`}
        >
          <span className="locker-id">{locker.id}</span>
          <span className="locker-size">{SIZE_LABEL[locker.size]}</span>
          <span className="locker-status">{locker.available ? 'Available' : 'Occupied'}</span>
          {!locker.available && (
            <>
              <span className="locker-meta">
                PIN <code className="locker-pin">{locker.pickupCode}</code>
              </span>
              {locker.storedAt && (
                <span className="locker-meta">
                  Since {new Date(locker.storedAt).toLocaleString()}
                </span>
              )}
              <span className="locker-meta">Accrued RM{locker.accruedCharge}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
