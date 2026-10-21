// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StockModal } from "./StockModal";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows the backend available quantity inside the adjustment form", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "INSUFFICIENT_STOCK",
              message: "Stok tidak mencukupi.",
              available: 0,
            },
          }),
          { status: 409 },
        ),
    ),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <StockModal
        product={{
          id: 1,
          sku: "A",
          name: "Paper",
          stock: 0,
          price: 100,
          is_active: true,
          created_at: "2026-10-21T00:00:00Z",
          last_movement_at: null,
        }}
        onSaved={() => {}}
      />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Arah pergerakan"), "out");
  await user.type(screen.getByLabelText("Jumlah"), "1");
  await user.click(screen.getByRole("button", { name: "Simpan pergerakan" }));
  expect(await screen.findByText(/Tersedia: 0/)).toBeTruthy();
});
