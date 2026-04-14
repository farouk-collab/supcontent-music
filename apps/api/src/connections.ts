import { Pool } from "pg";
import Redis from "ioredis";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
