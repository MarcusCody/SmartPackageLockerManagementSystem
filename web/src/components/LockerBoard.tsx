import type { LockerView } from '../api/client';

const SIZE_LABEL: Record<LockerView['size'], string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
};

/** Live grid of every locker and its availability — the station's status board. */
export function LockerBoard({ lockers }: { lockers: LockerView[] }) {
  if (lockers.length === 0) {
    return <p className="board-empty">No lockers yet. Create some in the Operations tab.</p>;
  }

  return (
    <ul className="locker-board" aria-label="Locker availability board">
      {lockers.map((locker) => (
        <li
          key={locker.id}
          className={`locker-card ${locker.available ? 'is-available' : 'is-occupied'}`}
        >
          <span className="locker-id">{locker.id}</span>
          <span className="locker-size">{SIZE_LABEL[locker.size]}</span>
          <span className="locker-status">{locker.available ? 'Available' : 'Occupied'}</span>
        </li>
      ))}
    </ul>
  );
}
