import { ApiError } from "../../api/client";
import type { CreateOrderInput } from "../../api/types";
import { positiveInteger } from "../products/validation";
export interface DraftItem {
  sku: string;
  qty: string;
}
export function orderErrors(
  customer: string,
  items: DraftItem[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!customer.trim() || customer.length > 250)
    errors.customer = "Nama pelanggan wajib diisi, maksimal 250 karakter.";
  if (items.length === 0 || items.length > 100)
    errors.items = "Tambahkan 1–100 item.";
  else if (items.some((i) => !i.sku || !positiveInteger(i.qty)))
    errors.items = "Pilih SKU dan isi qty integer positif untuk setiap item.";
  else if (new Set(items.map((i) => i.sku)).size !== items.length)
    errors.items = "Satu SKU hanya boleh ditambahkan sekali.";
  return errors;
}
export function itemError(error: unknown, sku: string): string {
  return error instanceof ApiError &&
    error.code === "INSUFFICIENT_STOCK" &&
    error.sku === sku
    ? `Stok ${sku} tidak cukup. Tersedia: ${error.available ?? 0}.`
    : "";
}
export function orderPayload(
  customer: string,
  items: DraftItem[],
): CreateOrderInput {
  return {
    customer: customer.trim(),
    items: items.map((i) => ({ sku: i.sku, qty: Number(i.qty) })),
  };
}
