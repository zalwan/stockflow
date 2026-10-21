// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { ProductsPage } from "./ProductsPage";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("does not claim an active connection when the API is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Koneksi terganggu")).toBeTruthy();
  expect(screen.queryByText("Terhubung ke gudang")).toBeNull();
  expect(screen.getAllByRole("button", { name: "Coba lagi" })).toHaveLength(2);
});
it("keeps the stock dialog open and prevents closing while saving", async () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  let finish: ((response: Response) => void) | undefined;
  const product = {
    id: 1,
    sku: "A",
    name: "Paper",
    price: 100,
    stock: 0,
    is_active: true,
    created_at: "2026-10-21T00:00:00Z",
    last_movement_at: null,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/stock"))
        return await new Promise<Response>((resolve) => {
          finish = resolve;
        });
      const payload = String(input).endsWith("/summary")
        ? {
            total_products: 1,
            active_products: 1,
            total_stock_value: "0",
            low_stock_count: 1,
          }
        : { data: [product], page: 1, limit: 10, total: 1 };
      return new Response(JSON.stringify(payload), { status: 200 });
    }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Sesuaikan stok A" }),
  );
  await user.type(screen.getByRole("textbox", { name: "Jumlah" }), "1");
  await user.click(screen.getByRole("button", { name: "Simpan pergerakan" }));
  expect(
    (screen.getByRole("button", { name: "Tutup dialog" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  finish?.(
    new Response(JSON.stringify({ ...product, stock: 1 }), { status: 200 }),
  );
  expect(await screen.findByText(/Perubahan berhasil disimpan/)).toBeTruthy();
});
