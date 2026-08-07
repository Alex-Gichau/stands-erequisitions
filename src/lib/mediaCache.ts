import { useState, useEffect } from "react";
import { normalizeAttachmentUrl, DEFAULT_IMAGE_PLACEHOLDER } from "./utils";

const CACHE_NAME = "requisition-media-v1";

// Global in-memory Blob URL map: normalizedUrl -> blobUrl
const memoryBlobCache = new Map<string, string>();
const activeFetches = new Map<string, Promise<string>>();

/**
 * Checks if CacheStorage is available in the current browser environment.
 */
function isCacheStorageSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

/**
 * Fetches and caches a media file (image or PDF), returning a client-side Blob URL.
 * Aggressively utilizes memory cache -> CacheStorage -> network fetch.
 */
export async function getCachedMediaUrl(rawUrl: string | null | undefined, mimeTypeHint?: string): Promise<string> {
  const normalized = normalizeAttachmentUrl(rawUrl);
  if (!normalized) return "";

  // Data URLs, Blob URLs, or SVG data strings don't need network fetching or caching
  if (
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:") ||
    normalized === DEFAULT_IMAGE_PLACEHOLDER
  ) {
    return normalized;
  }

  // 1. Check in-memory blob cache (Instant synchronous return)
  if (memoryBlobCache.has(normalized)) {
    return memoryBlobCache.get(normalized)!;
  }

  // 2. Prevent duplicate inflight fetches for the same URL
  if (activeFetches.has(normalized)) {
    return activeFetches.get(normalized)!;
  }

  const fetchPromise = (async () => {
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        // 3. Check CacheStorage if supported
        if (isCacheStorageSupported()) {
          try {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(normalized);
            if (cachedResponse && cachedResponse.ok) {
              const blob = await cachedResponse.blob();
              const blobUrl = URL.createObjectURL(blob);
              memoryBlobCache.set(normalized, blobUrl);
              return blobUrl;
            }
          } catch (cacheErr) {
            console.warn("[MediaCache] CacheStorage match failed:", cacheErr);
          }
        }

        // 4. Fetch from network with cache directives and timeout/robust headers
        const response = await fetch(normalized, {
          method: "GET",
          cache: "force-cache",
          headers: {
            "Accept": "image/*,application/pdf,*/*",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} loading media`);
        }

        // 5. Store in CacheStorage for future sessions
        if (isCacheStorageSupported() && response.status === 200) {
          try {
            const cache = await caches.open(CACHE_NAME);
            cache.put(normalized, response.clone()).catch(() => {});
          } catch (e) {
            // Ignore cache put errors
          }
        }

        const contentType = response.headers.get("content-type") || mimeTypeHint || "";
        const rawBlob = await response.blob();
        
        const blob = mimeTypeHint && !rawBlob.type ? new Blob([rawBlob], { type: contentType }) : rawBlob;
        const blobUrl = URL.createObjectURL(blob);
        
        memoryBlobCache.set(normalized, blobUrl);
        return blobUrl;
      } catch (err) {
        lastError = err;
        if (attempts < maxAttempts) {
          await new Promise((res) => setTimeout(res, attempts * 400)); // exponential backoff
        }
      }
    }

    console.warn(`[MediaCache] Fetch failed for ${normalized} after ${maxAttempts} attempts, fallback to raw URL:`, lastError);
    return normalized;
  })();

  activeFetches.set(normalized, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    activeFetches.delete(normalized);
  }
}

/**
 * Pre-caches a list of media URLs in the background.
 */
export function preloadMediaBatch(urls: (string | null | undefined)[]) {
  if (!urls || !Array.isArray(urls)) return;
  urls.forEach((url) => {
    const normalized = normalizeAttachmentUrl(url);
    if (normalized && !memoryBlobCache.has(normalized)) {
      getCachedMediaUrl(normalized).catch(() => {});
    }
  });
}

/**
 * React hook for consuming cached media (images & PDFs).
 */
export function useCachedMedia(rawUrl: string | null | undefined, mimeTypeHint?: string): {
  cachedUrl: string;
  isLoading: boolean;
  error: boolean;
} {
  const normalized = normalizeAttachmentUrl(rawUrl);
  const [cachedUrl, setCachedUrl] = useState<string>(() => {
    if (!normalized) return "";
    if (normalized.startsWith("data:") || normalized.startsWith("blob:")) return normalized;
    return memoryBlobCache.get(normalized) || normalized;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!normalized || normalized.startsWith("data:") || normalized.startsWith("blob:")) return false;
    return !memoryBlobCache.has(normalized);
  });
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!normalized) {
      setCachedUrl("");
      setIsLoading(false);
      setError(false);
      return;
    }

    if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
      setCachedUrl(normalized);
      setIsLoading(false);
      setError(false);
      return;
    }

    if (memoryBlobCache.has(normalized)) {
      setCachedUrl(memoryBlobCache.get(normalized)!);
      setIsLoading(false);
      setError(false);
      return;
    }

    setIsLoading(true);
    setError(false);

    getCachedMediaUrl(normalized, mimeTypeHint)
      .then((url) => {
        if (isMounted) {
          setCachedUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCachedUrl(normalized);
          setIsLoading(false);
          setError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [normalized, mimeTypeHint]);

  return { cachedUrl, isLoading, error };
}
