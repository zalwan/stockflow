import { useState } from "react";
import { ErrorMessage } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { rupiah } from "../../lib/format";
import { wibDate } from "./date";
import { useDailySales } from "./queries";

export function DailySalesPanel() {
  const [date, setDate] = useState(wibDate);
  const report = useDailySales(date);
  return (
    <section className="panel daily-sales-panel" aria-label="Penjualan harian">
      <div className="panel-title">
        <div>
          <h2>
            <Icon name="arrow-up-right" size={18} /> Penjualan harian
          </h2>
          <p>
            Order aktif berdasarkan tanggal dibuat (WIB). Order dibatalkan tidak
            dihitung.
          </p>
        </div>
        <label className="report-date">
          Tanggal laporan
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min="0001-01-01"
            max="9999-12-31"
          />
        </label>
      </div>
      {!date ? (
        <p className="report-placeholder">
          Pilih tanggal untuk melihat laporan penjualan.
        </p>
      ) : report.isError ? (
        <div className="panel-feedback">
          <ErrorMessage
            error={report.error}
            retry={() => void report.refetch()}
          />
        </div>
      ) : (
        <div className="daily-sales-grid" aria-busy={report.isFetching}>
          <article className="daily-revenue">
            <span>Total penjualan</span>
            <strong>
              {report.data ? (
                rupiah(report.data.total_sales)
              ) : (
                <span
                  className="skeleton-line"
                  aria-label="Memuat total penjualan"
                />
              )}
            </strong>
          </article>
          <article>
            <span>Transaksi</span>
            <strong>
              {report.data ? `${report.data.order_count} order` : "—"}
            </strong>
          </article>
          <article>
            <span>Barang terjual</span>
            <strong>
              {report.data ? `${report.data.units_sold} unit` : "—"}
            </strong>
          </article>
        </div>
      )}
      {report.isFetching && report.data && (
        <small className="report-refresh">Memperbarui laporan…</small>
      )}
    </section>
  );
}
