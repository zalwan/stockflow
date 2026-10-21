import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { ProductParams } from "../../api/types";
export const useProducts = (params: ProductParams) =>
  useQuery({
    queryKey: ["products", params],
    queryFn: () => api.listProducts(params),
  });
export const useSummary = () =>
  useQuery({ queryKey: ["summary"], queryFn: api.summary });
export const useMovements = (id: number) =>
  useQuery({ queryKey: ["movements", id], queryFn: () => api.movements(id) });
export async function refreshInventory(client: QueryClient) {
  await Promise.all(
    ["products", "summary", "movements"].map((key) =>
      client.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
