import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Product } from "../../api/types";
import { ErrorMessage } from "../../components/Feedback";
import { productErrors } from "./validation";
import { refreshInventory } from "./queries";
export function ProductForm({
  product,
  onSaved,
  onPendingChange,
}: {
  product?: Product;
  onSaved: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [active, setActive] = useState(product?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const client = useQueryClient();
  const save = useMutation({
    onMutate: () => onPendingChange?.(true),
    onSettled: () => onPendingChange?.(false),
    mutationFn: () => {
      const input = {
        sku: sku.trim(),
        name: name.trim(),
        price: Number(price),
        is_active: active,
      };
      return product
        ? api.updateProduct(product.id, input)
        : api.createProduct(input);
    },
    onSuccess: async () => {
      await refreshInventory(client);
      onSaved();
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const next = productErrors({ sku, name, price });
        setErrors(next);
        if (!Object.keys(next).length) save.mutate();
      }}
      noValidate
    >
      <label>
        SKU
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          maxLength={100}
          placeholder="Contoh: KRT-A4-80"
          disabled={save.isPending}
        />
        {errors.sku && <span className="field-error">{errors.sku}</span>}
      </label>
      <label>
        Nama produk
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={250}
          placeholder="Nama yang mudah dikenali"
          disabled={save.isPending}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>
      <label>
        Harga satuan (Rp)
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="numeric"
          placeholder="65000"
          disabled={save.isPending}
        />
        {errors.price && <span className="field-error">{errors.price}</span>}
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          disabled={save.isPending}
        />
        Produk aktif
      </label>
      {!product && (
        <p className="hint">
          Produk baru dimulai dengan stok 0. Gunakan penyesuaian stok untuk
          mencatat penerimaan.
        </p>
      )}
      <ErrorMessage error={save.error} />
      <footer className="form-footer">
        <button className="button primary" disabled={save.isPending}>
          {save.isPending ? "Menyimpan…" : "Simpan produk"}
        </button>
      </footer>
    </form>
  );
}
