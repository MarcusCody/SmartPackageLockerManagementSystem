import type { AdminLockerView } from '../api/client';
import { cn } from '@/lib/utils';

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
    return <p className="text-sm text-muted-foreground">No lockers yet. Add one above.</p>;
  }

  return (
    <ul
      className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0"
      aria-label="Locker overview with pickup PINs"
    >
      {lockers.map((locker) => (
        <li
          key={locker.id}
          className={cn(
            'flex flex-col gap-1 rounded-xl border p-3 shadow-sm',
            locker.available
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-stone-200 bg-stone-100 text-stone-600',
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-bold">{locker.id}</span>
            <span className="text-xs font-semibold uppercase tracking-wide">
              {locker.available ? 'Available' : 'Occupied'}
            </span>
          </div>
          <span className="text-sm">{SIZE_LABEL[locker.size]}</span>
          {!locker.available && (
            <>
              <span className="text-xs">
                PIN{' '}
                <code className="rounded border bg-white px-1.5 py-0.5 font-bold tracking-widest">
                  {locker.pickupCode}
                </code>
              </span>
              {locker.storedAt && (
                <span className="text-xs">Since {new Date(locker.storedAt).toLocaleString()}</span>
              )}
              <span className="text-xs">Accrued RM{locker.accruedCharge}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
