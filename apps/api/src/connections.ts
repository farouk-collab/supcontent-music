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

let _redis: any = null;
const redisUrl = String(process.env.REDIS_URL || "").trim();
const runningOnRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
const shouldDisableRedis = !redisUrl || (runningOnRender && isLocalRedisUrl(redisUrl));

if (!shouldDisableRedis) {
  _redis = new Redis(redisUrl);
  _redis.on("error", (err: any) => {
    console.error("[ioredis] Unhandled error event:", err?.message ?? err);
  });
} else {
  if (!redisUrl) {
    console.warn("REDIS_URL not set - using noop redis shim");
  } else if (runningOnRender) {
    console.warn("REDIS_URL points to localhost on Render - using noop redis shim");
  }
  _redis = createNoopRedis();
}

export const redis = _redis;
