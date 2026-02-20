import express from "express";
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
import { spotifyGet, spotifyNewReleases, spotifySearch } from "./services";
import authRoutes from "./routes/auth";
import collectionsRoutes from "./routes/collections";
import usersRoutes from "./routes/users";
import uploadRoutes from "./routes/uploads";
import socialRoutes from "./routes/social";

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
app.use("/collections", collectionsRoutes);
app.use("/users", usersRoutes);
app.use("/upload", uploadRoutes);
app.use("/social", socialRoutes);

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

    if (!q) return res.status(400).json({ erreur: "Le paramÃ¨tre 'q' est requis" });
    if (!["track", "album", "artist"].includes(type)) {
      return res.status(400).json({ erreur: "Le paramÃ¨tre 'type' doit Ãªtre track|album|artist" });
    }

    // Ensure integers and safe ranges before calling Spotify
    const safeLimit = Math.trunc(Number(limit) || SPOTIFY_SEARCH_MAX_LIMIT);
    const finalLimit = Math.max(1, Math.min(SPOTIFY_SEARCH_MAX_LIMIT, safeLimit));
    const finalOffset = Math.max(0, Math.trunc(Number((page - 1) * finalLimit) || 0));

    console.log("ðŸŽ¯ /search final params:", { q, type, limit: finalLimit, offset: finalOffset, page });

    try {
      const data = await spotifySearch({ q, type, limit: finalLimit, offset: finalOffset });
      return res.json(data);
    } catch (e: any) {
      const statusCode = e?.status ?? e?.response?.status ?? null;
      const errData = e?.data ?? e?.response?.data ?? null;
      const errMessage =
        (errData && (errData.error?.message || errData.message)) || e?.message || "";
      if (statusCode === 400 && String(errMessage).includes("Invalid limit")) {
        console.warn("Spotify returned Invalid limit â€” retrying with smaller limit=10");
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
      erreur: "Ã©chec de la recherche Spotify",
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
      return res.status(400).json({ erreur: "Le paramÃ¨tre 'type' doit Ãªtre track|album|artist" });
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
      erreur: "Ã©chec de la rÃ©cupÃ©ration Spotify",
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
          mediaMap.set(`${m.media_type}:${m.media_id}`, { name: "", subtitle: "", image: "" });
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

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "supcontent-api" });
});

const PORT = process.env.PORT || 1234;
app.listen(PORT, () => console.log(`🚀 API: http://localhost:${PORT}`));

ensureCollectionsTables().catch((err) => {
  console.error("Collections tables init failed (non-blocking):", err?.message || err);
});

ensureSocialTables().catch((err) => {
  console.error("Social tables init failed (non-blocking):", err?.message || err);
});

