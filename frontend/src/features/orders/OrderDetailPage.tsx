import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Icon } from "../../components/Icon";
import { OrderStatus } from "./OrderStatus";
import { Dialog } from "../../components/Dialog";
import { ErrorMessage, Loading } from "../../components/Feedback";
import { dateTime, rupiah } from "../../lib/format";
import { refreshInventory } from "../products/queries";
import { useOrder, refreshOrders } from "./queries";
export function OrderDetailPage() {
  const { id: raw } = useParams();
  const id = Number(raw);
  const q = useOrder(id);
  const [confirm, setConfirm] = useState(false);
  const client = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(id),
    onSuccess: async (order) => {
      client.setQueryData(["order", id], order);
      await Promise.all([refreshInventory(client), refreshOrders(client)]);
      await client.invalidateQueries({ queryKey: ["order", id] });
      setConfirm(false);
    },
  });
  if (!Number.isInteger(id) || id <= 0)
    return <ErrorMessage error={new Error("ID order tidak valid.")} />;
  if (q.isPending) return <Loading label="Memuat order…" />;
  if (q.isError)
    return <ErrorMessage error={q.error} retry={() => void q.refetch()} />;
  const order = q.data;
  const cancelled = order.status === "CANCELLED";
  return (
    <>
      <Link className="back-link" to="/orders">
        <Icon name="arrow-left" size={15} /> Kembali ke daftar order
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PENJUALAN / DETAIL ORDER</div>
          <h1>Order #{String(order.id).padStart(4, "0")}</h1>
          <p>Dibuat {dateTime(order.created_at)}</p>
        </div>
        <OrderStatus status={order.status} large />
      </div>
      {cancelled && (
        <div className="feedback success" role="status">
          <Icon name="check" size={17} /> Order dibatalkan. Stok seluruh item
          telah dikembalikan ke inventori.
        </div>
      )}
      <section className="panel">
        <div className="order-customer">
          <div>
            <span className="eyebrow">PELANGGAN PEMBELI</span>
            <h2>{order.customer}</h2>
          </div>
          <div>
            <span className="eyebrow">STATUS ORDER</span>
            <p>{cancelled ? "Dibatalkan" : "Dibuat"}</p>
            {order.cancelled_at && (
              <small>Dibatalkan {dateTime(order.cancelled_at)}</small>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU produk</th>
                <th>Harga satuan</th>
                <th>Jumlah</th>
                <th className="align-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code>{item.sku}</code>
                  </td>
                  <td>{rupiah(item.unit_price)}</td>
                  <td>{item.qty} unit</td>
                  <td className="align-right">
                    {rupiah(item.qty * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="order-total">
          <span>
            Total order{" "}
            <small>{order.items.length} item · harga saat penjualan</small>
          </span>
          <strong>{rupiah(order.total)}</strong>
        </div>
      </section>
      <div className="detail-actions">
        <Link className="button" to="/orders/new">
          <Icon name="plus" size={16} /> Buat order lain
        </Link>
        <Link className="button" to="/products">
          <Icon name="inventory" size={16} />
          Lihat inventori
        </Link>
        {!cancelled && (
          <button
            className="button danger-outline"
            onClick={() => {
              cancel.reset();
              setConfirm(true);
            }}
          >
            Batalkan order
          </button>
        )}
      </div>
      {confirm && (
        <Dialog
          title="Batalkan order?"
          description={`Order #${order.id} · ${order.customer}`}
          onClose={() => setConfirm(false)}
          busy={cancel.isPending}
        >
          <p>
            Seluruh stok pada order ini akan dikembalikan. Order yang dibatalkan
            tetap tersimpan sebagai riwayat.
          </p>
          <ErrorMessage error={cancel.error} />
          <footer className="form-footer">
            <button
              className="button"
              disabled={cancel.isPending}
              onClick={() => setConfirm(false)}
            >
              Kembali
            </button>
            <button
              className="button danger"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Membatalkan…" : "Ya, batalkan order"}
            </button>
          </footer>
        </Dialog>
      )}
    </>
  );
}
