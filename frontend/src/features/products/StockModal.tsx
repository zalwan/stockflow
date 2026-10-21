import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Product, StockInput } from "../../api/types";
import { ErrorMessage } from "../../components/Feedback";
import { positiveInteger } from "./validation";
import { refreshInventory } from "./queries";
export function StockModal({
  product,
  onSaved,
  onPendingChange,
}: {
  product: Product;
  onSaved: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [direction, setDirection] = useState<StockInput["type"]>("in");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [invalid, setInvalid] = useState(false);
  const client = useQueryClient();
  const save = useMutation({
    onMutate: () => onPendingChange?.(true),
    onSettled: () => onPendingChange?.(false),
    mutationFn: () =>
      api.adjustStock(product.id, {
        type: direction,
        qty: Number(qty),
        note: note.trim(),
      }),
    onSuccess: async () => {
      await refreshInventory(client);
      onSaved();
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setInvalid(!positiveInteger(qty));
        if (positiveInteger(qty)) save.mutate();
      }}
      noValidate
    >
      <div className="stock-context">
        <span>Stok saat dibuka</span>
        <strong>
          {product.stock} <small>unit</small>
        </strong>
      </div>
      <label>
        Arah pergerakan
        <select
          value={direction}
          onChange={(e) => {
            setDirection(e.target.value as StockInput["type"]);
            save.reset();
          }}
          disabled={save.isPending}
        >
          <option value="in">Masuk · tambah stok</option>
          <option value="out">Keluar · kurangi stok</option>
        </select>
      </label>
      <label>
        Jumlah
        <input
          inputMode="numeric"
          value={qty}
          onChange={(e) => {
            setQty(e.target.value);
            save.reset();
          }}
          placeholder="Masukkan jumlah unit"
          disabled={save.isPending}
        />
        {invalid && (
          <span className="field-error">
            Isi integer positif, maksimal 2.147.483.647.
          </span>
        )}
      </label>
      <label>
        Catatan <span className="optional">opsional</span>
        <textarea
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Contoh: penerimaan dari pemasok"
          disabled={save.isPending}
        />
      </label>
      <ErrorMessage error={save.error} />
      <footer className="form-footer">
        <button className="button primary" disabled={save.isPending}>
          {save.isPending ? "Menyimpan…" : "Simpan pergerakan"}
        </button>
      </footer>
    </form>
  );
}
