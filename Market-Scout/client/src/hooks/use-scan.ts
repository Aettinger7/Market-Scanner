import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useLatestScans() {
  return useQuery({
    queryKey: [api.scan.latest.path],
    queryFn: async () => {
      const res = await fetch(api.scan.latest.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch latest scans");
      return api.scan.latest.responses[200].parse(await res.json());
    },
    // Refresh every 30 seconds to keep data fresh
    refetchInterval: 30000, 
  });
}

export function useRunScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.scan.run.path, {
        method: api.scan.run.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to run scan");
      return api.scan.run.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scan.latest.path] });
    },
  });
}
