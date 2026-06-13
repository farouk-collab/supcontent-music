import { Router } from "express";
import crypto from "crypto";
import { verifyAccessToken } from "../auth/jwt";
import { pool } from "../connections";
import { ensureCollectionsTables, newCollectionId } from "../db/collections";
import { parseSpotifyPlaylistId, spotifyGetPlaylistTracks } from "../services";
import {
  deriveTitleFromUrl,
  inferMediaTypeFromUrl,
  inferSourceFromUrl,
  normalizeUrl,
  parseEmbeddedMediaLink,
} from "../lib/searchHub";

type ImportedRow = {
  id: string;
  title: string;
  source: string;
  tracks: number;
  favorite: boolean;
  synced: boolean;
  loginRequired: boolean;
  url: string;
  itemType: "playlist" | "media";
  mediaType: "" | "audio" | "video";
};

const router = Router();
const importedRowsStore = new Map<string, ImportedRow[]>();

router.get("/ping", (_req, res) => {
  return res.json({ ok: true, service: "search-hub" });
});

function getAuthenticatedUserId(req: any) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      return String(payload.sub || "");
    } catch {
      return "";
    }
  }

  return "";
}

function sessionKey(req: any) {
  const userId = getAuthenticatedUserId(req);
  if (userId) return `user:${userId}`;

  const ip = String(req.ip || req.headers["x-forwarded-for"] || "guest");
  const ua = String(req.headers["user-agent"] || "browser");
  const guestHash = crypto.createHash("sha1").update(`${ip}::${ua}`).digest("hex").slice(0, 16);
  return `guest:${guestHash}`;
}

function readRows(req: any) {
  return importedRowsStore.get(sessionKey(req)) || [];
}

function writeRows(req: any, rows: ImportedRow[]) {
  importedRowsStore.set(sessionKey(req), rows);
  return rows;
}

function createImportedRow(partial: Partial<ImportedRow>): ImportedRow {
  const itemType = partial.itemType === "media" ? "media" : "playlist";
  const mediaType = partial.mediaType === "audio" ? "audio" : partial.mediaType === "video" ? "video" : "";
  return {
    id: crypto.randomUUID(),
    title: String(partial.title || (itemType === "media" ? "Media importe" : "Playlist importee")),
    source: String(partial.source || "Lien externe"),
    tracks: Math.max(1, Number(partial.tracks || 1)),
    favorite: Boolean(partial.favorite),
    synced: Boolean(partial.synced),
    loginRequired: true,
    url: normalizeUrl(String(partial.url || "")),
    itemType,
    mediaType,
  };
}

function duplicateUrl(rows: ImportedRow[], url: string) {
  const target = normalizeUrl(url);
  return rows.find((item) => normalizeUrl(item.url) === target);
}

function importedCollectionMediaType(item: ImportedRow): "playlist" | "media" {
  return item.itemType === "media" ? "media" : "playlist";
}

function importedCollectionItemKind(item: ImportedRow): "playlist" | "media" {
  return importedCollectionMediaType(item);
}

function persistentImportedMediaId(item: ImportedRow) {
  const normalized = normalizeUrl(item.url);
  return `import-${crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 24)}`;
}

function importedSubtitle(item: ImportedRow) {
  if (item.itemType === "playlist") {
    return `${item.source} · ${Math.max(1, Number(item.tracks || 0))} titres importes`;
  }

  if (item.mediaType === "video") return `${item.source} · video importee`;
  if (item.mediaType === "audio") return `${item.source} · audio importe`;
  return `${item.source} · media importe`;
}

function externalSourceUrls(item: ImportedRow) {
  const normalized = normalizeUrl(item.url);
  const source = String(item.source || "").toLowerCase();
  const isYoutube = source.includes("youtube");
  const isSpotify = source.includes("spotify");
  return {
    sourceUrl: normalized,
    youtubeUrl: isYoutube ? normalized : null,
    spotifyUrl: isSpotify ? normalized : null,
  };
}

async function ensureImportsCollectionForUser(userId: string) {
  await ensureCollectionsTables();
  const existing = await pool.query<{ id: string }>(
    `SELECT id
       FROM collections
      WHERE user_id = $1 AND code = $2
      ORDER BY created_at ASC
      LIMIT 1`,
    [userId, "imports-recherche"],
  );

  if (existing.rows[0]?.id) return existing.rows[0].id;

  const created = await pool.query<{ id: string }>(
    `INSERT INTO collections (id, user_id, label, code)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [newCollectionId(), userId, "Imports recherche", "imports-recherche"],
  );

  return created.rows[0].id;
}

async function persistImportedRows(userId: string, rows: ImportedRow[]) {
  if (!rows.length) return null;

  const collectionId = await ensureImportsCollectionForUser(userId);

  for (const item of rows) {
    const mediaType = importedCollectionMediaType(item);
    const mediaId = persistentImportedMediaId(item);
    const urls = externalSourceUrls(item);

    await pool.query(
      `INSERT INTO collection_items (
        collection_id,
        media_type,
        media_id,
        item_kind,
        external_source,
        title,
        subtitle,
        image_url,
        source_url,
        youtube_url,
        spotify_url,
        track_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11)
      ON CONFLICT (collection_id, media_type, media_id)
      DO UPDATE SET
        item_kind = EXCLUDED.item_kind,
        external_source = EXCLUDED.external_source,
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        source_url = EXCLUDED.source_url,
        youtube_url = EXCLUDED.youtube_url,
        spotify_url = EXCLUDED.spotify_url,
        track_count = EXCLUDED.track_count`,
      [
        collectionId,
        mediaType,
        mediaId,
        importedCollectionItemKind(item),
        item.source,
        item.title,
        importedSubtitle(item),
        urls.sourceUrl,
        urls.youtubeUrl,
        urls.spotifyUrl,
        Math.max(1, Number(item.tracks || 1)),
      ],
    );
  }

  return collectionId;
}

router.get("/imports", (req, res) => {
  return res.json({ items: readRows(req) });
});

router.get("/import/parse", (req, res) => {
  const url = normalizeUrl(String(req.query.url || ""));
  if (!url) return res.status(400).json({ erreur: "URL manquante" });

  const parsed = parseEmbeddedMediaLink(url);
  if (!parsed) return res.status(400).json({ erreur: "Lien non reconnu" });

  return res.json({ item: parsed });
});

router.post("/imports/playlist", async (req, res) => {
  const url = normalizeUrl(String(req.body?.url || ""));
  const source = String(req.body?.source || "").toLowerCase();
  if (!url) return res.status(400).json({ erreur: "URL manquante" });
  if (!["spotify", "youtube"].includes(source)) {
    return res.status(400).json({ erreur: "Source invalide" });
  }

  const rows = readRows(req);
  if (duplicateUrl(rows, url)) return res.status(409).json({ erreur: "Ce lien est deja importe" });

  let title = source === "spotify" ? "Playlist Spotify importee" : "Playlist YouTube importee";
  let tracks = Math.floor(Math.random() * 20) + 12;

  if (source === "spotify") {
    const playlistId = parseSpotifyPlaylistId(url);
    if (!playlistId) return res.status(400).json({ erreur: "Playlist Spotify invalide" });
    const data = await spotifyGetPlaylistTracks(playlistId, 150);
    title = String(data.name || title);
    tracks = Array.isArray(data.items) ? data.items.length : tracks;
  }

  const row = createImportedRow({
    title,
    source: source === "spotify" ? "Spotify" : "YouTube",
    tracks,
    url,
    itemType: "playlist",
  });

  writeRows(req, [row, ...rows]);
  return res.status(201).json({ item: row, items: readRows(req) });
});

router.post("/imports/media", (req, res) => {
  const url = normalizeUrl(String(req.body?.url || ""));
  const requestedTitle = String(req.body?.title || "").trim();
  if (!url) return res.status(400).json({ erreur: "URL manquante" });

  const rows = readRows(req);
  if (duplicateUrl(rows, url)) return res.status(409).json({ erreur: "Ce lien est deja importe" });

  const mediaType = inferMediaTypeFromUrl(url);
  let row: ImportedRow | null = null;

  if (mediaType) {
    const defaultTitle = deriveTitleFromUrl(url, mediaType === "audio" ? "Son importe" : "Video importee");
    row = createImportedRow({
      title: requestedTitle || defaultTitle,
      source: mediaType === "audio" ? "Lien audio" : "Lien video",
      tracks: 1,
      url,
      itemType: "media",
      mediaType,
    });
  } else {
    const source = inferSourceFromUrl(url);
    if (source === "youtube") {
      row = createImportedRow({
        title: requestedTitle || "Video YouTube importee",
        source: "YouTube",
        tracks: 1,
        url,
        itemType: "media",
        mediaType: "video",
      });
    } else if (source === "spotify") {
      const lower = url.toLowerCase();
      let title = "Media Spotify importe";
      if (lower.includes("/track/")) title = "Titre Spotify importe";
      if (lower.includes("/album/")) title = "Album Spotify importe";
      if (lower.includes("/playlist/")) title = "Playlist Spotify importee";
      row = createImportedRow({
        title: requestedTitle || title,
        source: "Spotify",
        tracks: lower.includes("/track/") ? 1 : Math.floor(Math.random() * 20) + 12,
        url,
        itemType: "media",
        mediaType: "audio",
      });
    }
  }

  if (!row) {
    return res.status(400).json({ erreur: "Lien invalide detecte. Utilise YouTube, Spotify, .mp3 ou .mp4." });
  }

  writeRows(req, [row, ...rows]);
  return res.status(201).json({ item: row, items: readRows(req) });
});

router.patch("/imports/:id/favorite", (req, res) => {
  const id = String(req.params.id || "");
  const rows = readRows(req);
  const next = rows.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item));
  writeRows(req, next);
  return res.json({ items: next });
});

router.delete("/imports/:id", (req, res) => {
  const id = String(req.params.id || "");
  const next = readRows(req).filter((item) => item.id !== id);
  writeRows(req, next);
  return res.json({ items: next });
});

router.post("/imports/merge", (req, res) => {
  const rows = readRows(req);
  if (rows.length < 2) return res.status(400).json({ erreur: "Ajoute au moins 2 playlists pour fusionner." });

  const merged = createImportedRow({
    title: `Fusion ${new Date().toLocaleDateString("fr-FR")}`,
    source: "Spotify",
    tracks: rows.reduce((sum, row) => sum + Number(row.tracks || 0), 0),
    itemType: "playlist",
    mediaType: "",
  });

  writeRows(req, [merged, ...rows]);
  return res.status(201).json({ item: merged, items: readRows(req) });
});

router.post("/imports/sync", async (req, res) => {
  const rows = readRows(req);
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    const next = rows.map((item) => ({ ...item, synced: true }));
    writeRows(req, next);
    return res.json({ items: next, persisted: false });
  }

  const collectionId = await persistImportedRows(userId, rows);
  const next = rows.map((item) => ({ ...item, synced: true }));
  writeRows(req, next);
  return res.json({ items: next, persisted: true, collectionId });
});

export default router;
