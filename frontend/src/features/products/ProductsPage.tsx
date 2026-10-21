import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Product } from "../../api/types";
import { Icon } from "../../components/Icon";
import { Dialog } from "../../components/Dialog";
import { ErrorMessage, Loading } from "../../components/Feedback";
import { relativeTime, rupiah } from "../../lib/format";
import { useDebounce } from "../../lib/useDebounce";
import { useProducts, useSummary, refreshInventory } from "./queries";
import { resetPage } from "./validation";
import { ProductForm } from "./ProductForm";
import { StockModal } from "./StockModal";
import { MovementHistory } from "./MovementHistory";
type Action =
  | { kind: "create" }
  | { kind: "edit" | "stock" | "history" | "delete"; product: Product };
const filters = [
  ["all", "Semua"],
  ["active", "Aktif"],
  ["inactive", "Nonaktif"],
  ["low-stock", "Stok menipis"],
] as const;
export function ProductsPage() {
  const [params, setParams] = useState({
    search: "",
    page: 1,
    limit: 10,
    filter: "all",
  });
  const search = useDebounce(params.search);
  const products = useProducts({ ...params, search });
  const summary = useSummary();
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState("");
  const [formPending, setFormPending] = useState(false);
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteProduct(id),
    onSuccess: async () => {
      await refreshInventory(client);
      setParams((p) => ({ ...p, page: 1 }));
      setAction(null);
      setNotice("Produk berhasil dihapus.");
    },
  });
  const saved = () => {
    setFormPending(false);
    setAction(null);
    setNotice("Perubahan berhasil disimpan.");
  };
  const show = (next: Action) => {
    remove.reset();
    setAction(next);
    setNotice("");
  };
  const titles = {
    edit: "Edit produk",
    stock: "Sesuaikan stok",
    history: "Riwayat pergerakan",
    delete: "Hapus produk",
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE / INVENTORI</div>
          <h1>Inventori produk</h1>
          <p>
            Kelola persediaan, catat pergerakan, dan jaga stok tetap akurat.
          </p>
        </div>
        <div className="heading-actions">
          <Link to="/orders/new" className="button">
            <Icon name="orders" size={16} /> Buat order
          </Link>
          <button
            className="button primary"
            onClick={() => show({ kind: "create" })}
          >
            <Icon name="plus" size={17} /> Tambah produk
          </button>
        </div>
      </div>
      <div className="summary-grid" aria-label="Ringkasan seluruh produk">
        {[
          ["Total produk", summary.data?.total_products, "Seluruh katalog"],
          ["Produk aktif", summary.data?.active_products, "Siap dikelola"],
          [
            "Nilai persediaan",
            summary.data ? rupiah(summary.data.total_stock_value) : undefined,
            "Harga × stok seluruh produk",
          ],
          [
            "Stok menipis",
            summary.data?.low_stock_count,
            "Persediaan ≤ 10 unit",
          ],
        ].map(([label, value, caption], i) => (
          <article
            className={`summary-card ${i === 3 ? "warning-card" : ""}`}
            key={label}
          >
            <div className="summary-label">
              {label}
              <span>
                <Icon
                  name={
                    (
                      ["inventory", "check", "arrow-up-right", "clock"] as const
                    )[i]
                  }
                  size={18}
                />
              </span>
            </div>
            <strong>{value ?? "—"}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </div>
      {summary.isError && (
        <ErrorMessage
          error={summary.error}
          retry={() => void summary.refetch()}
        />
      )}
      {notice && (
        <div className="feedback success" role="status">
          <Icon name="check" size={16} /> {notice}
          <button
            className="icon-button"
            aria-label="Tutup notifikasi"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>
              Daftar produk{" "}
              <span className="count">{products.data?.total ?? "—"}</span>
            </h2>
            <p>Satu tempat untuk seluruh persediaan Anda.</p>
          </div>
          <span
            className={`live-label ${products.isError ? "offline" : ""}`}
            aria-live="polite"
          >
            <i />
            {products.isError
              ? "Koneksi terganggu"
              : products.isPending
                ? "Menghubungkan…"
                : "Terhubung ke gudang"}
          </span>
        </div>
        <div className="toolbar">
          <div className="tabs" aria-label="Filter produk">
            {filters.map(([key, label]) => (
              <button
                key={key}
                className={params.filter === key ? "selected" : ""}
                aria-pressed={params.filter === key}
                onClick={() => setParams((p) => resetPage(p, { filter: key }))}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" size={17} />
            <input
              aria-label="Cari produk"
              value={params.search}
              onChange={(e) =>
                setParams((p) => resetPage(p, { search: e.target.value }))
              }
              placeholder="Cari SKU atau nama produk…"
            />
          </label>
        </div>
        {products.isPending ? (
          <Loading label="Memuat persediaan…" />
        ) : products.isError ? (
          <div className="panel-feedback">
            <ErrorMessage
              error={products.error}
              retry={() => void products.refetch()}
            />
          </div>
        ) : !products.data.data.length ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="inventory" size={36} />
            </div>
            <h3>Tidak ada produk</h3>
            <p>
              {params.search || params.filter !== "all"
                ? "Coba kata kunci atau filter lain."
                : "Tambahkan produk pertama untuk mulai mengelola stok."}
            </p>
            {(params.search || params.filter !== "all") && (
              <button
                className="button"
                onClick={() =>
                  setParams((p) => resetPage(p, { search: "", filter: "all" }))
                }
              >
                Reset pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produk / SKU</th>
                  <th>Harga satuan</th>
                  <th>Stok</th>
                  <th>Status</th>
                  <th>Pergerakan terakhir</th>
                  <th className="align-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {products.data.data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-avatar">
                          {p.name.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{p.name}</strong>
                          <code>{p.sku}</code>
                        </div>
                      </div>
                    </td>
                    <td className="tabular">{rupiah(p.price)}</td>
                    <td>
                      <span
                        className={`stock-number ${p.stock <= 10 ? "low" : ""}`}
                      >
                        {p.stock}
                      </span>
                      <span className="unit"> unit</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${p.is_active ? "active" : "inactive"}`}
                      >
                        <i />
                        {p.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button muted movement-link"
                        onClick={() => show({ kind: "history", product: p })}
                        title={p.last_movement_at ?? undefined}
                      >
                        <Icon name="history" size={13} />{" "}
                        {relativeTime(p.last_movement_at)}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="button small"
                          onClick={() => show({ kind: "stock", product: p })}
                          aria-label={`Sesuaikan stok ${p.sku}`}
                        >
                          <Icon name="swap" size={14} /> Stok
                        </button>
                        <button
                          className="icon-button"
                          title="Edit produk"
                          aria-label={`Edit ${p.sku}`}
                          onClick={() => show({ kind: "edit", product: p })}
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          className="icon-button danger-text"
                          title="Hapus produk"
                          aria-label={`Hapus ${p.sku}`}
                          onClick={() => show({ kind: "delete", product: p })}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="pagination">
          <span>
            {products.data
              ? `${products.data.total} produk · halaman ${params.page} dari ${Math.max(1, Math.ceil(products.data.total / params.limit))}`
              : "Daftar persediaan"}
            {products.isFetching && !products.isPending
              ? " · Memperbarui…"
              : ""}
          </span>
          <div>
            <button
              className="button small"
              disabled={params.page === 1 || products.isFetching}
              onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}
            >
              <Icon name="arrow-left" size={14} /> Sebelumnya
            </button>
            <button
              className="button small"
              disabled={
                !products.data ||
                params.page * params.limit >= products.data.total ||
                products.isFetching
              }
              onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}
            >
              Berikutnya <Icon name="arrow-right" size={14} />
            </button>
          </div>
        </footer>
      </section>
      <p className="page-footnote">
        <Icon name="history" size={13} /> Perubahan stok dan penjualan tersimpan
        bersama riwayat pergerakannya.
      </p>
      {action && (
        <Dialog
          title={
            action.kind === "create" ? "Tambah produk" : titles[action.kind]
          }
          description={
            action.kind === "create"
              ? "Lengkapi informasi produk baru."
              : `${action.product.sku} · ${action.product.name}`
          }
          onClose={() => setAction(null)}
          busy={remove.isPending || formPending}
        >
          {action.kind === "create" && (
            <ProductForm onPendingChange={setFormPending} onSaved={saved} />
          )}
          {action.kind === "edit" && (
            <ProductForm
              product={action.product}
              onPendingChange={setFormPending}
              onSaved={saved}
            />
          )}
          {action.kind === "stock" && (
            <StockModal
              product={action.product}
              onPendingChange={setFormPending}
              onSaved={saved}
            />
          )}
          {action.kind === "history" && (
            <MovementHistory id={action.product.id} />
          )}
          {action.kind === "delete" && (
            <>
              <p>
                Hapus produk ini? Produk yang mempunyai riwayat pergerakan tidak
                dapat dihapus. Anda dapat menonaktifkannya melalui edit produk.
              </p>
              <ErrorMessage error={remove.error} />
              <footer className="form-footer">
                <button
                  className="button"
                  onClick={() => setAction(null)}
                  disabled={remove.isPending}
                >
                  Kembali
                </button>
                <button
                  className="button danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(action.product.id)}
                >
                  {remove.isPending ? "Menghapus…" : "Hapus produk"}
                </button>
              </footer>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
