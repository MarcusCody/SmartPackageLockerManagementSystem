import { api } from '../api/client';
import { CustomerView } from '../views/CustomerView';

/**
 * /customer — pickup only. Customers see no locker status board: which
 * lockers exist or are occupied is not their business.
 */
export function CustomerPage() {
  return <CustomerView onRetrieve={(pin, lockerId) => api.retrievePackage(pin, lockerId)} />;
}
