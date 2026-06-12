export function parseEmbeddedMediaLink(rawUrl) {
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
