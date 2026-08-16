import { Fragment } from 'react';
import type { LockerView } from '../api/client';

// Door heights in px — larger lockers get taller doors, like a real wall.
const DOOR_HEIGHT: Record<LockerView['size'], number> = { SMALL: 46, MEDIUM: 96, LARGE: 196 };
const GAP = 6;
const COLUMN_CAPACITY = 400;

/** Pack doors into cabinet columns without splitting a door across columns. */
function packColumns(lockers: LockerView[]): LockerView[][] {
  const columns: LockerView[][] = [];
  let current: LockerView[] = [];
  let height = 0;
  for (const locker of lockers) {
    const doorHeight = DOOR_HEIGHT[locker.size] + GAP;
    if (height + doorHeight > COLUMN_CAPACITY && current.length > 0) {
      columns.push(current);
      current = [];
      height = 0;
    }
    current.push(locker);
    height += doorHeight;
  }
  if (current.length > 0) {
    columns.push(current);
  }
  return columns;
}

function Kiosk() {
  return (
    <div className="wall-kiosk" aria-hidden="true">
      <span className="kiosk-brand">Smart Package Locker</span>
      <span className="kiosk-screen" />
      <span className="kiosk-tag">Collection Point</span>
      <ol className="kiosk-steps">
        <li>Input your PIN</li>
        <li>Confirm your order</li>
        <li>Collect your parcel</li>
      </ol>
    </div>
  );
}

/**
 * Stylised station preview: one door per locker, sized by locker size,
 * with occupied doors showing a parcel. Purely visual — the detailed
 * data lives in the locker overview below it.
 */
export function LockerWall({ lockers }: { lockers: LockerView[] }) {
  if (lockers.length === 0) {
    return <p className="board-empty">No lockers yet. Add one above.</p>;
  }

  const columns = packColumns(lockers);

  return (
    <div className="locker-wall">
      {columns.map((column, index) => (
        <Fragment key={column[0]?.id ?? index}>
          {index === 1 && <Kiosk />}
          <div className="wall-column">
            {column.map((locker) => (
              <div
                key={locker.id}
                role="img"
                aria-label={`Locker ${locker.id}, ${locker.size.toLowerCase()}, ${
                  locker.available ? 'available' : 'occupied'
                }`}
                className={`wall-door ${locker.available ? 'is-vacant' : 'is-filled'}`}
                style={{ height: DOOR_HEIGHT[locker.size] }}
              >
                <span className="door-id">{locker.id}</span>
                {!locker.available && (
                  <span className="door-parcel" aria-hidden="true">
                    📦
                  </span>
                )}
                <span className="door-handle" aria-hidden="true" />
              </div>
            ))}
          </div>
        </Fragment>
      ))}
      {columns.length === 1 && <Kiosk />}
    </div>
  );
}
