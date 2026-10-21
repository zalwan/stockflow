// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CreateOrderPage } from "./CreateOrderPage";
import { OrdersPage } from "./OrdersPage";
import { jsonResponse, sampleOrder, sampleOrderRow } from "../../test/orders";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows a newly created customer order in an already cached list", async () => {
  let created = false;
  const newOrder = {
    ...sampleOrder,
    id: 2,
    customer: "Pelanggan Baru",
    total: 65000,
    items: [{ id: 3, sku: "KRT-A4-80", qty: 1, unit_price: 65000 }],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://test").pathname;
      if (path === "/api/orders" && init?.method === "POST") {
        created = true;
        return jsonResponse(newOrder, 201);
      }
      if (path === "/api/orders") {
        const data = created
          ? [
              {
                ...sampleOrderRow,
                id: 2,
                customer: "Pelanggan Baru",
                total: 65000,
                item_count: 1,
                unit_count: 1,
              },
              sampleOrderRow,
            ]
          : [sampleOrderRow];
        return jsonResponse({ data, page: 1, limit: 10, total: data.length });
      }
      if (path === "/api/products")
        return jsonResponse({
          data: [
            {
              id: 1,
              sku: "KRT-A4-80",
              name: "Kertas A4",
              stock: 10,
              price: 65000,
              is_active: true,
              created_at: sampleOrder.created_at,
              last_movement_at: null,
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
        });
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        })
      }
    >
      <MemoryRouter initialEntries={["/orders/new"]}>
        <Routes>
          <Route
            path="/orders/new"
            element={
              <>
                <OrdersPage />
                <CreateOrderPage />
              </>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <>
                <OrdersPage />
                <h2>Order baru tersimpan</h2>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole("row", { name: /PT Ruang/ });
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: /Nama pelanggan/ }),
    "Pelanggan Baru",
  );
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Produk item 1" }),
    "KRT-A4-80",
  );
  await user.click(screen.getByRole("button", { name: "Buat order" }));
  expect(
    await screen.findByRole("heading", { name: "Order baru tersimpan" }),
  ).toBeTruthy();
  expect(
    await screen.findByRole("row", { name: /Pelanggan Baru/ }),
  ).toBeTruthy();
});
