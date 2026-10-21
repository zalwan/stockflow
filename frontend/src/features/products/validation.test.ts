import { describe, expect, it } from "vitest";
import { positiveInteger, productErrors, resetPage } from "./validation";
describe("inventory form validation", () => {
  it.each(["0", "-1", "1.5", "1e3", " ", "2147483648"])(
    "rejects quantity %s",
    (value) => expect(positiveInteger(value)).toBe(false),
  );
  it("accepts integer quantities", () =>
    expect(positiveInteger("12")).toBe(true));
  it("allows zero price, rejects missing names and decimal prices", () => {
    expect(productErrors({ sku: "A", name: "Paper", price: "0" })).toEqual({});
    expect(productErrors({ sku: " ", name: " ", price: "1.5" })).toEqual({
      sku: expect.any(String),
      name: expect.any(String),
      price: expect.any(String),
    });
  });
  it("resets pagination when filters change", () =>
    expect(
      resetPage(
        { page: 4, search: "paper", filter: "all" },
        { filter: "active" },
      ),
    ).toEqual({ page: 1, search: "paper", filter: "active" }));
});
