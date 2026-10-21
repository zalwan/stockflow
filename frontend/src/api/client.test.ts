import { expect, it, vi, afterEach } from "vitest";
import { ApiError, api } from "./client";
afterEach(() => vi.unstubAllGlobals());
it("preserves server sku and available zero in an error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "INSUFFICIENT_STOCK",
              message: "Not enough stock",
              sku: "A",
              available: 0,
            },
          }),
          { status: 409 },
        ),
    ),
  );
  try {
    await api.createOrder({ customer: "C", items: [{ sku: "A", qty: 1 }] });
    throw new Error("expected rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "INSUFFICIENT_STOCK",
      sku: "A",
      available: 0,
    });
  }
});
it("handles empty 204 response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  await expect(api.deleteProduct(1)).resolves.toBeUndefined();
});
it("gives a readable error for a non JSON upstream failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("bad gateway", { status: 502 })),
  );
  await expect(api.summary()).rejects.toMatchObject({
    status: 502,
    message: expect.any(String),
  });
});
it("preserves field-level validation messages", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid input",
              fields: { customer: "Customer required" },
            },
          }),
          { status: 400 },
        ),
    ),
  );
  await expect(
    api.createOrder({ customer: "", items: [] }),
  ).rejects.toMatchObject({ fields: { customer: "Customer required" } });
});
it("encodes order number search and sends pagination/status filters", async () => {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify({ data: [], page: 2, limit: 10, total: 0 }), {
        status: 200,
      }),
  );
  vi.stubGlobal("fetch", fetch);
  await api.listOrders({
    search: "#0003",
    status: "CANCELLED",
    page: 2,
    limit: 10,
  });
  const url = new URL(String(fetch.mock.calls[0][0]), "http://test");
  expect(url.pathname).toBe("/api/orders");
  expect(url.searchParams.get("search")).toBe("#0003");
  expect(url.searchParams.get("status")).toBe("CANCELLED");
  expect(url.searchParams.get("page")).toBe("2");
  expect(url.searchParams.get("limit")).toBe("10");
});
it("sends the purchase idempotency key without putting it in the body", async () => {
  let headers: Headers | undefined;
  let body: unknown;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: 1 }), { status: 201 });
    }),
  );
  await api.createOrder(
    { customer: "C", items: [{ sku: "A", qty: 1 }] },
    "checkout-123",
  );
  expect(headers?.get("Idempotency-Key")).toBe("checkout-123");
  expect(body).toEqual({ customer: "C", items: [{ sku: "A", qty: 1 }] });
});
it("requests the selected date from the daily sales API", async () => {
  let requested = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      requested = String(input);
      return new Response(
        JSON.stringify({
          date: "2026-10-21",
          time_zone: "Asia/Jakarta",
          order_count: 1,
          units_sold: 2,
          total_sales: "20000",
        }),
      );
    }),
  );
  const report = await api.dailySales("2026-10-21");
  expect(requested).toBe("/api/reports/daily-sales?date=2026-10-21");
  expect(report.total_sales).toBe("20000");
});
