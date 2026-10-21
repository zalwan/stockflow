import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { OrderListParams } from "../../api/types";
import { Icon } from "../../components/Icon";
import { TableSkeleton } from "../../components/TableSkeleton";
import { ErrorMessage } from "../../components/Feedback";
import { dateTime, relativeTime, rupiah } from "../../lib/format";
import { useDebounce } from "../../lib/useDebounce";
import { useOrders } from "./queries";
import { resetOrderPage } from "./listState";
import { OrderStatus } from "./OrderStatus";
const filters = [
  ["", "Semua"],
  ["CREATED", "Dibuat"],
  ["CANCELLED", "Dibatalkan"],
] as const;
export function OrdersPage({ summary }: { summary?: ReactNode }) {
  const [params, setParams] = useState<OrderListParams>({
    search: "",
    status: "",
    page: 1,
    limit: 10,
  });
  const search = useDebounce(params.search);
  const q = useOrders({ ...params, search });
  const searchPending = params.search !== search;
  // A cancellation can remove the last row from a filtered page.
  const lastPage = q.data
    ? Math.max(1, Math.ceil(q.data.total / params.limit))
    : params.page;
  if (params.page > lastPage) setParams({ ...params, page: lastPage });
  const filtered = Boolean(params.search || params.status);
  const reset = () =>
    setParams((p) => resetOrderPage(p, { search: "", status: "" }));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PENJUALAN / RIWAYAT TRANSAKSI</div>
          <h1>Order penjualan</h1>
          <p>Temukan pembelian pelanggan dan telusuri setiap transaksinya.</p>
        </div>
        <Link className="button primary" to="/orders/new">
          <Icon name="plus" size={17} />
          Buat order
        </Link>
      </div>
      {summary}
      <section className="panel orders-panel">
        <div className="panel-title">
          <div>
            <h2>
              Riwayat order{" "}
              <span className="count">{q.data?.total ?? "—"}</span>
            </h2>
            <p>
              Nama pelanggan, barang yang dibeli, dan status order dalam satu
              tempat.
            </p>
          </div>
          <span
            className={`live-label ${q.isError ? "offline" : ""}`}
            aria-live="polite"
          >
            <i />
            {q.isError
              ? "Koneksi terganggu"
              : q.isPending
                ? "Menghubungkan…"
                : "Data penjualan"}
          </span>
        </div>
        <div className="toolbar">
          <div className="tabs" aria-label="Filter status order">
            {filters.map(([key, label]) => (
              <button
                key={key}
                className={params.status === key ? "selected" : ""}
                aria-pressed={params.status === key}
                onClick={() =>
                  setParams((p) => resetOrderPage(p, { status: key }))
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search order-search">
            <Icon name="search" size={17} />
            <input
              value={params.search}
              onChange={(e) =>
                setParams((p) => resetOrderPage(p, { search: e.target.value }))
              }
              aria-label="Cari order"
              placeholder="Cari pelanggan atau nomor order…"
            />
          </label>
        </div>
        {q.isPending ? (
          <TableSkeleton label="Memuat order…" columns={7} />
        ) : q.isError ? (
          <div className="panel-feedback">
            <ErrorMessage error={q.error} retry={() => void q.refetch()} />
          </div>
        ) : !q.data.data.length ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="orders" size={36} />
            </div>
            <h3>
              {filtered ? "Tidak ada order ditemukan" : "Belum ada order"}
            </h3>
            <p>
              {filtered
                ? "Coba nama pelanggan, nomor order, atau status yang berbeda."
                : "Order penjualan pertama Anda akan tampil di sini."}
            </p>
            {filtered ? (
              <button className="button" onClick={reset}>
                Reset pencarian
              </button>
            ) : (
              <Link className="button primary" to="/orders/new">
                <Icon name="plus" size={16} />
                Buat order pertama
              </Link>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Nomor order</th>
                  <th>Pelanggan</th>
                  <th>Dibuat pada</th>
                  <th>Barang</th>
                  <th>Total order</th>
                  <th>Status</th>
                  <th className="align-right">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((order) => {
                  const number = `#${String(order.id).padStart(4, "0")}`;
                  const initials = order.customer
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase();
                  return (
                    <tr key={order.id}>
                      <td>
                        <Link
                          className="order-number-link"
                          to={`/orders/${order.id}`}
                        >
                          {number}
                        </Link>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <span className="customer-avatar" aria-hidden="true">
                            {initials}
                          </span>
                          <strong>{order.customer}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="date-cell">
                          <time dateTime={order.created_at}>
                            {dateTime(order.created_at)}
                          </time>
                          <small>{relativeTime(order.created_at)}</small>
                        </div>
                      </td>
                      <td>
                        <div className="item-count">
                          <span>{order.item_count} jenis</span>
                          <small>{order.unit_count} unit</small>
                        </div>
                      </td>
                      <td className="order-money">{rupiah(order.total)}</td>
                      <td>
                        <OrderStatus status={order.status} />
                      </td>
                      <td className="align-right">
                        <Link
                          className="button small"
                          to={`/orders/${order.id}`}
                          aria-label={`Lihat detail order ${number}`}
                        >
                          Detail
                          <Icon name="arrow-right" size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <footer className="pagination">
          <span>
            {q.data
              ? `${q.data.total} order · halaman ${params.page} dari ${Math.max(1, Math.ceil(q.data.total / params.limit))}`
              : "Daftar order"}
            {q.isFetching && !q.isPending ? " · Memperbarui…" : ""}
          </span>
          <div>
            <button
              className="button small"
              disabled={params.page === 1 || q.isFetching || searchPending}
              onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}
            >
              <Icon name="arrow-left" size={14} />
              Sebelumnya
            </button>
            <button
              className="button small"
              disabled={
                searchPending ||
                !q.data ||
                params.page * params.limit >= q.data.total ||
                q.isFetching
              }
              onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}
            >
              Berikutnya
              <Icon name="arrow-right" size={14} />
            </button>
          </div>
        </footer>
      </section>
      <p className="page-footnote">
        <Icon name="history" size={13} /> Order yang dibatalkan tetap tersimpan
        sebagai riwayat.
      </p>
    </>
  );
}
