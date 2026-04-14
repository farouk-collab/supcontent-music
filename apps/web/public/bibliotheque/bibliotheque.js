import { apiFetch, escapeHtml, isLoggedIn, requireLogin, resolveMediaUrl, toast } from "/noyau/app.js";

const FAVORITES_STORAGE_KEY = "supcontent-library-favorites-v5";
const VIEW_STORAGE_KEY = "supcontent-library-view-v5";
const PLAYER_MODE_STORAGE_KEY = "supcontent-library-player-mode-v2";
const PLAYER_STATE_STORAGE_KEY = "supcontent-library-player-state-v1";

const DEFAULT_NOTIFICATIONS = [
  { id: 1, type: "playlist", user: "Bibliotheque", text: "ta collection Night Drive a ete synchronisee", time: "Il y a 4 min", read: false },
  { id: 2, type: "comment", user: "Global Player", text: "lecture prete pour ton dernier media", time: "Il y a 12 min", read: false },
  { id: 3, type: "community", user: "Collections", text: "2 doublons detectes dans Afro Sunset", time: "Il y a 1 h", read: true },
];

const MEDIA_CATALOG = [
  { id: "cat-1", media_type: "track", media_id: "cat-1", title: "Blinding Lights", subtitle: "The Weeknd · Track", source: "Spotify", isYoutube: false, canPlayVideo: false, duplicateKey: "blinding-lights-the-weeknd", mood: "night", energy: "high", artist: "The Weeknd" },
  { id: "cat-2", media_type: "track", media_id: "cat-2", title: "Calm Down", subtitle: "Rema · Track", source: "Spotify", isYoutube: false, canPlayVideo: false, duplicateKey: "calm-down-rema", mood: "sunset", energy: "low", artist: "Rema" },
  { id: "cat-3", media_type: "playlist", media_id: "cat-3", title: "Sunset Ride", subtitle: "YouTube Mix · Nova", source: "YouTube", isYoutube: true, canPlayVideo: true, youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", duplicateKey: "sunset-ride-nova", mood: "sunset", energy: "medium", artist: "Nova" },
  { id: "cat-4", media_type: "track", media_id: "cat-4", title: "Nightcall Echo", subtitle: "Kavinsky style · Track", source: "Spotify", isYoutube: false, canPlayVideo: false, duplicateKey: "nightcall-echo", mood: "night", energy: "medium", artist: "Kavinsky style" },
  { id: "cat-5", media_type: "playlist", media_id: "cat-5", title: "Workout Rush", subtitle: "YouTube Mix · Energy Lab", source: "YouTube", isYoutube: true, canPlayVideo: true, youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", duplicateKey: "workout-rush", mood: "workout", energy: "high", artist: "Energy Lab" },
];

const dom = {
  authBadge: document.querySelector("#libraryAuthBadge"),
  syncButton: document.querySelector("#librarySyncButton"),
  notificationsButton: document.querySelector("#libraryNotificationsButton"),
  notificationsCount: document.querySelector("#libraryNotificationsCount"),
  notificationsPanel: document.querySelector("#libraryNotificationsPanel"),
  notificationsReadButton: document.querySelector("#libraryNotificationsReadButton"),
  notificationTests: document.querySelector("#libraryNotificationTests"),
  featureTests: document.querySelector("#libraryFeatureTests"),
  notificationsList: document.querySelector("#libraryNotificationsList"),
  createCollectionButton: document.querySelector("#libraryCreateCollectionButton"),
  collectionsList: document.querySelector("#libraryCollectionsList"),
  viewButtons: Array.from(document.querySelectorAll("[data-library-view]")),
  collectionHero: document.querySelector("#libraryCollectionHero"),
  addMediaButton: document.querySelector("#libraryAddMediaButton"),
  renameCollectionButton: document.querySelector("#libraryRenameCollectionButton"),
  deleteCollectionButton: document.querySelector("#libraryDeleteCollectionButton"),
  mergeCollectionsButton: document.querySelector("#libraryMergeCollectionsButton"),
  deduplicateButton: document.querySelector("#libraryDeduplicateButton"),
  favoritesOnlyButton: document.querySelector("#libraryFavoritesOnlyButton"),
  shareButton: document.querySelector("#libraryShareButton"),
  mainContent: document.querySelector("#libraryMainContent"),
  autoCollections: document.querySelector("#libraryAutoCollections"),
  statsGrid: document.querySelector("#libraryStatsGrid"),
  audioModeButton: document.querySelector("#libraryAudioModeButton"),
  videoModeButton: document.querySelector("#libraryVideoModeButton"),
  playerCover: document.querySelector("#libraryPlayerCover"),
  playerTitle: document.querySelector("#libraryPlayerTitle"),
  playerArtist: document.querySelector("#libraryPlayerArtist"),
  playerCollection: document.querySelector("#libraryPlayerCollection"),
  playerDuration: document.querySelector("#libraryPlayerDuration"),
  playerBadges: document.querySelector("#libraryPlayerBadges"),
  playerVisual: document.querySelector("#libraryPlayerVisual"),
  playerCurrentTime: document.querySelector("#libraryPlayerCurrentTime"),
  playerEndTime: document.querySelector("#libraryPlayerEndTime"),
  playerProgress: document.querySelector("#libraryPlayerProgress"),
  prevButton: document.querySelector("#libraryPrevButton"),
  nextButton: document.querySelector("#libraryNextButton"),
  forwardButton: document.querySelector("#libraryForwardButton"),
  shuffleButton: document.querySelector("#libraryShuffleButton"),
  repeatButton: document.querySelector("#libraryRepeatButton"),
  volumeInput: document.querySelector("#libraryVolumeInput"),
  queueList: document.querySelector("#libraryQueueList"),
  recommendationsList: document.querySelector("#libraryRecommendationsList"),
  socialList: document.querySelector("#librarySocialList"),
  rightsList: document.querySelector("#libraryRightsList"),
  statusList: document.querySelector("#libraryStatusList"),
  recentList: document.querySelector("#libraryRecentList"),
  similarList: document.querySelector("#librarySimilarList"),
  footerCurrent: document.querySelector("#libraryFooterCurrent"),
  footerShuffle: document.querySelector("#libraryFooterShuffle"),
  footerPrev: document.querySelector("#libraryFooterPrev"),
  footerPlay: document.querySelector("#libraryFooterPlay"),
  footerNext: document.querySelector("#libraryFooterNext"),
  footerRepeat: document.querySelector("#libraryFooterRepeat"),
};

const state = {
  notificationsOpen: false,
  notifications: [],
  collections: [],
  selectedCollectionId: "",
  viewMode: "collections",
  favoritesOnly: false,
  favorites: new Set(),
  playerMode: "audio",
  feedback: "Bibliotheque premium prete · /collections/me simule",
  nowPlaying: null,
  recentlyPlayed: [],
  queue: [],
};

let librarySyncTimer = null;

function sanitizeNotification(item, fallbackIndex = 0) {
  if (!item || typeof item !== "object") return { id: `fallback-${fallbackIndex}`, type: "system", user: "Systeme", text: "Notification indisponible", time: "Maintenant", read: true };
  return { id: item.id ?? `generated-${fallbackIndex}`, type: item.type ?? "system", user: item.user ?? "Systeme", text: item.text ?? "Nouvelle activite", time: item.time ?? "Maintenant", read: Boolean(item.read) };
}

function sanitizeNotifications(list) {
  return Array.isArray(list) ? list.map((item, index) => sanitizeNotification(item, index)) : [];
}

function runNotificationTests() {
  const cases = [
    { input: [{ id: 1, user: "A", text: "ok", time: "now", read: false }], check: (r) => r.length === 1 && r[0].read === false },
    { input: [undefined], check: (r) => r.length === 1 && r[0].user === "Systeme" },
    { input: null, check: (r) => Array.isArray(r) && r.length === 0 },
  ];
  return cases.map((test) => ({ passed: test.check(sanitizeNotifications(test.input)) }));
}

function runLibraryTests() {
  const cases = [
    { check: () => new Set(state.collections.map((c) => c.id)).size === state.collections.length },
    { check: () => state.collections.every((c) => Array.isArray(c.rows)) },
    { check: () => getAllRows().some((m) => m.isYoutube) || MEDIA_CATALOG.some((m) => m.isYoutube) },
    { check: () => MEDIA_CATALOG.length > 0 },
  ];
  return cases.map((test) => ({ passed: test.check() }));
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function persistFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(state.favorites)));
  } catch {
    toast("Impossible de sauvegarder les favoris en local.", "Erreur");
  }
}
function loadView() { try { return localStorage.getItem(VIEW_STORAGE_KEY) === "favorites" ? "favorites" : "collections"; } catch { return "collections"; } }
function persistView() {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, state.viewMode);
  } catch {
    toast("Impossible de sauvegarder la vue courante.", "Erreur");
  }
}
function loadPlayerMode() { try { return localStorage.getItem(PLAYER_MODE_STORAGE_KEY) === "video" ? "video" : "audio"; } catch { return "audio"; } }
function persistPlayerMode() {
  try {
    localStorage.setItem(PLAYER_MODE_STORAGE_KEY, state.playerMode);
  } catch {
    toast("Impossible de sauvegarder le mode du player.", "Erreur");
  }
}

function defaultPlayerState() {
  return { id: "m-3", media_type: "playlist", media_id: "m-3", title: "Late Night Session", subtitle: "YouTube Mix · DJ Nova", source: "YouTube", isYoutube: true, canPlayVideo: true, youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", progress: 38, collectionName: "Night Drive", duration: "42:18", artist: "DJ Nova", isPlaying: true, volume: 72, shuffle: false, repeat: false, mood: "night", energy: "low", duplicateKey: "late-night-session-dj-nova" };
}

function loadPlayerState() { try { const raw = localStorage.getItem(PLAYER_STATE_STORAGE_KEY); return raw ? JSON.parse(raw) : defaultPlayerState(); } catch { return defaultPlayerState(); } }
function persistPlayerState() {
  try {
    localStorage.setItem(PLAYER_STATE_STORAGE_KEY, JSON.stringify(state.nowPlaying));
  } catch {
    toast("Impossible de sauvegarder l'etat du player.", "Erreur");
  }
}

function mediaKey(mediaType, mediaId) { return `${String(mediaType || "")}:${String(mediaId || "")}`; }

function parseSpotifyInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const direct = raw.match(/^(track|album|artist)\s*[:/]\s*([A-Za-z0-9]+)$/i);
  if (direct) return { media_type: direct[1].toLowerCase(), media_id: direct[2] };
  try {
    const url = new URL(raw);
    const match = String(url.pathname || "").match(/\/(track|album|artist)\/([A-Za-z0-9]+)/i);
    if (match) return { media_type: match[1].toLowerCase(), media_id: match[2] };
  } catch {}
  return null;
}

function inferMood(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("night") || value.includes("weeknd") || value.includes("after")) return "night";
  if (value.includes("afro") || value.includes("sunset") || value.includes("rema") || value.includes("tems")) return "sunset";
  if (value.includes("gym") || value.includes("workout") || value.includes("charge") || value.includes("gazo")) return "workout";
  return "night";
}

function inferEnergy(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("workout") || value.includes("charge") || value.includes("drill") || value.includes("rap")) return "high";
  if (value.includes("sunset") || value.includes("calm") || value.includes("love")) return "low";
  return "medium";
}

function formatProgress(duration, progress) {
  if (!duration || !duration.includes(":")) return "00:00";
  const parts = duration.split(":").map((item) => Number(item || 0));
  const total = parts.length === 2 ? (parts[0] * 60) + parts[1] : ((parts[0] * 3600) + (parts[1] * 60) + parts[2]);
  const current = Math.max(0, Math.floor((Number(progress || 0) / 100) * total));
  const minutes = Math.floor((current % 3600) / 60);
  const seconds = current % 60;
  const hours = Math.floor(current / 3600);
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toCollectionModel(collection) {
  const items = Array.isArray(collection?.items) ? collection.items : [];
  const rows = items.map((item) => {
    const mediaType = String(item?.media_type || "");
    const mediaId = String(item?.media_id || "");
    const youtubeUrl = String(item?.media?.youtube_url || "");
    const sourceUrl = String(item?.media?.source_url || "");
    const spotifyUrl = String(item?.media?.spotify_url || "");
    const title = String(item?.media?.name || mediaId || "Sans titre");
    const subtitle = String(item?.media?.subtitle || "");
    const artist = subtitle.split("·")[0]?.trim() || title;
    return { id: mediaKey(mediaType, mediaId), media_type: mediaType, media_id: mediaId, collectionId: String(collection?.id || ""), collectionName: String(collection?.name || "Collection"), title, subtitle, image: resolveMediaUrl(item?.media?.image || ""), source: youtubeUrl ? "YouTube" : "Spotify", isYoutube: Boolean(youtubeUrl), canPlayVideo: Boolean(youtubeUrl || sourceUrl.toLowerCase().includes("youtube") || spotifyUrl.toLowerCase().includes("youtube")), youtube_url: youtubeUrl, source_url: sourceUrl, spotify_url: spotifyUrl, duplicateKey: `${title.toLowerCase()}-${artist.toLowerCase()}`, artist, mood: inferMood(`${title} ${subtitle} ${collection?.name || ""}`), energy: inferEnergy(`${title} ${subtitle}`), type: mediaType };
  });
  const counts = new Map();
  rows.forEach((row) => counts.set(row.duplicateKey, (counts.get(row.duplicateKey) || 0) + 1));
  return { id: String(collection?.id || ""), name: String(collection?.name || "Collection"), description: collection?.status_code ? `Liste statut : ${String(collection.status_code).replaceAll("_", " ")}` : `${rows.length} medias dans cette collection`, rows, duplicates: rows.filter((row) => (counts.get(row.duplicateKey) || 0) > 1), socials: { likes: 80 + rows.length * 17, comments: 10 + rows.length * 3, listeners: Math.max(4, rows.length * 2) }, isEditable: !collection?.status_code };
}

function getSelectedCollection() { return state.collections.find((collection) => collection.id === state.selectedCollectionId) || state.collections[0] || null; }
function getAllRows() { return state.collections.flatMap((collection) => collection.rows); }
function getFavoriteRows() { return getAllRows().filter((row) => state.favorites.has(row.id)); }
function getVisibleRows() { const base = state.viewMode === "favorites" ? getFavoriteRows() : (getSelectedCollection()?.rows || []); return state.favoritesOnly && state.viewMode !== "favorites" ? base.filter((row) => state.favorites.has(row.id)) : base; }
function getDuplicateRows() { return getSelectedCollection()?.duplicates || []; }
function getUnreadCount() { return sanitizeNotifications(state.notifications).filter((item) => !item.read).length; }
function getNotificationIcon(type) { if (type === "playlist") return "♫"; if (type === "comment") return "◌"; if (type === "community") return "✦"; return "•"; }
function getPlayerVisualMode() { return state.playerMode === "video" && state.nowPlaying?.canPlayVideo ? "video" : "audio"; }
function setFeedback(message) { state.feedback = String(message || ""); renderStatusBox(); }

function syncFromGlobalPlayerState() {
  const globalState = window.supcontentPlayer?.state?.();
  if (!globalState || !globalState.title) return;

  const nextMode = String(globalState.mode || "audio") === "video" ? "video" : "audio";
  const nextPlayer = {
    ...state.nowPlaying,
    id: state.nowPlaying?.id || `global-${String(globalState.provider || "media")}`,
    title: String(globalState.title || state.nowPlaying?.title || "Lecture"),
    subtitle: String(globalState.subtitle || state.nowPlaying?.subtitle || ""),
    source: globalState.provider === "youtube" ? "YouTube" : (state.nowPlaying?.source || "Media"),
    isYoutube: globalState.provider === "youtube",
    canPlayVideo: nextMode === "video" || Boolean(state.nowPlaying?.canPlayVideo),
    youtube_url: globalState.url || state.nowPlaying?.youtube_url || "",
    source_url: globalState.url || state.nowPlaying?.source_url || "",
    progress: Math.max(0, Math.min(100, Number(globalState.time || state.nowPlaying?.progress || 0))),
    artist: String(globalState.subtitle || state.nowPlaying?.artist || "Artiste inconnu"),
    isPlaying: Boolean(globalState.playing),
  };

  state.playerMode = nextMode;
  state.nowPlaying = nextPlayer;
  persistPlayerMode();
  persistPlayerState();
}

function tickPlayerProgress() {
  if (!state.nowPlaying) return;

  syncFromGlobalPlayerState();

  if (!state.nowPlaying.isPlaying) {
    renderPlayer();
    return;
  }

  if (!window.supcontentPlayer?.state?.()?.title) {
    state.nowPlaying.progress = Math.min(100, Number(state.nowPlaying.progress || 0) + 1.2);
  }

  if (Number(state.nowPlaying.progress || 0) >= 100) {
    state.nowPlaying.progress = 100;
    persistPlayerState();
    playNextFromQueue();
    return;
  }

  persistPlayerState();
  renderPlayer();
}

function restartSyncLoop() {
  if (librarySyncTimer) window.clearInterval(librarySyncTimer);
  librarySyncTimer = window.setInterval(tickPlayerProgress, 1000);
}

function getSimilarRows() {
  const currentMood = state.nowPlaying?.mood;
  return [...getAllRows(), ...MEDIA_CATALOG]
    .filter((row) => String(row.id) !== String(state.nowPlaying?.id))
    .filter((row, index, arr) => arr.findIndex((item) => item.duplicateKey === row.duplicateKey) === index)
    .filter((row) => currentMood ? row.mood === currentMood : true)
    .slice(0, 4);
}

function getRecommendations() {
  const dominantMood = state.recentlyPlayed[0]?.mood || state.nowPlaying?.mood || "night";
  return [...MEDIA_CATALOG, ...getAllRows()]
    .filter((row) => String(row.id) !== String(state.nowPlaying?.id))
    .filter((row, index, arr) => arr.findIndex((item) => item.duplicateKey === row.duplicateKey) === index)
    .map((row) => ({ ...row, score: (row.mood === dominantMood ? 40 : 0) + (row.energy === "high" ? 12 : row.energy === "medium" ? 8 : 5) + (state.favorites.has(row.id) ? 15 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function getAutoCollections() {
  const top = state.recentlyPlayed.reduce((acc, item) => { acc[item.title] = (acc[item.title] || 0) + 1; return acc; }, {});
  return { recent: state.recentlyPlayed.slice(0, 4), top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 3), discovered: getRecommendations().slice(0, 3) };
}

function markAllNotificationsRead() {
  state.notifications = sanitizeNotifications(state.notifications).map((item) => ({ ...item, read: true }));
  renderNotifications();
}

function markNotificationRead(id) {
  state.notifications = sanitizeNotifications(state.notifications).map((item) => (String(item.id) === String(id) ? { ...item, read: true } : item));
  renderNotifications();
}

function toggleFavorite(rowId) {
  if (!rowId) return;
  if (state.favorites.has(rowId)) state.favorites.delete(rowId);
  else state.favorites.add(rowId);
  persistFavorites();
  setFeedback("Favoris mis a jour dans localStorage");
  renderAll();
}

function pushRecentlyPlayed(entry) {
  state.recentlyPlayed = [entry, ...state.recentlyPlayed.filter((item) => item.id !== entry.id)].slice(0, 8);
}

function playMedia(row, forcedMode) {
  if (!row) return;
  state.playerMode = forcedMode === "video" && row.canPlayVideo ? "video" : "audio";
  persistPlayerMode();
  state.nowPlaying = { ...row, progress: Math.floor(Math.random() * 55) + 20, collectionName: row.collectionName || getSelectedCollection()?.name || "Bibliotheque", duration: row.canPlayVideo ? "12:44" : row.media_type === "album" ? "42:18" : "03:24", artist: row.artist || row.subtitle.split("·")[0]?.trim() || "Artiste inconnu", isPlaying: true, volume: state.nowPlaying?.volume ?? 72, shuffle: state.nowPlaying?.shuffle ?? false, repeat: state.nowPlaying?.repeat ?? false };
  persistPlayerState();
  pushRecentlyPlayed(state.nowPlaying);
  const mediaUrl = row.youtube_url || row.source_url || "";
  if (mediaUrl && row.isYoutube && window.supcontentPlayer?.playYouTube) {
    window.supcontentPlayer.playYouTube({ url: mediaUrl, title: row.title, subtitle: row.subtitle || row.collectionName, cover: row.image || "", mode: state.playerMode });
  } else if (mediaUrl && !row.isYoutube && window.supcontentPlayer?.playMedia && state.playerMode === "video") {
    window.supcontentPlayer.playMedia({ url: mediaUrl, title: row.title, subtitle: row.subtitle || row.collectionName, cover: row.image || "", mode: "video" });
  }
  setFeedback(state.playerMode === "video" ? "Lecture video lancee depuis la bibliotheque" : row.isYoutube ? "Lecture audio lancee via player global YouTube si disponible" : "Lecture audio lancee depuis la bibliotheque");
  renderAll();
}

function openMedia(row) {
  if (!row) return;
  setFeedback(`Ouverture de la page detail pour ${row.title}`);
  window.location.href = `/media/media.html?type=${encodeURIComponent(row.media_type)}&id=${encodeURIComponent(row.media_id)}`;
}

function addToQueue(row) {
  if (!row) return;
  const alreadyQueued = state.queue.some((item) => item.media_type === row.media_type && item.media_id === row.media_id);
  if (alreadyQueued) {
    setFeedback(`${row.title} est deja dans la file d'attente`);
    renderQueue();
    return;
  }
  state.queue = [...state.queue, { ...row, id: `queue-${row.id}-${Date.now()}`, duration: row.canPlayVideo ? "12:44" : row.media_type === "album" ? "42:18" : "03:24" }];
  setFeedback(`${row.title} ajoute a la file d'attente`);
  renderQueue();
}

function playNextFromQueue() {
  if (!state.queue.length) { setFeedback("La file d'attente est vide"); return; }
  const [next, ...rest] = state.queue;
  state.queue = rest;
  playMedia(next, next.canPlayVideo ? state.playerMode : "audio");
}

function togglePlayback() {
  if (!state.nowPlaying) return;

  if (state.nowPlaying.isPlaying) {
    if (window.supcontentPlayer?.stop) {
      window.supcontentPlayer.stop();
      setFeedback("Lecture stoppee dans le player global");
    } else {
      setFeedback("Pause locale activee");
    }
    state.nowPlaying.isPlaying = false;
  } else {
    const playbackRow = {
      ...state.nowPlaying,
      id: state.nowPlaying.id || mediaKey(state.nowPlaying.media_type, state.nowPlaying.media_id),
    };
    playMedia(playbackRow, state.playerMode);
    setFeedback("Lecture relancee");
    return;
  }

  persistPlayerState();
  renderPlayer();
}

function removeQueueItem(index) {
  state.queue = state.queue.filter((_, itemIndex) => itemIndex !== index);
  setFeedback("Element retire de la file d'attente");
  renderQueue();
}

function moveQueueItem(index, direction) {
  const next = [...state.queue];
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) return;
  [next[index], next[target]] = [next[target], next[index]];
  state.queue = next;
  setFeedback("Ordre de la file mis a jour");
  renderQueue();
}

async function loadCollections() {
  if (!isLoggedIn()) {
    state.collections = [];
    state.selectedCollectionId = "";
    setFeedback("Connexion requise pour charger /collections/me");
    renderAll();
    return;
  }
  try {
    const response = await apiFetch("/collections/me?include_items=1");
    state.collections = (Array.isArray(response?.collections) ? response.collections : []).map(toCollectionModel);
    if (!state.selectedCollectionId || !state.collections.some((collection) => collection.id === state.selectedCollectionId)) state.selectedCollectionId = state.collections[0]?.id || "";
    if (!state.nowPlaying || !state.nowPlaying.media_id) {
      const firstRow = state.collections[0]?.rows?.[0];
      if (firstRow) state.nowPlaying = { ...firstRow, progress: 38, duration: firstRow.canPlayVideo ? "42:18" : "03:24", artist: firstRow.artist || "Artiste inconnu", isPlaying: true, volume: 72, shuffle: false, repeat: false };
    }
    if (!state.collections.length) {
      state.selectedCollectionId = "";
      setFeedback("Aucune collection trouvee sur /collections/me");
    } else {
      setFeedback("Bibliotheque synchronisee avec /collections/me");
    }
    renderAll();
  } catch (error) {
    state.collections = [];
    state.selectedCollectionId = "";
    setFeedback(error?.message || "Erreur de chargement bibliotheque");
    toast(error?.message || "Erreur chargement bibliotheque", "Erreur");
    renderAll();
  }
}

async function createCollection() {
  if (!requireLogin({ redirect: true })) return;
  const name = window.prompt("Nom de la nouvelle collection :", "");
  if (!name || !name.trim()) return;
  try {
    await apiFetch("/collections", { method: "POST", body: JSON.stringify({ name: name.trim(), is_public: false }) });
    setFeedback("Collection creee via /collections");
    await loadCollections();
  } catch (error) {
    toast(error?.message || "Erreur creation collection", "Erreur");
    setFeedback(error?.message || "Erreur creation collection");
  }
}

async function renameCollection() {
  const selected = getSelectedCollection();
  if (!selected?.isEditable || !requireLogin({ redirect: true })) return;
  const nextName = window.prompt("Nouveau nom de la collection :", selected.name);
  if (!nextName || !nextName.trim()) return;
  try {
    await apiFetch(`/collections/${encodeURIComponent(selected.id)}`, { method: "PATCH", body: JSON.stringify({ name: nextName.trim() }) });
    setFeedback("Collection renommee cote backend");
    await loadCollections();
  } catch (error) {
    toast(error?.message || "Erreur renommage collection", "Erreur");
    setFeedback(error?.message || "Erreur renommage collection");
  }
}

async function deleteCollection() {
  const selected = getSelectedCollection();
  if (!selected?.isEditable || !requireLogin({ redirect: true })) return;
  if (!window.confirm(`Supprimer la collection "${selected.name}" ?`)) return;
  try {
    await apiFetch(`/collections/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    setFeedback("Collection supprimee cote backend");
    await loadCollections();
  } catch (error) {
    toast(error?.message || "Erreur suppression collection", "Erreur");
    setFeedback(error?.message || "Erreur suppression collection");
  }
}

async function addMediaToCollection() {
  const selected = getSelectedCollection();
  if (!selected?.isEditable || !requireLogin({ redirect: true })) return;
  const raw = window.prompt("Ajoute un media : URL Spotify ou track:ID / album:ID / artist:ID", "");
  const parsed = parseSpotifyInput(raw);
  if (!parsed) { toast("Format invalide. Utilise par exemple track:123 ou une URL Spotify.", "Erreur"); return; }
  try {
    await apiFetch(`/collections/${encodeURIComponent(selected.id)}/items`, { method: "POST", body: JSON.stringify(parsed) });
    setFeedback("Media ajoute a la collection via le backend");
    await loadCollections();
  } catch (error) {
    toast(error?.message || "Erreur ajout media", "Erreur");
    setFeedback(error?.message || "Erreur ajout media");
  }
}

async function removeMediaFromCollection(row) {
  const selected = getSelectedCollection();
  if (!row || !selected?.isEditable || !requireLogin({ redirect: true })) return;
  try {
    await apiFetch(`/collections/${encodeURIComponent(selected.id)}/items/${encodeURIComponent(row.media_type)}/${encodeURIComponent(row.media_id)}`, { method: "DELETE" });
    setFeedback("Media retire de la collection");
    await loadCollections();
  } catch (error) {
    toast(error?.message || "Erreur suppression media", "Erreur");
    setFeedback(error?.message || "Erreur suppression media");
  }
}

async function deduplicateSelectedCollection() {
  const selected = getSelectedCollection();
  if (!selected?.isEditable) return;
  if (!selected.duplicates.length) { setFeedback("Aucun doublon a supprimer"); return; }
  if (!requireLogin({ redirect: true })) return;
  const seen = new Set();
  const duplicatesToDelete = selected.rows.filter((row) => {
    if (seen.has(row.duplicateKey)) return true;
    seen.add(row.duplicateKey);
    return false;
  });
  try {
    await Promise.all(duplicatesToDelete.map((row) => apiFetch(`/collections/${encodeURIComponent(selected.id)}/items/${encodeURIComponent(row.media_type)}/${encodeURIComponent(row.media_id)}`, { method: "DELETE" })));
    setFeedback("Liste dedoublonnee");
    await loadCollections();
  } catch (error) {
    toast(error?.message || "Erreur dedoublonnage", "Erreur");
    setFeedback(error?.message || "Erreur dedoublonnage");
  }
}

async function mergeCollections() {
  const editableCollections = state.collections.filter((collection) => collection.isEditable);
  if (editableCollections.length < 2) { setFeedback("Pas assez de collections a fusionner"); return; }
  if (!requireLogin({ redirect: true })) return;
  const source = getSelectedCollection()?.isEditable ? getSelectedCollection() : editableCollections[0];
  const choices = editableCollections.filter((collection) => collection.id !== source.id);
  const name = window.prompt(`Fusion avec quelle collection ? Disponibles: ${choices.map((collection) => collection.name).join(", ")}`, choices[0]?.name || "");
  const other = choices.find((collection) => collection.name.toLowerCase() === String(name || "").trim().toLowerCase());
  if (!other) { toast("Collection cible introuvable.", "Erreur"); return; }
  try {
    const created = await apiFetch("/collections", { method: "POST", body: JSON.stringify({ name: `${source.name} + ${other.name}`, is_public: false }) });
    const mergedId = String(created?.collection?.id || "");
    if (!mergedId) throw new Error("Creation de la collection fusionnee impossible");
    const uniqueRows = new Map();
    [...source.rows, ...other.rows].forEach((row) => uniqueRows.set(mediaKey(row.media_type, row.media_id), row));
    await Promise.all(Array.from(uniqueRows.values()).map((row) => apiFetch(`/collections/${encodeURIComponent(mergedId)}/items`, { method: "POST", body: JSON.stringify({ media_type: row.media_type, media_id: row.media_id }) })));
    state.selectedCollectionId = mergedId;
    setFeedback("Collections fusionnees via les outils bibliotheque");
    await loadCollections();
  } catch (error) {
    toast(error?.message || "Erreur fusion collections", "Erreur");
    setFeedback(error?.message || "Erreur fusion collections");
  }
}

async function syncCollections() {
  if (!requireLogin({ redirect: true })) return;
  try {
    await loadCollections();
    toast("Synchronisation terminee.", "OK");
  } catch (error) {
    toast(error?.message || "Erreur synchronisation", "Erreur");
    setFeedback(error?.message || "Erreur synchronisation");
  }
}

function renderNotifications() {
  const safeNotifications = sanitizeNotifications(state.notifications);
  const unreadCount = getUnreadCount();
  dom.notificationsButton.classList.toggle("is-open", state.notificationsOpen);
  dom.notificationsPanel.hidden = !state.notificationsOpen;
  dom.notificationsCount.hidden = unreadCount === 0;
  dom.notificationsCount.textContent = String(unreadCount);
  dom.notificationTests.innerHTML = `<div class="library-test-pill ${runNotificationTests().every((t) => t.passed) ? "is-ok" : "is-bad"}">${runNotificationTests().every((t) => t.passed) ? "Tests notifications passes" : "Un test notifications a echoue"}</div>`;
  dom.featureTests.innerHTML = `<div class="library-test-pill ${runLibraryTests().every((t) => t.passed) ? "is-ok" : "is-bad"}">${runLibraryTests().every((t) => t.passed) ? "Tests bibliotheque passes" : "Un test bibliotheque a echoue"}</div>`;
  dom.notificationsList.innerHTML = safeNotifications.length ? safeNotifications.map((item) => `<button class="library-notif-card ${item.read ? "" : "is-unread"}" type="button" data-notification-id="${escapeHtml(item.id)}"><div class="library-notif-icon">${escapeHtml(getNotificationIcon(item.type))}</div><div><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;"><div style="font-size:14px;line-height:1.4;"><strong>${escapeHtml(item.user)}</strong> ${escapeHtml(item.text)}</div>${item.read ? "" : `<span style="width:10px;height:10px;border-radius:999px;background:#34d399;display:block;flex:0 0 auto;margin-top:5px;"></span>`}</div><small>${escapeHtml(item.time)}</small></div></button>`).join("") : `<div class="library-empty">Aucune notification pour le moment.</div>`;
  dom.notificationsList.querySelectorAll("[data-notification-id]").forEach((button) => button.addEventListener("click", () => markNotificationRead(button.getAttribute("data-notification-id"))));
}

function renderAuthBadge() { dom.authBadge.textContent = isLoggedIn() ? "Connecte" : "Deconnecte"; }

function renderAutoCollections() {
  const autoCollections = getAutoCollections();
  dom.autoCollections.innerHTML = `<div class="library-list-card"><p style="margin:0;font-weight:700;">Recemment joues</p><small style="display:block;margin-top:6px;color:#9ca3af;">${autoCollections.recent.length} elements</small></div><div class="library-list-card"><p style="margin:0;font-weight:700;">Les plus ecoutes</p><small style="display:block;margin-top:6px;color:#9ca3af;">${autoCollections.top.map(([title]) => title).join(" · ") || "Aucun"}</small></div><div class="library-list-card"><p style="margin:0;font-weight:700;">Decouverts recemment</p><small style="display:block;margin-top:6px;color:#9ca3af;">${autoCollections.discovered.map((item) => item.title).join(" · ") || "Aucun"}</small></div>`;
}

function renderCollectionsList() {
  if (!state.collections.length) { dom.collectionsList.innerHTML = `<div class="library-empty">Aucune collection disponible pour le moment.</div>`; return; }
  dom.collectionsList.innerHTML = state.collections.map((collection) => `<button class="library-list-card library-list-button ${collection.id === state.selectedCollectionId ? "is-active" : ""}" type="button" data-collection-id="${escapeHtml(collection.id)}"><div class="library-hero-top"><div><p style="margin:0;font-weight:700;">${escapeHtml(collection.name)}</p><p style="margin:6px 0 0;color:#9ca3af;font-size:14px;">${escapeHtml(collection.description)}</p></div><span class="library-badge">${collection.rows.length} medias</span></div><div class="library-badge-row" style="margin-top:12px;"><span class="library-badge">${collection.socials.likes} likes</span><span class="library-badge">${collection.socials.comments} commentaires</span><span class="library-badge">${collection.socials.listeners} ecoutent</span></div></button>`).join("");
  dom.collectionsList.querySelectorAll("[data-collection-id]").forEach((button) => button.addEventListener("click", () => { state.selectedCollectionId = String(button.getAttribute("data-collection-id") || ""); renderAll(); }));
}

function renderViewButtons() {
  dom.viewButtons.forEach((button) => button.classList.toggle("is-active", button.getAttribute("data-library-view") === state.viewMode));
  dom.favoritesOnlyButton.textContent = state.favoritesOnly ? "Voir tous les medias" : "Favoris uniquement";
}

function renderCollectionHero() {
  const selected = getSelectedCollection();
  const favoriteRows = getFavoriteRows();
  if (state.viewMode === "favorites") dom.collectionHero.innerHTML = `<p class="library-kicker" style="color:#f0fdf4;">Favoris</p><h2>Mes favoris</h2><p>${favoriteRows.length} elements stockes en localStorage pour un acces rapide.</p><div class="library-badge-row" style="margin-top:14px;"><span class="library-badge">${favoriteRows.length} elements</span><span class="library-badge">vue rapide</span></div>`;
  else if (selected) dom.collectionHero.innerHTML = `<p class="library-kicker" style="color:#f0fdf4;">Collection ouverte</p><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.description)}</p><div class="library-badge-row" style="margin-top:14px;"><span class="library-badge">${selected.socials.likes} likes</span><span class="library-badge">${selected.socials.comments} commentaires</span><span class="library-badge">${selected.socials.listeners} ecoutent</span></div>`;
  else dom.collectionHero.innerHTML = `<p class="library-kicker" style="color:#f0fdf4;">Bibliotheque</p><h2>Aucune collection chargee</h2><p>Connecte-toi puis recharge la bibliotheque pour commencer.</p>`;
  const editable = Boolean(selected?.isEditable) && state.viewMode === "collections";
  dom.addMediaButton.disabled = !editable;
  dom.renameCollectionButton.disabled = !editable;
  dom.deleteCollectionButton.disabled = !editable;
  dom.deduplicateButton.disabled = !editable;
}

function mediaCard(row, selectedCollection) {
  return `<article class="library-media-card"><div class="library-media-top"><div><p style="margin:0;font-weight:700;">${escapeHtml(row.title)}</p><p style="margin:6px 0 0;color:#9ca3af;">${escapeHtml(row.subtitle || row.collectionName)}</p><div class="library-badge-row" style="margin-top:12px;"><span class="library-badge">${escapeHtml(row.media_type)}</span><span class="library-badge">${escapeHtml(row.source)}</span><span class="library-badge">${escapeHtml(row.mood)}</span>${state.favorites.has(row.id) ? `<span class="library-badge">favori</span>` : ""}</div></div><button class="library-icon-btn ${state.favorites.has(row.id) ? "is-favorite" : ""}" type="button" data-favorite-id="${escapeHtml(row.id)}">${state.favorites.has(row.id) ? "♥" : "♡"}</button></div><div class="library-media-actions"><button class="library-primary" type="button" data-play-audio-id="${escapeHtml(row.id)}">Audio</button><button class="library-ghost" type="button" data-play-video-id="${escapeHtml(row.id)}">Video</button><button class="library-ghost" type="button" data-queue-id="${escapeHtml(row.id)}">Jouer apres</button><button class="library-ghost" type="button" data-open-id="${escapeHtml(row.id)}">Ouvrir</button>${selectedCollection?.isEditable && state.viewMode === "collections" ? `<button class="library-ghost" type="button" data-remove-id="${escapeHtml(row.id)}">Retirer</button>` : ""}</div></article>`;
}

function renderMainContent() {
  const selected = getSelectedCollection();
  const rows = getVisibleRows();
  if (!rows.length) { dom.mainContent.innerHTML = `<div class="library-empty"><strong>${state.viewMode === "favorites" ? "Aucun favori pour le moment" : "Aucun media dans cette vue"}</strong><p style="margin:.7rem 0 0;">${state.viewMode === "favorites" ? "Ajoute des medias a tes favoris pour les retrouver ici." : state.favoritesOnly ? "Aucun favori dans cette collection." : "Ajoute un media pour commencer."}</p></div>`; return; }
  dom.mainContent.innerHTML = rows.map((row) => mediaCard(row, selected)).join("");
  dom.mainContent.querySelectorAll("[data-favorite-id]").forEach((button) => button.addEventListener("click", () => toggleFavorite(String(button.getAttribute("data-favorite-id") || ""))));
  dom.mainContent.querySelectorAll("[data-play-audio-id]").forEach((button) => button.addEventListener("click", () => playMedia(getAllRows().find((item) => item.id === String(button.getAttribute("data-play-audio-id") || "")), "audio")));
  dom.mainContent.querySelectorAll("[data-play-video-id]").forEach((button) => button.addEventListener("click", () => { const row = getAllRows().find((item) => item.id === String(button.getAttribute("data-play-video-id") || "")); playMedia(row, row?.canPlayVideo ? "video" : "audio"); }));
  dom.mainContent.querySelectorAll("[data-queue-id]").forEach((button) => button.addEventListener("click", () => addToQueue(getAllRows().find((item) => item.id === String(button.getAttribute("data-queue-id") || "")))));
  dom.mainContent.querySelectorAll("[data-open-id]").forEach((button) => button.addEventListener("click", () => openMedia(getAllRows().find((item) => item.id === String(button.getAttribute("data-open-id") || "")))));
  dom.mainContent.querySelectorAll("[data-remove-id]").forEach((button) => button.addEventListener("click", () => removeMediaFromCollection(getAllRows().find((item) => item.id === String(button.getAttribute("data-remove-id") || ""))).catch((error) => toast(error?.message || "Erreur", "Erreur"))));
}

function renderStats() { dom.statsGrid.innerHTML = `<div class="library-stat-card"><p>Collections</p><strong>${state.collections.length}</strong></div><div class="library-stat-card"><p>Favoris</p><strong>${state.favorites.size}</strong></div><div class="library-stat-card"><p>Doublons detectes</p><strong>${getDuplicateRows().length}</strong></div>`; }

function renderPlayer() {
  const current = state.nowPlaying || defaultPlayerState();
  const visualMode = getPlayerVisualMode();
  dom.audioModeButton.classList.toggle("is-active", state.playerMode === "audio");
  dom.videoModeButton.classList.toggle("is-active", state.playerMode === "video");
  dom.playerCover.textContent = visualMode === "video" ? "▣" : "♫";
  dom.playerTitle.textContent = current.title || "Aucune lecture";
  dom.playerArtist.textContent = current.artist || current.subtitle || "Selectionne un media";
  dom.playerCollection.textContent = `Depuis ${current.collectionName || "la bibliotheque"}`;
  dom.playerDuration.textContent = current.duration || "--:--";
  dom.playerCurrentTime.textContent = formatProgress(current.duration, current.progress);
  dom.playerEndTime.textContent = current.duration || "--:--";
  dom.playerProgress.style.width = `${Math.max(0, Math.min(100, Number(current.progress || 0)))}%`;
  dom.volumeInput.value = String(current.volume ?? 72);
  dom.playerBadges.innerHTML = [current.source || "Source", visualMode === "video" ? "video" : "audio", current.canPlayVideo ? "clip dispo" : "audio seul"].map((item) => `<span class="library-badge">${escapeHtml(item)}</span>`).join("");
  dom.playerVisual.innerHTML = visualMode === "video" && current.canPlayVideo ? `<div><strong style="display:block;margin-bottom:6px;">Lecteur video simule</strong><div>Clip, live session ou video YouTube.</div></div>` : `<div><strong style="display:block;margin-bottom:6px;">Lecture audio en cours</strong><div>Player global ou audio bibliotheque.</div></div>`;
  dom.footerPlay.textContent = current.isPlaying ? "Pause" : "Play";
  dom.prevButton.disabled = !state.nowPlaying;
  dom.nextButton.disabled = !state.queue.length;
  dom.forwardButton.disabled = !state.nowPlaying;
  dom.shuffleButton.disabled = !state.nowPlaying;
  dom.repeatButton.disabled = !state.nowPlaying;
  dom.volumeInput.disabled = !state.nowPlaying;
  dom.footerPrev.disabled = !state.nowPlaying;
  dom.footerPlay.disabled = !state.nowPlaying;
  dom.footerNext.disabled = !state.queue.length;
  dom.footerShuffle.disabled = !state.nowPlaying;
  dom.footerRepeat.disabled = !state.nowPlaying;
  dom.footerCurrent.innerHTML = `<div class="library-player-cover">${visualMode === "video" ? "▣" : "♫"}</div><div><p style="margin:0;font-weight:700;">${escapeHtml(current.title)}</p><p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">${escapeHtml(current.artist)} · ${visualMode === "video" ? "video" : "audio"}</p></div>`;
}

function renderQueue() {
  dom.queueList.innerHTML = state.queue.length ? state.queue.map((item, index) => `<div class="library-queue-item"><div><p style="margin:0;font-weight:700;">${escapeHtml(item.title)}</p><small style="display:block;margin-top:6px;color:#9ca3af;">${escapeHtml(item.artist || item.subtitle || "")}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="library-queue-move library-ghost" type="button" data-queue-play-now="${index}">Play</button><button class="library-queue-move library-ghost" type="button" data-queue-move-up="${index}">↑</button><button class="library-queue-move library-ghost" type="button" data-queue-move-down="${index}">↓</button><button class="library-queue-move library-ghost" type="button" data-queue-remove="${index}">×</button></div></div>`).join("") : `<div class="library-list-card"><p style="margin:0;">Aucun morceau dans la queue.</p></div>`;
  dom.queueList.querySelectorAll("[data-queue-play-now]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.getAttribute("data-queue-play-now"));
    const item = state.queue[index];
    if (!item) return;
    state.queue = state.queue.filter((_, itemIndex) => itemIndex !== index);
    playMedia(item, item.canPlayVideo ? state.playerMode : "audio");
  }));
  dom.queueList.querySelectorAll("[data-queue-move-up]").forEach((button) => button.addEventListener("click", () => moveQueueItem(Number(button.getAttribute("data-queue-move-up")), "up")));
  dom.queueList.querySelectorAll("[data-queue-move-down]").forEach((button) => button.addEventListener("click", () => moveQueueItem(Number(button.getAttribute("data-queue-move-down")), "down")));
  dom.queueList.querySelectorAll("[data-queue-remove]").forEach((button) => button.addEventListener("click", () => removeQueueItem(Number(button.getAttribute("data-queue-remove")))));
}

function renderRecommendations() {
  dom.recommendationsList.innerHTML = getRecommendations().map((row) => `<button class="library-list-card library-list-button" type="button" data-recommendation-id="${escapeHtml(row.id)}"><p style="margin:0;font-weight:700;">${escapeHtml(row.title)}</p><small style="display:block;margin-top:6px;color:#9ca3af;">Score ${row.score} · ${escapeHtml(row.mood)}</small></button>`).join("");
  dom.recommendationsList.querySelectorAll("[data-recommendation-id]").forEach((button) => button.addEventListener("click", () => { const row = [...MEDIA_CATALOG, ...getAllRows()].find((item) => item.id === String(button.getAttribute("data-recommendation-id") || "")); playMedia(row, row?.canPlayVideo ? state.playerMode : "audio"); }));
}

function renderSocial() {
  const selected = getSelectedCollection();
  dom.socialList.innerHTML = `<div class="library-list-card"><p style="margin:0;">❤ Liker la collection</p><small>${selected ? `${selected.socials.likes} likes actuellement` : "Collection requise"}</small></div><div class="library-list-card"><p style="margin:0;">💬 Commenter</p><small>Discussion sociale autour de la collection</small></div><div class="library-list-card"><p style="margin:0;">📤 Partager</p><small>Tes amis ecoutent surtout Night Drive et Afro Sunset cette semaine.</small></div>`;
}

function renderRightsBox() { dom.rightsList.innerHTML = `<div class="library-list-card"><p style="margin:0;">${isLoggedIn() ? "Actions de gestion autorisees" : "Actions de gestion bloquees"}</p><small>${isLoggedIn() ? "Creation, edition et suppression actives sur /collections." : "Connexion requise pour modifier les collections."}</small></div>`; }
function renderStatusBox() { dom.statusList.innerHTML = `<div class="library-list-card"><p style="margin:0;">backend principal : /collections/me · favoris : localStorage · player persistant</p><small>${escapeHtml(state.feedback)}</small></div>`; }

function renderRecentAndSimilar() {
  dom.recentList.innerHTML = state.recentlyPlayed.length ? state.recentlyPlayed.map((row) => `<button class="library-list-card library-list-button" type="button" data-recent-id="${escapeHtml(row.id)}"><p style="margin:0;font-weight:700;">${escapeHtml(row.title)}</p><small style="display:block;margin-top:6px;color:#9ca3af;">${escapeHtml(row.artist || row.subtitle || "")}</small></button>`).join("") : `<div class="library-list-card"><p style="margin:0;">Aucun historique recent.</p></div>`;
  dom.recentList.querySelectorAll("[data-recent-id]").forEach((button) => button.addEventListener("click", () => { const row = state.recentlyPlayed.find((item) => item.id === String(button.getAttribute("data-recent-id") || "")); playMedia(row, row?.canPlayVideo ? state.playerMode : "audio"); }));
  const similarRows = getSimilarRows();
  dom.similarList.innerHTML = similarRows.length ? similarRows.map((row) => `<button class="library-list-card library-list-button" type="button" data-similar-id="${escapeHtml(row.id)}"><p style="margin:0;font-weight:700;">${escapeHtml(row.title)}</p><small style="display:block;margin-top:6px;color:#9ca3af;">${escapeHtml(row.subtitle || row.artist || "")}</small></button>`).join("") : `<div class="library-list-card"><p style="margin:0;">Aucune suggestion similaire.</p></div>`;
  dom.similarList.querySelectorAll("[data-similar-id]").forEach((button) => button.addEventListener("click", () => { const row = [...MEDIA_CATALOG, ...getAllRows()].find((item) => item.id === String(button.getAttribute("data-similar-id") || "")); playMedia(row, row?.canPlayVideo ? state.playerMode : "audio"); }));
}

function renderAll() {
  renderAuthBadge(); renderNotifications(); renderViewButtons(); renderCollectionsList(); renderAutoCollections(); renderCollectionHero(); renderMainContent(); renderStats(); renderPlayer(); renderQueue(); renderRecommendations(); renderSocial(); renderRightsBox(); renderStatusBox(); renderRecentAndSimilar();
}

function bindEvents() {
  state.notifications = sanitizeNotifications(DEFAULT_NOTIFICATIONS);
  state.favorites = new Set(loadFavorites());
  state.viewMode = loadView();
  state.playerMode = loadPlayerMode();
  state.nowPlaying = loadPlayerState();
  state.recentlyPlayed = [state.nowPlaying];
  state.queue = [
    { id: "q-1", media_type: "album", media_id: "q-1", title: "After Hours", subtitle: "The Weeknd · Album", source: "Spotify", isYoutube: false, canPlayVideo: false, duration: "4:01", artist: "The Weeknd", mood: "night", energy: "medium", duplicateKey: "after-hours" },
    { id: "q-2", media_type: "track", media_id: "q-2", title: "DND", subtitle: "Rema · Track", source: "Spotify", isYoutube: false, canPlayVideo: false, duration: "2:58", artist: "Rema", mood: "sunset", energy: "low", duplicateKey: "dnd-rema" },
    { id: "q-3", media_type: "playlist", media_id: "q-3", title: "Sunset Vibes", subtitle: "YouTube Playlist · Afro Mood", source: "YouTube", isYoutube: true, canPlayVideo: true, duration: "18:45", artist: "Afro Mood", mood: "sunset", energy: "low", duplicateKey: "sunset-vibes-afro-mood", youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  ];
  dom.notificationsButton?.addEventListener("click", () => { state.notificationsOpen = !state.notificationsOpen; renderNotifications(); });
  dom.notificationsReadButton?.addEventListener("click", markAllNotificationsRead);
  document.addEventListener("mousedown", (event) => { if (!state.notificationsOpen) return; if (dom.notificationsPanel.contains(event.target) || dom.notificationsButton.contains(event.target)) return; state.notificationsOpen = false; renderNotifications(); });
  dom.syncButton?.addEventListener("click", () => syncCollections().catch((error) => toast(error?.message || "Erreur", "Erreur")));
  dom.createCollectionButton?.addEventListener("click", () => createCollection().catch((error) => toast(error?.message || "Erreur", "Erreur")));
  dom.renameCollectionButton?.addEventListener("click", () => renameCollection().catch((error) => toast(error?.message || "Erreur", "Erreur")));
  dom.deleteCollectionButton?.addEventListener("click", () => deleteCollection().catch((error) => toast(error?.message || "Erreur", "Erreur")));
  dom.addMediaButton?.addEventListener("click", () => addMediaToCollection().catch((error) => toast(error?.message || "Erreur", "Erreur")));
  dom.mergeCollectionsButton?.addEventListener("click", () => mergeCollections().catch((error) => toast(error?.message || "Erreur", "Erreur")));
  dom.deduplicateButton?.addEventListener("click", () => deduplicateSelectedCollection().catch((error) => toast(error?.message || "Erreur", "Erreur")));
  dom.favoritesOnlyButton?.addEventListener("click", () => { state.favoritesOnly = !state.favoritesOnly; setFeedback(state.favoritesOnly ? "Filtre favoris active" : "Affichage complet retabli"); renderAll(); });
  dom.shareButton?.addEventListener("click", () => setFeedback("Partage de collection pret"));
  dom.viewButtons.forEach((button) => button.addEventListener("click", () => { state.viewMode = button.getAttribute("data-library-view") === "favorites" ? "favorites" : "collections"; persistView(); renderAll(); }));
  dom.audioModeButton?.addEventListener("click", () => {
    state.playerMode = "audio";
    persistPlayerMode();
    if (state.nowPlaying) persistPlayerState();
    renderPlayer();
  });
  dom.videoModeButton?.addEventListener("click", () => {
    state.playerMode = "video";
    persistPlayerMode();
    if (state.nowPlaying) persistPlayerState();
    renderPlayer();
  });
  dom.prevButton?.addEventListener("click", () => {
    if (!state.nowPlaying) return;
    state.nowPlaying.progress = Math.max(0, Number(state.nowPlaying.progress || 0) - 12);
    persistPlayerState();
    renderPlayer();
  });
  dom.nextButton?.addEventListener("click", playNextFromQueue);
  dom.forwardButton?.addEventListener("click", () => {
    if (!state.nowPlaying) return;
    state.nowPlaying.progress = Math.min(100, Number(state.nowPlaying.progress || 0) + 14);
    persistPlayerState();
    renderPlayer();
  });
  dom.shuffleButton?.addEventListener("click", () => {
    if (!state.nowPlaying) return;
    state.nowPlaying.shuffle = !state.nowPlaying.shuffle;
    persistPlayerState();
    renderPlayer();
  });
  dom.repeatButton?.addEventListener("click", () => {
    if (!state.nowPlaying) return;
    state.nowPlaying.repeat = !state.nowPlaying.repeat;
    persistPlayerState();
    renderPlayer();
  });
  dom.volumeInput?.addEventListener("input", (event) => {
    if (!state.nowPlaying) return;
    state.nowPlaying.volume = Number(event.target.value);
    persistPlayerState();
  });
  dom.footerShuffle?.addEventListener("click", () => dom.shuffleButton.click());
  dom.footerPrev?.addEventListener("click", () => dom.prevButton.click());
  dom.footerPlay?.addEventListener("click", togglePlayback);
  dom.footerNext?.addEventListener("click", playNextFromQueue);
  dom.footerRepeat?.addEventListener("click", () => dom.repeatButton.click());
}

async function init() {
  bindEvents();
  restartSyncLoop();
  renderAll();
  await loadCollections();
}

init().catch((error) => { toast(error?.message || "Erreur chargement bibliotheque", "Erreur"); });
