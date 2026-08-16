import type pg from 'pg';
import { Locker } from '../../domain/Locker.js';
import type { LockerSize } from '../../domain/LockerSize.js';
import type { Package } from '../../domain/Package.js';
import { NoSuitableLockerError } from '../../domain/errors.js';
import type { LockerRepository } from '../../application/ports.js';
import type { LockerAllocationStrategy } from '../../application/policies/LockerAllocationStrategy.js';

interface LockerRow {
  id: string;
  size: LockerSize;
  package_id: string | null;
  package_size: LockerSize | null;
  pickup_code: string | null;
  stored_at: Date | null;
}

function toLocker(row: LockerRow): Locker {
  const occupied =
    row.package_id !== null && row.package_size !== null && row.pickup_code !== null
      ? {
          pkg: { id: row.package_id, size: row.package_size },
          pickupCode: row.pickup_code,
          storedAt: row.stored_at as Date,
        }
      : undefined;
  return Locker.restore(row.id, row.size, occupied);
}

const OCCUPANCY_COLUMNS = 'id, size, package_id, package_size, pickup_code, stored_at';

export class PostgresLockerRepository implements LockerRepository {
  constructor(private readonly pool: pg.Pool) {}

  async add(locker: Locker): Promise<void> {
    await this.pool.query(
      `INSERT INTO lockers (${OCCUPANCY_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        locker.id,
        locker.size,
        locker.storedPackageId,
        locker.storedPackage?.size ?? null,
        locker.activePickupCode,
        locker.storedSince,
      ],
    );
  }

  async findAll(): Promise<Locker[]> {
    const { rows } = await this.pool.query<LockerRow>(
      `SELECT ${OCCUPANCY_COLUMNS} FROM lockers ORDER BY size, id`,
    );
    return rows.map(toLocker);
  }

  async findById(id: string): Promise<Locker | undefined> {
    const { rows } = await this.pool.query<LockerRow>(
      `SELECT ${OCCUPANCY_COLUMNS} FROM lockers WHERE id = $1`,
      [id],
    );
    return rows[0] === undefined ? undefined : toLocker(rows[0]);
  }

  async findByActivePickupCode(pickupCode: string): Promise<Locker | undefined> {
    const { rows } = await this.pool.query<LockerRow>(
      `SELECT ${OCCUPANCY_COLUMNS} FROM lockers WHERE pickup_code = $1`,
      [pickupCode],
    );
    return rows[0] === undefined ? undefined : toLocker(rows[0]);
  }

  /**
   * The Level 4 guarantee, database edition: candidates are locked with
   * SELECT … FOR UPDATE inside a transaction, the strategy picks in
   * process, and the reservation commits atomically — two concurrent
   * requests can never be handed the same locker, even across instances.
   */
  async findAndReserve(
    pkg: Package,
    pickupCode: string,
    storedAt: Date,
    strategy: LockerAllocationStrategy,
  ): Promise<Locker> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<LockerRow>(
        `SELECT ${OCCUPANCY_COLUMNS} FROM lockers WHERE package_id IS NULL ORDER BY size, id FOR UPDATE`,
      );
      const chosen = strategy.select(pkg.size, rows.map(toLocker));
      if (chosen === undefined) {
        await client.query('ROLLBACK');
        throw new NoSuitableLockerError(pkg.size);
      }
      await client.query(
        'UPDATE lockers SET package_id = $2, package_size = $3, pickup_code = $4, stored_at = $5 WHERE id = $1',
        [chosen.id, pkg.id, pkg.size, pickupCode, storedAt],
      );
      await client.query('COMMIT');
      chosen.store(pkg, pickupCode, storedAt);
      return chosen;
    } catch (error) {
      if (!(error instanceof NoSuitableLockerError)) {
        await client.query('ROLLBACK').catch(() => undefined);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async save(locker: Locker): Promise<void> {
    await this.pool.query(
      'UPDATE lockers SET package_id = $2, package_size = $3, pickup_code = $4, stored_at = $5 WHERE id = $1',
      [
        locker.id,
        locker.storedPackageId,
        locker.storedPackage?.size ?? null,
        locker.activePickupCode,
        locker.storedSince,
      ],
    );
  }
}
