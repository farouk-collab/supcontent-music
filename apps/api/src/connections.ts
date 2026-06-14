import { Pool, type PoolConfig } from "pg";
import Redis from "ioredis";

function buildPoolConfig(): PoolConfig {
  const rawConnectionString = String(process.env.DATABASE_URL || "").trim();
  if (!rawConnectionString) return {};

  let connectionString = rawConnectionString;
  let ssl: PoolConfig["ssl"] | undefined;

  try {
    const parsed = new URL(rawConnectionString);
    const sslMode = String(parsed.searchParams.get("sslmode") || "").toLowerCase();
    const host = String(parsed.hostname || "").toLowerCase();
    const hostedPg =
      host.endsWith(".supabase.co") ||
      host.includes(".pooler.supabase.com") ||
      host.includes(".neon.tech");

    if (sslMode) {
      ssl =
        sslMode === "disable"
          ? false
          : hostedPg
            ? { rejectUnauthorized: false }
            : { rejectUnauthorized: sslMode === "verify-full" };
    } else if (hostedPg) {
      ssl = { rejectUnauthorized: false };
    }

    // node-postgres re-parses sslmode from the URL and can override the explicit ssl object.
    // Strip SSL query flags from the connection string once we've derived the intended behavior.
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("sslcert");
    parsed.searchParams.delete("sslkey");
    parsed.searchParams.delete("sslrootcert");
    parsed.searchParams.delete("sslcrl");
    connectionString = parsed.toString();
  } catch {
    // Fall back to the raw connection string if URL parsing fails.
  }

  return ssl === undefined ? { connectionString } : { connectionString, ssl };
}

export const pool = new Pool(buildPoolConfig());

function createNoopRedis() {
  return {
    on: () => {},
    async set() {
      return "OK";
    },
    async get() {
      return null;
    },
    async quit() {
      return;
    },
    disconnect() {
      return;
    },
  };
}

function isLocalRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
  } catch {
    return false;
  }
}

function createRedisClient(url: string) {
  let lastErrorLog = "";
  let lastErrorAt = 0;
  let closeLogged = false;

  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 3) {
        const now = Date.now();
        if (now - lastErrorAt > 15000 || lastErrorLog !== "retry-exhausted") {
          lastErrorAt = now;
          lastErrorLog = "retry-exhausted";
          console.warn("[redis] retries exhausted, Redis cache will stay degraded until the next command succeeds");
        }
        return null;
      }
      return Math.min(times * 250, 1000);
    },
    reconnectOnError() {
      return false;
    },
  });

  client.on("connect", () => {
    closeLogged = false;
  });

  client.on("ready", () => {
    closeLogged = false;
    lastErrorLog = "";
    lastErrorAt = 0;
  });

  client.on("close", () => {
    if (closeLogged) return;
    closeLogged = true;
    console.warn("[redis] connection closed");
  });

  client.on("error", (err: any) => {
    const message = String(err?.message || err || "unknown redis error");
    const now = Date.now();
    if (message === lastErrorLog && now - lastErrorAt < 15000) return;
    lastErrorLog = message;
    lastErrorAt = now;
    console.warn(`[redis] ${message}`);
  });

  client.connect().catch((err: any) => {
    const message = String(err?.message || err || "initial redis connect failed");
    lastErrorLog = message;
    lastErrorAt = Date.now();
    console.warn(`[redis] initial connect failed: ${message}`);
  });

  return client;
}

let _redis: any = null;
const redisUrl = String(process.env.REDIS_URL || "").trim();
const runningOnRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
const redisDisabledByEnv = ["1", "true", "yes", "on"].includes(String(process.env.REDIS_DISABLED || process.env.DISABLE_REDIS || "").trim().toLowerCase());
const shouldDisableRedis = redisDisabledByEnv || !redisUrl || (runningOnRender && isLocalRedisUrl(redisUrl));

if (!shouldDisableRedis) {
  _redis = createRedisClient(redisUrl);
} else {
  if (redisDisabledByEnv) {
    console.warn("Redis disabled by env flag - using noop redis shim");
  } else if (!redisUrl) {
    console.warn("REDIS_URL not set - using noop redis shim");
  } else if (runningOnRender) {
    console.warn("REDIS_URL points to localhost on Render - using noop redis shim");
  }
  _redis = createNoopRedis();
}

export const redis = _redis;
