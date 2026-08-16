import type { LockerView } from '../api/client';
import { cn } from '@/lib/utils';

const SIZE_LABEL: Record<LockerView['size'], string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
};

/** Live grid of every locker and its availability — the station's status board. */
export function LockerBoard({ lockers }: { lockers: LockerView[] }) {
  if (lockers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No lockers yet. Create some in the Operations tab.
      </p>
    );
  }

  return (
    <ul
      className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 p-0"
      aria-label="Locker availability board"
    >
      {lockers.map((locker) => (
        <li
          key={locker.id}
          className={cn(
            'flex flex-col gap-0.5 rounded-xl border p-3 shadow-sm',
            locker.available
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-stone-200 bg-stone-100 text-stone-500',
          )}
        >
          <span className="text-base font-bold">{locker.id}</span>
          <span className="text-sm">{SIZE_LABEL[locker.size]}</span>
          <span className="text-xs font-semibold uppercase tracking-wide">
            {locker.available ? 'Available' : 'Occupied'}
          </span>
        </li>
      ))}
    </ul>
  );
}
