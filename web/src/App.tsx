import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeliveryPage } from './pages/DeliveryPage';
import { CustomerPage } from './pages/CustomerPage';
import { OperationPage } from './pages/OperationPage';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  );

export function App() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8">
      <header className="mb-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Package className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Smart Package Locker</h1>
            <p className="text-xs text-muted-foreground">Self-service parcel collection point</p>
          </div>
        </div>
        <nav aria-label="Role">
          <div className="flex gap-1 border-b">
            <NavLink to="/delivery" className={tabClass}>
              Delivery Agent
            </NavLink>
            <NavLink to="/customer" className={tabClass}>
              Customer
            </NavLink>
            <NavLink to="/operation" className={tabClass}>
              Operations
            </NavLink>
          </div>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/delivery" replace />} />
          <Route path="/delivery" element={<DeliveryPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/operation" element={<OperationPage />} />
          <Route path="*" element={<Navigate to="/delivery" replace />} />
        </Routes>
      </main>
    </div>
  );
}
