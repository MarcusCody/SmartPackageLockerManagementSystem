/**
 * Idempotent schema, applied at startup. Embedded as a string (rather
 * than a .sql file) so the compiled dist needs no asset copying.
 *
 * Note the partial unique index: PIN uniqueness among *active* packages
 * is enforced by the database itself, not just the application.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lockers (
  id           text PRIMARY KEY,
  size         text NOT NULL CHECK (size IN ('SMALL','MEDIUM','LARGE')),
  package_id   text,
  package_size text CHECK (package_size IN ('SMALL','MEDIUM','LARGE')),
  pickup_code  text,
  stored_at    timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS lockers_active_pickup_code
  ON lockers (pickup_code)
  WHERE pickup_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS orders (
  id             text PRIMARY KEY,
  customer_name  text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  package_size   text NOT NULL CHECK (package_size IN ('SMALL','MEDIUM','LARGE')),
  status         text NOT NULL CHECK (status IN ('AWAITING_DISPATCH','PENDING','STORED','RETURNED')),
  package_id     text
);
`;
