import { useMemo, useState } from "react";
import {
  AlertCircle as AlertCircleIcon,
  Headphones as AudioIcon,
  Link2 as LinkIcon,
  MonitorPlay as VideoIcon,
  Music4 as MusicIcon,
  Play as PlayIcon,
} from "lucide-react";

const EXAMPLES = [
  { label: "YouTube video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { label: "YouTube playlist", url: "https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workFmzvH3EKPF" },
  { label: "Spotify titre", url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT" },
  { label: "Spotify playlist", url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" },
];

function parseLink(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsedUrl.pathname;

    if (hostname === "youtu.be") {
      const videoId = pathname.split("/").filter(Boolean)[0];
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return {
          type: "youtube-video",
          id: videoId,
          listId: parsedUrl.searchParams.get("list"),
          source: "YouTube",
        };
      }
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com") {
      if (pathname === "/watch") {
        const videoId = parsedUrl.searchParams.get("v");
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          return {
            type: "youtube-video",
            id: videoId,
            listId: parsedUrl.searchParams.get("list"),
            source: "YouTube",
          };
        }
      }

      if (pathname === "/playlist") {
        const listId = parsedUrl.searchParams.get("list");
        if (listId) {
          return {
            type: "youtube-playlist",
            id: listId,
            source: "YouTube",
          };
        }
      }

      if (pathname.startsWith("/shorts/") || pathname.startsWith("/embed/")) {
        const videoId = pathname.split("/").filter(Boolean)[1];
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          return {
            type: "youtube-video",
            id: videoId,
            listId: parsedUrl.searchParams.get("list"),
            source: "YouTube",
          };
        }
      }
    }
  } catch {
    // Keep regex fallbacks below for partially malformed URLs.
  }

  const youtubeVideo = url.match(/(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeVideo) {
    const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return {
      type: "youtube-video",
      id: youtubeVideo[1],
      listId: listMatch ? listMatch[1] : null,
      source: "YouTube",
    };
  }

  const youtubePlaylist = url.match(/youtube\.com\/playlist\?(?:[^#]*&)?list=([a-zA-Z0-9_-]+)/);
  if (youtubePlaylist) {
    return {
      type: "youtube-playlist",
      id: youtubePlaylist[1],
      source: "YouTube",
    };
  }

  const spotifyTrack = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/);
  if (spotifyTrack) {
    return {
      type: "spotify-track",
      id: spotifyTrack[1],
      source: "Spotify",
    };
  }

  const spotifyPlaylist = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([a-zA-Z0-9]+)/);
  if (spotifyPlaylist) {
    return {
      type: "spotify-playlist",
      id: spotifyPlaylist[1],
      source: "Spotify",
    };
  }

  const spotifyAlbum = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?album\/([a-zA-Z0-9]+)/);
  if (spotifyAlbum) {
    return {
      type: "spotify-album",
      id: spotifyAlbum[1],
      source: "Spotify",
    };
  }

  return null;
}

function Badge({ children, variant = "neutral" }) {
  const variants = {
    neutral: "border-white/10 bg-white/5 text-zinc-300",
    youtube: "border-red-400/20 bg-red-500/10 text-red-200",
    spotify: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${variants[variant]}`}>
      {children}
    </span>
  );
}

export default function InlineMediaEmbedPlayer() {
  const [linkInput, setLinkInput] = useState("");
  const [error, setError] = useState("");
  const [currentMode, setCurrentMode] = useState("video");
  const [currentData, setCurrentData] = useState(null);

  const isSpotify = currentData?.source === "Spotify";
  const showModeToggle = currentData?.source === "YouTube";

  const currentLabel = useMemo(() => {
    if (!currentData) return "";
    if (currentData.type === "youtube-playlist") return "Playlist";
    if (currentData.type === "youtube-video") return currentMode === "audio" ? "Video en lecture audio" : "Video";
    if (currentData.type === "spotify-track") return "Titre";
    if (currentData.type === "spotify-playlist") return "Playlist";
    if (currentData.type === "spotify-album") return "Album";
    return "";
  }, [currentData, currentMode]);

  function loadLink(urlOverride) {
    const nextUrl = typeof urlOverride === "string" ? urlOverride : linkInput;
    const trimmed = nextUrl.trim();

    if (!trimmed) {
      setError("Entre un lien YouTube ou Spotify avant de charger.");
      setCurrentData(null);
      return;
    }

    const parsed = parseLink(trimmed);
    if (!parsed) {
      setError("Lien non reconnu. Utilise une video ou playlist YouTube, ou un titre, album ou playlist Spotify.");
      setCurrentData(null);
      return;
    }

    setError("");
    setLinkInput(trimmed);
    setCurrentData(parsed);
    setCurrentMode("video");
  }

  function renderYouTube() {
    if (!currentData) return null;

    const src =
      currentData.type === "youtube-playlist"
        ? `https://www.youtube.com/embed/videoseries?list=${currentData.id}&autoplay=1`
        : `https://www.youtube.com/embed/${currentData.id}?autoplay=1${currentData.listId ? `&list=${currentData.listId}` : ""}`;

    if (currentMode === "audio") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
              <AudioIcon size={18} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">Mode audio active</p>
              <p className="mt-1 text-sm text-zinc-400">La video tourne en arriere-plan pour conserver le son.</p>
            </div>
            <Badge variant="youtube">YouTube</Badge>
          </div>
          <iframe
            title="YouTube audio"
            src={src}
            className="absolute h-0 w-0 opacity-0 pointer-events-none"
            allow="autoplay; encrypted-media"
          />
          <p className="text-sm leading-6 text-zinc-400">
            YouTube ne fournit pas de lecteur audio pur. Le lecteur masque simplement l&apos;image jusqu&apos;au retour en mode video.
          </p>
        </div>
      );
    }

    return (
      <iframe
        title="YouTube embed"
        className="block aspect-video w-full rounded-[1.25rem]"
        src={src}
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    );
  }

  function renderSpotify() {
    if (!currentData) return null;

    let src = "";
    let className = "h-[380px]";

    if (currentData.type === "spotify-track") {
      src = `https://open.spotify.com/embed/track/${currentData.id}`;
      className = "h-20";
    } else if (currentData.type === "spotify-playlist") {
      src = `https://open.spotify.com/embed/playlist/${currentData.id}`;
    } else {
      src = `https://open.spotify.com/embed/album/${currentData.id}`;
    }

    return (
      <iframe
        title="Spotify embed"
        className={`block w-full rounded-[1.25rem] ${className}`}
        src={src}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    );
  }

  return (
    <section className="mb-6 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black shadow-lg shadow-emerald-500/10">
              <MusicIcon size={22} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Lecteur direct</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Colle un lien YouTube ou Spotify</h2>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Le contenu s&apos;affiche directement sur la page, avec bascule video/audio pour YouTube et embed Spotify pour les titres, albums et playlists.
          </p>
        </div>

        {currentData ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isSpotify ? "spotify" : "youtube"}>{currentData.source}</Badge>
            {currentLabel ? <Badge>{currentLabel}</Badge> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <LinkIcon size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={linkInput}
              onChange={(event) => setLinkInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadLink();
              }}
              placeholder="Colle un lien YouTube ou Spotify..."
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white outline-none transition focus:border-emerald-400/40 focus:bg-white/10"
            />
          </label>

          <button
            type="button"
            onClick={() => loadLink()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-black transition hover:bg-emerald-300"
          >
            <PlayIcon size={16} />
            Charger
          </button>
        </div>

        {error ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3 text-sm text-red-200">
            <AlertCircleIcon size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {showModeToggle ? (
          <div className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setCurrentMode("video")}
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm transition ${currentMode === "video" ? "bg-white text-black" : "text-zinc-300 hover:text-white"}`}
            >
              <VideoIcon size={15} />
              Video
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode("audio")}
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm transition ${currentMode === "audio" ? "bg-white text-black" : "text-zinc-300 hover:text-white"}`}
            >
              <AudioIcon size={15} />
              Audio
            </button>
          </div>
        ) : null}

        {currentData ? (
          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
            <div className="space-y-4">
              {isSpotify ? renderSpotify() : renderYouTube()}
              <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-zinc-400">
                <Badge variant={isSpotify ? "spotify" : "youtube"}>{currentData.source}</Badge>
                <span>{currentLabel}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => loadLink(example.url)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            {example.label}
          </button>
        ))}
      </div>
    </section>
  );
}
