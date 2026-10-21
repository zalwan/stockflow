import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/AppLayout";
import { ProductsPage } from "./features/products/ProductsPage";
import { CreateOrderPage } from "./features/orders/CreateOrderPage";
import { OrderDetailPage } from "./features/orders/OrderDetailPage";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 15000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/products" replace />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/orders/new" element={<CreateOrderPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Halaman tidak ditemukan</h1>
                  <NavLink className="button" to="/products">
                    Kembali ke inventori
                  </NavLink>
                </div>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
export default App;
