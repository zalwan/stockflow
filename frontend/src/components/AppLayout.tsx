import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon } from "./Icon";
export function AppLayout() {
  const { pathname } = useLocation();
  const page =
    pathname === "/orders/new"
      ? "Order baru"
      : pathname.startsWith("/orders/")
        ? "Detail order"
        : pathname === "/orders"
          ? "Order penjualan"
          : pathname === "/products"
            ? "Inventori"
            : "Workspace";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink
          to="/products"
          className="brand"
          aria-label="StockFlow — inventori"
        >
          <span className="brand-mark">
            s<span>f</span>
          </span>
          <span>
            stockflow<span className="brand-dot">.</span>
          </span>
        </NavLink>
        <div className="workspace">
          <span className="workspace-icon">
            <Icon name="warehouse" size={23} />
          </span>
          <div>
            <strong>Gudang utama</strong>
            <small>Inventory & sales</small>
          </div>
        </div>
        <span className="nav-label">OPERASIONAL</span>
        <nav aria-label="Navigasi utama">
          <NavLink to="/products">
            <Icon name="inventory" size={20} />
            Inventori
          </NavLink>
          <NavLink to="/orders">
            <Icon name="orders" size={20} />
            Order penjualan
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="history" size={21} />
            <strong>Setiap perubahan tercatat.</strong>
            <p>
              Telusuri persediaan dan pembelian pelanggan dalam satu tempat.
            </p>
          </div>
          <div className="workspace-user">
            <span>SF</span>
            <div>
              <strong>StockFlow</strong>
              <small>Inventory & Sales</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Operasional gudang</span>
            <Icon name="arrow-right" size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="location-pill">
              <Icon name="warehouse" size={14} />
              Gudang utama
            </span>
            <span className="avatar" aria-label="StockFlow">
              SF
            </span>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
