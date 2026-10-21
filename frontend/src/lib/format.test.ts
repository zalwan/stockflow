import { expect, it } from "vitest";
import { rupiah, relativeTime } from "./format";
it("formats integer rupiah", () =>
  expect(rupiah(1234567).replace(/\s/g, " ")).toBe("Rp 1.234.567"));
it("handles missing movement timestamps", () =>
  expect(relativeTime(null)).toBe("Belum ada pergerakan"));
it("formats inventory totals larger than int64 without precision loss", () =>
  expect(rupiah("13835058042397261827").replace(/\s/g, " ")).toBe(
    "Rp 13.835.058.042.397.261.827",
  ));
