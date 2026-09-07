import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client for automated caching, background updates,
 * window focus revalidation, and request deduplication.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes fresh time before background revalidation
      gcTime: 1000 * 60 * 10,    // Retain cached data in garbage collection for 10 minutes
      refetchOnWindowFocus: true, // Automatically synchronize when user tabs back into portal
      refetchOnReconnect: true,   // Refresh when recovering network connectivity
      retry: (failureCount, error: any) => {
        // Don't retry on 404s or client auth errors, retry up to 2 times on transient network drops
        if (error?.status === 404 || error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});
