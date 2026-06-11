import { Router } from "express";
import crypto from "crypto";
import { verifyAccessToken } from "../auth/jwt";
import { parseSpotifyPlaylistId, spotifyGetPlaylistTracks } from "../services";

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

function sessionKey(req: any) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      return `user:${payload.sub}`;
    } catch {
      // Ignore invalid token and fall back to guest scope.
    }
  }

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

function normalizeUrl(url: string) {
  return String(url || "").trim();
}

function parseUrl(url: string) {
  try {
    return new URL(normalizeUrl(url));
  } catch {
    return null;
  }
}

function inferMediaTypeFromUrl(url: string): "" | "audio" | "video" {
  const parsed = parseUrl(url);
  const target = String(parsed?.pathname || url || "").toLowerCase();
  if (target.endsWith(".mp3")) return "audio";
  if (target.endsWith(".mp4")) return "video";
  return "";
}

function inferSourceFromUrl(url: string) {
  const lower = normalizeUrl(url).toLowerCase();
  if (lower.includes("spotify.com/track") || lower.includes("spotify.com/album") || lower.includes("spotify.com/playlist")) return "spotify";
  if (
    lower.includes("youtu.be/") ||
    lower.includes("youtube.com/watch") ||
    lower.includes("youtube.com/shorts/") ||
    lower.includes("youtube.com/embed/") ||
    lower.includes("youtube.com/playlist") ||
    lower.includes("music.youtube.com/playlist")
  ) return "youtube";
  const mediaType = inferMediaTypeFromUrl(lower);
  if (mediaType === "audio") return "mp3";
  if (mediaType === "video") return "mp4";
  return "";
}

function deriveTitleFromUrl(url: string, fallback = "Media importe") {
  const parsed = parseUrl(url);
  const pathname = String(parsed?.pathname || "").split("/").filter(Boolean).pop() || "";
  if (!pathname) return fallback;
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function parseEmbeddedMediaLink(rawUrl: string) {
  const url = normalizeUrl(rawUrl);
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsedUrl.pathname;

    if (hostname === "youtu.be") {
      const videoId = pathname.split("/").filter(Boolean)[0];
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return { type: "youtube-video", id: videoId, listId: parsedUrl.searchParams.get("list"), source: "YouTube", originalUrl: url };
      }
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com") {
      if (pathname === "/watch") {
        const videoId = parsedUrl.searchParams.get("v");
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          return { type: "youtube-video", id: videoId, listId: parsedUrl.searchParams.get("list"), source: "YouTube", originalUrl: url };
        }
      }
      if (pathname === "/playlist") {
        const listId = parsedUrl.searchParams.get("list");
        if (listId) return { type: "youtube-playlist", id: listId, source: "YouTube", originalUrl: url };
      }
      if (pathname.startsWith("/shorts/") || pathname.startsWith("/embed/")) {
        const videoId = pathname.split("/").filter(Boolean)[1];
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          return { type: "youtube-video", id: videoId, listId: parsedUrl.searchParams.get("list"), source: "YouTube", originalUrl: url };
        }
      }
    }
  } catch {
    // fallback regex below
  }

  const yt = url.match(/(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return { type: "youtube-video", id: yt[1], listId: listMatch ? listMatch[1] : null, source: "YouTube", originalUrl: url };
  }

  const ytpl = url.match(/youtube\.com\/playlist\?(?:[^#]*&)?list=([a-zA-Z0-9_-]+)/);
  if (ytpl) return { type: "youtube-playlist", id: ytpl[1], source: "YouTube", originalUrl: url };

  const sptrack = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/);
  if (sptrack) return { type: "spotify-track", id: sptrack[1], source: "Spotify", originalUrl: url };

  const sppl = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([a-zA-Z0-9]+)/);
  if (sppl) return { type: "spotify-playlist", id: sppl[1], source: "Spotify", originalUrl: url };

  const spalb = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?album\/([a-zA-Z0-9]+)/);
  if (spalb) return { type: "spotify-album", id: spalb[1], source: "Spotify", originalUrl: url };

  const mediaType = inferMediaTypeFromUrl(url);
  if (mediaType === "audio") return { type: "direct-audio", source: "Direct", mediaType, originalUrl: url };
  if (mediaType === "video") return { type: "direct-video", source: "Direct", mediaType, originalUrl: url };

  return null;
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

router.post("/imports/sync", (req, res) => {
  const next = readRows(req).map((item) => ({ ...item, synced: true }));
  writeRows(req, next);
  return res.json({ items: next });
});

export default router;
