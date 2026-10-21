// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrdersPage } from "./OrdersPage";
import { sampleOrderRow, jsonResponse } from "../../test/orders";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show(
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("renders the customer, server total, item and unit counts and detail link", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      jsonResponse({ data: [sampleOrderRow], page: 1, limit: 10, total: 1 }),
    ),
  );
  show();
  const row = await screen.findByRole("row", {
    name: /PT Ruang Kerja Nusantara/,
  });
  expect(within(row).getByText("2 jenis")).toBeTruthy();
  expect(within(row).getByText("4 unit")).toBeTruthy();
  expect(within(row).getByText("Rp 194.000")).toBeTruthy();
  expect(
    within(row)
      .getByRole("link", { name: "Lihat detail order #0001" })
      .getAttribute("href"),
  ).toBe("/orders/1");
});
it("reaches loading and empty states using the API response", async () => {
  let finish: ((response: Response) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  show();
  expect(screen.getByRole("status").textContent).toContain("Memuat order");
  finish?.(jsonResponse({ data: [], page: 1, limit: 10, total: 0 }));
  expect(
    await screen.findByRole("heading", { name: "Belum ada order" }),
  ).toBeTruthy();
});
it("shows a failed request and retries successfully", async () => {
  let unavailable = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (unavailable) {
        unavailable = false;
        return jsonResponse(
          { error: { code: "NOT_READY", message: "Database belum siap." } },
          503,
        );
      }
      return jsonResponse({ data: [], page: 1, limit: 10, total: 0 });
    }),
  );
  show();
  expect(await screen.findByRole("alert")).toBeTruthy();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Coba lagi" }));
  expect(
    await screen.findByRole("heading", { name: "Belum ada order" }),
  ).toBeTruthy();
});
it("resets page for status and debounced customer search, and allows clearing an empty search", async () => {
  const requests: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://test");
      requests.push(url);
      const search = url.searchParams.get("search");
      const status = url.searchParams.get("status");
      const page = Number(url.searchParams.get("page"));
      return jsonResponse({
        data: search
          ? []
          : [{ ...sampleOrderRow, status: status || "CREATED" }],
        page,
        limit: 10,
        total: search ? 0 : 12,
      });
    }),
  );
  show();
  await screen.findByRole("row", { name: /PT Ruang/ });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Berikutnya" }));
  await waitFor(() =>
    expect(requests.at(-1)?.searchParams.get("page")).toBe("2"),
  );
  await user.click(screen.getByRole("button", { name: "Dibatalkan" }));
  await waitFor(() =>
    expect(requests.at(-1)?.searchParams.get("status")).toBe("CANCELLED"),
  );
  expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
  await user.type(screen.getByRole("textbox", { name: "Cari order" }), "Sinar");
  await waitFor(() =>
    expect(requests.at(-1)?.searchParams.get("search")).toBe("Sinar"),
  );
  expect(requests.at(-1)?.searchParams.get("status")).toBe("CANCELLED");
  expect(
    await screen.findByRole("heading", { name: "Tidak ada order ditemukan" }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Reset pencarian" }));
  await waitFor(() =>
    expect(requests.at(-1)?.searchParams.get("search")).toBe(""),
  );
  expect(requests.at(-1)?.searchParams.get("status")).toBe("");
});

it("blocks pagination until the new search is committed on page one", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const page of [1, 2]) {
    client.setQueryData(
      ["orders", { search: "", status: "", page, limit: 10 }],
      {
        data: [sampleOrderRow],
        page,
        limit: 10,
        total: 25,
      },
    );
  }
  const requests: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://test");
      requests.push(url);
      return jsonResponse({
        data: [sampleOrderRow],
        page: Number(url.searchParams.get("page")),
        limit: 10,
        total: 25,
      });
    }),
  );
  show(client);
  const next = screen.getByRole("button", { name: "Berikutnya" });
  fireEvent.click(next);
  expect(screen.getByText(/halaman 2 dari 3/)).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Cari order" }), {
    target: { value: "Sinar" },
  });
  expect(next.hasAttribute("disabled")).toBe(true);
  fireEvent.click(next);
  await waitFor(() =>
    expect(requests.at(-1)?.searchParams.get("search")).toBe("Sinar"),
  );
  expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
  await waitFor(() => expect(next.hasAttribute("disabled")).toBe(false));
});
