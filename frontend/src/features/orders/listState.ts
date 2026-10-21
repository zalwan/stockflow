import type { OrderListParams } from "../../api/types";
export function resetOrderPage(
  current: OrderListParams,
  patch: Partial<Pick<OrderListParams, "search" | "status">>,
): OrderListParams {
  return { ...current, ...patch, page: 1 };
}
