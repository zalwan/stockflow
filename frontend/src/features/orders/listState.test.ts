import { expect, it } from "vitest";
import { resetOrderPage } from "./listState";
it("resets page when the order status filter changes without dropping the search", () => {
  expect(
    resetOrderPage(
      { search: "Sinar", status: "", page: 4, limit: 10 },
      { status: "CANCELLED" },
    ),
  ).toEqual({ search: "Sinar", status: "CANCELLED", page: 1, limit: 10 });
});
it("resets page when the customer search changes without dropping status", () => {
  expect(
    resetOrderPage(
      { search: "", status: "CREATED", page: 4, limit: 10 },
      { search: "Ruang" },
    ),
  ).toEqual({ search: "Ruang", status: "CREATED", page: 1, limit: 10 });
});
