// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CreateOrderPage } from "./CreateOrderPage";
import { jsonResponse, sampleOrder } from "../../test/orders";
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={["/orders/new"]}>
        <Routes>
          <Route path="/orders/new" element={<CreateOrderPage />} />
          <Route path="/orders/:id" element={<h1>Order tersimpan</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("recovers an uncertain purchase after remount using the original body and key", async () => {
  const posts: { key: string | null; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push({
          key: new Headers(init.headers).get("Idempotency-Key"),
          body: String(init.body),
        });
        if (posts.length === 1)
          throw new TypeError("response lost after commit");
        return jsonResponse(sampleOrder, 201);
      }
      return jsonResponse({
        data: [
          {
            id: 1,
            sku: "KRT-A4-80",
            name: "Kertas",
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
    }),
  );
  show();
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: /Nama pelanggan/ }),
    "Toko Retry",
  );
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Produk item 1" }),
    "KRT-A4-80",
  );
  await user.click(screen.getByRole("button", { name: /^Buat order$/ }));
  await screen.findByRole("alert");
  expect(
    (
      screen.getByRole("textbox", {
        name: /Nama pelanggan/,
      }) as HTMLInputElement
    ).disabled,
  ).toBe(true);
  expect(posts[0].key).toBeTruthy();
  cleanup();
  show();
  expect(
    (
      screen.getByRole("textbox", {
        name: /Nama pelanggan/,
      }) as HTMLInputElement
    ).value,
  ).toBe("Toko Retry");
  await user.click(screen.getByRole("button", { name: "Coba simpan lagi" }));
  await screen.findByRole("heading", { name: "Order tersimpan" });
  expect(posts).toHaveLength(2);
  expect(posts[1]).toEqual(posts[0]);
  expect(sessionStorage.length).toBe(0);
});
it("allows a corrected purchase with a new key after a definitive rejection", async () => {
  const keys: (string | null)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        keys.push(new Headers(init.headers).get("Idempotency-Key"));
        return jsonResponse(
          {
            error: {
              code: "INSUFFICIENT_STOCK",
              message: "Stock insufficient",
              sku: "KRT-A4-80",
              available: 0,
            },
          },
          409,
        );
      }
      return jsonResponse({
        data: [
          {
            id: 1,
            sku: "KRT-A4-80",
            name: "Kertas",
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
    }),
  );
  show();
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: /Nama pelanggan/ }),
    "Toko Retry",
  );
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Produk item 1" }),
    "KRT-A4-80",
  );
  await user.click(screen.getByRole("button", { name: /^Buat order$/ }));
  await screen.findAllByRole("alert");
  expect(
    (
      screen.getByRole("textbox", {
        name: /Nama pelanggan/,
      }) as HTMLInputElement
    ).disabled,
  ).toBe(false);
  await user.click(screen.getByRole("button", { name: /^Buat order$/ }));
  await screen.findAllByRole("alert");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).not.toBe(keys[0]);
});
