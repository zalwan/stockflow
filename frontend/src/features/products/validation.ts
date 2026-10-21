const MAX = 2147483647;
export const positiveInteger = (value: string) =>
  /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= MAX;
export function productErrors(input: {
  sku: string;
  name: string;
  price: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.sku.trim() || input.sku.length > 100)
    errors.sku = "SKU wajib diisi, maksimal 100 karakter.";
  if (!input.name.trim() || input.name.length > 250)
    errors.name = "Nama wajib diisi, maksimal 250 karakter.";
  if (!/^\d+$/.test(input.price) || Number(input.price) > MAX)
    errors.price = "Harga harus berupa integer antara 0 dan 2.147.483.647.";
  return errors;
}
export function resetPage<
  T extends { page: number; search: string; filter: string },
>(current: T, patch: Partial<Pick<T, "search" | "filter">>): T {
  return { ...current, ...patch, page: 1 };
}
