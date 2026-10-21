import type { Order, OrderListItem } from "../api/types";
export const sampleOrder: Order = {
  id: 1,
  customer: "PT Ruang Kerja Nusantara",
  status: "CREATED",
  total: 194000,
  created_at: "2026-10-21T09:00:00Z",
  cancelled_at: null,
  items: [
    { id: 1, sku: "KRT-A4-80", qty: 2, unit_price: 65000 },
    { id: 2, sku: "PLP-BLU-12", qty: 2, unit_price: 32000 },
  ],
};
export const sampleOrderRow: OrderListItem = {
  id: 1,
  customer: sampleOrder.customer,
  status: "CREATED",
  total: 194000,
  created_at: sampleOrder.created_at,
  cancelled_at: null,
  item_count: 2,
  unit_count: 4,
};
export const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
export function installDialogFixture() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
}
