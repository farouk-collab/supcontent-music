export type ImportedMediaParseResult =
  | { type: "youtube-video"; id: string; listId: string | null; source: "YouTube"; originalUrl: string }
  | { type: "youtube-playlist"; id: string; source: "YouTube"; originalUrl: string }
  | { type: "spotify-track"; id: string; source: "Spotify"; originalUrl: string }
  | { type: "spotify-playlist"; id: string; source: "Spotify"; originalUrl: string }
  | { type: "spotify-album"; id: string; source: "Spotify"; originalUrl: string }
  | { type: "direct-audio"; source: "Direct"; mediaType: "audio"; originalUrl: string }
  | { type: "direct-video"; source: "Direct"; mediaType: "video"; originalUrl: string };

export function normalizeUrl(url: string) {
  return String(url || "").trim();
}

export function parseUrl(url: string) {
  try {
    return new URL(normalizeUrl(url));
  } catch {
    return null;
  }
}

export function inferMediaTypeFromUrl(url: string): "" | "audio" | "video" {
  const parsed = parseUrl(url);
  const target = String(parsed?.pathname || url || "").toLowerCase();
  if (target.endsWith(".mp3")) return "audio";
  if (target.endsWith(".mp4")) return "video";
  return "";
}

export function inferSourceFromUrl(url: string) {
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

export function deriveTitleFromUrl(url: string, fallback = "Media importe") {
  const parsed = parseUrl(url);
  const pathname = String(parsed?.pathname || "").split("/").filter(Boolean).pop() || "";
  if (!pathname) return fallback;
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

export function parseEmbeddedMediaLink(rawUrl: string): ImportedMediaParseResult | null {
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
    // Regex fallback below.
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
