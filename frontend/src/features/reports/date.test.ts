import { expect, it } from "vitest";
import { wibDate } from "./date";
it("selects the WIB calendar date across UTC midnight and year boundaries", () => {
  expect(wibDate(new Date("2026-10-21T16:59:59Z"))).toBe("2026-10-21");
  expect(wibDate(new Date("2026-10-21T17:00:00Z"))).toBe("2026-10-22");
  expect(wibDate(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
});
