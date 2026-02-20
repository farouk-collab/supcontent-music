import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

import { pool, redis } from "./connections";
import { spotifyGet, spotifySearch } from "./services";
import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import uploadRoutes from "./routes/uploads";

const app = express();

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
        scriptSrc: ["'self'"],
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

/* ======================
   API ROUTES
====================== */
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/upload", uploadRoutes);

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

    console.log("🎯 /search final params:", { q, type, limit: finalLimit, offset: finalOffset, page });

    try {
      const data = await spotifySearch({ q, type, limit: finalLimit, offset: finalOffset });
      return res.json(data);
    } catch (e: any) {
      const statusCode = e?.status ?? e?.response?.status ?? null;
      const errData = e?.data ?? e?.response?.data ?? null;
      const errMessage =
        (errData && (errData.error?.message || errData.message)) || e?.message || "";
      if (statusCode === 400 && String(errMessage).includes("Invalid limit")) {
        console.warn("Spotify returned Invalid limit — retrying with smaller limit=10");
        const fallback = await spotifySearch({ q, type, limit: 10, offset: 0 });
        return res.json(fallback);
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

    if (!["track", "album", "artist"].includes(type)) {
      return res.status(400).json({ erreur: "Le paramètre 'type' doit être track|album|artist" });
    }

    const data = await spotifyGet(type, id);
    return res.json(data);
  } catch (e: any) {
    console.error(
      "Spotify /media error:",
      e?.status ?? e?.response?.status,
      e?.data ?? e?.response?.data ?? e?.message
    );
    const statusCode = e?.status ?? e?.response?.status ?? 500;
    return res.status(statusCode).json({
      erreur: "échec de la récupération Spotify",
      status: e?.status ?? e?.response?.status ?? null,
      details: e?.data ?? e?.response?.data ?? e?.message ?? null,
    });
  }
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "supcontent-api" });
});

const PORT = process.env.PORT || 1234;
app.listen(PORT, () => console.log(`🚀 API: http://localhost:${PORT}`));
