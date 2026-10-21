import { ApiError } from "../api/client";
export function ErrorMessage({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  let message =
    error instanceof Error
      ? error.message
      : "Terjadi kesalahan. Silakan coba lagi.";
  if (error instanceof ApiError && error.code === "INSUFFICIENT_STOCK")
    message = `${error.sku ? `Stok ${error.sku}` : "Stok"} tidak mencukupi. Tersedia: ${error.available ?? 0}.`;
  return (
    <div className="feedback error" role="alert">
      <span>{message}</span>
      {retry && (
        <button type="button" className="button small" onClick={retry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}
export function Loading({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
