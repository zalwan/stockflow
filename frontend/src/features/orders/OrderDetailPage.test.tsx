// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrdersPage } from "./OrdersPage";
import { OrderDetailPage } from "./OrderDetailPage";
import {
  installDialogFixture,
  jsonResponse,
  sampleOrder,
  sampleOrderRow,
} from "../../test/orders";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("refreshes the visible order list after cancellation without reloading", async () => {
  installDialogFixture();
  let cancelled = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://test").pathname;
      if (path.endsWith("/cancel")) cancelled = true;
      const status = cancelled ? "CANCELLED" : "CREATED";
      const cancelled_at = cancelled ? "2026-10-21T10:00:00Z" : null;
      if (path === "/api/orders")
        return jsonResponse({
          data: [{ ...sampleOrderRow, status, cancelled_at }],
          total: 1,
          page: 1,
          limit: 10,
        });
      if (path === "/api/orders/1" || path === "/api/orders/1/cancel")
        return jsonResponse({ ...sampleOrder, status, cancelled_at });
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
      <MemoryRouter initialEntries={["/orders/1"]}>
        <Routes>
          <Route
            path="/orders/:id"
            element={
              <>
                <OrdersPage />
                <OrderDetailPage />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const row = await screen.findByRole("row", {
    name: /PT Ruang Kerja Nusantara/,
  });
  expect(within(row).getByText("Dibuat")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Batalkan order" }),
  );
  await user.click(screen.getByRole("button", { name: "Ya, batalkan order" }));
  await waitFor(() =>
    expect(
      within(
        screen.getByRole("row", { name: /PT Ruang Kerja Nusantara/ }),
      ).getByText("Dibatalkan"),
    ).toBeTruthy(),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
