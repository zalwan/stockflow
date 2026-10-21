import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Icon } from "../../components/Icon";
import { refreshOrders } from "./queries";
import { ErrorMessage, Loading } from "../../components/Feedback";
import { useDebounce } from "../../lib/useDebounce";
import { useProducts, refreshInventory } from "../products/queries";
import { itemError, orderErrors, orderPayload } from "./validation";
import type { DraftItem } from "./validation";
function ProductPicker({
  sku,
  index,
  onChange,
  disabled,
}: {
  sku: string;
  index: number;
  onChange: (sku: string) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const term = useDebounce(search);
  const q = useProducts({ search: term, page, limit: 20, filter: "all" });
  return (
    <div className="picker">
      <label className="sr-only" htmlFor={`search-${index}`}>
        Cari produk untuk item {index + 1}
      </label>
      <input
        id={`search-${index}`}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Cari SKU atau nama…"
        disabled={disabled}
      />
      <label className="sr-only" htmlFor={`item-${index}`}>
        Produk item {index + 1}
      </label>
      <select
        id={`item-${index}`}
        value={sku}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || q.isPending || q.isError}
      >
        <option value="">Pilih produk</option>
        {sku && !q.data?.data.some((p) => p.sku === sku) && (
          <option value={sku}>{sku}</option>
        )}
        {q.data?.data.map((p) => (
          <option value={p.sku} key={p.id}>
            {p.sku} · {p.name} (stok {p.stock})
          </option>
        ))}
      </select>
      {q.isPending && <Loading label="Memuat pilihan…" />}
      {q.isError && (
        <ErrorMessage error={q.error} retry={() => void q.refetch()} />
      )}
      {q.data && q.data.total > 20 && (
        <div className="picker-pagination">
          <button
            type="button"
            className="text-button"
            disabled={page === 1 || disabled}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span>
            Halaman {page} / {Math.ceil(q.data.total / 20)}
          </span>
          <button
            type="button"
            className="text-button"
            disabled={page * 20 >= q.data.total || disabled}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
export function CreateOrderPage() {
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<(DraftItem & { key: number })[]>([
    { key: 1, sku: "", qty: "1" },
  ]);
  const [nextKey, setNextKey] = useState(2);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: () => api.createOrder(orderPayload(customer, items)),
    onSuccess: async (order) => {
      client.setQueryData(["order", order.id], order);
      await Promise.all([refreshInventory(client), refreshOrders(client)]);
      void navigate(`/orders/${order.id}`);
    },
  });
  const change = (index: number, patch: Partial<DraftItem>) => {
    setItems((previous) =>
      previous.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    create.reset();
  };
  return (
    <>
      <Link className="back-link" to="/orders">
        <Icon name="arrow-left" size={15} /> Kembali ke daftar order
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PENJUALAN / ORDER BARU</div>
          <h1>Buat order penjualan</h1>
          <p>Catat penjualan dan perbarui stok dalam satu langkah.</p>
        </div>
      </div>
      <div className="order-layout">
        <form
          className="panel order-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const next = orderErrors(customer, items);
            setErrors(next);
            if (!Object.keys(next).length) create.mutate();
          }}
        >
          <div className="section-label">
            <span>01</span>
            <h2>Informasi pelanggan</h2>
          </div>
          <label>
            Nama pelanggan pembeli
            <input
              value={customer}
              maxLength={250}
              placeholder="Nama pelanggan atau perusahaan"
              onChange={(e) => {
                setCustomer(e.target.value);
                create.reset();
              }}
              disabled={create.isPending}
            />
            {errors.customer && (
              <span className="field-error">{errors.customer}</span>
            )}
          </label>
          <div className="section-label">
            <span>02</span>
            <h2>Item penjualan</h2>
            <small>{items.length} item</small>
          </div>
          <div className="order-items">
            {items.map((item, i) => {
              const error = itemError(create.error, item.sku);
              return (
                <div
                  className={`order-item ${error ? "item-conflict" : ""}`}
                  key={item.key}
                >
                  <div className="item-heading">
                    <strong>Item {i + 1}</strong>
                    <button
                      type="button"
                      className="text-button danger-text"
                      disabled={create.isPending || items.length === 1}
                      onClick={() => {
                        setItems((previous) =>
                          previous.filter((_, index) => index !== i),
                        );
                        create.reset();
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                  <div className="item-fields">
                    <div>
                      <span className="label-text">Produk</span>
                      <ProductPicker
                        sku={item.sku}
                        index={i}
                        onChange={(sku) => change(i, { sku })}
                        disabled={create.isPending}
                      />
                    </div>
                    <label>
                      Qty
                      <input
                        aria-label={`Jumlah item ${i + 1}`}
                        inputMode="numeric"
                        value={item.qty}
                        onChange={(e) => change(i, { qty: e.target.value })}
                        disabled={create.isPending}
                      />
                    </label>
                  </div>
                  {error && (
                    <p className="field-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {errors.items && (
            <p className="field-error" role="alert">
              {errors.items}
            </p>
          )}
          <button
            type="button"
            className="button add-item"
            disabled={create.isPending || items.length >= 100}
            onClick={() => {
              setItems((previous) => [
                ...previous,
                { key: nextKey, sku: "", qty: "1" },
              ]);
              setNextKey((k) => k + 1);
              create.reset();
            }}
          >
            <Icon name="plus" size={15} /> Tambah item
          </button>
          <ErrorMessage error={create.error} />
          <footer className="form-footer">
            <Link className="button" to="/orders">
              Kembali
            </Link>
            <button className="button primary" disabled={create.isPending}>
              {create.isPending ? "Menyimpan order…" : "Buat order"}
            </button>
          </footer>
        </form>
        <aside className="order-aside">
          <div className="aside-symbol">
            <Icon name="arrow-up-right" size={32} />
          </div>
          <h3>Dari gudang ke pelanggan.</h3>
          <p>
            Harga dan total akhir mengikuti data produk saat order disimpan.
          </p>
          <hr />
          <p>
            Stok seluruh item dikurangi bersama. Jika salah satu item tidak
            mencukupi, order tidak akan dibuat.
          </p>
          <p className="hint">
            Perlu koreksi? Order yang sudah dibuat dapat dibatalkan untuk
            mengembalikan stok.
          </p>
        </aside>
      </div>
    </>
  );
}
