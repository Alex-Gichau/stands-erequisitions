import Redis from "ioredis";

let valkeyClient: Redis | null = null;
let isConnected = false;
let connectionAttempted = false;

// Performance counters
let cacheHits = 0;
let cacheMisses = 0;

const VALKEY_URL = process.env.VALKEY_URL || process.env.REDIS_URL || "redis://127.0.0.1:6379";

/**
 * Initialize and get the Valkey Redis singleton client.
 * Configured with auto-reconnect and graceful error handling.
 */
export function getValkeyClient(): Redis | null {
  if (valkeyClient) return valkeyClient;

  if (connectionAttempted) return valkeyClient;
  connectionAttempted = true;

  try {
    console.log(`[Valkey] Initializing connection to ${VALKEY_URL}...`);
    
    valkeyClient = new Redis(VALKEY_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      retryStrategy(times) {
        if (times > 5) {
          // Slow down reconnection attempts if Valkey is not running locally
          return 10000;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
      enableOfflineQueue: false // Prevent blocking API requests if Valkey is down
    });

    valkeyClient.on("connect", () => {
      isConnected = true;
      console.log("⚡ [Valkey] Connected successfully to in-memory store");
    });

    valkeyClient.on("ready", () => {
      isConnected = true;
      console.log("⚡ [Valkey] Client ready for sub-millisecond caching");
    });

    valkeyClient.on("error", (err: any) => {
      isConnected = false;
      // Log connection error silently to avoid spamming console when Valkey server is offline
      if (err.code === "ECONNREFUSED") {
        // Valkey is offline, fallback gracefully to DB/Disk
      } else {
        console.warn("[Valkey] Connection warning:", err.message || err);
      }
    });

    valkeyClient.on("end", () => {
      isConnected = false;
    });

  } catch (err: any) {
    console.error("[Valkey] Failed to instantiate Redis/Valkey client:", err.message || err);
    valkeyClient = null;
    isConnected = false;
  }

  return valkeyClient;
}

/**
 * Health check & diagnostic status for Valkey caching layer
 */
export async function getValkeyStatus(): Promise<{
  status: "connected" | "disconnected" | "disabled";
  connected: boolean;
  latencyMs: number | null;
  keysCount: number;
  memoryUsed: string;
  cacheHits: number;
  cacheMisses: number;
  hitRate: string;
  endpoint: string;
}> {
  const client = getValkeyClient();
  const endpoint = VALKEY_URL.replace(/:\/\/[^@]*@/, "://***@");

  if (!client || !isConnected) {
    return {
      status: "disconnected",
      connected: false,
      latencyMs: null,
      keysCount: 0,
      memoryUsed: "0 B",
      cacheHits,
      cacheMisses,
      hitRate: cacheHits + cacheMisses > 0 ? `${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)}%` : "0%",
      endpoint
    };
  }

  try {
    const startStr = Date.now();
    await client.ping();
    const latencyMs = Date.now() - startStr;

    const info = await client.info("memory");
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1].trim() : "N/A";

    const dbSize = await client.dbsize();

    const totalOps = cacheHits + cacheMisses;
    const hitRate = totalOps > 0 ? `${((cacheHits / totalOps) * 100).toFixed(1)}%` : "0%";

    return {
      status: "connected",
      connected: true,
      latencyMs,
      keysCount: dbSize,
      memoryUsed,
      cacheHits,
      cacheMisses,
      hitRate,
      endpoint
    };
  } catch (e) {
    return {
      status: "disconnected",
      connected: false,
      latencyMs: null,
      keysCount: 0,
      memoryUsed: "0 B",
      cacheHits,
      cacheMisses,
      hitRate: "0%",
      endpoint
    };
  }
}

/**
 * Retrieves JSON cached value from Valkey.
 * If not present or Valkey is down, invokes the fetcher function, caches the result, and returns it.
 */
export async function getCachedJson<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  const client = getValkeyClient();

  if (client && isConnected) {
    try {
      const cachedVal = await client.get(key);
      if (cachedVal) {
        cacheHits++;
        return JSON.parse(cachedVal) as T;
      }
    } catch (err) {
      // If cache read fails, log and fallback to fetcher
    }
  }

  cacheMisses++;
  const freshData = await fetcher();

  if (client && isConnected && freshData !== undefined && freshData !== null) {
    try {
      await client.setex(key, ttlSeconds, JSON.stringify(freshData));
    } catch (err) {
      // Non-blocking set error
    }
  }

  return freshData;
}

/**
 * Explicitly set a key in Valkey
 */
export async function setValkeyKey(key: string, value: any, ttlSeconds = 300): Promise<void> {
  const client = getValkeyClient();
  if (!client || !isConnected) return;

  try {
    const val = typeof value === "string" ? value : JSON.stringify(value);
    await client.setex(key, ttlSeconds, val);
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Invalidate a specific cache key or matching pattern
 */
export async function invalidateValkeyKey(keyPattern: string): Promise<void> {
  const client = getValkeyClient();
  if (!client || !isConnected) return;

  try {
    if (keyPattern.includes("*")) {
      const keys = await client.keys(keyPattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } else {
      await client.del(keyPattern);
    }
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Helper to invalidate collection cache when records are written/updated
 */
export async function invalidateCollectionCache(collectionName: string): Promise<void> {
  await Promise.all([
    invalidateValkeyKey(`col:${collectionName}*`),
    invalidateValkeyKey("col:db-all"),
    invalidateValkeyKey("col:requisitions")
  ]);
}

/**
 * Flush all cached keys in Valkey
 */
export async function flushValkeyCache(): Promise<boolean> {
  const client = getValkeyClient();
  if (!client || !isConnected) return false;

  try {
    await client.flushdb();
    cacheHits = 0;
    cacheMisses = 0;
    return true;
  } catch (e) {
    return false;
  }
}

// Auto-initialize connection attempt on import
getValkeyClient();
