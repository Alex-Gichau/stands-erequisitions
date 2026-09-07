import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { Requisition, UserProfile, LedgerBook, RequisitionStatus } from "../types";

/**
 * Hook to query financial requisitions with automated background revalidation,
 * caching, and request deduplication.
 */
export function useRequisitionsQuery(options?: { enabled?: boolean }) {
  return useQuery<Requisition[]>({
    queryKey: ["requisitions"],
    queryFn: async () => {
      const res = await fetch("/api/requisitions");
      if (!res.ok) {
        throw new Error(`Failed to load requisitions (status: ${res.status})`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : data.requisitions || [];
    },
    staleTime: 1000 * 30, // 30 seconds fresh window
    gcTime: 1000 * 60 * 10, // 10 minutes cache retention
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to query a single requisition by ID with automatic caching.
 */
export function useRequisitionDetailQuery(id?: string, options?: { enabled?: boolean }) {
  return useQuery<Requisition>({
    queryKey: ["requisitions", id],
    queryFn: async () => {
      if (!id) throw new Error("Requisition ID is required");
      const res = await fetch(`/api/requisitions/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to load requisition ${id} (status: ${res.status})`);
      }
      return res.json();
    },
    staleTime: 1000 * 60, // 1 minute
    enabled: !!id && (options?.enabled ?? true),
  });
}

/**
 * Hook to query Google Finance market RSS feeds with background polling and deduplication.
 */
export function useMarketRssFeedsQuery(options?: { enabled?: boolean }) {
  return useQuery<{ success: boolean; source: string; items: Array<{ title: string; link: string; pubDate: string; source?: string }> }>({
    queryKey: ["market-rss-feeds"],
    queryFn: async () => {
      const res = await fetch("/api/market-rss-feeds");
      if (!res.ok) {
        throw new Error(`Failed to load market RSS feeds (status: ${res.status})`);
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 5, // Auto-poll every 5 minutes in the background
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to query system health & database diagnostics.
 */
export function useSystemHealthQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const res = await fetch("/api/system-health");
      if (!res.ok) {
        throw new Error(`Failed to load system health (status: ${res.status})`);
      }
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 45, // Auto-poll every 45s
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to query any collection from the portal database API.
 */
export function useDatabaseCollectionQuery<T = any>(collection: string, options?: { enabled?: boolean }) {
  return useQuery<T[]>({
    queryKey: ["db-collection", collection],
    queryFn: async () => {
      const res = await fetch(`/api/db/${collection}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${collection} (status: ${res.status})`);
      }
      return res.json();
    },
    staleTime: 1000 * 60, // 1 minute
    enabled: options?.enabled ?? (!!collection),
  });
}

/**
 * Mutation hook for updating a requisition status with cache invalidation
 */
export function useUpdateRequisitionStatusMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, note, approver }: { id: string; status: RequisitionStatus; note?: string; approver?: string }) => {
      const res = await fetch(`/api/requisitions/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note, approver }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update status (status: ${res.status})`);
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries to keep all views synchronized
      qc.invalidateQueries({ queryKey: ["requisitions"] });
      qc.invalidateQueries({ queryKey: ["requisitions", variables.id] });
      qc.invalidateQueries({ queryKey: ["system-health"] });
      qc.invalidateQueries({ queryKey: ["db-collection", "requisitions"] });
    },
  });
}

/**
 * Helper to invalidate portal query caches when records update
 */
export function invalidatePortalQueries(keys: string[] = ["requisitions"]) {
  keys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}
