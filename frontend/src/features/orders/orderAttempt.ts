import type { CreateOrderInput } from "../../api/types";

export interface OrderAttempt {
  key: string;
  input: CreateOrderInput;
}
const storageKey = "stockflow:pending-order:v1";

export function readOrderAttempt(): OrderAttempt | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (
      typeof data !== "object" ||
      data === null ||
      !("key" in data) ||
      typeof data.key !== "string" ||
      !/^[\x21-\x7e]{1,128}$/.test(data.key) ||
      !("input" in data)
    )
      return null;
    const input = data.input;
    if (
      typeof input !== "object" ||
      input === null ||
      !("customer" in input) ||
      typeof input.customer !== "string" ||
      !input.customer.trim() ||
      !("items" in input) ||
      !Array.isArray(input.items) ||
      input.items.length < 1 ||
      input.items.length > 100
    )
      return null;
    const items: CreateOrderInput["items"] = [];
    for (const item of input.items) {
      if (
        typeof item !== "object" ||
        item === null ||
        !("sku" in item) ||
        typeof item.sku !== "string" ||
        !item.sku ||
        !("qty" in item) ||
        typeof item.qty !== "number" ||
        !Number.isInteger(item.qty) ||
        item.qty < 1 ||
        item.qty > 2147483647
      )
        return null;
      items.push({ sku: item.sku, qty: item.qty });
    }
    return { key: data.key, input: { customer: input.customer, items } };
  } catch {
    return null;
  }
}

export function saveOrderAttempt(attempt: OrderAttempt) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(attempt));
  } catch {
    throw new Error(
      "Tidak dapat menyimpan percobaan order. Izinkan penyimpanan sesi browser lalu coba lagi.",
    );
  }
}
export function clearOrderAttempt() {
  sessionStorage.removeItem(storageKey);
}
