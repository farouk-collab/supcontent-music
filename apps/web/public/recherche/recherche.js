import { apiFetch, toast, escapeHtml, resolveMediaUrl, requireLogin } from "/noyau/app.js";

const STORAGE_KEY = "supcontent_imported_playlists_v1";

const searchBarForm = document.querySelector("#searchBarForm");
const musicSearchInput = document.querySelector("#musicSearchInput");
const clearSearchBtn = document.querySelector("#clearSearchBtn");
const sourceButtons = Array.from(document.querySelectorAll(".source-btn[data-source]"));
const typeButtons = Array.from(document.querySelectorAll(".type-btn[data-type]"));
const importPlatformButtons = Array.from(document.querySelectorAll("[data-import-platform]"));
const importTitle = document.querySelector("#importTitle");
const importSubtitle = document.querySelector("#importSubtitle");
const importLogo = document.querySelector("#importLogo");
const playlistUrlInput = document.querySelector("#playlistUrlInput");
const loadPlaylistBtn = document.querySelector("#loadPlaylistBtn");
const mergePlaylistsBtn = document.querySelector("#mergePlaylistsBtn");
const playImportedBtn = document.querySelector("#playImportedBtn");
const syncPlatformsBtn = document.querySelector("#syncPlatformsBtn");
const favoritesOnlyBtn = document.querySelector("#favoritesOnlyBtn");
const importedPlaylistsBox = document.querySelector("#importedPlaylists");
const results = document.querySelector("#results");
const hint = document.querySelector("#hint");

let currentSource = "spotify";
let currentType = "track";
let currentImportSource = "youtube";
let showFavoritesOnly = false;
let importedPlaylists = readImportedPlaylists();
let lastSearchItems = [];
let randomLoading = false;

const RANDOM_SPOTIFY_TERMS = [
  "afrobeats",
  "house",
  "drill",
  "rap fr",
  "amapiano",
  "dancehall",
  "rnb",
  "electro",
  "pop",
  "trap",
  "latin",
  "funk",
  "jazz",
  "lofi",
  "chill",
  "soul",
];

function mediaHref(type, id) {
  const safeType = String(type || "").trim();
  const safeId = String(id || "").trim();
  if (!safeType || !safeId) return "#";
  const q = `type=${encodeURIComponent(safeType)}&id=${encodeURIComponent(safeId)}`;
  return `/media/media.html?${q}#${q}`;
}

function externalYouTubeHref(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return "#";
  const q = `ext=youtube&url=${encodeURIComponent(safeUrl)}`;
  return `/media/media.html?${q}#${q}`;
}

function playYouTubeInline(url, title = "YouTube", subtitle = "") {
  const player = window.supcontentPlayer;
  if (!player?.playYouTube) return false;
  player.playYouTube({ url, title, subtitle, mode: "audio" });
  return true;
}

function pickItems(data) {
  return data?.items || data?.tracks?.items || data?.albums?.items || data?.artists?.items || [];
}

function pickImage(item) {
  const candidates = [
    ...(Array.isArray(item?.images) ? item.images : []),
    ...(Array.isArray(item?.album?.images) ? item.album.images : []),
  ];
  if (!candidates.length) return "";
  return candidates[0]?.url || candidates[0] || "";
}

function readImportedPlaylists() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        id: String(x?.id || crypto.randomUUID()),
        source: String(x?.source || "spotify"),
        title: String(x?.title || "Playlist importee"),
        url: String(x?.url || ""),
        tracks: Array.isArray(x?.tracks)
          ? x.tracks
              .map((t) => {
                if (typeof t === "string") {
                  const name = String(t || "").trim();
                  return name ? { id: "", name, artists: [], preview_url: "", spotify_url: "", image: "" } : null;
                }
                const name = String(t?.name || "").trim();
                if (!name) return null;
                return {
                  id: String(t?.id || ""),
                  name,
                  artists: Array.isArray(t?.artists) ? t.artists.map((a) => String(a || "").trim()).filter(Boolean) : [],
                  preview_url: String(t?.preview_url || ""),
                  spotify_url: String(t?.spotify_url || ""),
                  image: String(t?.image || ""),
                };
              })
              .filter(Boolean)
          : [],
        favorite: x?.favorite === true,
        createdAt: String(x?.createdAt || new Date().toISOString()),
        syncedAt: String(x?.syncedAt || ""),
      }))
      .slice(0, 120);
  } catch {
    return [];
  }
}

function writeImportedPlaylists(items) {
  importedPlaylists = Array.isArray(items) ? items : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(importedPlaylists));
}

function inferSourceFromUrl(url) {
  const lower = String(url || "").toLowerCase();
  if (!lower) return "";
  if (lower.includes("spotify.com/playlist")) return "spotify";
  if (lower.includes("youtube.com/playlist") || lower.includes("music.youtube.com/playlist")) return "youtube";
  return "";
}

function extractPlaylistNameFromUrl(url, fallbackSource) {
  try {
    const u = new URL(url);
    const list = String(u.searchParams.get("list") || "").trim();
    if (list) return `${fallbackSource === "youtube" ? "YouTube" : "Spotify"} ${list.slice(0, 8)}`;
  } catch {
    // ignore
  }
  return `${fallbackSource === "youtube" ? "Playlist YouTube" : "Playlist Spotify"} ${new Date().toLocaleDateString("fr-FR")}`;
}

function tracksFromLastSearch() {
  return lastSearchItems
    .map((it) => {
      const name = String(it?.name || "").trim();
      if (!name) return null;
      return {
        id: String(it?.id || ""),
        name,
        artists: Array.isArray(it?.artists) ? it.artists.map((a) => String(a?.name || "")).filter(Boolean) : [],
        preview_url: "",
        spotify_url: String(it?.external_urls?.spotify || ""),
        image: String(pickImage(it) || ""),
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

async function fetchSpotifyPlaylistTracks(url) {
  const data = await apiFetch(`/spotify/playlist?url=${encodeURIComponent(String(url || "").trim())}&limit=150`);
  const playlist = data?.playlist || {};
  const tracks = Array.isArray(data?.items)
    ? data.items.map((t) => ({
        id: String(t?.id || ""),
        name: String(t?.name || "").trim(),
        artists: Array.isArray(t?.artists) ? t.artists.map((a) => String(a || "").trim()).filter(Boolean) : [],
        preview_url: String(t?.preview_url || ""),
        spotify_url: String(t?.spotify_url || ""),
        image: String(t?.image || ""),
      }))
    : [];
  return {
    title: String(playlist?.name || "").trim(),
    tracks: tracks.filter((t) => t.name),
  };
}

function setSource(source) {
  currentSource = source === "youtube" ? "youtube" : "spotify";
  sourceButtons.forEach((btn) => {
    const isActive = btn.getAttribute("data-source") === currentSource;
    btn.classList.toggle("is-active", isActive);
  });
  hint.textContent =
    currentSource === "youtube"
      ? "Source active: YouTube. Import via URL de playlist disponible."
      : "Source active: Spotify. Recherche API complète.";
}

function setType(type) {
  currentType = ["track", "artist", "album"].includes(type) ? type : "track";
  typeButtons.forEach((btn) => btn.classList.toggle("is-active", btn.getAttribute("data-type") === currentType));
}

function setImportSource(source) {
  currentImportSource = source === "spotify" ? "spotify" : "youtube";
  importPlatformButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-import-platform") === currentImportSource);
  });
  if (importTitle) {
    importTitle.textContent = currentImportSource === "spotify" ? "Importer depuis Spotify" : "Importer depuis YouTube";
  }
  if (importSubtitle) {
    importSubtitle.textContent =
      currentImportSource === "spotify"
        ? "Collez le lien de la playlist Spotify"
        : "Collez le lien de la playlist YouTube";
  }
  if (importLogo) {
    importLogo.textContent = currentImportSource === "spotify" ? "S" : "▶";
    importLogo.classList.toggle("spotify", currentImportSource === "spotify");
  }
  if (playlistUrlInput && !playlistUrlInput.value.trim()) {
    playlistUrlInput.value =
      currentImportSource === "spotify"
        ? "https://open.spotify.com/playlist/"
        : "https://music.youtube.com/playlist?list=";
  }
  if (loadPlaylistBtn) {
    loadPlaylistBtn.classList.toggle("spotify", currentImportSource === "spotify");
  }
}

function renderMusicItem(it) {
  const img = resolveMediaUrl(pickImage(it));
  const name = it.name || "";
  const id = it.id;
  const type = it.type;
  const sub = it.artists ? it.artists.map((a) => a.name).join(", ") : it.genres ? it.genres.join(", ") : "";
  const href = mediaHref(type, id);

  return `
    <a class="item" href="${href}">
      <div class="cover">${img ? `<img src="${escapeHtml(img)}" alt="">` : `<div class="badge">no image</div>`}</div>
      <div class="meta">
        <div class="title">${escapeHtml(name)}</div>
        <div class="sub">${escapeHtml(sub)}</div>
        <div class="badge">Ouvrir detail</div>
      </div>
    </a>
  `;
}

function renderYouTubePlaceholder(q) {
  const youtubeLists = importedPlaylists.filter((p) => p.source === "youtube");
  const filtered = q
    ? youtubeLists.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()))
    : youtubeLists;
  if (!filtered.length) {
    results.innerHTML = `<small>Aucune playlist YouTube importee pour l'instant.</small>`;
    hint.textContent = "Importe un lien YouTube pour alimenter cette source.";
    return;
  }
  results.innerHTML = filtered
    .map(
      (p) => `
      <a class="item" href="${escapeHtml(externalYouTubeHref(p.url))}" data-inline-yt="1" data-yt-url="${escapeHtml(
        p.url
      )}" data-yt-title="${escapeHtml(p.title)}">
        <div class="cover"><div class="badge">YT</div></div>
        <div class="meta">
          <div class="title">${escapeHtml(p.title)}</div>
          <div class="sub">${escapeHtml(`${p.tracks.length} titres importes`)}</div>
          <div class="badge">Lire sur le site</div>
        </div>
      </a>
    `
    )
    .join("");
  hint.textContent = `Playlists YouTube: ${filtered.length}`;
  results.querySelectorAll("[data-inline-yt='1']").forEach((el) => {
    el.addEventListener("click", (ev) => {
      const url = String(el.getAttribute("data-yt-url") || "");
      const title = String(el.getAttribute("data-yt-title") || "YouTube");
      if (playYouTubeInline(url, title, "Playlist YouTube")) ev.preventDefault();
    });
  });
}

function pickRandomTerms(count = 2) {
  const pool = [...RANDOM_SPOTIFY_TERMS];
  const out = [];
  while (pool.length && out.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

async function renderRandomSpotifyResults() {
  if (randomLoading) return;
  randomLoading = true;
  results.innerHTML = `<small>Chargement de résultats aléatoires Spotify...</small>`;

  try {
    const terms = pickRandomTerms(2);
    const responses = await Promise.all(
      terms.map((term) =>
        apiFetch(
          `/search?q=${encodeURIComponent(term)}&type=${encodeURIComponent(currentType)}&limit=${encodeURIComponent("8")}`
        ).catch(() => ({ items: [] }))
      )
    );

    const allItems = responses.flatMap((res) => pickItems(res));
    const seen = new Set();
    const uniqueItems = [];
    for (const item of allItems) {
      const key = `${String(item?.type || "")}:${String(item?.id || "")}`;
      if (!item?.id || seen.has(key)) continue;
      seen.add(key);
      uniqueItems.push(item);
      if (uniqueItems.length >= 12) break;
    }

    lastSearchItems = uniqueItems;
    if (!uniqueItems.length) {
      results.innerHTML = `<small>Aucun résultat aléatoire disponible pour le moment.</small>`;
      hint.textContent = "Relance dans quelques secondes.";
      return;
    }

    results.innerHTML = uniqueItems.map(renderMusicItem).join("");
    hint.textContent = `Suggestions Spotify aléatoires (${currentType})`;
  } catch (err) {
    results.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err?.message || "Erreur")}</small>`;
    hint.textContent = "Impossible de charger les suggestions Spotify.";
  } finally {
    randomLoading = false;
  }
}

async function runSearch() {
  const q = String(musicSearchInput?.value || "").trim();
  results.innerHTML = `<small>Chargement...</small>`;
  hint.textContent = "";

  if (currentSource === "youtube") {
    renderYouTubePlaceholder(q);
    return;
  }

  if (!q) {
    await renderRandomSpotifyResults();
    return;
  }

  try {
    const mediaData = await apiFetch(
      `/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(currentType)}&limit=${encodeURIComponent("12")}`
    );
    const items = pickItems(mediaData);
    lastSearchItems = items;
    if (!items.length) {
      results.innerHTML = `<small>Aucun resultat</small>`;
      hint.textContent = "Essaie un autre mot-cle.";
      return;
    }
    results.innerHTML = items.map(renderMusicItem).join("");
    hint.textContent = `Source: Spotify | Type: ${currentType} | Resultats: ${items.length}`;
  } catch (err) {
    results.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err?.message || "Erreur")}</small>`;
    toast(err?.message || "Erreur recherche", "Erreur");
  }
}

function renderImportedPlaylists() {
  if (!importedPlaylistsBox) return;
  const rows = (showFavoritesOnly ? importedPlaylists.filter((x) => x.favorite) : importedPlaylists).slice().reverse();
  if (!rows.length) {
    importedPlaylistsBox.innerHTML = `<small>Aucune playlist importee.</small>`;
    return;
  }
  importedPlaylistsBox.innerHTML = rows
    .map(
      (p) => `
      <div class="playlist-line">
        <div class="meta">
          <strong>${escapeHtml(p.title)}</strong>
          <div class="sub">${escapeHtml(p.source.toUpperCase())} · ${escapeHtml(p.tracks.length)} titres · ${escapeHtml(
        p.createdAt.slice(0, 10)
      )}${p.syncedAt ? ` · sync ${escapeHtml(p.syncedAt.slice(0, 10))}` : ""}</div>
          <div class="sub">${escapeHtml(p.url)}</div>
          ${
            p.source === "spotify" && p.tracks.length
              ? `<div class="sub">${escapeHtml(
                  p.tracks
                    .slice(0, 4)
                    .map((t) => {
                      const artists = Array.isArray(t?.artists) ? t.artists.join(", ") : "";
                      return artists ? `${t.name} - ${artists}` : t.name;
                    })
                    .join(" • ")
                )}${p.tracks.length > 4 ? " • ..." : ""}</div>`
              : ""
          }
        </div>
        <div class="actions">
          <button class="btn" type="button" data-fav-id="${escapeHtml(p.id)}">${p.favorite ? "★ Favori" : "☆ Favori"}</button>
          <button class="btn" type="button" data-open-id="${escapeHtml(p.id)}">Ouvrir</button>
          <button class="btn danger" type="button" data-del-id="${escapeHtml(p.id)}">Supprimer</button>
        </div>
      </div>
    `
    )
    .join("");

  importedPlaylistsBox.querySelectorAll("[data-fav-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = String(btn.getAttribute("data-fav-id") || "");
      const next = importedPlaylists.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p));
      writeImportedPlaylists(next);
      renderImportedPlaylists();
    });
  });
  importedPlaylistsBox.querySelectorAll("[data-open-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = String(btn.getAttribute("data-open-id") || "");
      const row = importedPlaylists.find((p) => p.id === id);
      if (!row?.url) return;
      if (row.source === "youtube") {
        if (playYouTubeInline(row.url, row.title, "Playlist YouTube")) return;
        window.location.href = externalYouTubeHref(row.url);
        return;
      }
      window.open(row.url, "_blank", "noopener,noreferrer");
    });
  });
  importedPlaylistsBox.querySelectorAll("[data-del-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = String(btn.getAttribute("data-del-id") || "");
      writeImportedPlaylists(importedPlaylists.filter((p) => p.id !== id));
      renderImportedPlaylists();
    });
  });
}

function addImportedPlaylistFromUrl(raw) {
  return addImportedPlaylistFromUrlAsync(raw);
}

async function addImportedPlaylistFromUrlAsync(raw) {
  const url = String(raw || "").trim();
  if (!url) {
    toast("Colle un lien de playlist.", "Erreur");
    return;
  }
  const inferred = inferSourceFromUrl(url);
  if (!inferred) {
    toast("Lien non reconnu. Utilise une URL playlist Spotify ou YouTube.", "Erreur");
    return;
  }
  if (inferred !== currentImportSource) {
    toast(`Lien ${inferred} detecte. Choisis ${inferred} dans l'import.`, "Erreur");
    return;
  }
  let title = extractPlaylistNameFromUrl(url, inferred);
  let tracks = tracksFromLastSearch();

  if (inferred === "spotify") {
    try {
      const resolved = await fetchSpotifyPlaylistTracks(url);
      if (resolved.title) title = resolved.title;
      if (resolved.tracks.length) tracks = resolved.tracks;
    } catch (e) {
      toast("Impossible de lire toute la playlist Spotify, import partiel.", "Erreur");
    }
  }

  const row = {
    id: crypto.randomUUID(),
    source: inferred,
    title,
    url,
    tracks,
    favorite: false,
    createdAt: new Date().toISOString(),
    syncedAt: "",
  };
  writeImportedPlaylists([row, ...importedPlaylists].slice(0, 120));
  renderImportedPlaylists();
  toast(
    `Playlist ${inferred === "youtube" ? "YouTube" : "Spotify"} importee (${tracks.length} titres).`,
    "OK"
  );
}

function mergePlaylists() {
  if (importedPlaylists.length < 2) {
    toast("Ajoute au moins 2 playlists pour fusionner.", "Erreur");
    return;
  }
  const mergedTracks = Array.from(
    new Set(importedPlaylists.flatMap((p) => (Array.isArray(p.tracks) ? p.tracks : [])).map((t) => String(t || "").trim()))
  ).filter(Boolean);
  const merged = {
    id: crypto.randomUUID(),
    source: "spotify",
    title: `Fusion ${new Date().toLocaleString("fr-FR")}`,
    url: "",
    tracks: mergedTracks,
    favorite: false,
    createdAt: new Date().toISOString(),
    syncedAt: "",
  };
  writeImportedPlaylists([merged, ...importedPlaylists].slice(0, 120));
  renderImportedPlaylists();
  toast("Playlists fusionnees.", "OK");
}

function playImported() {
  const candidate =
    importedPlaylists.find((p) => p.favorite) ||
    importedPlaylists.find((p) => p.url) ||
    null;
  if (!candidate) {
    toast("Aucune playlist a lire.", "Erreur");
    return;
  }
  if (candidate.url) {
    if (candidate.source === "youtube") {
      if (playYouTubeInline(candidate.url, candidate.title, "Playlist YouTube")) return;
      window.location.href = externalYouTubeHref(candidate.url);
      return;
    }
    const preview = candidate.tracks.find((t) => String(t?.preview_url || "").trim());
    if (preview?.preview_url && window.supcontentPlayer?.playMedia) {
      window.supcontentPlayer.playMedia({
        url: preview.preview_url,
        title: preview.name || candidate.title,
        subtitle: Array.isArray(preview.artists) ? preview.artists.join(", ") : "Spotify preview",
        cover: preview.image || "",
        mode: "audio",
      });
      return;
    }
    window.open(candidate.url, "_blank", "noopener,noreferrer");
    return;
  }
  toast("Lecture indisponible: cette playlist n'a pas d'URL source.", "Erreur");
}

function syncPlatforms() {
  if (!importedPlaylists.length) {
    toast("Aucune playlist a synchroniser.", "Erreur");
    return;
  }
  const now = new Date().toISOString();
  const next = importedPlaylists.map((p) => ({ ...p, syncedAt: now }));
  writeImportedPlaylists(next);
  renderImportedPlaylists();
  toast("Synchronisation terminee.", "OK");
}

searchBarForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch();
});
musicSearchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runSearch();
  }
});
clearSearchBtn?.addEventListener("click", () => {
  if (!musicSearchInput) return;
  musicSearchInput.value = "";
  results.innerHTML = "";
  hint.textContent = "";
  if (currentSource === "spotify") {
    renderRandomSpotifyResults();
  }
  musicSearchInput.focus();
});

sourceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const source = String(btn.getAttribute("data-source") || "spotify");
    setSource(source);
    runSearch();
  });
});

typeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const t = String(btn.getAttribute("data-type") || "track");
    setType(t);
    runSearch();
  });
});

importPlatformButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const source = String(btn.getAttribute("data-import-platform") || "youtube");
    setImportSource(source);
    playlistUrlInput?.focus();
  });
});

loadPlaylistBtn?.addEventListener("click", () => {
  if (!requireLogin()) return;
  loadPlaylistBtn.setAttribute("disabled", "disabled");
  addImportedPlaylistFromUrl(String(playlistUrlInput?.value || "")).finally(() => {
    loadPlaylistBtn.removeAttribute("disabled");
  });
});
playlistUrlInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (!requireLogin()) return;
    loadPlaylistBtn.setAttribute("disabled", "disabled");
    addImportedPlaylistFromUrl(String(playlistUrlInput.value || "")).finally(() => {
      loadPlaylistBtn.removeAttribute("disabled");
    });
  }
});

mergePlaylistsBtn?.addEventListener("click", () => {
  if (!requireLogin()) return;
  mergePlaylists();
});
playImportedBtn?.addEventListener("click", () => {
  if (!requireLogin()) return;
  playImported();
});
syncPlatformsBtn?.addEventListener("click", () => {
  if (!requireLogin()) return;
  syncPlatforms();
});
favoritesOnlyBtn?.addEventListener("click", () => {
  if (!requireLogin()) return;
  showFavoritesOnly = !showFavoritesOnly;
  favoritesOnlyBtn.classList.toggle("primary", showFavoritesOnly);
  favoritesOnlyBtn.textContent = showFavoritesOnly ? "Tous les imports" : "Favoris uniquement";
  renderImportedPlaylists();
});

renderImportedPlaylists();
setSource("spotify");
setType("track");
setImportSource("youtube");
renderRandomSpotifyResults();
