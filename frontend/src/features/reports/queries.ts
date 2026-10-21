import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
export function useDailySales(date: string) {
  return useQuery({
    queryKey: ["daily-sales", date],
    queryFn: () => api.dailySales(date),
    enabled: Boolean(date),
  });
}
