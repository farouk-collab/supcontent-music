import { apiFetch, toast, resolveMediaUrl, requireLogin } from "/noyau/app.js";

const STORAGE_KEY = "supcontent_imported_playlists_v1";

const DEFAULT_NOTIFICATIONS = [
  { id: 1, type: "release", user: "Nina.beats", text: "a partage une nouvelle sortie : Timeless - The Weeknd", time: "Il y a 2 min", read: false },
  { id: 2, type: "community", user: "Ayo.wav", text: "a aime ta playlist Afro Sunset", time: "Il y a 8 min", read: false },
  { id: 3, type: "follow", user: "Luna.mix", text: "a commence a te suivre", time: "Il y a 21 min", read: false },
  { id: 4, type: "comment", user: "Melo", text: 'a commente ton post : "grosse ambiance ce son"', time: "Il y a 1 h", read: true },
  { id: 5, type: "playlist", user: "DJ Nova", text: "a ajoute ton morceau a la playlist Midnight Drive", time: "Il y a 2 h", read: true },
  { id: 6, type: "release", user: "Kez.fm", text: "a publie un extrait exclusif dans ses stories", time: "Il y a 3 h", read: true },
  { id: 7, type: "community", user: "SoundWave", text: 'a reposte ta review "Night Drive Energy"', time: "Hier", read: true },
];

const spotifySuggestionsBank = [
  { id: "s1", title: "Timeless", subtitle: "The Weeknd � Titre" },
  { id: "s2", title: "UTOPIA", subtitle: "Travis Scott � Album" },
  { id: "s3", title: "Tems", subtitle: "Artiste verifie" },
  { id: "s4", title: "Afrobeats Now", subtitle: "Playlist editoriale" },
  { id: "s5", title: "Metro Boomin", subtitle: "Artiste producteur" },
  { id: "s6", title: "Aya Nakamura", subtitle: "Artiste pop / afro" },
];

const fallbackSpotifyResults = [
  { id: "sp-track-1", kind: "tracks", title: "Timeless", subtitle: "The Weeknd � After Midnight", coverLabel: "Single", detail: "Ouvrir detail media", href: "#" },
  { id: "sp-track-2", kind: "tracks", title: "FE!N", subtitle: "Travis Scott � UTOPIA", coverLabel: "Single", detail: "Ouvrir detail media", href: "#" },
  { id: "sp-artist-1", kind: "artists", title: "Tems", subtitle: "Artiste � Soul / Afro", coverLabel: "Artist", detail: "Ouvrir profil artiste", href: "#" },
  { id: "sp-artist-2", kind: "artists", title: "Metro Boomin", subtitle: "Artiste � Producteur", coverLabel: "Artist", detail: "Ouvrir profil artiste", href: "#" },
  { id: "sp-album-1", kind: "albums", title: "Moon Signals", subtitle: "Tems � Album", coverLabel: "Album", detail: "Ouvrir detail media", href: "#" },
  { id: "sp-album-2", kind: "albums", title: "UTOPIA", subtitle: "Travis Scott � Album", coverLabel: "Album", detail: "Ouvrir detail media", href: "#" },
];

const fallbackYoutubeResults = [
  { id: "yt-track-1", kind: "tracks", title: "Timeless (Live Session)", subtitle: "YouTube Video � The Weeknd", coverLabel: "Video", detail: "Ouvrir detail media", youtubePlayable: true, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", href: "#" },
  { id: "yt-track-2", kind: "tracks", title: "Afro Sunset Mix", subtitle: "YouTube Video � DJ Nova", coverLabel: "Video", detail: "Ouvrir detail media", youtubePlayable: true, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", href: "#" },
  { id: "yt-artist-1", kind: "artists", title: "A COLORS SHOW", subtitle: "Chaine / createur", coverLabel: "Channel", detail: "Ouvrir detail media", youtubePlayable: false, url: "", href: "#" },
  { id: "yt-album-1", kind: "albums", title: "Late Night Pop Essentials", subtitle: "Playlist importee YouTube", coverLabel: "Playlist", detail: "Ouvrir playlist importee", youtubePlayable: true, url: "https://music.youtube.com/playlist?list=PLmock001", href: "#" },
  { id: "yt-album-2", kind: "albums", title: "Rap FR Recharge", subtitle: "Playlist importee YouTube", coverLabel: "Playlist", detail: "Ouvrir playlist importee", youtubePlayable: true, url: "https://music.youtube.com/playlist?list=PLmock002", href: "#" },
];

const fallbackImportedPlaylists = [
  { id: "pl-1", title: "Night Drive", source: "Spotify", tracks: 24, favorite: true, synced: true, loginRequired: true, url: "https://open.spotify.com/playlist/mock001" },
  { id: "pl-2", title: "Rap FR Recharge", source: "YouTube", tracks: 31, favorite: false, synced: false, loginRequired: true, url: "https://music.youtube.com/playlist?list=PLmock002" },
  { id: "pl-3", title: "Afro Sunset", source: "Spotify", tracks: 18, favorite: true, synced: true, loginRequired: true, url: "https://open.spotify.com/playlist/mock003" },
  { id: "md-1", title: "SoundHelix Demo", source: "Lien audio", tracks: 1, favorite: false, synced: true, loginRequired: true, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", mediaType: "audio", itemType: "media" },
  { id: "md-2", title: "Video Demo", source: "Lien video", tracks: 1, favorite: false, synced: false, loginRequired: true, url: "https://www.w3schools.com/html/mov_bbb.mp4", mediaType: "video", itemType: "media" },
];

const RANDOM_SPOTIFY_TERMS = ["afrobeats", "house", "drill", "rap fr", "amapiano", "dancehall", "rnb", "electro", "pop", "trap", "latin", "funk", "jazz", "lofi", "chill", "soul"];

const state = {
  notificationsOpen: false,
  notifications: sanitizeNotifications(DEFAULT_NOTIFICATIONS),
  socketConnected: true,
  lastRealtimeEvent: "Dernier evenement il y a quelques secondes",
  searchValue: "",
  activeSource: "spotify",
  activeType: "tracks",
  favoritesOnly: false,
  inlinePlayerId: null,
  suggestionsSeed: 0,
  lastSearch: "Timeless",
  loadingResults: false,
  spotifyResultsLive: [],
  spotifySuggestionsLive: [],
  importedPlaylists: [],
  hasPersistedPlaylists: false,
};

const refs = {
  dropdown: document.querySelector("#searchNotifDropdown"),
  notifBtn: document.querySelector("#searchNotifBtn"),
  notifBadge: document.querySelector("#searchNotifBadge"),
  realtimePill: document.querySelector("#searchRealtimePill"),
  notifPanel: document.querySelector("#searchNotifPanel"),
  notifStatus: document.querySelector("#searchNotifStatus"),
  notifStats: document.querySelector("#searchNotifStats"),
  notifLast: document.querySelector("#searchNotifLast"),
  notifList: document.querySelector("#searchNotifList"),
  mockNotifBtn: document.querySelector("#searchMockNotifBtn"),
  markAllReadBtn: document.querySelector("#searchMarkAllReadBtn"),
  searchInput: document.querySelector("#searchInput"),
  searchClearBtn: document.querySelector("#searchClearBtn"),
  sourceButtons: Array.from(document.querySelectorAll("[data-source]")),
  typeButtons: Array.from(document.querySelectorAll("[data-type]")),
  lastValue: document.querySelector("#searchLastValue"),
  currentSource: document.querySelector("#searchCurrentSource"),
  suggestionsSection: document.querySelector("#searchSuggestionsSection"),
  suggestionsGrid: document.querySelector("#searchSuggestionsGrid"),
  refreshSuggestionsBtn: document.querySelector("#searchRefreshSuggestionsBtn"),
  resultsCount: document.querySelector("#searchResultsCount"),
  resultsList: document.querySelector("#searchResultsList"),
  favoritesOnlyBtn: document.querySelector("#searchFavoritesOnlyBtn"),
  playlistsCount: document.querySelector("#searchPlaylistsCount"),
  playlistsGrid: document.querySelector("#searchPlaylistsGrid"),
  importSpotifyBtn: document.querySelector("#searchImportSpotifyBtn"),
  importYoutubeBtn: document.querySelector("#searchImportYoutubeBtn"),
  importMediaBtn: document.querySelector("#searchImportMediaBtn"),
  mergePlaylistsBtn: document.querySelector("#searchMergePlaylistsBtn"),
  syncPlaylistsBtn: document.querySelector("#searchSyncPlaylistsBtn"),
  importLinkInput: document.querySelector("#searchImportLinkInput"),
  importLoadBtn: document.querySelector("#searchImportLoadBtn"),
  importError: document.querySelector("#searchImportError"),
  importErrorText: document.querySelector("#searchImportErrorText"),
  importPlayer: document.querySelector("#searchImportPlayer"),
  importExampleButtons: Array.from(document.querySelectorAll("[data-import-example]")),
};

let wsTimer = null;
let searchRequestId = 0;
let suggestionRequestId = 0;

function sanitizeNotification(item, fallbackIndex = 0) {
  if (!item || typeof item !== "object") {
    return { id: `fallback-${fallbackIndex}`, type: "system", user: "Systeme", text: "Notification indisponible", time: "Maintenant", read: true };
  }
  return {
    id: item.id ?? `generated-${fallbackIndex}`,
    type: item.type ?? "system",
    user: item.user ?? "Systeme",
    text: item.text ?? "Nouvelle activite",
    time: item.time ?? "Maintenant",
    read: Boolean(item.read),
  };
}

function sanitizeNotifications(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => sanitizeNotification(item, index));
}

function runNotificationTests() {
  const cases = [
    { input: [{ id: 1, type: "comment", user: "Test", text: "ok", time: "now", read: false }], check: (result) => result.length === 1 && result[0].read === false && result[0].user === "Test" },
    { input: [{ id: 2, type: "follow", user: "Test", text: "ok", time: "now" }], check: (result) => result.length === 1 && result[0].read === false },
    { input: [undefined], check: (result) => result.length === 1 && result[0].user === "Systeme" && result[0].read === true },
    { input: null, check: (result) => Array.isArray(result) && result.length === 0 },
    { input: [{ id: 3 }], check: (result) => result.length === 1 && result[0].text === "Nouvelle activite" && result[0].user === "Systeme" },
    { input: [{ id: 4, read: 1 }, undefined, { user: "A" }], check: (result) => result.length === 3 && result[0].read === true && result[1].user === "Systeme" },
  ];
  return cases.map((test) => ({ passed: test.check(sanitizeNotifications(test.input)) }));
}

function readImportedPlaylists() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      id: String(item?.id || crypto.randomUUID()),
      title: String(item?.title || "Playlist importee"),
      source: String(item?.source || "Spotify"),
      tracks: Array.isArray(item?.tracks) ? item.tracks.length : Number(item?.tracks || 0),
      favorite: Boolean(item?.favorite),
      synced: Boolean(item?.syncedAt || item?.synced),
      loginRequired: true,
      url: String(item?.url || ""),
      itemType: String(item?.itemType || "playlist") === "media" ? "media" : "playlist",
      mediaType: String(item?.mediaType || "") === "audio" ? "audio" : String(item?.mediaType || "") === "video" ? "video" : "",
    }));
  } catch {
    return [];
  }
}

function hasPersistedPlaylists() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function setImportedRows(rows) {
  state.importedPlaylists = Array.isArray(rows) ? rows : [];
  state.hasPersistedPlaylists = state.importedPlaylists.length > 0;
}

async function hydrateImportedPlaylists() {
  try {
    const data = await apiFetch("/search-hub/imports");
    setImportedRows(Array.isArray(data?.items) ? data.items : []);
  } catch {
    setImportedRows(readImportedPlaylists());
    state.hasPersistedPlaylists = hasPersistedPlaylists();
  }
  renderPlaylists();
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function mediaHref(type, id) {
  const safeType = String(type || "").trim();
  const safeId = String(id || "").trim();
  if (!safeType || !safeId) return "#";
  return `/media/media.html?type=${encodeURIComponent(safeType)}&id=${encodeURIComponent(safeId)}`;
}

function externalYouTubeHref(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return "#";
  return `/media/media.html?ext=youtube&url=${encodeURIComponent(safeUrl)}`;
}

function playYouTubeInline(url, title = "YouTube", subtitle = "") {
  const player = window.supcontentPlayer;
  if (!player?.playYouTube || !url) return false;
  player.playYouTube({ url, title, subtitle, mode: "audio" });
  return true;
}

function pickItems(data) {
  return data?.items || data?.tracks?.items || data?.albums?.items || data?.artists?.items || [];
}

function pickImage(item) {
  const candidates = [...(Array.isArray(item?.images) ? item.images : []), ...(Array.isArray(item?.album?.images) ? item.album.images : [])];
  return candidates[0]?.url || candidates[0] || "";
}

function mapApiItem(item) {
  const type = String(item?.type || "track");
  const artists = Array.isArray(item?.artists) ? item.artists.map((artist) => String(artist?.name || "").trim()).filter(Boolean) : [];
  const subtitle = type === "artist" ? `Artiste${item?.genres?.length ? ` � ${item.genres.slice(0, 2).join(" / ")}` : ""}` : type === "album" ? `${artists.join(", ")} � Album` : `${artists.join(", ")}${item?.album?.name ? ` � ${item.album.name}` : ""}`;
  return { id: String(item?.id || crypto.randomUUID()), kind: type === "artist" ? "artists" : type === "album" ? "albums" : "tracks", type, title: String(item?.name || "Media"), subtitle: subtitle || "Resultat Spotify", coverLabel: type === "artist" ? "Artist" : type === "album" ? "Album" : "Single", detail: type === "artist" ? "Ouvrir profil artiste" : "Ouvrir detail media", image: resolveMediaUrl(pickImage(item)), href: mediaHref(type, item?.id), spotifyUrl: String(item?.external_urls?.spotify || ""), youtubePlayable: false, url: "" };
}

function pickRandomTerms(count = 2) {
  const pool = [...RANDOM_SPOTIFY_TERMS];
  const out = [];
  while (pool.length && out.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(index, 1)[0]);
  }
  return out;
}

function getUnreadCount() {
  return sanitizeNotifications(state.notifications).filter((item) => !item.read).length;
}

function getSafeNotifications() {
  return sanitizeNotifications(state.notifications);
}

function getNotificationIcon(type) {
  switch (type) {
    case "release": return "?";
    case "community": return "?";
    case "follow": return "+";
    case "comment": return "?";
    case "playlist": return "?";
    default: return "�";
  }
}

function storageRows() {
  if (state.importedPlaylists.length || state.hasPersistedPlaylists) return state.importedPlaylists;
  return fallbackImportedPlaylists;
}

function getVisibleSuggestions() {
  if (state.spotifySuggestionsLive.length) return state.spotifySuggestionsLive.slice(0, 4);
  const rotated = [...spotifySuggestionsBank];
  const offset = state.suggestionsSeed % rotated.length;
  return [...rotated.slice(offset), ...rotated.slice(0, offset)].slice(0, 4);
}

function getLiveResults() {
  if (state.activeSource === "spotify") {
    if (state.spotifyResultsLive.length) return state.spotifyResultsLive;
    return fallbackSpotifyResults.filter((item) => item.kind === state.activeType);
  }

  const query = state.searchValue.trim().toLowerCase();
  const importedYoutube = storageRows().filter((playlist) => playlist.source.toLowerCase() === "youtube" && playlist.itemType !== "media").map((playlist) => ({
    id: playlist.id,
    kind: "albums",
    title: playlist.title,
    subtitle: `Playlist importee YouTube � ${playlist.tracks} titres`,
    coverLabel: "Playlist",
    detail: "Ouvrir playlist importee",
    youtubePlayable: true,
    image: "",
    url: playlist.url || "",
    href: playlist.url ? externalYouTubeHref(playlist.url) : "#",
  }));

  const base = importedYoutube.length ? importedYoutube : fallbackYoutubeResults;
  const typed = base.filter((item) => item.kind === state.activeType);
  if (!query) return typed;
  return typed.filter((item) => item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query));
}

function getFilteredPlaylists() {
  return storageRows().filter((playlist) => (state.favoritesOnly ? playlist.favorite : true));
}

function renderNotifications() {
  const unreadCount = getUnreadCount();
  const safeNotifications = getSafeNotifications();
  const allTestsPassed = runNotificationTests().every((test) => test.passed);

  refs.notifBtn.classList.toggle("is-open", state.notificationsOpen);
  refs.notifPanel.hidden = !state.notificationsOpen;
  refs.notifBadge.hidden = unreadCount === 0;
  refs.notifBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  refs.realtimePill.textContent = state.socketConnected ? "Temps reel connecte" : "Temps reel hors ligne";
  refs.realtimePill.classList.toggle("is-offline", !state.socketConnected);
  refs.notifStatus.textContent = state.socketConnected ? "WebSocket simule : de nouvelles notifications arrivent automatiquement toutes les 5 secondes." : "Temps reel coupe : le flux live est en pause.";
  refs.notifStats.innerHTML = `
    <div class="search-stat-card"><span class="search-stat-label">Total</span><strong>${safeNotifications.length}</strong><span>notifications</span></div>
    <div class="search-stat-card is-pink"><span class="search-stat-label">Non lues</span><strong>${unreadCount}</strong><span>elements</span></div>
    <div class="search-stat-card is-blue"><span class="search-stat-label">Mode</span><strong>${allTestsPassed ? "OK" : "KO"}</strong><span>mock data live</span></div>
  `;
  refs.notifLast.textContent = `${allTestsPassed ? "Tests de robustesse passes" : "Un test de robustesse a echoue"} � ${state.lastRealtimeEvent}`;
  refs.notifList.innerHTML = safeNotifications.map((item) => `
    <button class="search-notif-item ${item.read ? "" : "is-unread"}" type="button" data-notif-id="${String(item.id)}">
      <div class="search-notif-icon">${getNotificationIcon(item.type)}</div>
      <div><div class="search-notif-text-row"><div class="search-notif-text"><strong>${escapeHtml(item.user)}</strong> ${escapeHtml(item.text)}</div>${item.read ? "" : '<span class="search-notif-dot"></span>'}</div><div class="search-notif-time">${escapeHtml(item.time)}</div></div>
    </button>
  `).join("");
  refs.notifList.querySelectorAll("[data-notif-id]").forEach((button) => button.addEventListener("click", () => markNotificationAsRead(button.getAttribute("data-notif-id"))));
}

function renderSearchControls() {
  refs.searchInput.value = state.searchValue;
  refs.searchClearBtn.hidden = !state.searchValue;
  refs.lastValue.textContent = state.lastSearch;
  refs.currentSource.textContent = state.activeSource;
  refs.sourceButtons.forEach((button) => button.classList.toggle("is-active-source", button.getAttribute("data-source") === state.activeSource));
  refs.typeButtons.forEach((button) => button.classList.toggle("is-active-type", button.getAttribute("data-type") === state.activeType));
}

function renderSuggestions() {
  const suggestions = getVisibleSuggestions();
  const hidden = Boolean(state.searchValue.trim());
  refs.suggestionsSection.hidden = hidden;
  if (hidden) return;
  refs.suggestionsGrid.innerHTML = suggestions.map((item) => `
    <button class="search-suggestion" type="button" data-suggestion="${escapeHtml(item.title)}">
      <div class="search-suggestion-cover">${item.image ? `<img src="${escapeHtml(item.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">` : "?"}</div>
      <div class="search-result-title">${escapeHtml(item.title)}</div>
      <div class="search-result-sub">${escapeHtml(item.subtitle)}</div>
    </button>
  `).join("");
  refs.suggestionsGrid.querySelectorAll("[data-suggestion]").forEach((button) => button.addEventListener("click", () => {
    state.searchValue = button.getAttribute("data-suggestion") || "";
    state.lastSearch = state.searchValue || state.lastSearch;
    renderSearchControls();
    fetchSearchResults();
  }));
}

function renderResults() {
  const liveResults = getLiveResults();
  refs.resultsCount.textContent = state.loadingResults ? "Chargement..." : `${liveResults.length} resultats`;
  if (state.loadingResults) {
    refs.resultsList.innerHTML = `<div class="search-empty-state"><p class="search-result-title">Chargement</p><p>Recuperation des resultats...</p></div>`;
    return;
  }
  if (!liveResults.length) {
    refs.resultsList.innerHTML = `<div class="search-empty-state"><p class="search-result-title">Aucun resultat</p><p>Change la source, le type ou la requete pour tester l'interface.</p></div>`;
    return;
  }
  refs.resultsList.innerHTML = liveResults.map((item) => `
    <article class="search-result-item">
      <div class="search-result-row">
        <div class="search-result-cover">${item.image ? `<img src="${escapeHtml(item.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">` : escapeHtml(item.coverLabel || "Media")}</div>
        <div class="search-result-body">
          <div class="search-result-top">
            <div><div class="search-result-title">${escapeHtml(item.title)}</div><div class="search-result-sub">${escapeHtml(item.subtitle)}</div></div>
            <a class="search-pill-btn" href="${escapeHtml(item.href || "#")}">${escapeHtml(item.detail || "Ouvrir")}</a>
          </div>
          <div class="search-result-actions">
            <a class="search-pill-btn is-primary" href="${escapeHtml(item.href || "#")}">Detail</a>
            ${item.spotifyUrl ? `<a class="search-pill-btn" href="${escapeHtml(item.spotifyUrl)}" target="_blank" rel="noopener noreferrer">Spotify</a>` : ""}
            ${item.youtubePlayable ? `<button class="search-pill-btn" type="button" data-inline-player="${escapeHtml(item.id)}">${state.inlinePlayerId === item.id ? "Masquer le player" : "Lecture YouTube inline"}</button>` : ""}
          </div>
          ${state.inlinePlayerId === item.id ? '<div class="search-inline-player">Player YouTube inline simule � visible seulement si le player global est dispo.</div>' : ""}
        </div>
      </div>
    </article>
  `).join("");
  refs.resultsList.querySelectorAll("[data-inline-player]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    const itemId = button.getAttribute("data-inline-player");
    const target = liveResults.find((row) => row.id === itemId);
    state.inlinePlayerId = state.inlinePlayerId === itemId ? null : itemId;
    if (state.inlinePlayerId && target?.url) playYouTubeInline(target.url, target.title, target.subtitle);
    renderResults();
  }));
}

function renderPlaylists() {
  const playlists = getFilteredPlaylists();
  refs.playlistsCount.textContent = `${playlists.length} imports`;
  refs.favoritesOnlyBtn.textContent = state.favoritesOnly ? "Favoris uniquement" : "Afficher les favoris";
  refs.favoritesOnlyBtn.classList.toggle("is-active-type", state.favoritesOnly);

  if (!playlists.length) {
    refs.playlistsGrid.innerHTML = `<div class="search-empty-state"><p class="search-result-title">Aucun import</p><p>Importe une playlist, un son ou une video, ou retire le filtre favoris pour voir du contenu.</p></div>`;
    return;
  }

  refs.playlistsGrid.innerHTML = playlists.map((playlist) => `
    <article class="search-playlist-card">
      <div class="search-playlist-top">
        <div><div class="search-playlist-title">${escapeHtml(playlist.title)}</div><div class="search-playlist-sub">${escapeHtml(playlist.source)} - ${playlist.itemType === "media" ? (playlist.mediaType === "audio" ? "1 son mp3" : "1 video mp4") : `${playlist.tracks} titres`}</div></div>
        <span class="search-playlist-status ${playlist.favorite ? "is-fav" : "is-std"}">${playlist.favorite ? "Favori" : "Standard"}</span>
      </div>
      <div class="search-playlist-tags">
        <span class="search-playlist-tag ${playlist.synced ? "is-green" : "is-amber"}">${playlist.synced ? "Synchronisee" : "Non synchronisee"}</span>
        <span class="search-playlist-tag is-neutral">${playlist.itemType === "media" ? (playlist.mediaType === "audio" ? "MP3" : "MP4") : "Playlist"}</span>
        <span class="search-playlist-tag is-neutral">${playlist.loginRequired ? "requireLogin()" : "Libre"}</span>
      </div>
      <div class="search-playlist-actions">
        <button class="search-pill-btn is-primary" type="button" data-open-playlist="${escapeHtml(playlist.id)}">${playlist.itemType === "media" ? "Lire" : "Ouvrir"}</button>
        <div class="search-grid-2"><button class="search-pill-btn" type="button" data-toggle-favorite="${escapeHtml(playlist.id)}">${playlist.favorite ? "Retirer fav" : "Favori"}</button><button class="search-pill-btn" type="button" data-delete-playlist="${escapeHtml(playlist.id)}">Supprimer</button></div>
      </div>
    </article>
  `).join("");

  refs.playlistsGrid.querySelectorAll("[data-open-playlist]").forEach((button) => button.addEventListener("click", () => openPlaylist(button.getAttribute("data-open-playlist"))));
  refs.playlistsGrid.querySelectorAll("[data-toggle-favorite]").forEach((button) => button.addEventListener("click", () => toggleFavorite(button.getAttribute("data-toggle-favorite"))));
  refs.playlistsGrid.querySelectorAll("[data-delete-playlist]").forEach((button) => button.addEventListener("click", () => deletePlaylist(button.getAttribute("data-delete-playlist"))));
}

function renderAll() {
  renderNotifications();
  renderSearchControls();
  renderSuggestions();
  renderResults();
  renderPlaylists();
  normalizeSearchText();
}

function cleanBrokenString(value) {
  return String(value || "")
    .replaceAll("ï¿½", "-")
    .replaceAll("�", "-")
    .replaceAll("Â·", "·")
    .replaceAll("Ã", "A");
}

function normalizeSearchText() {
  const selectors = [
    ".search-suggestion h3",
    ".search-suggestion p",
    ".search-result-title",
    ".search-result-sub",
    ".search-playlist-title",
    ".search-playlist-sub",
    ".search-inline-player",
    "#searchNotifLast",
    "#searchRealtimePill",
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = cleanBrokenString(node.textContent);
    });
  });
}

function markNotificationAsRead(id) {
  state.notifications = sanitizeNotifications(state.notifications).map((item) => (String(item.id) === String(id) ? { ...item, read: true } : item));
  renderNotifications();
}

function markAllNotificationsAsRead() {
  state.notifications = sanitizeNotifications(state.notifications).map((item) => ({ ...item, read: true }));
  renderNotifications();
}

function pushMockNotification() {
  const pool = sanitizeNotifications([
    { id: Date.now(), type: "comment", user: "Rina.pop", text: "a repondu a ton avis sur le dernier single pop", time: "A l'instant", read: false },
    { id: Date.now() + 1, type: "follow", user: "TrapZone", text: "vient de s'abonner a ton profil", time: "A l'instant", read: false },
    { id: Date.now() + 2, type: "playlist", user: "Afro Mood", text: 'a ajoute ton titre dans "Sunset Vibes"', time: "A l'instant", read: false },
  ]);
  const nextItem = pool[Math.floor(Math.random() * pool.length)] ?? sanitizeNotification(undefined);
  state.notifications = [nextItem, ...sanitizeNotifications(state.notifications)];
  state.lastRealtimeEvent = `${nextItem.user} � ${nextItem.text}`;
  state.notificationsOpen = true;
  renderNotifications();
}

function startRealtimeNotifications() {
  if (wsTimer) clearInterval(wsTimer);
  const simulatedRealtime = sanitizeNotifications([
    { id: 1001, type: "release", user: "Kez.fm", text: "vient de publier une story sur une sortie rap", time: "A l'instant", read: false },
    { id: 1002, type: "playlist", user: "DJ Nova", text: "a ajoute ton son a la playlist Midnight Drive", time: "A l'instant", read: false },
    undefined,
  ]);
  let index = 0;
  wsTimer = window.setInterval(() => {
    if (index >= simulatedRealtime.length) {
      clearInterval(wsTimer);
      return;
    }
    const nextItem = sanitizeNotification(simulatedRealtime[index], index);
    state.notifications = [nextItem, ...sanitizeNotifications(state.notifications)];
    state.lastRealtimeEvent = `${nextItem.user} � ${nextItem.text}`;
    index += 1;
    renderNotifications();
  }, 5000);
}

async function fetchSearchResults() {
  const requestId = ++searchRequestId;
  let isCurrentRequest = true;
  if (state.activeSource !== "spotify") {
    state.loadingResults = false;
    state.spotifyResultsLive = [];
    renderResults();
    return;
  }
  const query = state.searchValue.trim();
  if (!query) {
    state.loadingResults = false;
    state.spotifyResultsLive = [];
    renderResults();
    return;
  }
  state.loadingResults = true;
  renderResults();
  try {
    const typeMap = { tracks: "track", artists: "artist", albums: "album" };
    const data = await apiFetch(`/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(typeMap[state.activeType] || "track")}&limit=12`);
    if (requestId !== searchRequestId) return;
    state.spotifyResultsLive = pickItems(data).map(mapApiItem).filter((item) => item.kind === state.activeType);
  } catch (error) {
    if (requestId !== searchRequestId) return;
    state.spotifyResultsLive = [];
    toast(error?.message || "Erreur recherche", "Erreur");
  } finally {
    isCurrentRequest = requestId === searchRequestId;
    if (isCurrentRequest) {
      state.loadingResults = false;
      renderResults();
    }
  }
}

async function fetchSuggestions() {
  const requestId = ++suggestionRequestId;
  let isCurrentRequest = true;
  if (state.searchValue.trim()) {
    state.spotifySuggestionsLive = [];
    renderSuggestions();
    return;
  }
  try {
    const terms = pickRandomTerms(2);
    const responses = await Promise.all(terms.map((term) => apiFetch(`/search?q=${encodeURIComponent(term)}&type=track&limit=8`).catch(() => ({ items: [] }))));
    if (requestId !== suggestionRequestId) return;
    const seen = new Set();
    const unique = [];
    responses.flatMap((response) => pickItems(response)).forEach((item) => {
      const mapped = mapApiItem(item);
      if (seen.has(mapped.id)) return;
      seen.add(mapped.id);
      unique.push({ id: mapped.id, title: mapped.title, subtitle: mapped.subtitle, image: mapped.image });
    });
    state.spotifySuggestionsLive = unique.slice(0, 4);
  } catch {
    state.spotifySuggestionsLive = [];
  } finally {
    isCurrentRequest = requestId === suggestionRequestId;
    if (isCurrentRequest) {
      renderSuggestions();
    }
  }
}

function normalizePlaylistUrl(url) {
  return String(url || "").trim();
}

function extractYouTubePlaylistId(url) {
  try {
    const u = new URL(url);
    const list = u.searchParams.get("list") || "";
    return list.startsWith("PL") || list.startsWith("UU") || list.startsWith("FL") || list.startsWith("LL") ? list : "";
  } catch {
    return "";
  }
}

function extractYouTubeVideoId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get("v") || u.pathname.split("/").pop() || "";
  } catch {
    return "";
  }
}

function parseUrl(url) {
  try {
    return new URL(String(url || "").trim());
  } catch {
    return null;
  }
}

function inferMediaTypeFromUrl(url) {
  const parsed = parseUrl(url);
  const target = String(parsed?.pathname || url || "").toLowerCase();
  if (target.endsWith(".mp3")) return "audio";
  if (target.endsWith(".mp4")) return "video";
  return "";
}

function inferSourceFromUrl(url) {
  const lower = normalizePlaylistUrl(url).toLowerCase();
  if (lower.includes("spotify.com/track") || lower.includes("spotify.com/album") || lower.includes("spotify.com/playlist")) return "spotify";
  if (
    lower.includes("youtu.be/") ||
    lower.includes("youtube.com/watch") ||
    lower.includes("youtube.com/shorts/") ||
    lower.includes("youtube.com/embed/") ||
    lower.includes("youtube.com/playlist") ||
    lower.includes("music.youtube.com/playlist")
  ) {
    if ((lower.includes("youtube.com/watch") || lower.includes("youtu.be/")) && extractYouTubePlaylistId(url)) return "youtube";
    if (lower.includes("youtube.com/watch") || lower.includes("youtu.be/")) return "youtube-video";
    return "youtube";
  }
  const mediaType = inferMediaTypeFromUrl(lower);
  if (mediaType === "audio") return "mp3";
  if (mediaType === "video") return "mp4";
  return "";
}

function inferImportedMediaDescriptor(url) {
  const source = inferSourceFromUrl(url);
  if (source === "youtube") {
    const lower = normalizePlaylistUrl(url).toLowerCase();
    return {
      source: "YouTube",
      title: lower.includes("playlist") ? "Playlist YouTube importee" : "Video YouTube importee",
      tracks: 1,
      itemType: "media",
      mediaType: "video",
    };
  }
  if (source === "spotify") {
    const lower = normalizePlaylistUrl(url).toLowerCase();
    let title = "Media Spotify importe";
    if (lower.includes("/track/")) title = "Titre Spotify importe";
    if (lower.includes("/album/")) title = "Album Spotify importe";
    if (lower.includes("/playlist/")) title = "Playlist Spotify importee";
    return {
      source: "Spotify",
      title,
      tracks: lower.includes("/track/") ? 1 : Math.floor(Math.random() * 20) + 12,
      itemType: "media",
      mediaType: "audio",
    };
  }
  return null;
}

function parseEmbeddedMediaLink(rawUrl) {
  const url = normalizePlaylistUrl(rawUrl);
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

function showImportPlayerError(message) {
  if (!refs.importError || !refs.importErrorText) return;
  refs.importErrorText.textContent = message;
  refs.importError.style.display = "flex";
}

function hideImportPlayerError() {
  if (refs.importError) refs.importError.style.display = "none";
}

function getImportInfoBar(source, label) {
  const badgeClass = source === "YouTube" ? "is-youtube" : "is-spotify";
  return `<div class="search-import-info"><span class="search-import-badge ${badgeClass}">${source}</span><span>${label}</span></div>`;
}

function renderImportLaunchState(title, subtitle) {
  if (!refs.importPlayer) return;
  refs.importPlayer.style.display = "block";
  refs.importPlayer.innerHTML = `
    <div class="search-import-audio-ui">
      <div class="search-import-audio-row">
        <div class="search-import-audio-icon">&#9835;</div>
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:700;color:#fff;">${escapeHtml(title)}</div>
          <div style="font-size:12px;color:#a1a1aa;margin-top:4px;">${escapeHtml(subtitle)}</div>
        </div>
      </div>
      <div class="search-import-helper">
        <p>La lecture est lancee dans la barre du bas en mode audio. Clique sur la waveform pour ouvrir la version etendue, puis repasse en video si le media en propose une.</p>
        <button class="search-pill-btn is-primary" type="button" data-import-resume-player>Lancer le son</button>
      </div>
    </div>
  `;
  refs.importPlayer.querySelector("[data-import-resume-player]")?.addEventListener("click", () => {
    window.supcontentPlayer?.resume?.();
  });
}

function renderSpotifyImportPlayer(data) {
  if (!refs.importPlayer) return;
  refs.importPlayer.style.display = "block";

  let src = "";
  let label = "";
  let frameHeight = data.type === "spotify-track" ? 80 : 400;

  if (data.type === "spotify-track") {
    src = `https://open.spotify.com/embed/track/${data.id}`;
    label = "Titre";
  } else if (data.type === "spotify-playlist") {
    src = `https://open.spotify.com/embed/playlist/${data.id}`;
    label = "Playlist";
  } else {
    src = `https://open.spotify.com/embed/album/${data.id}`;
    label = "Album";
  }

  refs.importPlayer.innerHTML = `
    <iframe src="${src}" style="height:${frameHeight}px;" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    <div class="search-import-helper">
      <p>Spotify bloque en general la lecture automatique avec son. Clique sur le bouton play dans le lecteur Spotify.</p>
    </div>
    ${getImportInfoBar("Spotify", label)}
  `;
}

async function loadEmbeddedImportLink(urlOverride = "") {
  const url = normalizePlaylistUrl(urlOverride || refs.importLinkInput?.value || "");
  if (!url) {
    showImportPlayerError("Entre un lien avant de cliquer sur Charger.");
    return;
  }

  let data = null;
  try {
    const response = await apiFetch(`/search-hub/import/parse?url=${encodeURIComponent(url)}`);
    data = response?.item || null;
  } catch (error) {
    data = parseEmbeddedMediaLink(url);
    if (!data) {
      showImportPlayerError(error?.message || "Lien non reconnu. Utilise YouTube ou Spotify.");
      return;
    }
  }

  if (!data) {
    showImportPlayerError("Lien non reconnu. Utilise YouTube ou Spotify.");
    return;
  }

  hideImportPlayerError();
  if (refs.importLinkInput) refs.importLinkInput.value = url;

  if (data.source === "YouTube") {
    window.supcontentPlayer?.playYouTube?.({
      url,
      title: deriveTitleFromUrl(url, data.type === "youtube-playlist" ? "Playlist YouTube" : "Video YouTube"),
      subtitle: data.type === "youtube-playlist" ? "Lecture audio -> clique sur la waveform pour la video" : "YouTube audio",
      mode: "audio",
    });
    renderImportLaunchState("Lecture YouTube lancee", "Mode audio dans la barre du bas.");
    return;
  }

  if (data.type === "direct-audio" || data.type === "direct-video") {
    window.supcontentPlayer?.playMedia?.({
      url,
      title: deriveTitleFromUrl(url, data.type === "direct-audio" ? "Audio direct" : "Video directe"),
      subtitle: data.type === "direct-audio" ? "Fichier audio" : "Video -> clique sur la waveform pour l'image",
      mode: "audio",
    });
    renderImportLaunchState("Lecture directe lancee", "Le player bas est actif.");
    return;
  }

  if (data.source === "Spotify") {
    renderSpotifyImportPlayer(data);
  } else {
    showImportPlayerError("Type de media non gere.");
  }
}

function deriveTitleFromUrl(url, fallback = "Media importe") {
  const parsed = parseUrl(url);
  const pathname = String(parsed?.pathname || "").split("/").filter(Boolean).pop() || "";
  if (!pathname) return fallback;
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

async function importPlaylist(source) {
  if (!requireLogin({ redirect: false })) return;
  const placeholder = source === "spotify" ? "https://open.spotify.com/playlist/" : "https://music.youtube.com/playlist?list=";
  const rawUrl = window.prompt(source === "spotify" ? "Colle le lien de la playlist Spotify" : "Colle le lien de la playlist YouTube ou une video YouTube", placeholder);
  const url = normalizePlaylistUrl(rawUrl);
  if (!url) return;
  const inferred = inferSourceFromUrl(url);

  const playlistId = extractYouTubePlaylistId(url);
  const normalizedUrl = (inferred === "youtube" && playlistId && !url.includes("youtube.com/playlist"))
    ? `https://www.youtube.com/playlist?list=${playlistId}`
    : url;

  if (inferred === "youtube-video" && source === "youtube") {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) { toast("Impossible d'extraire l'ID de la video.", "Erreur"); return; }
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const played = playYouTubeInline(cleanUrl, "Video YouTube", "");
    if (played) toast("Lecture lancee dans le lecteur.", "OK");
    else toast("Lecteur non disponible.", "Erreur");
    return;
  }

  if (inferred !== source) {
    toast(`Lien invalide pour cette source. Attend un lien ${source === "spotify" ? "Spotify" : "YouTube"}.`, "Erreur");
    return;
  }

  try {
    const data = await apiFetch("/search-hub/imports/playlist", {
      method: "POST",
      body: JSON.stringify({ source, url }),
    });
    setImportedRows(data?.items);
    renderPlaylists();
    toast(`Playlist ${source === "spotify" ? "Spotify" : "YouTube"} importee.`, "OK");
  } catch (error) {
    toast(error?.message || "Import impossible.", "Erreur");
  }
}

async function importMediaLink() {
  if (!requireLogin({ redirect: false })) return;
  const rawUrl = window.prompt("Colle un lien YouTube, Spotify, MP3 ou MP4", "https://youtu.be/7CGKeID7nRc");
  const url = normalizePlaylistUrl(rawUrl);
  if (!url) return;

  const mediaType = inferMediaTypeFromUrl(url);
  if (mediaType) {
    const defaultTitle = deriveTitleFromUrl(url, mediaType === "audio" ? "Son importe" : "Video importee");
    const rawTitle = window.prompt(`Nom du ${mediaType === "audio" ? "son" : "video"} importe`, defaultTitle);
    const title = String(rawTitle || defaultTitle).trim() || defaultTitle;
    try {
      const data = await apiFetch("/search-hub/imports/media", {
        method: "POST",
        body: JSON.stringify({ url, title }),
      });
      setImportedRows(data?.items);
      renderPlaylists();
      toast(`${mediaType === "audio" ? "Son" : "Video"} importe.`, "OK");
    } catch (error) {
      toast(error?.message || "Import impossible.", "Erreur");
    }
    return;
  }

  const descriptor = inferImportedMediaDescriptor(url);
  if (!descriptor) {
    toast("Lien invalide detecte. Utilise YouTube, Spotify, .mp3 ou .mp4.", "Erreur");
    return;
  }

  const defaultTitle = descriptor.title;
  const rawTitle = window.prompt("Nom du media importe", defaultTitle);
  const title = String(rawTitle || defaultTitle).trim() || defaultTitle;
  try {
    const data = await apiFetch("/search-hub/imports/media", {
      method: "POST",
      body: JSON.stringify({ url, title }),
    });
    setImportedRows(data?.items);
    renderPlaylists();
    toast(`${descriptor.source} importe.`, "OK");
  } catch (error) {
    toast(error?.message || "Import impossible.", "Erreur");
  }
}

function openPlaylist(id) {
  const playlist = storageRows().find((row) => String(row.id) === String(id));
  if (playlist?.loginRequired && !requireLogin({ redirect: false })) return;
  if (!playlist?.url) {
    toast("Playlist sans URL source", "Erreur");
    return;
  }
  if (playlist.itemType === "media") {
    const inferredSource = inferSourceFromUrl(playlist.url);
    if (inferredSource === "youtube") {
      if (playYouTubeInline(playlist.url, playlist.title, "Media YouTube")) return;
      window.location.href = externalYouTubeHref(playlist.url);
      return;
    }
    if (inferredSource === "spotify") {
      const opened = window.open(playlist.url, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = playlist.url;
      return;
    }
    const player = window.supcontentPlayer;
    if (!player?.playMedia) {
      toast("Player global indisponible.", "Erreur");
      return;
    }
    player.playMedia({
      url: playlist.url,
      title: playlist.title,
      subtitle: playlist.mediaType === "audio" ? "Audio importe" : "Video importee",
      mode: playlist.mediaType === "audio" ? "audio" : "video",
    });
    return;
  }
  if (playlist.source.toLowerCase() === "youtube") {
    if (playYouTubeInline(playlist.url, playlist.title, "Playlist YouTube")) return;
    window.location.href = externalYouTubeHref(playlist.url);
    return;
  }
  const opened = window.open(playlist.url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = playlist.url;
}

async function toggleFavorite(id) {
  try {
    const data = await apiFetch(`/search-hub/imports/${encodeURIComponent(String(id))}/favorite`, {
      method: "PATCH",
    });
    setImportedRows(data?.items);
    renderPlaylists();
  } catch (error) {
    toast(error?.message || "Impossible de changer le favori.", "Erreur");
  }
}

async function deletePlaylist(id) {
  try {
    const data = await apiFetch(`/search-hub/imports/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
    setImportedRows(data?.items);
    renderPlaylists();
  } catch (error) {
    toast(error?.message || "Suppression impossible.", "Erreur");
  }
}

async function mergePlaylists() {
  if (!requireLogin({ redirect: false })) return;
  try {
    const data = await apiFetch("/search-hub/imports/merge", {
      method: "POST",
    });
    setImportedRows(data?.items);
    renderPlaylists();
    toast("Playlists fusionnees.", "OK");
  } catch (error) {
    toast(error?.message || "Fusion impossible.", "Erreur");
  }
}

async function syncPlaylists() {
  if (!requireLogin({ redirect: false })) return;
  try {
    const data = await apiFetch("/search-hub/imports/sync", {
      method: "POST",
    });
    setImportedRows(data?.items);
    renderPlaylists();
    toast("Synchronisation terminee.", "OK");
  } catch (error) {
    toast(error?.message || "Synchronisation impossible.", "Erreur");
  }
}

function bindEvents() {
  refs.notifBtn?.addEventListener("click", () => {
    state.notificationsOpen = !state.notificationsOpen;
    renderNotifications();
  });
  refs.mockNotifBtn?.addEventListener("click", pushMockNotification);
  refs.markAllReadBtn?.addEventListener("click", markAllNotificationsAsRead);
  document.addEventListener("mousedown", (event) => {
    if (!refs.dropdown?.contains(event.target)) {
      state.notificationsOpen = false;
      renderNotifications();
    }
  });

  refs.searchInput?.addEventListener("input", async (event) => {
    state.searchValue = event.target.value;
    renderAll();
    if (state.searchValue.trim()) await fetchSearchResults();
    else {
      state.spotifyResultsLive = [];
      renderResults();
      await fetchSuggestions();
    }
  });

  refs.searchInput?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      state.lastSearch = state.searchValue.trim() || "Recherche vide";
      renderSearchControls();
      await fetchSearchResults();
    }
  });

  refs.searchClearBtn?.addEventListener("click", async () => {
    state.searchValue = "";
    state.spotifyResultsLive = [];
    renderAll();
    refs.searchInput?.focus();
    await fetchSuggestions();
  });

  refs.sourceButtons.forEach((button) => button.addEventListener("click", async () => {
    state.activeSource = button.getAttribute("data-source") || "spotify";
    state.inlinePlayerId = null;
    renderAll();
    if (state.activeSource === "spotify") await fetchSearchResults();
  }));

  refs.typeButtons.forEach((button) => button.addEventListener("click", async () => {
    state.activeType = button.getAttribute("data-type") || "tracks";
    state.inlinePlayerId = null;
    renderAll();
    if (state.activeSource === "spotify" && state.searchValue.trim()) await fetchSearchResults();
  }));

  refs.refreshSuggestionsBtn?.addEventListener("click", async () => {
    state.suggestionsSeed += 1;
    state.spotifySuggestionsLive = [];
    renderSuggestions();
    await fetchSuggestions();
  });

  refs.favoritesOnlyBtn?.addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    renderPlaylists();
  });

  refs.importSpotifyBtn?.addEventListener("click", () => importPlaylist("spotify"));
  refs.importYoutubeBtn?.addEventListener("click", () => importPlaylist("youtube"));
  refs.importMediaBtn?.addEventListener("click", importMediaLink);
  refs.mergePlaylistsBtn?.addEventListener("click", mergePlaylists);
  refs.syncPlaylistsBtn?.addEventListener("click", syncPlaylists);

  refs.importLoadBtn?.addEventListener("click", () => loadEmbeddedImportLink());
  refs.importLinkInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loadEmbeddedImportLink();
  });
  refs.importExampleButtons.forEach((button) => button.addEventListener("click", () => {
    const exampleUrl = button.getAttribute("data-import-example") || "";
    loadEmbeddedImportLink(exampleUrl);
  }));
}

bindEvents();
renderAll();
startRealtimeNotifications();
fetchSuggestions();
hydrateImportedPlaylists();
