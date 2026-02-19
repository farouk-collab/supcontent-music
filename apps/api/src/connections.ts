import { Pool } from "pg";
import Redis from "ioredis";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let _redis: any = null;
if (process.env.REDIS_URL) {
	_redis = new Redis(process.env.REDIS_URL);
	_redis.on("error", (err: any) => {
		console.error("[ioredis] Unhandled error event:", err?.message ?? err);
	});
} else {
	console.warn("REDIS_URL not set — using noop redis shim");
	_redis = {
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

export const redis = _redis;
