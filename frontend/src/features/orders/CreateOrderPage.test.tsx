// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CreateOrderPage } from "./CreateOrderPage";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows required customer and item validation without submitting an order", async () => {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify({ data: [], page: 1, limit: 20, total: 0 }), {
        status: 200,
      }),
  );
  vi.stubGlobal("fetch", fetch);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CreateOrderPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("combobox", { name: "Produk item 1" })).toBeTruthy();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Buat order" }));
  expect(await screen.findByText(/Nama pelanggan wajib/)).toBeTruthy();
  expect(await screen.findByText(/Pilih SKU dan isi qty/)).toBeTruthy();
  expect(
    fetch.mock.calls.every((call) => !String(call[0]).endsWith("/orders")),
  ).toBe(true);
});
