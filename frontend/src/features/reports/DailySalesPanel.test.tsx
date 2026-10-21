// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailySalesPanel } from "./DailySalesPanel";
import { jsonResponse } from "../../test/orders";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DailySalesPanel />
    </QueryClientProvider>,
  );
}
it("shows exact server revenue and requests the selected WIB date", async () => {
  const dates: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const date =
        new URL(String(input), "http://test").searchParams.get("date") ?? "";
      dates.push(date);
      return jsonResponse({
        date,
        time_zone: "Asia/Jakarta",
        order_count: 2,
        units_sold: 5,
        total_sales: date === "2026-10-20" ? "0" : "9007199254740993",
      });
    }),
  );
  show();
  const panel = screen.getByRole("region", { name: "Penjualan harian" });
  expect(
    await within(panel).findByText("Rp 9.007.199.254.740.993"),
  ).toBeTruthy();
  expect(within(panel).getByText("5 unit")).toBeTruthy();
  await userEvent.setup().clear(screen.getByLabelText("Tanggal laporan"));
  expect(within(panel).getByText(/Pilih tanggal/)).toBeTruthy();
  // Native date inputs use an ISO value independent of browser locale.
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(screen.getByLabelText("Tanggal laporan"), {
    target: { value: "2026-10-20" },
  });
  expect(await within(panel).findByText("Rp 0")).toBeTruthy();
  expect(dates.at(-1)).toBe("2026-10-20");
});
it("shows a report error and retries the selected date", async () => {
  let failed = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (failed) {
        failed = false;
        return jsonResponse(
          { error: { code: "NOT_READY", message: "Laporan belum tersedia." } },
          503,
        );
      }
      const date = new URL(String(input), "http://test").searchParams.get(
        "date",
      );
      return jsonResponse({
        date,
        time_zone: "Asia/Jakarta",
        order_count: 0,
        units_sold: 0,
        total_sales: "0",
      });
    }),
  );
  show();
  expect(await screen.findByRole("alert")).toBeTruthy();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Coba lagi" }));
  expect(await screen.findByText("Rp 0")).toBeTruthy();
  expect(screen.getByText("0 order")).toBeTruthy();
});
