// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";
afterEach(cleanup);
it.each([
  ["/products", "Inventori", "Inventori"],
  ["/orders", "Order penjualan", "Order penjualan"],
  ["/orders/new", "Order baru", "Order penjualan"],
  ["/orders/23", "Detail order", "Order penjualan"],
])(
  "shows the correct context and navigation at %s",
  (path, heading, active) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="*" element={<p>Halaman uji</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(within(screen.getByRole("banner")).getByText(heading)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: active }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Order penjualan" })
        .getAttribute("href"),
    ).toBe("/orders");
    expect(
      within(screen.getByRole("complementary"))
        .getByText("Gudang utama")
        .closest('button,a,[role="button"]'),
    ).toBeNull();
    expect(screen.getByText("Halaman uji")).toBeTruthy();
  },
);
