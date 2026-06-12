import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";

process.env.NODE_ENV = "test";
process.env.REDIS_DISABLED = "1";
process.env.SUPCONTENT_SKIP_INIT = "1";
process.env.DATABASE_URL ||= "postgres://supcontent:supcontent@127.0.0.1:5432/supcontent";

const require = createRequire(import.meta.url);
const { startServer } = require("../../apps/api/dist/index.js");
const { pool, redis } = require("../../apps/api/dist/connections.js");

let server;
let baseUrl = "";

before(async () => {
  server = startServer(0);
  await once(server, "listening");
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  await pool.end().catch(() => {});
  if (typeof redis?.quit === "function") await redis.quit().catch(() => {});
});

test("health endpoint returns ok", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("openapi endpoint exposes core auth routes", async () => {
  const response = await fetch(`${baseUrl}/openapi.json`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.openapi, "3.0.3");
  assert.ok(payload.paths["/auth/login"]);
  assert.ok(payload.paths["/search-hub/imports"]);
});
