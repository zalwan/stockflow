import { expect, it } from "vitest";
import { orderErrors, itemError, orderPayload } from "./validation";
import { ApiError } from "../../api/client";
it("rejects empty customer and item list", () => {
  expect(orderErrors("", []).customer).toBeTruthy();
  expect(orderErrors("Customer", []).items).toBeTruthy();
});
it("rejects duplicate SKU and invalid quantities", () => {
  expect(
    orderErrors("Customer", [
      { sku: "A", qty: "1" },
      { sku: "A", qty: "1" },
    ]).items,
  ).toBeTruthy();
  expect(
    orderErrors("Customer", [{ sku: "A", qty: "1.5" }]).items,
  ).toBeTruthy();
});
it("associates an insufficient stock error only with the failed sku", () => {
  const error = new ApiError(409, {
    code: "INSUFFICIENT_STOCK",
    message: "Not enough stock",
    sku: "B",
    available: 0,
  });
  expect(itemError(error, "A")).toBe("");
  expect(itemError(error, "B")).toContain("0");
});
it("sends quantities and skus, never client prices", () =>
  expect(orderPayload(" Customer ", [{ sku: "A", qty: "2" }])).toEqual({
    customer: "Customer",
    items: [{ sku: "A", qty: 2 }],
  }));
