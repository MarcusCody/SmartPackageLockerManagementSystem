import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { DeliveryPage } from './pages/DeliveryPage';
import { CustomerPage } from './pages/CustomerPage';
import { OperationPage } from './pages/OperationPage';

const tabClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'tab is-active' : 'tab');

export function App() {
  return (
    <div className="app">
      <header>
        <h1>Smart Package Locker</h1>
        <nav aria-label="Role">
          <div className="tabs">
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
