import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Package, Activity, Users, ShoppingCart } from 'lucide-react';

// Placeholder Pages (we will build them individually)
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Clients from './pages/Clients';
import Sales from './pages/Sales';

// Layout Component with Top Bar and Bottom Navigation
const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: <Home size={24} /> },
    { path: '/vendas', label: 'Vendas', icon: <ShoppingCart size={24} /> },
    { path: '/produtos', label: 'Produtos', icon: <Package size={24} /> },
    { path: '/estoque', label: 'Estoque', icon: <Activity size={24} /> },
    { path: '/clientes', label: 'Clientes', icon: <Users size={24} /> },
  ];

  return (
    <div className="app-layout">
      {/* Top Header */}
      <header className="top-header">
        <div className="logo-container">
          {/* Logo Placeholder - User configures the attached one */}
          <div className="brand-logo">
            <span style={{ color: 'var(--secondary)' }}>Açai</span> Kalix
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Bottom Navigation for Mobile / Fixed Sidebar for Desktop */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <div className="nav-icon">{item.icon}</div>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/produtos" element={<Products />} />
          <Route path="/estoque" element={<Stock />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/vendas" element={<Sales />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
