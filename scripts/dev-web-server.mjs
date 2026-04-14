import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "apps", "web", "public");
const configPath = path.resolve(__dirname, "..", "serve.json");
const port = 4173;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
};

const defaultHeaders = {
  "Cache-Control": "no-cache",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function existingServerLooksHealthy() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/accueil/accueil.html`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function normalizePathname(urlPath) {
  try {
    return decodeURIComponent(String(urlPath || "/").split("?")[0]);
  } catch {
    return "/";
  }
}

function isSafeSubpath(base, target) {
  const rel = path.relative(base, target);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function loadConfig() {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const cleanHeaders = Array.isArray(parsed?.headers) ? parsed.headers : [];
    return {
      rewrites: Array.isArray(parsed?.rewrites) ? parsed.rewrites : [],
      headers: cleanHeaders,
    };
  } catch {
    return { rewrites: [], headers: [] };
  }
}

function resolveRewrite(pathname, rewrites) {
  const direct = rewrites.find((entry) => String(entry?.source || "") === pathname);
  if (direct?.destination) return String(direct.destination);
  const catchAll = rewrites.find((entry) => String(entry?.source || "") === "/**");
  return catchAll?.destination ? String(catchAll.destination) : pathname;
}

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function applyHeaderRules(response, pathname, rules) {
  for (const rule of rules) {
    if (String(rule?.source || "") !== pathname) continue;
    const headers = Array.isArray(rule?.headers) ? rule.headers : [];
    for (const header of headers) {
      if (!header?.key) continue;
      response.setHeader(String(header.key), String(header.value ?? ""));
    }
  }
}

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...defaultHeaders });
  response.end("Not found");
}

const config = await loadConfig();

const server = http.createServer((request, response) => {
  const pathname = normalizePathname(request.url || "/");
  const effectivePath = pathname === "/" ? "/index.html" : pathname;
  const initialTarget = path.resolve(rootDir, `.${effectivePath}`);

  let filePath = initialTarget;
  if (!existsSync(filePath) || (existsSync(filePath) && statSync(filePath).isDirectory())) {
    const rewritten = resolveRewrite(pathname, config.rewrites);
    filePath = path.resolve(rootDir, `.${rewritten}`);
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    sendNotFound(response);
    return;
  }

  const rel = path.relative(rootDir, filePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    sendNotFound(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentType(filePath),
    ...defaultHeaders,
  });
  applyHeaderRules(response, pathname, config.headers);

  createReadStream(filePath).pipe(response);
});

server.on("error", async (error) => {
  if (error?.code !== "EADDRINUSE") {
    throw error;
  }

  const healthy = await existingServerLooksHealthy();
  if (!healthy) {
    console.error(`port ${port} is already in use, but no healthy web server answered on it`);
    process.exit(1);
  }

  console.log(`supcontent web server already running on http://127.0.0.1:${port} - reusing existing instance`);
  // Keep this process alive so `npm run dev` stays stable under concurrently.
  // The active server keeps serving; this process simply acts as a holder.
  for (;;) {
    await sleep(60_000);
  }
});

server.listen(port, () => {
  console.log(`supcontent web server running on http://127.0.0.1:${port}`);
});
