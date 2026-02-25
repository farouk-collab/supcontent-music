import express from "express";
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

import { pool, redis } from "./connections";
import { ensureCollectionsTables } from "./db/collections";
import { ensureSocialTables } from "./db/social";
import { ensureFollowTables } from "./db/follows";
import { ensureSpotifyLinksTable, getSpotifyLinkByUserId, upsertSpotifyLink } from "./db/spotifyLinks";
import { ensurePasswordResetTable } from "./db/passwordResets";
import {
  spotifyGet,
  spotifyNewReleases,
  spotifySearch,
  refreshSpotifyUserAccessToken,
  spotifyUserGet,
} from "./services";
import authRoutes from "./routes/auth";
import collectionsRoutes from "./routes/collections";
import usersRoutes from "./routes/users";
import uploadRoutes from "./routes/uploads";
import socialRoutes from "./routes/social";
import followsRoutes from "./routes/follows";
import feedRoutes from "./routes/feed";
import notificationsRoutes from "./routes/notifications";
import { AuthedRequest, requireAuth } from "./middleware/requireAuth";

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://i.scdn.co", "https://mosaic.scdn.co"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "https:", "'unsafe-inline'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

type Method = "get" | "post" | "put" | "patch" | "delete";
type EndpointDef = { method: Method; path: string; tag: string; auth?: boolean; summary?: string };

const endpointCatalog: EndpointDef[] = [
  { method: "get", path: "/", tag: "System", summary: "Service info" },
  { method: "get", path: "/health", tag: "System", summary: "Health check" },
  { method: "get", path: "/env-check", tag: "System", summary: "Environment flags" },
  { method: "get", path: "/db-test", tag: "System", summary: "Database connectivity test" },
  { method: "get", path: "/redis-test", tag: "System", summary: "Redis connectivity test" },
  { method: "get", path: "/search", tag: "System", summary: "Spotify search proxy" },
  { method: "get", path: "/auth/ping", tag: "Auth" },
  { method: "get", path: "/auth/oauth/github/start", tag: "Auth" },
  { method: "get", path: "/auth/oauth/github/callback", tag: "Auth" },
  { method: "get", path: "/auth/oauth/google/start", tag: "Auth" },
  { method: "get", path: "/auth/oauth/google/callback", tag: "Auth" },
  { method: "get", path: "/auth/oauth/spotify/url", tag: "Auth", auth: true },
  { method: "get", path: "/auth/oauth/spotify/callback", tag: "Auth" },
  { method: "get", path: "/auth/spotify/status", tag: "Auth", auth: true },
  { method: "post", path: "/auth/register", tag: "Auth" },
  { method: "post", path: "/auth/login", tag: "Auth" },
  { method: "post", path: "/auth/password/forgot", tag: "Auth" },
  { method: "post", path: "/auth/password/reset", tag: "Auth" },
  { method: "post", path: "/auth/refresh", tag: "Auth" },
  { method: "post", path: "/auth/logout", tag: "Auth" },
  { method: "get", path: "/auth/me", tag: "Auth", auth: true },
  { method: "patch", path: "/auth/me", tag: "Auth", auth: true },
  { method: "delete", path: "/auth/me", tag: "Auth", auth: true },
  { method: "post", path: "/auth/upload/{kind}", tag: "Auth", auth: true },
  { method: "get", path: "/users/search", tag: "Users" },
  { method: "patch", path: "/users/me", tag: "Users", auth: true },
  { method: "get", path: "/collections/me", tag: "Collections", auth: true },
  { method: "post", path: "/collections", tag: "Collections", auth: true },
  { method: "patch", path: "/collections/{id}", tag: "Collections", auth: true },
  { method: "delete", path: "/collections/{id}", tag: "Collections", auth: true },
  { method: "post", path: "/collections/{id}/items", tag: "Collections", auth: true },
  { method: "delete", path: "/collections/{id}/items/{mediaType}/{mediaId}", tag: "Collections", auth: true },
  { method: "post", path: "/collections/status/{status}/items", tag: "Collections", auth: true },
  { method: "post", path: "/collections/init", tag: "Collections" },
  { method: "post", path: "/upload/avatar", tag: "Upload", auth: true },
  { method: "post", path: "/upload/cover", tag: "Upload", auth: true },
  { method: "post", path: "/upload/social", tag: "Upload", auth: true },
  { method: "get", path: "/social/media/{mediaType}/{mediaId}", tag: "Social" },
  { method: "post", path: "/social/media/{mediaType}/{mediaId}/reviews", tag: "Social", auth: true },
  { method: "post", path: "/social/reviews/{reviewId}/like", tag: "Social", auth: true },
  { method: "delete", path: "/social/reviews/{reviewId}/like", tag: "Social", auth: true },
  { method: "post", path: "/social/reviews/{reviewId}/vote", tag: "Social", auth: true },
  { method: "delete", path: "/social/reviews/{reviewId}/vote", tag: "Social", auth: true },
  { method: "post", path: "/social/reviews/{reviewId}/comments", tag: "Social", auth: true },
  { method: "patch", path: "/social/reviews/{reviewId}", tag: "Social", auth: true },
  { method: "delete", path: "/social/reviews/{reviewId}", tag: "Social", auth: true },
  { method: "patch", path: "/social/comments/{commentId}", tag: "Social", auth: true },
  { method: "post", path: "/social/comments/{commentId}/vote", tag: "Social", auth: true },
  { method: "delete", path: "/social/comments/{commentId}/vote", tag: "Social", auth: true },
  { method: "delete", path: "/social/comments/{commentId}", tag: "Social", auth: true },
  { method: "get", path: "/follows/settings/me", tag: "Follows", auth: true },
  { method: "put", path: "/follows/settings/me", tag: "Follows", auth: true },
  { method: "get", path: "/follows/settings/blocked", tag: "Follows", auth: true },
  { method: "post", path: "/follows/settings/blocked/{targetUserId}", tag: "Follows", auth: true },
  { method: "delete", path: "/follows/settings/blocked/{targetUserId}", tag: "Follows", auth: true },
  { method: "get", path: "/follows/swipe/preferences", tag: "Follows", auth: true },
  { method: "put", path: "/follows/swipe/preferences", tag: "Follows", auth: true },
  { method: "get", path: "/follows/swipe/profiles", tag: "Follows", auth: true },
  { method: "post", path: "/follows/swipe/profiles/{targetUserId}", tag: "Follows", auth: true },
  { method: "get", path: "/follows/swipe/music", tag: "Follows", auth: true },
  { method: "post", path: "/follows/swipe/music", tag: "Follows", auth: true },
  { method: "get", path: "/follows/swipe/invitations/me", tag: "Follows", auth: true },
  { method: "get", path: "/follows/can-chat/{targetUserId}", tag: "Follows", auth: true },
  { method: "post", path: "/follows/{targetUserId}", tag: "Follows", auth: true },
  { method: "delete", path: "/follows/{targetUserId}", tag: "Follows", auth: true },
  { method: "get", path: "/follows/me", tag: "Follows", auth: true },
  { method: "get", path: "/follows/users/{userId}", tag: "Follows" },
  { method: "get", path: "/feed/me", tag: "Feed", auth: true },
  { method: "get", path: "/notifications/me", tag: "Notifications", auth: true },
];

const buildOpenApiSpec = (baseUrl: string) => {
  const paths: Record<string, any> = {};
  for (const ep of endpointCatalog) {
    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][ep.method] = {
      tags: [ep.tag],
      summary: ep.summary || `${ep.method.toUpperCase()} ${ep.path}`,
      security: ep.auth ? [{ bearerAuth: [] }] : undefined,
      responses: {
        "200": { description: "OK" },
        "400": { description: "Bad request" },
        "401": { description: "Unauthorized" },
        "500": { description: "Server error" },
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Supcontent API",
      version: "1.0.0",
      description: "API documentation for Supcontent music backend.",
    },
    servers: [{ url: baseUrl }],
    tags: [
      { name: "System" },
      { name: "Auth" },
      { name: "Users" },
      { name: "Collections" },
      { name: "Social" },
      { name: "Follows" },
      { name: "Feed" },
      { name: "Notifications" },
      { name: "Upload" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    paths,
  };
};

/* ======================
   API ROUTES
====================== */
app.use("/auth", authRoutes);
app.use("/collections", collectionsRoutes);
app.use("/users", usersRoutes);
app.use("/upload", uploadRoutes);
app.use("/social", socialRoutes);
app.use("/follows", followsRoutes);
app.use("/feed", feedRoutes);
app.use("/notifications", notificationsRoutes);

app.get("/openapi.json", (req, res) => {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https");
  const host = String(req.headers["x-forwarded-host"] || req.get("host") || "");
  const baseUrl = host ? `${proto}://${host}` : "";
  return res.json(buildOpenApiSpec(baseUrl));
});

app.get("/docs", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Supcontent API Docs</title>
    <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
  </head>
  <body style="margin:0;background:#111;">
    <rapi-doc
      spec-url="/openapi.json"
      theme="dark"
      render-style="read"
      show-header="true"
      allow-try="false"
      sort-tags="true"
      sort-endpoints-by="method"
    ></rapi-doc>
  </body>
</html>`);
});

app.get("/swagger", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Supcontent Swagger UI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body, #swagger-ui { height: 100%; margin: 0; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
      });
    </script>
  </body>
</html>`);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/env-check", (_req, res) => {
  res.json({
    spotifyClientIdLoaded: Boolean(process.env.SPOTIFY_CLIENT_ID),
    spotifyClientSecretLoaded: Boolean(process.env.SPOTIFY_CLIENT_SECRET),
    databaseUrlLoaded: Boolean(process.env.DATABASE_URL),
    redisUrlLoaded: Boolean(process.env.REDIS_URL),
    jwtAccessLoaded: Boolean(process.env.JWT_ACCESS_SECRET),
    jwtRefreshLoaded: Boolean(process.env.JWT_REFRESH_SECRET),
  });
});

app.get("/db-test", async (_req, res) => {
  try {
    const r = await pool.query("SELECT NOW() as now");
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error("DB error:", e?.message);
    res.status(500).json({ error: "DB connection failed" });
  }
});

app.get("/redis-test", async (_req, res) => {
  try {
    await redis.set("ping", "pong", "EX", 30);
    res.json({ ping: await redis.get("ping") });
  } catch (e: any) {
    console.error("Redis error:", e?.message);
    res.status(500).json({ error: "Redis connection failed" });
  }
});

app.get("/search", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const SPOTIFY_SEARCH_MAX_LIMIT = 10;
    const q = String(req.query.q ?? "").trim();
    const type = String(req.query.type ?? "track").trim() as "track" | "album" | "artist";

    const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

    const pageNum = Number.parseInt(String(pageRaw ?? "1"), 10);
    const limitNum = Number.parseInt(String(limitRaw ?? "20"), 10);

    const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
    const limit = Number.isFinite(limitNum)
      ? Math.min(SPOTIFY_SEARCH_MAX_LIMIT, Math.max(1, limitNum))
      : SPOTIFY_SEARCH_MAX_LIMIT;

    if (!q) return res.status(400).json({ erreur: "Le paramètre 'q' est requis" });
    if (!["track", "album", "artist"].includes(type)) {
      return res.status(400).json({ erreur: "Le paramètre 'type' doit être track|album|artist" });
    }

    // Ensure integers and safe ranges before calling Spotify
    const safeLimit = Math.trunc(Number(limit) || SPOTIFY_SEARCH_MAX_LIMIT);
    const finalLimit = Math.max(1, Math.min(SPOTIFY_SEARCH_MAX_LIMIT, safeLimit));
    const finalOffset = Math.max(0, Math.trunc(Number((page - 1) * finalLimit) || 0));
    const qNorm = q.toLowerCase();
    const queryBucket = qNorm.includes("rap")
      ? "rap"
      : qNorm.includes("afro")
        ? "afro"
        : qNorm.includes("pop")
          ? "pop"
          : qNorm.includes("top")
            ? "top"
            : "generic";
    const cacheKey = `search:v4:${type}:${q.toLowerCase()}:${finalLimit}:${finalOffset}`;
    const queryFallbackKey = `search:v4:fallback:${type}:${queryBucket}`;

    console.log("🎯 /search final params:", { q, type, limit: finalLimit, offset: finalOffset, page });

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        res.setHeader("X-Cache", "HIT");
        return res.json(parsed);
      }
    } catch (cacheErr: any) {
      console.warn("Search cache read failed:", cacheErr?.message || cacheErr);
    }

    try {
      const data = await spotifySearch({ q, type, limit: finalLimit, offset: finalOffset });
      try {
        await redis.set(cacheKey, JSON.stringify(data), "EX", 300);
        await redis.set(queryFallbackKey, JSON.stringify(data), "EX", 900);
      } catch (cacheErr: any) {
        console.warn("Search cache write failed:", cacheErr?.message || cacheErr);
      }
      res.setHeader("X-Cache", "MISS");
      return res.json(data);
    } catch (e: any) {
      const statusCode = e?.status ?? e?.response?.status ?? null;
      const errData = e?.data ?? e?.response?.data ?? null;
      const errMessage =
        (errData && (errData.error?.message || errData.message)) || e?.message || "";
      if (statusCode === 400 && String(errMessage).includes("Invalid limit")) {
        console.warn("Spotify returned Invalid limit — retrying with smaller limit=10");
        const fallback = await spotifySearch({ q, type, limit: 10, offset: 0 });
        try {
          await redis.set(cacheKey, JSON.stringify(fallback), "EX", 300);
          await redis.set(queryFallbackKey, JSON.stringify(fallback), "EX", 900);
        } catch (cacheErr: any) {
          console.warn("Search cache write failed:", cacheErr?.message || cacheErr);
        }
        res.setHeader("X-Cache", "MISS");
        return res.json(fallback);
      }
      if (statusCode === 429) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            res.setHeader("X-Cache", "STALE");
            return res.json(parsed);
          }
        } catch (cacheErr: any) {
          console.warn("Search cache fallback read failed:", cacheErr?.message || cacheErr);
        }
        try {
          const queryFallback = await redis.get(queryFallbackKey);
          if (queryFallback) {
            const parsed = JSON.parse(queryFallback);
            res.setHeader("X-Cache", "FALLBACK");
            return res.json(parsed);
          }
        } catch (cacheErr: any) {
          console.warn("Search query fallback read failed:", cacheErr?.message || cacheErr);
        }

        const cannedByBucket: Record<string, any[]> = {
          top: [
            { id: "0VjIjW4GlUZAMYd2vXMi3b", name: "Blinding Lights", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "The Weeknd" }], external_urls: { spotify: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b" } },
            { id: "7MXVkk9YMctZqd1Srtv4MB", name: "Starboy", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "The Weeknd" }], external_urls: { spotify: "https://open.spotify.com/track/7MXVkk9YMctZqd1Srtv4MB" } },
            { id: "463CkQjx2Zk1yXoBuierM9", name: "Levitating", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Dua Lipa" }], external_urls: { spotify: "https://open.spotify.com/track/463CkQjx2Zk1yXoBuierM9" } },
            { id: "4LRPiXqCikLlN15c3yImP7", name: "As It Was", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Harry Styles" }], external_urls: { spotify: "https://open.spotify.com/track/4LRPiXqCikLlN15c3yImP7" } },
            { id: "3PfIrDoz19wz7qK7tYeu62", name: "Don't Start Now", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Dua Lipa" }], external_urls: { spotify: "https://open.spotify.com/track/3PfIrDoz19wz7qK7tYeu62" } },
            { id: "37BZB0z9T8Xu7U3e65qxFy", name: "Save Your Tears", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "The Weeknd" }], external_urls: { spotify: "https://open.spotify.com/track/37BZB0z9T8Xu7U3e65qxFy" } },
            { id: "0yLdNVWF3Srea0uzk55zFn", name: "Flowers", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Miley Cyrus" }], external_urls: { spotify: "https://open.spotify.com/track/0yLdNVWF3Srea0uzk55zFn" } },
            { id: "6UelLqGlWMcVH1E5c4H7lY", name: "Watermelon Sugar", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Harry Styles" }], external_urls: { spotify: "https://open.spotify.com/track/6UelLqGlWMcVH1E5c4H7lY" } },
          ],
          rap: [
            { id: "7GX5flRQZVHRAGd6B4TmDO", name: "XO TOUR Llif3", type: "track", images: [], artists: [{ name: "Lil Uzi Vert" }], external_urls: { spotify: "https://open.spotify.com/track/7GX5flRQZVHRAGd6B4TmDO" } },
            { id: "6DCZcSspjsKoFjzjrWoCdn", name: "God's Plan", type: "track", images: [], artists: [{ name: "Drake" }], external_urls: { spotify: "https://open.spotify.com/track/6DCZcSspjsKoFjzjrWoCdn" } },
            { id: "2xLMifQCjDGFmkHkpNLD9h", name: "SICKO MODE", type: "track", images: [], artists: [{ name: "Travis Scott" }], external_urls: { spotify: "https://open.spotify.com/track/2xLMifQCjDGFmkHkpNLD9h" } },
            { id: "7KXjTSCq5nL1LoYtL7XAwS", name: "HUMBLE.", type: "track", images: [], artists: [{ name: "Kendrick Lamar" }], external_urls: { spotify: "https://open.spotify.com/track/7KXjTSCq5nL1LoYtL7XAwS" } },
            { id: "5uCax9HTNlzGybIStD3vDh", name: "Lucid Dreams", type: "track", images: [], artists: [{ name: "Juice WRLD" }], external_urls: { spotify: "https://open.spotify.com/track/5uCax9HTNlzGybIStD3vDh" } },
            { id: "3e9HZxeyfWwjeyPAMmWSSQ", name: "Money Trees", type: "track", images: [], artists: [{ name: "Kendrick Lamar" }], external_urls: { spotify: "https://open.spotify.com/track/3e9HZxeyfWwjeyPAMmWSSQ" } },
            { id: "0SGkqnVQo9KPytSri1H6cF", name: "SAD!", type: "track", images: [], artists: [{ name: "XXXTENTACION" }], external_urls: { spotify: "https://open.spotify.com/track/0SGkqnVQo9KPytSri1H6cF" } },
            { id: "3a1lNhkSLSkpJE4MSHpDu9", name: "Congratulations", type: "track", images: [], artists: [{ name: "Post Malone" }], external_urls: { spotify: "https://open.spotify.com/track/3a1lNhkSLSkpJE4MSHpDu9" } },
          ],
          afro: [
            { id: "2XU0oxnq2qxCpomAAuJY8K", name: "Calm Down", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Rema" }], external_urls: { spotify: "https://open.spotify.com/track/2XU0oxnq2qxCpomAAuJY8K" } },
            { id: "5FG7Tl93LdH117jEKYl3Cm", name: "Essence", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Wizkid" }], external_urls: { spotify: "https://open.spotify.com/track/5FG7Tl93LdH117jEKYl3Cm" } },
            { id: "1XKkZY6C4L5gv4x9x6eDdz", name: "Love Nwantiti (Ah Ah Ah)", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "CKay" }], external_urls: { spotify: "https://open.spotify.com/track/1XKkZY6C4L5gv4x9x6eDdz" } },
            { id: "1vYXt7VSjH9JIM5oRRo7vA", name: "Last Last", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Burna Boy" }], external_urls: { spotify: "https://open.spotify.com/track/1vYXt7VSjH9JIM5oRRo7vA" } },
            { id: "6I6fQvA9v4xR6f9h4QYk2E", name: "Rush", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Ayra Starr" }], external_urls: { spotify: "https://open.spotify.com/track/6I6fQvA9v4xR6f9h4QYk2E" } },
            { id: "4fSIb4hdOQ151TILNsSEaF", name: "Peru", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Fireboy DML, Ed Sheeran" }], external_urls: { spotify: "https://open.spotify.com/track/4fSIb4hdOQ151TILNsSEaF" } },
            { id: "6ylDpki1VpIsc525KC1ojF", name: "Soweto", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Victony, Rema, Tempoe, Don Toliver" }], external_urls: { spotify: "https://open.spotify.com/track/6ylDpki1VpIsc525KC1ojF" } },
            { id: "4g6x2mH3c2yh2d7wD5RSLM", name: "Bloody Samaritan", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Ayra Starr" }], external_urls: { spotify: "https://open.spotify.com/track/4g6x2mH3c2yh2d7wD5RSLM" } },
          ],
          pop: [
            { id: "0VjIjW4GlUZAMYd2vXMi3b", name: "Blinding Lights", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "The Weeknd" }], external_urls: { spotify: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b" } },
            { id: "463CkQjx2Zk1yXoBuierM9", name: "Levitating", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Dua Lipa" }], external_urls: { spotify: "https://open.spotify.com/track/463CkQjx2Zk1yXoBuierM9" } },
            { id: "4LRPiXqCikLlN15c3yImP7", name: "As It Was", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Harry Styles" }], external_urls: { spotify: "https://open.spotify.com/track/4LRPiXqCikLlN15c3yImP7" } },
            { id: "3PfIrDoz19wz7qK7tYeu62", name: "Don't Start Now", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Dua Lipa" }], external_urls: { spotify: "https://open.spotify.com/track/3PfIrDoz19wz7qK7tYeu62" } },
            { id: "37BZB0z9T8Xu7U3e65qxFy", name: "Save Your Tears", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "The Weeknd" }], external_urls: { spotify: "https://open.spotify.com/track/37BZB0z9T8Xu7U3e65qxFy" } },
            { id: "6UelLqGlWMcVH1E5c4H7lY", name: "Watermelon Sugar", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Harry Styles" }], external_urls: { spotify: "https://open.spotify.com/track/6UelLqGlWMcVH1E5c4H7lY" } },
            { id: "1BxfuPKGuaTgP7aM0Bbdwr", name: "Cruel Summer", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Taylor Swift" }], external_urls: { spotify: "https://open.spotify.com/track/1BxfuPKGuaTgP7aM0Bbdwr" } },
            { id: "4ZtFanR9U6ndgddUvNcjcG", name: "good 4 u", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Olivia Rodrigo" }], external_urls: { spotify: "https://open.spotify.com/track/4ZtFanR9U6ndgddUvNcjcG" } },
          ],
          generic: [
            { id: "2takcwOaAZWiXQijPHIx7B", name: "Can't Hold Us", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Macklemore" }], external_urls: { spotify: "https://open.spotify.com/track/2takcwOaAZWiXQijPHIx7B" } },
            { id: "0VjIjW4GlUZAMYd2vXMi3b", name: "Blinding Lights", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "The Weeknd" }], external_urls: { spotify: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b" } },
            { id: "68Dni7IE4VyPkTOH9mRWHr", name: "No Role Modelz", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "J. Cole" }], external_urls: { spotify: "https://open.spotify.com/track/68Dni7IE4VyPkTOH9mRWHr" } },
            { id: "2XU0oxnq2qxCpomAAuJY8K", name: "Calm Down", type: "track", images: [{ url: "https://i.scdn.co/image/ab67616d0000b273a3eff72f62782fb589a492f9" }], artists: [{ name: "Rema" }], external_urls: { spotify: "https://open.spotify.com/track/2XU0oxnq2qxCpomAAuJY8K" } },
          ],
        };

        const canned = cannedByBucket[queryBucket] || cannedByBucket.generic;
        const mergePlan: Record<string, string[]> = {
          top: ["top"],
          pop: ["pop"],
          rap: ["rap"],
          afro: ["afro"],
          generic: ["generic", "top", "pop", "rap", "afro"],
        };
        const orderedBuckets = mergePlan[queryBucket] || mergePlan.generic;
        const mergedPool = orderedBuckets.flatMap((bucketName) => cannedByBucket[bucketName] || []);
        const dedupedPool: any[] = [];
        const seenIds = new Set<string>();
        for (const it of mergedPool) {
          const id = String(it?.id || "").trim();
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);
          dedupedPool.push(it);
        }
        const sourcePool = dedupedPool.length ? dedupedPool : canned;
        const windowedSeed = sourcePool.slice(finalOffset, finalOffset + finalLimit);
        const windowed: any[] = [];
        let stopEnrichment = false;
        for (const it of windowedSeed) {
          if (stopEnrichment) {
            const oembed = await fetchSpotifyOEmbedImage(String(it?.external_urls?.spotify || ""));
            if (oembed) {
              windowed.push({
                ...it,
                images: [{ url: oembed }],
              });
            } else {
              windowed.push(it);
            }
            continue;
          }
          const mediaId = String(it?.id || "").trim();
          if (!mediaId) {
            windowed.push(it);
            continue;
          }
          try {
            const raw: any = await spotifyGet(type, mediaId);
            const image =
              String(raw?.images?.[0]?.url || "") ||
              String(raw?.album?.images?.[0]?.url || "");
            const artists = Array.isArray(raw?.artists)
              ? raw.artists.map((a: any) => ({ name: String(a?.name || "") })).filter((a: any) => a.name)
              : Array.isArray(it?.artists)
                ? it.artists
                : [];
            windowed.push({
              ...it,
              id: String(raw?.id || mediaId),
              name: String(raw?.name || it?.name || ""),
              type: String(raw?.type || it?.type || type),
              images: image ? [{ url: image }] : Array.isArray(it?.images) ? it.images : [],
              artists,
              external_urls: raw?.external_urls || it?.external_urls || {},
            });
          } catch (enrichErr: any) {
            if ((enrichErr?.status ?? enrichErr?.response?.status) === 429) {
              stopEnrichment = true;
            }
            const oembed = await fetchSpotifyOEmbedImage(String(it?.external_urls?.spotify || ""));
            if (oembed) {
              windowed.push({
                ...it,
                images: [{ url: oembed }],
              });
            } else {
              windowed.push(it);
            }
          }
        }
        const degradedBucket = {
          href: "",
          items: windowed,
          limit: finalLimit,
          next: null,
          offset: finalOffset,
          previous: null,
          total: sourcePool.length,
        };
        const degraded =
          type === "album"
            ? { albums: degradedBucket, degraded: true, degraded_reason: "spotify_rate_limited" }
            : type === "artist"
              ? { artists: degradedBucket, degraded: true, degraded_reason: "spotify_rate_limited" }
              : { tracks: degradedBucket, degraded: true, degraded_reason: "spotify_rate_limited" };
        res.setHeader("X-Cache", "EMPTY-FALLBACK");
        return res.status(200).json(degraded);
      }
      throw e;
    }
  } catch (e: any) {
    console.error(
      "Spotify /search error:",
      e?.status ?? e?.response?.status,
      e?.data ?? e?.response?.data ?? e?.message
    );
    const statusCode = e?.status ?? e?.response?.status ?? 500;
    return res.status(statusCode).json({
      erreur: "échec de la recherche Spotify",
      status: e?.status ?? e?.response?.status ?? null,
      details: e?.data ?? e?.response?.data ?? e?.message ?? null,
    });
  }
});

app.get("/media/:type/:id", async (req, res) => {
  try {
    const type = String(req.params.type).trim() as "track" | "album" | "artist";
    const id = String(req.params.id || "").trim();
    const forceRefresh = String(req.query.refresh || "").trim() === "1";

    if (!["track", "album", "artist"].includes(type)) {
      return res.status(400).json({ erreur: "Le paramètre 'type' doit être track|album|artist" });
    }

    const cacheKey = `media:v1:${type}:${id}`;
    if (!forceRefresh) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          res.setHeader("X-Cache", "HIT");
          return res.json(JSON.parse(cached));
        }
      } catch (cacheErr: any) {
        console.warn("Media cache read failed:", cacheErr?.message || cacheErr);
      }
    }

    const data = await spotifyGet(type, id);
    try {
      await redis.set(cacheKey, JSON.stringify(data), "EX", 900);
    } catch (cacheErr: any) {
      console.warn("Media cache write failed:", cacheErr?.message || cacheErr);
    }
    res.setHeader("X-Cache", "MISS");
    return res.json(data);
  } catch (e: any) {
    const type = String(req.params.type || "").trim();
    const id = String(req.params.id || "").trim();
    const statusCode = e?.status ?? e?.response?.status ?? 500;
    if (statusCode === 429 && ["track", "album", "artist"].includes(type) && id) {
      const cacheKey = `media:v1:${type}:${id}`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          res.setHeader("X-Cache", "STALE");
          return res.status(200).json(JSON.parse(cached));
        }
      } catch (cacheErr: any) {
        console.warn("Media stale cache read failed:", cacheErr?.message || cacheErr);
      }
      const spotifyUrl = `https://open.spotify.com/${type}/${encodeURIComponent(id)}`;
      const oembed = await fetchSpotifyOEmbedDetails(spotifyUrl);
      if (oembed.title || oembed.author) {
        try {
          const typedQueryParts: string[] = [];
          if (oembed.title) typedQueryParts.push(`track:${oembed.title}`);
          if (oembed.author) typedQueryParts.push(`artist:${oembed.author}`);
          const typedQuery = typedQueryParts.join(" ").trim();
          const plainQuery = `${oembed.title} ${oembed.author}`.trim();
          const query = typedQuery || plainQuery || id;
          const recovered: any = await spotifySearch({ q: query, type: type as "track" | "album" | "artist", limit: 8, offset: 0 });
          const items = pickSearchItemsByType(recovered, type as "track" | "album" | "artist");
          const wantedId = normalizeLooseText(id);
          const wantedTitle = normalizeLooseText(oembed.title);
          const wantedAuthor = normalizeLooseText(oembed.author);

          const ranked = items
            .map((it: any) => {
              const itemId = normalizeLooseText(String(it?.id || ""));
              const itemName = normalizeLooseText(String(it?.name || ""));
              const itemArtists = normalizeLooseText(
                Array.isArray(it?.artists) ? it.artists.map((a: any) => String(a?.name || "")).join(" ") : ""
              );
              let score = 0;
              if (itemId && wantedId && itemId === wantedId) score += 10;
              if (wantedTitle && itemName && (itemName.includes(wantedTitle) || wantedTitle.includes(itemName))) score += 4;
              if (wantedAuthor && itemArtists && (itemArtists.includes(wantedAuthor) || wantedAuthor.includes(itemArtists))) score += 3;
              return { it, score };
            })
            .sort((a: any, b: any) => b.score - a.score);

          const best = ranked[0]?.it || null;
          if (best) {
            const payload = { ...best, degraded: true, degraded_reason: "spotify_rate_limited_search_recovery" };
            try {
              await redis.set(cacheKey, JSON.stringify(payload), "EX", 900);
            } catch {
              // noop
            }
            res.setHeader("X-Cache", "SEARCH-FALLBACK");
            return res.status(200).json(payload);
          }
        } catch {
          // noop
        }
      }
      if (oembed.image) {
        res.setHeader("X-Cache", "OEMBED-FALLBACK");
        return res.status(200).json({
          id,
          type,
          name: oembed.title || id,
          artists: oembed.author ? [{ name: oembed.author }] : [],
          album: { images: [{ url: oembed.image }] },
          images: [{ url: oembed.image }],
          external_urls: { spotify: spotifyUrl },
          degraded: true,
          degraded_reason: "spotify_rate_limited",
        });
      }
    }
    console.error(
      "Spotify /media error:",
      statusCode,
      e?.data ?? e?.response?.data ?? e?.message
    );
    return res.status(statusCode).json({
      erreur: "échec de la récupération Spotify",
      status: e?.status ?? e?.response?.status ?? null,
      details: e?.data ?? e?.response?.data ?? e?.message ?? null,
    });
  }
});

type FeedCategoryKey = "trending" | "rap" | "afro" | "pop";

const FEED_CATEGORY_DEFS: Array<{
  key: FeedCategoryKey;
  title: string;
  subtitle: string;
  queries: string[];
}> = [
  {
    key: "trending",
    title: "Tendances",
    subtitle: "Titres du moment",
    queries: ["top hits france", "viral hits france"],
  },
  {
    key: "rap",
    title: "Rap",
    subtitle: "Rap francais",
    queries: ["rap francais ninho gazo damso pnl jul sch", "french rap 2026"],
  },
  {
    key: "afro",
    title: "Afro",
    subtitle: "Afro / Amapiano / Afrobeats",
    queries: ["afrobeats rema burna boy ayra starr wizkid", "afro amapiano hits"],
  },
  {
    key: "pop",
    title: "Pop",
    subtitle: "Pop internationale",
    queries: ["pop hits dua lipa the weeknd taylor swift", "international pop hits"],
  },
];

function mapSpotifyTrackForFeed(raw: any) {
  return {
    id: String(raw?.id || ""),
    type: "track",
    name: String(raw?.name || ""),
    artists: Array.isArray(raw?.artists)
      ? raw.artists
          .map((a: any) => ({ id: String(a?.id || ""), name: String(a?.name || "") }))
          .filter((a: any) => a.name)
      : [],
    album: {
      id: String(raw?.album?.id || ""),
      name: String(raw?.album?.name || ""),
      images: Array.isArray(raw?.album?.images)
        ? raw.album.images
            .map((img: any) => ({ url: String(img?.url || "") }))
            .filter((img: any) => img.url)
        : [],
    },
    duration_ms: Number(raw?.duration_ms || 0),
    popularity: Number(raw?.popularity || 0),
    explicit: Boolean(raw?.explicit),
    external_urls: {
      spotify: String(raw?.external_urls?.spotify || ""),
    },
  };
}

async function fetchSpotifyOEmbedImage(spotifyUrl: string): Promise<string> {
  const url = String(spotifyUrl || "").trim();
  if (!url) return "";
  try {
    const q = new URLSearchParams({ url }).toString();
    const res = await fetch(`https://open.spotify.com/oembed?${q}`);
    if (!res.ok) return "";
    const data: any = await res.json();
    return String(data?.thumbnail_url || "").trim();
  } catch {
    return "";
  }
}

async function fetchSpotifyOEmbedDetails(spotifyUrl: string): Promise<{ title: string; author: string; image: string }> {
  const url = String(spotifyUrl || "").trim();
  if (!url) return { title: "", author: "", image: "" };
  try {
    const q = new URLSearchParams({ url }).toString();
    const res = await fetch(`https://open.spotify.com/oembed?${q}`);
    if (!res.ok) return { title: "", author: "", image: "" };
    const data: any = await res.json();
    return {
      title: String(data?.title || "").trim(),
      author: String(data?.author_name || "").trim(),
      image: String(data?.thumbnail_url || "").trim(),
    };
  } catch {
    return { title: "", author: "", image: "" };
  }
}

function normalizeLooseText(v: string) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickSearchItemsByType(data: any, type: "track" | "album" | "artist") {
  if (type === "track") return Array.isArray(data?.tracks?.items) ? data.tracks.items : [];
  if (type === "album") return Array.isArray(data?.albums?.items) ? data.albums.items : [];
  if (type === "artist") return Array.isArray(data?.artists?.items) ? data.artists.items : [];
  return [];
}

async function getValidSpotifyUserAccessToken(userId: string) {
  const link = await getSpotifyLinkByUserId(userId);
  if (!link) {
    const err = new Error("Spotify account not connected");
    (err as any).status = 412;
    throw err;
  }

  const expiresAtMs = new Date(String(link.expires_at)).getTime();
  const shouldRefresh = !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000;
  if (!shouldRefresh) return link.access_token;

  const refreshed = await refreshSpotifyUserAccessToken(String(link.refresh_token || ""));
  const nextAccessToken = String(refreshed?.access_token || "");
  if (!nextAccessToken) return link.access_token;

  const nextRefresh = String(refreshed?.refresh_token || link.refresh_token || "");
  const nextExpiry = new Date(Date.now() + Math.max(60, Number(refreshed?.expires_in || 3600)) * 1000);

  await upsertSpotifyLink({
    userId,
    spotifyUserId: String(link.spotify_user_id || ""),
    accessToken: nextAccessToken,
    refreshToken: nextRefresh,
    tokenType: String(refreshed?.token_type || link.token_type || "Bearer"),
    scope: String(refreshed?.scope || link.scope || ""),
    expiresAt: nextExpiry,
  });

  return nextAccessToken;
}

function trackCategoryScore(track: any, artistGenresById: Map<string, string[]>, bucket: FeedCategoryKey) {
  const artists = Array.isArray(track?.artists) ? track.artists : [];
  const genreText = artists
    .flatMap((a: any) => artistGenresById.get(String(a?.id || "")) || [])
    .join(" ")
    .toLowerCase();
  const nameText = String(track?.name || "").toLowerCase();
  const artistText = artists.map((a: any) => String(a?.name || "")).join(" ").toLowerCase();
  const haystack = `${genreText} ${nameText} ${artistText}`;

  if (bucket === "rap") {
    const strong = ["french rap", "rap fr", "drill", "trap", "hip hop", "hip-hop", "boom bap", "grime"];
    const weak = ["rap"];
    const strongHit = strong.some((k) => haystack.includes(k));
    const weakHit = weak.some((k) => haystack.includes(k));
    const popPenalty = haystack.includes("dance pop") || haystack.includes("synthpop");
    return strongHit ? (popPenalty ? 2 : 3) : weakHit ? 1 : 0;
  }
  if (bucket === "afro") {
    const strong = ["afrobeats", "afrobeat", "afropop", "amapiano", "naija", "nigerian pop", "afroswing"];
    const weak = ["afro"];
    const strongHit = strong.some((k) => haystack.includes(k));
    const weakHit = weak.some((k) => haystack.includes(k));
    return strongHit ? 3 : weakHit ? 1 : 0;
  }
  if (bucket === "pop") {
    const strong = ["dance pop", "electropop", "synthpop", "pop"];
    const rapPenalty = haystack.includes("french rap") || haystack.includes("hip hop") || haystack.includes("drill");
    return strong.some((k) => haystack.includes(k)) ? (rapPenalty ? 1 : 3) : 0;
  }
  return 1;
}

async function buildPersonalizedCategories(userId: string, limit: number) {
  const accessToken = await getValidSpotifyUserAccessToken(userId);
  const safeLimit = Math.max(4, Math.min(20, limit));

  const [topShort, topMedium, recent]: any[] = await Promise.all([
    spotifyUserGet("/me/top/tracks", accessToken, { limit: 50, time_range: "short_term" }).catch(() => ({ items: [] })),
    spotifyUserGet("/me/top/tracks", accessToken, { limit: 50, time_range: "medium_term" }).catch(() => ({ items: [] })),
    spotifyUserGet("/me/player/recently-played", accessToken, { limit: 50 }).catch(() => ({ items: [] })),
  ]);

  const topShortItems = Array.isArray(topShort?.items) ? topShort.items : [];
  const topMediumItems = Array.isArray(topMedium?.items) ? topMedium.items : [];
  const recentItems = (Array.isArray(recent?.items) ? recent.items : []).map((x: any) => x?.track).filter(Boolean);

  const poolTracks = [...topShortItems, ...topMediumItems, ...recentItems]
    .map(mapSpotifyTrackForFeed)
    .filter((t: any) => t?.id && Array.isArray(t?.album?.images) && t.album.images.length > 0);

  const uniqTracks = Array.from(new Map(poolTracks.map((t: any) => [String(t.id), t])).values());
  if (!uniqTracks.length) {
    const err = new Error("No personalized tracks available");
    (err as any).status = 424;
    throw err;
  }

  const artistIds = Array.from(
    new Set(
      uniqTracks
        .flatMap((t: any) => (Array.isArray(t?.artists) ? t.artists : []))
        .map((a: any) => String(a?.id || ""))
        .filter(Boolean)
    )
  );

  const artistGenresById = new Map<string, string[]>();
  for (let i = 0; i < artistIds.length; i += 50) {
    const chunk = artistIds.slice(i, i + 50);
    if (!chunk.length) continue;
    const artistsData: any = await spotifyUserGet("/artists", accessToken, { ids: chunk.join(",") }).catch(() => ({ artists: [] }));
    const artists = Array.isArray(artistsData?.artists) ? artistsData.artists : [];
    for (const a of artists) {
      artistGenresById.set(
        String(a?.id || ""),
        Array.isArray(a?.genres) ? a.genres.map((g: any) => String(g || "").toLowerCase()).filter(Boolean) : []
      );
    }
  }

  const scored = uniqTracks.map((t: any) => {
    const rap = trackCategoryScore(t, artistGenresById, "rap");
    const afro = trackCategoryScore(t, artistGenresById, "afro");
    const pop = trackCategoryScore(t, artistGenresById, "pop");
    return { track: t, rap, afro, pop };
  });

  const pickDistinctBucket = (bucket: "rap" | "afro" | "pop") =>
    scored
      .filter((x: any) => {
        if (bucket === "rap") return x.rap > 0 && x.rap >= x.afro && x.rap >= x.pop;
        if (bucket === "afro") return x.afro > 0 && x.afro > x.rap && x.afro >= x.pop;
        return x.pop > 0 && x.pop > x.rap && x.pop > x.afro;
      })
      .sort((a: any, b: any) => {
        const sa = bucket === "rap" ? a.rap : bucket === "afro" ? a.afro : a.pop;
        const sb = bucket === "rap" ? b.rap : bucket === "afro" ? b.afro : b.pop;
        if (sb !== sa) return sb - sa;
        return Number(b.track?.popularity || 0) - Number(a.track?.popularity || 0);
      })
      .map((x: any) => x.track)
      .slice(0, safeLimit);

  const trending = uniqTracks.slice(0, safeLimit);
  const rap = pickDistinctBucket("rap");
  const afro = pickDistinctBucket("afro");
  const pop = pickDistinctBucket("pop");

  return {
    trending: { key: "trending", title: "Tendances pour toi", subtitle: "Base sur tes ecoutes Spotify", items: trending },
    rap: { key: "rap", title: "Rap pour toi", subtitle: "Selon tes ecoutes", items: rap },
    afro: { key: "afro", title: "Afro pour toi", subtitle: "Selon tes ecoutes", items: afro },
    pop: { key: "pop", title: "Pop pour toi", subtitle: "Selon tes ecoutes", items: pop },
  };
}

async function fetchCategoryTracks(queries: string[], limit: number) {
  const dedup = new Map<string, any>();
  const wanted = Math.max(1, Math.min(20, limit));

  for (const q of queries) {
    if (dedup.size >= wanted) break;
    const searchLimit = Math.max(10, Math.min(20, wanted * 2));
    const data: any = await spotifySearch({ q, type: "track", limit: searchLimit, offset: 0 });
    const items = Array.isArray(data?.tracks?.items) ? data.tracks.items : Array.isArray(data?.items) ? data.items : [];
    for (const it of items) {
      const mapped = mapSpotifyTrackForFeed(it);
      if (!mapped.id || !mapped.album.images.length) continue;
      if (!dedup.has(mapped.id)) dedup.set(mapped.id, mapped);
      if (dedup.size >= wanted) break;
    }
  }

  return Array.from(dedup.values()).slice(0, wanted);
}

app.get("/music/personalized", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitNum = Number.parseInt(String(limitRaw ?? "10"), 10);
    const limit = Number.isFinite(limitNum) ? Math.max(4, Math.min(20, limitNum)) : 10;
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ erreur: "Utilisateur non authentifie" });
    const cacheKey = `music:personalized:v1:${userId}:${limit}`;

    const categories = await buildPersonalizedCategories(userId, limit);
    try {
      await redis.set(cacheKey, JSON.stringify(categories), "EX", 600);
    } catch {
      // noop
    }
    return res.json({
      generated_at: new Date().toISOString(),
      source: "spotify_user_history",
      limit,
      categories,
    });
  } catch (e: any) {
    const statusCode = e?.status ?? e?.response?.status ?? 500;
    if (statusCode === 412) {
      return res.status(412).json({ erreur: "spotify_not_connected" });
    }
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitNum = Number.parseInt(String(limitRaw ?? "10"), 10);
    const limit = Number.isFinite(limitNum) ? Math.max(4, Math.min(20, limitNum)) : 10;
    const userId = String(req.user?.id || "");
    if (userId) {
      const cacheKey = `music:personalized:v1:${userId}:${limit}`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.status(200).json({
            generated_at: new Date().toISOString(),
            source: "spotify_user_history_cache",
            limit,
            categories: JSON.parse(cached),
            degraded: true,
          });
        }
      } catch {
        // noop
      }
    }
    console.error(
      "Music personalized error:",
      e?.status ?? e?.response?.status,
      e?.data ?? e?.response?.data ?? e?.message
    );
    return res.status(statusCode).json({
      erreur: "echec chargement recommandations personnalisees",
      status: e?.status ?? e?.response?.status ?? null,
      details: e?.data ?? e?.response?.data ?? e?.message ?? null,
    });
  }
});

app.get("/music/categories", async (req, res) => {
  try {
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitNum = Number.parseInt(String(limitRaw ?? "10"), 10);
    const limit = Number.isFinite(limitNum) ? Math.max(4, Math.min(20, limitNum)) : 10;
    const categories: Record<string, any> = {};

    for (const cat of FEED_CATEGORY_DEFS) {
      const cacheKey = `music:categories:v1:${cat.key}:${limit}`;
      try {
        const items = await fetchCategoryTracks(cat.queries, limit);
        const payload = { key: cat.key, title: cat.title, subtitle: cat.subtitle, items };
        categories[cat.key] = payload;
        try {
          await redis.set(cacheKey, JSON.stringify(payload), "EX", 300);
        } catch (cacheErr: any) {
          console.warn("Music categories cache write failed:", cacheErr?.message || cacheErr);
        }
      } catch (err: any) {
        const statusCode = err?.status ?? err?.response?.status ?? null;
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            categories[cat.key] = {
              ...parsed,
              stale: true,
              stale_reason: statusCode === 429 ? "spotify_rate_limited" : "spotify_error",
            };
            continue;
          }
        } catch (cacheErr: any) {
          console.warn("Music categories cache read failed:", cacheErr?.message || cacheErr);
        }

        categories[cat.key] = {
          key: cat.key,
          title: cat.title,
          subtitle: cat.subtitle,
          items: [],
          error: statusCode === 429 ? "spotify_rate_limited" : "spotify_error",
        };
      }
    }

    return res.json({
      generated_at: new Date().toISOString(),
      limit,
      categories,
    });
  } catch (e: any) {
    console.error(
      "Music categories error:",
      e?.status ?? e?.response?.status,
      e?.data ?? e?.response?.data ?? e?.message
    );
    const statusCode = e?.status ?? e?.response?.status ?? 500;
    return res.status(statusCode).json({
      erreur: "echec chargement categories musique",
      status: e?.status ?? e?.response?.status ?? null,
      details: e?.data ?? e?.response?.data ?? e?.message ?? null,
    });
  }
});

app.get("/music/news", async (req, res) => {
  try {
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitNum = Number.parseInt(String(limitRaw ?? "10"), 10);
    const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(20, limitNum)) : 10;

    let releaseItems: any[] = [];
    try {
      const releasesData: any = await spotifyNewReleases(limit);
      releaseItems = releasesData?.albums?.items || [];
    } catch (e: any) {
      const statusCode = e?.status ?? e?.response?.status ?? null;
      if (statusCode === 403) {
        // Some Spotify apps/regions block /browse/new-releases in client-credentials mode.
        // Fallback: build a "news" feed from album searches.
        const seeds = ["new music friday", "nouveautes album", "sorties rap", "pop nouveautes"];
        const searched = await Promise.all(
          seeds.map(async (q) => {
            try {
              const r: any = await spotifySearch({ q, type: "album", limit: 6, offset: 0 });
              return r?.albums?.items || r?.items || [];
            } catch {
              return [];
            }
          })
        );
        const flat = searched.flat();
        const uniq = new Map<string, any>();
        for (const a of flat) {
          const id = String(a?.id || "");
          if (!id || uniq.has(id)) continue;
          uniq.set(id, a);
        }
        releaseItems = Array.from(uniq.values()).slice(0, limit);
      } else {
        throw e;
      }
    }

    const releases = releaseItems.map((a: any) => ({
      id: String(a?.id || ""),
      name: String(a?.name || ""),
      media_type: "album",
      artists: Array.isArray(a?.artists) ? a.artists.map((x: any) => String(x?.name || "")).filter(Boolean) : [],
      image: String(a?.images?.[0]?.url || ""),
      release_date: String(a?.release_date || ""),
      total_tracks: Number(a?.total_tracks || 0),
      spotify_url: String(a?.external_urls?.spotify || ""),
    }));

    let recentReviews: any[] = [];
    let recentComments: any[] = [];
    try {
      const [reviewsRes, commentsRes] = await Promise.all([
        pool.query(
          `
            SELECT r.media_type, r.media_id, r.rating, r.body, r.created_at, u.display_name
            FROM reviews r
            JOIN users u ON u.id = r.user_id
            ORDER BY r.created_at DESC
            LIMIT 10
          `
        ),
        pool.query(
          `
            SELECT r.media_type, r.media_id, rc.body, rc.created_at, u.display_name
            FROM review_comments rc
            JOIN reviews r ON r.id = rc.review_id
            JOIN users u ON u.id = rc.user_id
            ORDER BY rc.created_at DESC
            LIMIT 10
          `
        ),
      ]);
      recentReviews = reviewsRes.rows || [];
      recentComments = commentsRes.rows || [];
    } catch {
      recentReviews = [];
      recentComments = [];
    }

    const communityRaw = [
      ...recentReviews.map((x: any) => ({
        kind: "review",
        media_type: String(x.media_type || "track"),
        media_id: String(x.media_id || ""),
        text: String(x.body || ""),
        rating: x.rating == null ? null : Number(x.rating),
        display_name: String(x.display_name || "Utilisateur"),
        created_at: x.created_at,
      })),
      ...recentComments.map((x: any) => ({
        kind: "comment",
        media_type: String(x.media_type || "track"),
        media_id: String(x.media_id || ""),
        text: String(x.body || ""),
        rating: null,
        display_name: String(x.display_name || "Utilisateur"),
        created_at: x.created_at,
      })),
    ]
      .sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime())
      .slice(0, 10);

    const uniqMedia = Array.from(
      new Map(
        communityRaw.map((x) => [`${x.media_type}:${x.media_id}`, { media_type: x.media_type, media_id: x.media_id }])
      ).values()
    );

    const mediaMap = new Map<string, { name: string; subtitle: string; image: string }>();
    await Promise.all(
      uniqMedia.map(async (m) => {
        try {
          const raw: any = await spotifyGet(m.media_type as "track" | "album" | "artist", m.media_id);
          const subtitle = Array.isArray(raw?.artists)
            ? raw.artists.map((a: any) => String(a?.name || "")).filter(Boolean).join(", ")
            : Array.isArray(raw?.genres)
              ? raw.genres.map((g: any) => String(g || "")).filter(Boolean).join(", ")
              : "";
          const image = String(raw?.images?.[0]?.url || raw?.album?.images?.[0]?.url || "");
          mediaMap.set(`${m.media_type}:${m.media_id}`, {
            name: String(raw?.name || ""),
            subtitle,
            image,
          });
        } catch {
          const spotifyUrl = `https://open.spotify.com/${encodeURIComponent(String(m.media_type || "track"))}/${encodeURIComponent(String(m.media_id || ""))}`;
          const oembed = await fetchSpotifyOEmbedDetails(spotifyUrl);
          mediaMap.set(`${m.media_type}:${m.media_id}`, {
            name: oembed.title || "",
            subtitle: oembed.author || "",
            image: oembed.image || "",
          });
        }
      })
    );

    const community = communityRaw.map((x) => ({
      ...x,
      media: mediaMap.get(`${x.media_type}:${x.media_id}`) || { name: "", subtitle: "", image: "" },
    }));

    return res.json({
      generated_at: new Date().toISOString(),
      releases,
      community,
    });
  } catch (e: any) {
    console.error(
      "Music news error:",
      e?.status ?? e?.response?.status,
      e?.data ?? e?.response?.data ?? e?.message
    );
    const statusCode = e?.status ?? e?.response?.status ?? 500;
    return res.status(statusCode).json({
      erreur: "echec chargement actualites musique",
      status: e?.status ?? e?.response?.status ?? null,
      details: e?.data ?? e?.response?.data ?? e?.message ?? null,
    });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled API error:", err?.message || err);
  if (res.headersSent) return;
  return res.status(500).json({ erreur: "Erreur serveur" });
});

// Serve uploads from the same directory used by local upload fallback.
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "supcontent-api" });
});

const PORT = process.env.PORT || 1234;
app.listen(PORT, () => console.log(`?? API: http://localhost:${PORT}`));

ensureCollectionsTables().catch((err) => {
  console.error("Collections tables init failed (non-blocking):", err?.message || err);
});

ensureSocialTables().catch((err) => {
  console.error("Social tables init failed (non-blocking):", err?.message || err);
});

ensureFollowTables().catch((err) => {
  console.error("Follow tables init failed (non-blocking):", err?.message || err);
});

ensureSpotifyLinksTable().catch((err) => {
  console.error("Spotify links table init failed (non-blocking):", err?.message || err);
});

ensurePasswordResetTable().catch((err) => {
  console.error("Password reset table init failed (non-blocking):", err?.message || err);
});

