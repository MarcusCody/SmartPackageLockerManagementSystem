import type pg from 'pg';
import { Order } from '../../domain/Order.js';
import type { OrderStatus } from '../../domain/Order.js';
import type { LockerSize } from '../../domain/LockerSize.js';
import type { OrderRepository } from '../../application/ports.js';

interface OrderRow {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  package_size: LockerSize;
  status: OrderStatus;
  package_id: string | null;
}

function toOrder(row: OrderRow): Order {
  return Order.restore(
    row.id,
    {
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      packageSize: row.package_size,
    },
    row.status,
    row.package_id,
  );
}

const COLUMNS = 'id, customer_name, customer_email, customer_phone, package_size, status, package_id';

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly pool: pg.Pool) {}

  async add(order: Order): Promise<void> {
    await this.pool.query(
      `INSERT INTO orders (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        order.id,
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.packageSize,
        order.status,
        order.packageId,
      ],
    );
  }

  async findAll(): Promise<Order[]> {
    const { rows } = await this.pool.query<OrderRow>(`SELECT ${COLUMNS} FROM orders ORDER BY id`);
    return rows.map(toOrder);
  }

  async findById(id: string): Promise<Order | undefined> {
    const { rows } = await this.pool.query<OrderRow>(
      `SELECT ${COLUMNS} FROM orders WHERE id = $1`,
      [id],
    );
    return rows[0] === undefined ? undefined : toOrder(rows[0]);
  }

  async findPending(): Promise<Order[]> {
    const { rows } = await this.pool.query<OrderRow>(
      `SELECT ${COLUMNS} FROM orders WHERE status = 'PENDING' ORDER BY id`,
    );
    return rows.map(toOrder);
  }

  async findAwaitingDispatch(): Promise<Order[]> {
    const { rows } = await this.pool.query<OrderRow>(
      `SELECT ${COLUMNS} FROM orders WHERE status = 'AWAITING_DISPATCH' ORDER BY id`,
    );
    return rows.map(toOrder);
  }

  async findByPackageId(packageId: string): Promise<Order | undefined> {
    const { rows } = await this.pool.query<OrderRow>(
      `SELECT ${COLUMNS} FROM orders WHERE package_id = $1`,
      [packageId],
    );
    return rows[0] === undefined ? undefined : toOrder(rows[0]);
  }

  async save(order: Order): Promise<void> {
    await this.pool.query('UPDATE orders SET status = $2, package_id = $3 WHERE id = $1', [
      order.id,
      order.status,
      order.packageId,
    ]);
  }
}
