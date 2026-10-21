import type { QueryClient } from "@tanstack/react-query";
import type { OrderListParams } from "../../api/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
export function useOrder(id: number) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => api.getOrder(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => api.listOrders(params),
  });
}
export async function refreshOrders(client: QueryClient) {
  await client.invalidateQueries({ queryKey: ["orders"] });
}
