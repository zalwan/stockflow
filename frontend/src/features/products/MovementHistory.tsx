import { Icon } from "../../components/Icon";
import { ErrorMessage, Loading } from "../../components/Feedback";
import { dateTime } from "../../lib/format";
import { useMovements } from "./queries";
export function MovementHistory({ id }: { id: number }) {
  const q = useMovements(id);
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorMessage error={q.error} retry={() => void q.refetch()} />;
  if (!q.data.data.length)
    return (
      <div className="empty">
        <h3>Belum ada pergerakan</h3>
        <p>Penerimaan dan pengeluaran stok akan tercatat di sini.</p>
      </div>
    );
  return (
    <div className="history">
      {q.data.data.map((m) => (
        <article key={m.id}>
          <span className={`movement-mark ${m.type}`}>
            <Icon
              name={m.type === "in" ? "arrow-down-left" : "arrow-up-right"}
              size={18}
            />
          </span>
          <div>
            <strong>{m.type === "in" ? "Stok masuk" : "Stok keluar"}</strong>
            <p>{m.note || "Tanpa catatan"}</p>
            <time>{dateTime(m.created_at)}</time>
          </div>
          <b className={m.type === "in" ? "positive" : "negative"}>
            {m.type === "in" ? "+" : "−"}
            {m.qty}
          </b>
        </article>
      ))}
    </div>
  );
}
