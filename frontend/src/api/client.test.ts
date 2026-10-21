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
