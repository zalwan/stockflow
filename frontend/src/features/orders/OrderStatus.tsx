import type { Order } from "../../api/types";
export function OrderStatus({
  status,
  large = false,
}: {
  status: Order["status"];
  large?: boolean;
}) {
  const cancelled = status === "CANCELLED";
  return (
    <span
      className={`badge ${large ? "large " : ""}${cancelled ? "inactive" : "active"}`}
    >
      <i aria-hidden="true" />
      {cancelled ? "Dibatalkan" : "Dibuat"}
    </span>
  );
}
