import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

import { pool, redis } from "./connections";
import { spotifyGet, spotifySearch } from "./services"; // re-exported from index
import authRoutes from "./routes/auth";

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

/* ======================
   API ROUTES
====================== */
app.use("/auth", authRoutes);

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
    const q = String(req.query.q ?? "").trim();
    const type = String(req.query.type ?? "track") as "track" | "album" | "artist";

    const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

    const pageNum = Number.parseInt(String(pageRaw ?? "1"), 10);
    const limitNum = Number.parseInt(String(limitRaw ?? "20"), 10);

    const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
    const limit = Number.isFinite(limitNum) ? Math.min(50, Math.max(1, limitNum)) : 20;

    if (!q) return res.status(400).json({ erreur: "Le paramètre 'q' est requis" });
    if (!["track", "album", "artist"].includes(type)) {
      return res.status(400).json({ erreur: "Le paramètre 'type' doit être track|album|artist" });
    }

    const data = await spotifySearch({ q, type, page, limit });
    res.json(data);
  } catch (e: any) {
    console.error("Spotify /search error:", e?.response?.status, e?.response?.data ?? e?.message);
    res.status(500).json({
      erreur: "échec de la recherche Spotify",
      status: e?.response?.status ?? null,
      details: e?.response?.data ?? e?.message ?? null,
    });
  }
});

app.get("/media/:type/:id", async (req, res) => {
  try {
    const type = req.params.type as "track" | "album" | "artist";
    const id = req.params.id;

    if (!["track", "album", "artist"].includes(type)) {
      return res.status(400).json({ erreur: "Le paramètre 'type' doit être track|album|artist" });
    }

    const data = await spotifyGet(type, id);
    res.json(data);
  } catch (e: any) {
    console.error("Spotify /media error:", e?.response?.status, e?.response?.data ?? e?.message);
    res.status(500).json({
      erreur: "échec de la récupération Spotify",
      status: e?.response?.status ?? null,
      details: e?.response?.data ?? e?.message ?? null,
    });
  }
});

/* ======================
   STATIC FRONT (HTML/CSS/JS)
====================== */
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const PORT = process.env.PORT || 1234;
app.listen(PORT, () => console.log(`🚀 API: http://localhost:${PORT}`));
