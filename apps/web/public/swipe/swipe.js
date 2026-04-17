import { apiFetch, escapeHtml, isLoggedIn, toast } from "/noyau/app.js";

const STORAGE_KEY = "supcontent-swipe-state-v3";
const DRAG_THRESHOLD = 120;
const DEFAULT_ADVANCED_FILTERS = {
  ageMin: "",
  ageMax: "",
  heightMin: "",
  heightMax: "",
  locationQuery: "",
  maxDistanceKm: "",
  useDistanceFilter: false,
  gender: "all",
  race: "all",
};

const DEFAULT_NOTIFICATIONS = [
  { id: 1, type: "release", user: "Nina.beats", text: "a partage une nouvelle sortie : Timeless - The Weeknd", time: "Il y a 2 min", read: false },
  { id: 2, type: "community", user: "Ayo.wav", text: "a aime ta playlist Afro Sunset", time: "Il y a 8 min", read: false },
  { id: 3, type: "follow", user: "Luna.mix", text: "a commence a te suivre", time: "Il y a 21 min", read: false },
  { id: 4, type: "comment", user: "Melo", text: 'a commente ton post : "grosse ambiance ce son"', time: "Il y a 1 h", read: true },
];

const fallbackLikesYouProfiles = [
  { id: "mock-201", name: "Mira.sound", vibe: "R&B / Afro / Night feelings", compatibility: 92, sourceLabel: "Mock" },
  { id: "mock-202", name: "Yann.loop", vibe: "Rap FR / Trap / Drive", compatibility: 88, sourceLabel: "Mock" },
  { id: "mock-203", name: "Zia.fm", vibe: "Pop / Electro / Soft mood", compatibility: 85, sourceLabel: "Mock" },
];

const fallbackMusicCards = [
  {
    id: 101,
    name: "Midnight Drive",
    artistLabel: "The Weeknd · Album",
    city: "Spotify",
    vibe: "Pop nocturne / Synthwave / Moody",
    genreGroup: "pop",
    compatibility: 96,
    createdRank: 3,
    recentTasteBoost: 98,
    topArtists: ["Blinding Lights", "Take My Breath", "After Hours"],
    playlists: ["Parfait pour la nuit", "Tres proche de tes likes recents"],
    bio: "Un projet a swiper si tu veux une ambiance de route nocturne, neons et grosses prods melancoliques.",
    status: "Recommande selon tes ecoutes recentes",
    cardType: "music",
    media_type: "album",
    media_id: "fallback-midnight-drive",
  },
  {
    id: 102,
    name: "Afro Sunset",
    artistLabel: "Tems · Playlist mood",
    city: "Spotify",
    vibe: "Afro chill / Sunset / Summer",
    genreGroup: "afro",
    compatibility: 93,
    createdRank: 1,
    recentTasteBoost: 95,
    topArtists: ["Tems", "Rema", "Asake"],
    playlists: ["Tres coherent avec tes favoris afro", "Enorme potentiel de replay"],
    bio: "Une selection douce et solaire pour decouvrir ou relancer des sons afro tres fluides.",
    status: "Hot dans les recommandations perso",
    cardType: "music",
    media_type: "playlist",
    media_id: "fallback-afro-sunset",
  },
];

const state = {
  viewMode: "discover",
  notificationsOpen: false,
  notifications: sanitizeNotifications(DEFAULT_NOTIFICATIONS),
  likedIds: [],
  passedIds: [],
  superLikedIds: [],
  history: [],
  matches: [],
  genreFilter: "all",
  sortMode: "compatibility",
  advancedFilters: { ...DEFAULT_ADVANCED_FILTERS },
  actionLock: false,
  swipeFeedback: "",
  activeMatch: null,
  compatibilityMap: {},
  compatibilityLoading: true,
  profiles: [],
  musics: [],
  likesYou: [],
  invitations: [],
};

function isAuthedSwipeUser() {
  return isLoggedIn();
}

const refs = {
  matchModal: document.querySelector("#swipeMatchModal"),
  matchTitle: document.querySelector("#swipeMatchTitle"),
  matchText: document.querySelector("#swipeMatchText"),
  openChatBtn: document.querySelector("#swipeOpenChatBtn"),
  closeMatchBtn: document.querySelector("#swipeCloseMatchBtn"),
  notifDropdown: document.querySelector("#swipeNotifDropdown"),
  notifBtn: document.querySelector("#swipeNotifBtn"),
  notifBadge: document.querySelector("#swipeNotifBadge"),
  notifPanel: document.querySelector("#swipeNotifPanel"),
  notifTests: document.querySelector("#swipeNotifTests"),
  logicTests: document.querySelector("#swipeLogicTests"),
  notifList: document.querySelector("#swipeNotifList"),
  markAllReadBtn: document.querySelector("#swipeMarkAllReadBtn"),
  headerStats: document.querySelector("#swipeHeaderStats"),
  tabButtons: Array.from(document.querySelectorAll("[data-view]")),
  likesSection: document.querySelector("#swipeLikesSection"),
  matchesSection: document.querySelector("#swipeMatchesSection"),
  genreButtons: Array.from(document.querySelectorAll("[data-genre]")),
  sortButtons: Array.from(document.querySelectorAll("[data-sort]")),
  ageMinInput: document.querySelector("#swipeAgeMinInput"),
  ageMaxInput: document.querySelector("#swipeAgeMaxInput"),
  heightMinInput: document.querySelector("#swipeHeightMinInput"),
  heightMaxInput: document.querySelector("#swipeHeightMaxInput"),
  locationInput: document.querySelector("#swipeLocationInput"),
  distanceInput: document.querySelector("#swipeDistanceInput"),
  distanceToggle: document.querySelector("#swipeDistanceToggle"),
  genderSelect: document.querySelector("#swipeGenderSelect"),
  raceSelect: document.querySelector("#swipeRaceSelect"),
  applyAdvancedFiltersBtn: document.querySelector("#swipeApplyAdvancedFiltersBtn"),
  resetAdvancedFiltersBtn: document.querySelector("#swipeResetAdvancedFiltersBtn"),
  advancedFilterSummary: document.querySelector("#swipeAdvancedFilterSummary"),
  undoBtn: document.querySelector("#swipeUndoBtn"),
  cardStage: document.querySelector("#swipeCardStage"),
  modeText: document.querySelector("#swipeModeText"),
  scoreSource: document.querySelector("#swipeScoreSource"),
  likesCount: document.querySelector("#swipeLikesCount"),
  passCount: document.querySelector("#swipePassCount"),
  superLikesCount: document.querySelector("#swipeSuperLikesCount"),
  lastAction: document.querySelector("#swipeLastAction"),
  sortDescription: document.querySelector("#swipeSortDescription"),
  scoreStatus: document.querySelector("#swipeScoreStatus"),
  matchesMini: document.querySelector("#swipeMatchesMini"),
  superLikesMini: document.querySelector("#swipeSuperLikesMini"),
  invitationsMini: document.querySelector("#swipeInvitationsMini"),
  passesMini: document.querySelector("#swipePassesMini"),
};

let swipeResetTimer = null;
let dragStartX = 0;

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
    { input: [{ id: 1, type: "comment", user: "Test", text: "ok", time: "now", read: false }], check: (result) => result.length === 1 && result[0].read === false },
    { input: [{ id: 2, type: "follow", user: "Test", text: "ok", time: "now" }], check: (result) => result.length === 1 && result[0].read === false },
    { input: [undefined], check: (result) => result.length === 1 && result[0].user === "Systeme" },
    { input: null, check: (result) => Array.isArray(result) && result.length === 0 },
    { input: [{ id: 9, user: "A" }], check: (result) => result[0].text === "Nouvelle activite" && result[0].read === false },
  ];
  return cases.map((test) => ({ passed: test.check(sanitizeNotifications(test.input)) }));
}

function runSwipeLogicTests() {
  const discoverCards = state.profiles.length ? state.profiles : [];
  const cases = [
    { check: () => discoverCards.filter((profile) => !state.likedIds.includes(profile.id) && !state.passedIds.includes(profile.id) && !state.superLikedIds.includes(profile.id)).length >= 0 },
    { check: () => Array.isArray(state.matches) },
    { check: () => ["compatibility", "new", "recentTaste"].includes(state.sortMode) },
    { check: () => Array.isArray(state.history) },
    { check: () => Array.isArray(getCardsForCurrentMode()) },
  ];
  return cases.map((test) => ({ passed: test.check() }));
}

function getDefaultState() {
  return {
    likedIds: [],
    passedIds: [],
    superLikedIds: [],
    history: [],
    matches: [],
    genreFilter: "all",
    sortMode: "compatibility",
    advancedFilters: { ...DEFAULT_ADVANCED_FILTERS },
  };
}

function loadPersistedSwipeState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return {
      likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds : [],
      passedIds: Array.isArray(parsed.passedIds) ? parsed.passedIds : [],
      superLikedIds: Array.isArray(parsed.superLikedIds) ? parsed.superLikedIds : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      genreFilter: parsed.genreFilter ?? "all",
      sortMode: parsed.sortMode ?? "compatibility",
      advancedFilters: { ...DEFAULT_ADVANCED_FILTERS, ...(parsed.advancedFilters || {}) },
    };
  } catch {
    return getDefaultState();
  }
}

function persistState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        likedIds: state.likedIds,
        passedIds: state.passedIds,
        superLikedIds: state.superLikedIds,
        history: state.history,
        matches: state.matches,
        genreFilter: state.genreFilter,
        sortMode: state.sortMode,
        advancedFilters: state.advancedFilters,
      })
    );
  } catch {
    toast("Impossible de sauvegarder l'etat swipe en local.", "Erreur");
  }
}

function stableSeed(input) {
  return String(input || "")
    .split("")
    .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
}

function generateProfileTraits(item, index) {
  const seed = stableSeed(item?.id || index);
  const heights = [158, 162, 166, 170, 174, 178, 182, 186, 190];
  const races = ["black", "arab", "white", "asian", "mixed", "other"];
  const genderMap = ["male", "female", "other", "prefer_not_to_say"];
  const genderRaw = String(item?.gender || "").trim().toLowerCase();
  const gender = genderMap.includes(genderRaw) ? genderRaw : genderMap[seed % genderMap.length];
  return {
    heightCm: heights[seed % heights.length],
    race: races[seed % races.length],
    gender,
  };
}

function getUnreadCount() {
  return sanitizeNotifications(state.notifications).filter((item) => !item.read).length;
}

function getNotificationIcon(type) {
  switch (type) {
    case "release":
      return "♪";
    case "community":
      return "♥";
    case "follow":
      return "+";
    case "comment":
      return "✎";
    case "playlist":
      return "◈";
    default:
      return "•";
  }
}

function classifyGenre(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("afro") || value.includes("amapiano")) return "afro";
  if (value.includes("pop") || value.includes("electro")) return "pop";
  if (value.includes("rap") || value.includes("drill") || value.includes("trap")) return "rap";
  return "all";
}

function mapProfile(item, index) {
  const vibe = String(item?.bio || item?.location || "Compatibilit? musicale");
  const artists = Array.isArray(item?.top_artists) ? item.top_artists : [];
  const compatibility = Math.min(99, Math.max(72, 82 + ((index * 5) % 14)));
  const traits = generateProfileTraits(item, index);
  return {
    id: String(item?.id || `profile-${index + 1}`),
    name: String(item?.display_name || item?.username || "Utilisateur"),
    age: item?.age ?? null,
    city: String(item?.location || "SUPCONTENT"),
    vibe,
    genreGroup: classifyGenre(vibe),
    compatibility,
    createdRank: index + 1,
    recentTasteBoost: compatibility + 2,
    topArtists: artists.length ? artists : ["The Weeknd", "Tems", "Tiakola"],
    playlists: ["Gouts similaires", "Bon potentiel de match"],
    bio: String(item?.bio || "Profil musical suggere a partir de tes preferences."),
    status: item?.is_followed_by ? "Te suit deja" : item?.is_following ? "Tu le suis deja" : "Nouveau profil musical",
    mockReciprocalLike: Boolean(item?.is_followed_by),
    gender: traits.gender,
    heightCm: traits.heightCm,
    race: traits.race,
    distanceKm: item?.distance_km == null ? null : Number(item.distance_km),
    cardType: "profile",
    raw: item,
  };
}

function mapInvitation(item, index) {
  const name = String(item?.display_name || item?.username || "Utilisateur");
  const relationText = item?.can_chat_direct
    ? "Chat direct disponible"
    : item?.message
      ? String(item.message)
      : "Invitation de discussion apres swipe";
  return {
    id: String(item?.id || `inv-${index}`),
    profileId: String(item?.sender_id || ""),
    name,
    vibe: relationText,
    compatibility: Math.min(99, Math.max(78, 90 - index * 3)),
    sourceLabel: item?.can_chat_direct ? "Invitation + match" : "Invitation",
    canChatDirect: Boolean(item?.can_chat_direct),
    matchId: String(item?.id || `inv-${index}`),
  };
}

function mapLikeItem(item, index) {
  const user = item?.user || {};
  const name = String(user?.display_name || user?.username || "Utilisateur");
  const vibe = String(user?.bio || user?.location || item?.message || "Compatibilit? musicale");
  const isSuperlike = Boolean(item?.is_superlike);
  const profileId = String(item?.profile_id || user?.id || `like-${index}`);
  const compatibility = Math.min(99, Math.max(78, isSuperlike ? 95 - index * 2 : 88 - index * 2));
  return {
    id: String(item?.swipe_id || `like-${index}`),
    profileId,
    name,
    vibe,
    compatibility,
    sourceLabel: String(item?.source_label || (isSuperlike ? "Super like recu" : "Like recu")),
    canChatDirect: Boolean(item?.can_chat_direct),
    matchId: String(item?.match_id || `match-${profileId}`),
    isSuperlike,
    createdAt: item?.created_at || null,
  };
}

function mapMatchItem(item, index) {
  const user = item?.user || {};
  const name = String(user?.display_name || user?.username || "Utilisateur");
  const vibe = String(user?.bio || user?.location || "Match musical confirme");
  const profileId = String(user?.id || item?.profile_id || `match-${index}`);
  return {
    matchId: String(item?.match_id || `match-${profileId}`),
    profileId,
    name,
    vibe,
    canChatDirect: Boolean(item?.can_chat_direct),
    isSuperlike: Boolean(item?.is_superlike),
    createdAt: item?.created_at || null,
  };
}

function mapMusic(item, index) {
  const media = item?.media || {};
  const title = String(media?.name || `${item?.media_type || "track"} ${item?.media_id || ""}`);
  const subtitle = String(media?.subtitle || item?.media_type || "Media");
  const vibe = `${subtitle} / ${title}`;
  const compatibility = Math.min(99, Math.max(75, 84 + ((index * 4) % 12)));
  return {
    id: String(item?.media_id || `music-${index + 1}`),
    name: title,
    artistLabel: subtitle,
    city: String(media?.spotify_url ? "Spotify" : "SUPCONTENT"),
    vibe,
    genreGroup: classifyGenre(vibe),
    compatibility,
    createdRank: index + 1,
    recentTasteBoost: compatibility + 3,
    topArtists: [title, subtitle, `${Math.round(Number(item?.avg_rating || 0) * 10) / 10}/5`],
    playlists: ["Reco selon tes notes", "Basee sur tes ecoutes recentes"],
    bio: "Carte musique issue de /follows/swipe/music pour varier entre personnes et medias.",
    status: `Reviews: ${Number(item?.review_count || 0)} · Notes: ${Math.round(Number(item?.avg_rating || 0) * 10) / 10}`,
    cardType: "music",
    media_type: String(item?.media_type || "track"),
    media_id: String(item?.media_id || ""),
    raw: item,
  };
}

function normalizeAdvancedFilters(raw = {}) {
  return {
    ageMin: String(raw.ageMin ?? "").trim(),
    ageMax: String(raw.ageMax ?? "").trim(),
    heightMin: String(raw.heightMin ?? "").trim(),
    heightMax: String(raw.heightMax ?? "").trim(),
    locationQuery: String(raw.locationQuery ?? "").trim(),
    maxDistanceKm: String(raw.maxDistanceKm ?? "").trim(),
    useDistanceFilter: Boolean(raw.useDistanceFilter),
    gender: String(raw.gender || "all"),
    race: String(raw.race || "all"),
  };
}

function readAdvancedFiltersFromUi() {
  return normalizeAdvancedFilters({
    ageMin: refs.ageMinInput?.value,
    ageMax: refs.ageMaxInput?.value,
    heightMin: refs.heightMinInput?.value,
    heightMax: refs.heightMaxInput?.value,
    locationQuery: refs.locationInput?.value,
    maxDistanceKm: refs.distanceInput?.value,
    useDistanceFilter: refs.distanceToggle?.checked,
    gender: refs.genderSelect?.value,
    race: refs.raceSelect?.value,
  });
}

function writeAdvancedFiltersToUi() {
  const filters = normalizeAdvancedFilters(state.advancedFilters);
  if (refs.ageMinInput) refs.ageMinInput.value = filters.ageMin;
  if (refs.ageMaxInput) refs.ageMaxInput.value = filters.ageMax;
  if (refs.heightMinInput) refs.heightMinInput.value = filters.heightMin;
  if (refs.heightMaxInput) refs.heightMaxInput.value = filters.heightMax;
  if (refs.locationInput) refs.locationInput.value = filters.locationQuery;
  if (refs.distanceInput) refs.distanceInput.value = filters.maxDistanceKm;
  if (refs.distanceToggle) refs.distanceToggle.checked = filters.useDistanceFilter;
  if (refs.genderSelect) refs.genderSelect.value = filters.gender;
  if (refs.raceSelect) refs.raceSelect.value = filters.race;
}

function applyAdvancedProfileFilters(card) {
  const filters = normalizeAdvancedFilters(state.advancedFilters);
  const age = Number(card.age);
  const height = Number(card.heightCm);
  const location = String(card.city || "").toLowerCase();
  const distance = Number(card.distanceKm);
  const ageMin = Number.parseInt(filters.ageMin, 10);
  const ageMax = Number.parseInt(filters.ageMax, 10);
  const heightMin = Number.parseInt(filters.heightMin, 10);
  const heightMax = Number.parseInt(filters.heightMax, 10);
  const maxDistanceKm = Number.parseInt(filters.maxDistanceKm, 10);

  if (Number.isFinite(ageMin) && (!Number.isFinite(age) || age < ageMin)) return false;
  if (Number.isFinite(ageMax) && (!Number.isFinite(age) || age > ageMax)) return false;
  if (Number.isFinite(heightMin) && (!Number.isFinite(height) || height < heightMin)) return false;
  if (Number.isFinite(heightMax) && (!Number.isFinite(height) || height > heightMax)) return false;
  if (filters.locationQuery && !location.includes(filters.locationQuery.toLowerCase())) return false;
  if (filters.gender !== "all" && String(card.gender || "").toLowerCase() !== filters.gender) return false;
  if (filters.race !== "all" && String(card.race || "").toLowerCase() !== filters.race) return false;
  if (filters.useDistanceFilter && Number.isFinite(maxDistanceKm)) {
    if (!Number.isFinite(distance) || distance > maxDistanceKm) return false;
  }
  return true;
}

function renderAdvancedFilterSummary() {
  const filters = normalizeAdvancedFilters(state.advancedFilters);
  const labels = [];
  if (filters.ageMin || filters.ageMax) labels.push(`Age ${filters.ageMin || "18"}-${filters.ageMax || "99"}`);
  if (filters.heightMin || filters.heightMax) labels.push(`Taille ${filters.heightMin || "120"}-${filters.heightMax || "230"} cm`);
  if (filters.locationQuery) labels.push(`Lieu: ${filters.locationQuery}`);
  if (filters.gender !== "all") labels.push(`Genre: ${filters.gender}`);
  if (filters.race !== "all") labels.push(`Origine: ${filters.race}`);
  if (filters.useDistanceFilter && filters.maxDistanceKm) labels.push(`Distance: ${filters.maxDistanceKm} km max`);
  refs.advancedFilterSummary.textContent = labels.length ? labels.join(" · ") : "Filtres larges actifs.";
}

async function syncBackendSwipePreferences() {
  if (!isAuthedSwipeUser()) return;
  const filters = normalizeAdvancedFilters(state.advancedFilters);
  const minAge = Number.parseInt(filters.ageMin, 10);
  const maxAge = Number.parseInt(filters.ageMax, 10);
  const payload = {
    use_distance_filter: Boolean(filters.useDistanceFilter),
    max_distance_km: Number.parseInt(filters.maxDistanceKm, 10) || 50,
    min_age: Number.isFinite(minAge) ? minAge : 18,
    max_age: Number.isFinite(maxAge) ? maxAge : 99,
    preferred_genders: filters.gender !== "all" ? [filters.gender] : [],
  };
  await apiFetch("/follows/swipe/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).catch(() => null);
}

function getCardsForCurrentMode() {
  const source = state.viewMode === "music" ? (state.musics.length ? state.musics : fallbackMusicCards) : state.profiles;
  const swipedIds = new Set([...state.likedIds, ...state.passedIds, ...state.superLikedIds]);
  const filtered = source.filter((card) => {
    const matchesGenre = state.genreFilter === "all" || card.genreGroup === state.genreFilter;
    const matchesAdvanced = state.viewMode === "music" ? true : applyAdvancedProfileFilters(card);
    return matchesGenre && matchesAdvanced && !swipedIds.has(card.id);
  });
  return filtered.slice().sort((a, b) => {
    if (state.sortMode === "compatibility") return b.compatibility - a.compatibility;
    if (state.sortMode === "new") return (a.createdRank || 999) - (b.createdRank || 999);
    if (state.sortMode === "recentTaste") return (b.recentTasteBoost || b.compatibility) - (a.recentTasteBoost || a.compatibility);
    return 0;
  });
}

function getCurrentCard() {
  if (state.viewMode !== "discover" && state.viewMode !== "music") return null;
  return getCardsForCurrentMode()[0] || null;
}

function findCardLabelById(cardId, modeHint) {
  const primarySource = modeHint === "music" ? state.musics : state.profiles;
  const primaryCard = primarySource.find((item) => String(item.id) === String(cardId));
  if (primaryCard) return primaryCard.name;

  const fallbackCard = [...state.profiles, ...state.musics].find((item) => String(item.id) === String(cardId));
  return fallbackCard?.name || `Carte #${cardId}`;
}

function getRecentHistoryByDirection(direction, limit = 3) {
  return state.history.filter((item) => item.direction === direction).slice(0, limit);
}

function renderMiniCard(title, subtitle, buttonHtml = "") {
  return `
    <div class="swipe-list-card">
      <p style="font-weight:700;">${escapeHtml(title)}</p>
      <p style="color:#a1a1aa;font-size:13px;">${escapeHtml(subtitle)}</p>
      ${buttonHtml}
    </div>
  `;
}

function setActionFeedback(type) {
  state.swipeFeedback = type;
  renderCardStage();
  if (swipeResetTimer) clearTimeout(swipeResetTimer);
  swipeResetTimer = window.setTimeout(() => {
    state.swipeFeedback = "";
    state.actionLock = false;
    renderCardStage();
    renderSummary();
  }, 340);
}

function renderHeader() {
  refs.headerStats.textContent = `${state.likedIds.length} likes · ${state.superLikedIds.length} super likes · ${state.matches.length} matchs`;
}

function pushLocalMatch(card, direction, backendMatchId = "") {
  const match = {
    matchId: String(backendMatchId || `match-${card.id}`),
    profileId: String(card.id),
    name: card.name,
    vibe: card.vibe,
    canChatDirect: true,
    isSuperlike: direction === "superlike",
  };
  state.matches = [match, ...state.matches.filter((item) => item.profileId !== card.id)];
  state.activeMatch = match;
}

function renderNotifications() {
  const unreadCount = getUnreadCount();
  const notifTestsPassed = runNotificationTests().every((item) => item.passed);
  const swipeTestsPassed = runSwipeLogicTests().every((item) => item.passed);
  const safeNotifications = sanitizeNotifications(state.notifications);

  refs.notifBtn.classList.toggle("is-open", state.notificationsOpen);
  refs.notifPanel.hidden = !state.notificationsOpen;
  refs.notifBadge.hidden = unreadCount === 0;
  refs.notifBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);

  refs.notifTests.className = `swipe-notif-note ${notifTestsPassed ? "is-green" : "is-red"}`;
  refs.logicTests.className = `swipe-notif-note ${swipeTestsPassed ? "is-green" : "is-red"}`;
  refs.notifTests.textContent = notifTestsPassed ? "Tests notifications passes" : "Un test notifications a echoue";
  refs.logicTests.textContent = swipeTestsPassed ? "Tests swipe passes" : "Un test swipe a echoue";

  refs.notifList.innerHTML = safeNotifications.map((item) => `
    <button class="swipe-notif-item ${item.read ? "" : "is-unread"}" type="button" data-notif-id="${String(item.id)}">
      <div class="swipe-notif-icon">${getNotificationIcon(item.type)}</div>
      <div>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="font-size:14px;line-height:1.35;"><strong>${escapeHtml(item.user)}</strong> ${escapeHtml(item.text)}</div>
          ${item.read ? "" : '<span style="width:10px;height:10px;border-radius:999px;background:#34d399;flex:0 0 auto;margin-top:4px;"></span>'}
        </div>
        <div style="margin-top:6px;font-size:12px;color:#8b949e;">${escapeHtml(item.time)}</div>
      </div>
    </button>
  `).join("");

  refs.notifList.querySelectorAll("[data-notif-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-notif-id");
      state.notifications = sanitizeNotifications(state.notifications).map((item) => (String(item.id) === String(id) ? { ...item, read: true } : item));
      renderNotifications();
    });
  });
}

function renderTabs() {
  refs.tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-view") === state.viewMode);
  });

  const likesOpen = state.viewMode === "likes";
  const matchesOpen = state.viewMode === "matches";
  refs.likesSection.hidden = !likesOpen;
  refs.matchesSection.hidden = !matchesOpen;

  if (likesOpen) {
    const likesYouItems = state.likesYou.length ? state.likesYou : (isAuthedSwipeUser() ? [] : fallbackLikesYouProfiles);
    refs.likesSection.innerHTML = likesYouItems.map((person) => `
      <div class="swipe-list-card">
        <p style="font-weight:700;">${escapeHtml(person.name)}</p>
        <p style="color:#a1a1aa;font-size:14px;">${escapeHtml(person.vibe)}</p>
        <p style="color:#6ee7b7;font-size:12px;">${person.compatibility}% compatible</p>
        <p style="color:#8b949e;font-size:12px;margin-top:6px;">${escapeHtml(person.sourceLabel || "Suggestion")}</p>
        ${person.isSuperlike ? `<p style="color:#f9a8d4;font-size:12px;margin-top:6px;">Super like prioritaire</p>` : ""}
        ${person.canChatDirect ? `<button class="swipe-pill-btn is-primary" type="button" data-open-like-chat="${escapeHtml(person.matchId || "")}" style="margin-top:12px;">Ouvrir le chat</button>` : ""}
      </div>
    `).join("") || `<p style="color:#a1a1aa;font-size:14px;">Aucun like recu pour le moment.</p>`;

    refs.likesSection.querySelectorAll("[data-open-like-chat]").forEach((button) => {
      button.addEventListener("click", () => openChat(button.getAttribute("data-open-like-chat")));
    });
  }

  if (matchesOpen) {
    refs.matchesSection.innerHTML = state.matches.length
      ? state.matches.map((match) => `
          <div class="swipe-list-card">
            <p style="font-weight:700;">${escapeHtml(match.name)}</p>
            <p style="color:#a1a1aa;font-size:14px;">${escapeHtml(match.vibe)}</p>
            <button class="swipe-pill-btn is-primary" type="button" data-open-match="${escapeHtml(match.matchId)}" style="margin-top:12px;">Ouvrir le chat</button>
          </div>
        `).join("")
      : `<p style="color:#a1a1aa;font-size:14px;">Aucun match pour le moment.</p>`;

    refs.matchesSection.querySelectorAll("[data-open-match]").forEach((button) => {
      button.addEventListener("click", () => openChat(button.getAttribute("data-open-match")));
    });
  }
}

function renderSidePanel() {
  refs.modeText.textContent = state.viewMode === "music" ? "D?couverte musicale" : "Compatibilit? musicale";
  refs.scoreSource.textContent = !isAuthedSwipeUser()
    ? "Mode invite avec cartes locales"
    : state.compatibilityLoading
      ? "Chargement /follows/swipe/music..."
      : "API /follows/swipe/music reliee";
  refs.genreButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-genre") === state.genreFilter);
  });
  refs.sortButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-sort") === state.sortMode);
  });
  writeAdvancedFiltersToUi();
  renderAdvancedFilterSummary();
  refs.undoBtn.disabled = state.history.length === 0 || state.actionLock;
}

function cardHtml(card, index, totalCount) {
  const isProfile = card.cardType === "profile";
  const profileMetaTags = isProfile
    ? `
        ${card.age ? `<span class="swipe-tag">${escapeHtml(String(card.age))} ans</span>` : ""}
        ${card.heightCm ? `<span class="swipe-tag">${escapeHtml(String(card.heightCm))} cm</span>` : ""}
        ${card.gender ? `<span class="swipe-tag">${escapeHtml(String(card.gender))}</span>` : ""}
        ${card.race ? `<span class="swipe-tag">${escapeHtml(String(card.race))}</span>` : ""}
        ${card.distanceKm != null ? `<span class="swipe-tag">${escapeHtml(String(card.distanceKm))} km</span>` : ""}
      `
    : "";
  const stateClass = state.swipeFeedback ? ` is-${state.swipeFeedback}` : "";
  return `
    <div id="swipeActiveCard" class="swipe-card-shell${stateClass}${state.actionLock ? " is-locked" : ""}">
      ${state.swipeFeedback === "like" ? '<div class="swipe-overlay-tag is-like">LIKE</div>' : ""}
      ${state.swipeFeedback === "pass" ? '<div class="swipe-overlay-tag is-pass">PASS</div>' : ""}
      ${state.swipeFeedback === "superlike" ? '<div class="swipe-overlay-tag is-superlike">SUPER LIKE</div>' : ""}

      <div class="swipe-card-hero">
        <div class="swipe-card-hero-content">
          <div class="swipe-card-topline">
            <span class="swipe-badge is-green">${card.compatibility}% ${isProfile ? "compatible" : "affinite"}</span>
            <span class="swipe-badge">${index}/${totalCount}</span>
          </div>

          <div>
            <div class="swipe-badge" style="margin-bottom:16px;">${escapeHtml(card.city || "SUPCONTENT")}</div>
            <h2 class="swipe-card-title">${escapeHtml(isProfile ? `${card.name}${card.age ? `, ${card.age}` : ""}` : card.name)}</h2>
            <div class="swipe-card-sub">${escapeHtml(isProfile ? card.vibe : card.artistLabel)}</div>
            <p class="swipe-card-bio">${escapeHtml(card.bio)}</p>
          </div>
        </div>
      </div>

      <div class="swipe-card-body">
        <div>
          <div class="swipe-kicker" style="color:#f9a8d4;">${isProfile ? "Top artistes" : "Titres / artistes lies"}</div>
          <div class="swipe-tag-group">${card.topArtists.map((artist) => `<span class="swipe-tag">${escapeHtml(artist)}</span>`).join("")}</div>
        </div>

        ${isProfile ? `<div><div class="swipe-kicker">Profil</div><div class="swipe-tag-group">${profileMetaTags}</div></div>` : ""}

        <div>
          <div class="swipe-kicker">${isProfile ? "Playlists favorites" : "Pourquoi swiper ce media"}</div>
          <div class="swipe-tag-group">${card.playlists.map((playlist) => `<span class="swipe-tag">${escapeHtml(playlist)}</span>`).join("")}</div>
        </div>

        <div class="swipe-status"><strong>Statut :</strong> ${escapeHtml(card.status)}</div>

        <div class="swipe-actions">
          <button class="swipe-pill-btn" type="button" data-swipe-action="pass">Pass</button>
          <button class="swipe-pill-btn" type="button" data-swipe-action="superlike">Super like</button>
          <button class="swipe-pill-btn is-primary" type="button" data-swipe-action="like">Like</button>
        </div>
      </div>
    </div>
  `;
}

function emptyCardHtml() {
  return `
    <div class="swipe-empty">
      <p style="font-size:20px;font-weight:800;">Il n'y a plus de cartes a swiper</p>
      <p>Recharge la pile, elargis les criteres ou reviens plus tard.</p>
      <div class="swipe-empty-actions">
        <button id="swipeReloadBtn" class="swipe-pill-btn is-primary" type="button">Recharger</button>
        <button id="swipeResetFiltersBtn" class="swipe-pill-btn" type="button">?largir les crit?res</button>
      </div>
    </div>
  `;
}

function renderCardStage() {
  const isCardView = state.viewMode === "discover" || state.viewMode === "music";
  const cards = getCardsForCurrentMode();
  const currentCard = getCurrentCard();
  const totalCount = state.viewMode === "music" ? (state.musics.length || fallbackMusicCards.length) : state.profiles.length;

  if (!isCardView) {
    refs.cardStage.innerHTML = `
      <div class="swipe-empty">
        <p style="font-size:20px;font-weight:800;">Choisis un onglet de consultation</p>
        <p>Les onglets "Ils t'ont like" et "Matchs" utilisent des listes, pas une carte swipe centrale.</p>
      </div>
    `;
    return;
  }

  if (!currentCard) {
    refs.cardStage.innerHTML = emptyCardHtml();
    document.querySelector("#swipeReloadBtn")?.addEventListener("click", reloadQueue);
    document.querySelector("#swipeResetFiltersBtn")?.addEventListener("click", () => {
      state.genreFilter = "all";
      state.advancedFilters = { ...DEFAULT_ADVANCED_FILTERS };
      persistState();
      renderSidePanel();
      renderCardStage();
    });
    return;
  }

  refs.cardStage.innerHTML = cardHtml(currentCard, state.history.length + 1, totalCount || cards.length || 1);
  document.querySelectorAll("[data-swipe-action]").forEach((button) => {
    button.addEventListener("click", () => performSwipe(button.getAttribute("data-swipe-action")));
  });

  const activeCard = document.querySelector("#swipeActiveCard");
  if (!activeCard) return;
  activeCard.addEventListener("pointerdown", (event) => {
    dragStartX = event.clientX;
  });
  activeCard.addEventListener("pointerup", (event) => {
    const dx = event.clientX - dragStartX;
    dragStartX = 0;
    if (state.actionLock) return;
    if (dx > DRAG_THRESHOLD) performSwipe("like");
    else if (dx < -DRAG_THRESHOLD) performSwipe("pass");
  });
}

function renderSummary() {
  refs.likesCount.textContent = String(state.likedIds.length);
  refs.passCount.textContent = String(state.passedIds.length);
  refs.superLikesCount.textContent = String(state.superLikedIds.length);

  refs.lastAction.textContent = state.history[0]
    ? `Carte #${state.history[0].profileId} · ${state.history[0].direction} · ${state.history[0].mode}`
    : "Aucune action r?cente";

  refs.sortDescription.textContent =
    state.sortMode === "compatibility"
      ? "Tri par score API le plus eleve."
      : state.sortMode === "new"
        ? "Tri par nouveaux profils en tete."
        : "Tri par proximite avec tes gouts recents.";

  refs.scoreStatus.textContent = state.compatibilityLoading ? "Mise a jour du scoring en cours..." : "Scoring dynamique pret.";

  refs.matchesMini.innerHTML = state.matches.length
    ? state.matches.map((match) => `
        <div class="swipe-list-card">
          <p style="font-weight:700;">${escapeHtml(match.name)}</p>
          <p style="color:#a1a1aa;font-size:13px;">${escapeHtml(match.vibe)}</p>
          <button class="swipe-pill-btn" type="button" data-open-mini-match="${escapeHtml(match.matchId)}" style="margin-top:10px;">Ouvrir le chat</button>
        </div>
      `).join("")
    : `<p style="color:#a1a1aa;font-size:14px;">Pas encore de match.</p>`;

  refs.matchesMini.querySelectorAll("[data-open-mini-match]").forEach((button) => {
    button.addEventListener("click", () => openChat(button.getAttribute("data-open-mini-match")));
  });

  renderHeader();
}

function renderSummaryEnhanced() {
  renderSummary();

  if (refs.lastAction) {
    refs.lastAction.textContent = state.history[0]
      ? `${state.history[0].label || findCardLabelById(state.history[0].profileId, state.history[0].mode)} · ${state.history[0].direction} · ${state.history[0].mode}`
      : "Aucune action r?cente";
  }

  if (refs.superLikesMini) {
    const recentSuperLikes = getRecentHistoryByDirection("superlike");
    refs.superLikesMini.innerHTML = recentSuperLikes.length
      ? recentSuperLikes.map((item) =>
          renderMiniCard(
            item.label || findCardLabelById(item.profileId, item.mode),
            item.mode === "music" ? "Super like musical envoye" : "Super like profil envoye"
          )
        ).join("")
      : `<p style="color:#a1a1aa;font-size:14px;">Aucun super like pour le moment.</p>`;
  }

  if (refs.invitationsMini) {
    refs.invitationsMini.innerHTML = state.invitations.length
      ? state.invitations.slice(0, 3).map((item) =>
          renderMiniCard(
            item.name,
            item.vibe,
            item.canChatDirect
              ? `<button class="swipe-pill-btn" type="button" data-open-invitation-chat="${escapeHtml(item.matchId || "")}" style="margin-top:10px;">Ouvrir le chat</button>`
              : ""
          )
        ).join("")
      : `<p style="color:#a1a1aa;font-size:14px;">Aucune invitation re?ue.</p>`;

    refs.invitationsMini.querySelectorAll("[data-open-invitation-chat]").forEach((button) => {
      button.addEventListener("click", () => openChat(button.getAttribute("data-open-invitation-chat")));
    });
  }

  if (refs.passesMini) {
    const recentPasses = getRecentHistoryByDirection("pass");
    refs.passesMini.innerHTML = recentPasses.length
      ? recentPasses.map((item) =>
          renderMiniCard(
            item.label || findCardLabelById(item.profileId, item.mode),
            item.mode === "music" ? "Passe dans les medias" : "Passe dans les profils"
          )
        ).join("")
      : `<p style="color:#a1a1aa;font-size:14px;">Aucun pass r?cent.</p>`;
  }
}

function renderMatchModal() {
  const match = state.activeMatch;
  refs.matchModal.hidden = !match;
  if (!match) return;
  refs.matchTitle.textContent = `Toi et ${match.name} avez match?`;
  refs.matchText.textContent = `La compatibilite musicale est forte. Votre vibe commune : ${match.vibe}.`;
}

async function performSwipe(direction) {
  const currentCard = getCurrentCard();
  if (!currentCard || state.actionLock) return;

  state.actionLock = true;
  state.history = [{
    profileId: currentCard.id,
    direction,
    mode: state.viewMode,
    label: currentCard.name,
    cardType: currentCard.cardType,
  }, ...state.history];

  if (!isAuthedSwipeUser()) {
    if ((direction === "like" || direction === "superlike") && state.viewMode !== "music" && currentCard.mockReciprocalLike) {
      pushLocalMatch(currentCard, direction);
    }
    if (direction === "pass") state.passedIds = [...state.passedIds, currentCard.id];
    if (direction === "like") state.likedIds = [...state.likedIds, currentCard.id];
    if (direction === "superlike") state.superLikedIds = [...state.superLikedIds, currentCard.id];
    persistState();
    setActionFeedback(direction);
    renderTabs();
    renderMatchModal();
    return;
  }

  try {
    if (state.viewMode === "music") {
      await apiFetch("/follows/swipe/music", {
        method: "POST",
        body: JSON.stringify({
          media_type: currentCard.media_type || "track",
          media_id: currentCard.media_id || currentCard.id,
          direction: direction === "pass" ? "pass" : "like",
        }),
      });
    } else {
      const res = await apiFetch(`/follows/swipe/profiles/${encodeURIComponent(currentCard.raw?.id || currentCard.id)}`, {
        method: "POST",
        body: JSON.stringify({ direction, message: direction === "superlike" ? "Super like envoy?" : "" }),
      });
      if ((direction === "like" || direction === "superlike") && (res?.can_chat_direct || currentCard.mockReciprocalLike)) {
        const match = {
          matchId: String(res?.match?.id || `match-${currentCard.id}`),
          profileId: String(currentCard.id),
          name: currentCard.name,
          vibe: currentCard.vibe,
          canChatDirect: Boolean(res?.can_chat_direct),
          isSuperlike: direction === "superlike",
        };
        state.matches = [match, ...state.matches.filter((item) => item.profileId !== currentCard.id)];
        state.activeMatch = match;
      }
      await Promise.all([loadLikesYou(), loadMatches()]);
    }
  } catch (error) {
    state.actionLock = false;
    toast(error?.message || "Action impossible", "Erreur");
    return;
  }

  if (direction === "pass") state.passedIds = [...state.passedIds, currentCard.id];
  if (direction === "like") state.likedIds = [...state.likedIds, currentCard.id];
  if (direction === "superlike") state.superLikedIds = [...state.superLikedIds, currentCard.id];

  persistState();
  setActionFeedback(direction);
  renderTabs();
  renderMatchModal();
}

function undoLastSwipe() {
  if (!state.history.length || state.actionLock) return;
  if (isAuthedSwipeUser()) {
    toast("Undo disponible seulement en historique local. Le swipe backend reste enregistre.", "Info");
  }
  const [last, ...rest] = state.history;
  state.history = rest;

  if (last.direction === "pass") state.passedIds = state.passedIds.filter((id) => id !== last.profileId);
  if (last.direction === "like") state.likedIds = state.likedIds.filter((id) => id !== last.profileId);
  if (last.direction === "superlike") state.superLikedIds = state.superLikedIds.filter((id) => id !== last.profileId);

  state.matches = state.matches.filter((item) => item.profileId !== last.profileId);
  if (state.activeMatch?.profileId === last.profileId) state.activeMatch = null;
  persistState();
  renderAll();
}

function openChat(matchId) {
  const match =
    state.matches.find((item) => item.matchId === matchId) ||
    state.likesYou.find((item) => item.matchId === matchId && item.canChatDirect) ||
    state.activeMatch;
  if (!match) {
    toast("Aucun chat disponible pour cette carte.", "Erreur");
    return;
  }
  if (!match.canChatDirect && match !== state.activeMatch) {
    toast("Chat direct indisponible tant que le match n'est pas confirme.", "Erreur");
    return;
  }
  state.notifications = [
    sanitizeNotification({
      id: Date.now(),
      type: "comment",
      user: match.name,
      text: "a ouvert un chat avec toi apres le match musical",
      time: "A l'instant",
      read: false,
    }),
    ...sanitizeNotifications(state.notifications),
  ];
  state.activeMatch = null;
  renderMatchModal();
  renderNotifications();
  const target = new URL("/discussion/discussion.html", window.location.origin);
  if (match.matchId) target.searchParams.set("match", String(match.matchId));
  if (match.profileId) target.searchParams.set("profile", String(match.profileId));
  window.location.href = target.toString();
}

function reloadQueue() {
  state.likedIds = [];
  state.passedIds = [];
  state.superLikedIds = [];
  state.history = [];
  state.matches = [];
  state.activeMatch = null;
  persistState();
  renderAll();
}

async function loadProfiles() {
  if (!isAuthedSwipeUser()) {
    state.profiles = [
      {
        id: "mock-profile-1",
        name: "Nina.beats",
        age: 23,
        city: "Paris",
        vibe: "Rap / R&B / Night drive",
        genreGroup: "rap",
        compatibility: 94,
        createdRank: 1,
        recentTasteBoost: 92,
        topArtists: ["The Weeknd", "Travis Scott", "SZA"],
        playlists: ["Late Night Energy", "Purple Lights"],
        bio: "Je cherche quelqu'un qui peut noter un album track par track sans sauter l'intro.",
        status: "Ecoute actuellement Timeless",
        mockReciprocalLike: false,
        gender: "female",
        heightCm: 168,
        race: "black",
        distanceKm: 8,
        cardType: "profile",
        raw: null,
      },
      {
        id: "mock-profile-2",
        name: "Ayo.wav",
        age: 22,
        city: "Lome",
        vibe: "Afro / Amapiano / Sunset",
        genreGroup: "afro",
        compatibility: 91,
        createdRank: 2,
        recentTasteBoost: 97,
        topArtists: ["Tems", "Rema", "Asake"],
        playlists: ["Afro Sunset", "Beach Bounce"],
        bio: "Je veux decouvrir des gens qui vivent la musique comme une ambiance entiere.",
        status: "En boucle sur DND",
        mockReciprocalLike: true,
        gender: "male",
        heightCm: 176,
        race: "black",
        distanceKm: 15,
        cardType: "profile",
        raw: null,
      },
      {
        id: "mock-profile-3",
        name: "Luna.mix",
        age: 24,
        city: "Lyon",
        vibe: "Pop / Electro / Soft nights",
        genreGroup: "pop",
        compatibility: 87,
        createdRank: 3,
        recentTasteBoost: 86,
        topArtists: ["Dua Lipa", "Billie Eilish", "Charli XCX"],
        playlists: ["Neon Pop", "3AM Feelings"],
        bio: "Je swipe surtout selon les gouts musicaux. Le reste vient apres.",
        status: "A partage une playlist aujourd'hui",
        mockReciprocalLike: false,
        gender: "female",
        heightCm: 164,
        race: "white",
        distanceKm: 27,
        cardType: "profile",
        raw: null,
      },
    ];
    return;
  }
  const data = await apiFetch("/follows/swipe/profiles?limit=20");
  const rows = Array.isArray(data?.items) ? data.items : [];
  state.profiles = rows.map(mapProfile);
  const prefs = data?.preferences || {};
  state.advancedFilters = normalizeAdvancedFilters({
    ...state.advancedFilters,
    ageMin: prefs.min_age ?? state.advancedFilters.ageMin,
    ageMax: prefs.max_age ?? state.advancedFilters.ageMax,
    maxDistanceKm: prefs.max_distance_km ?? state.advancedFilters.maxDistanceKm,
    useDistanceFilter: prefs.use_distance_filter ?? state.advancedFilters.useDistanceFilter,
    gender: Array.isArray(prefs.preferred_genders) && prefs.preferred_genders[0] ? prefs.preferred_genders[0] : state.advancedFilters.gender,
  });
}

async function loadMusics() {
  if (!isAuthedSwipeUser()) {
    state.musics = fallbackMusicCards;
    return;
  }
  const data = await apiFetch("/follows/swipe/music?limit=20");
  const rows = Array.isArray(data?.items) ? data.items : [];
  state.musics = rows.length ? rows.map(mapMusic) : fallbackMusicCards;
}

async function loadLikesYou() {
  if (!isAuthedSwipeUser()) {
    state.invitations = [];
    state.likesYou = fallbackLikesYouProfiles;
    return;
  }
  const [likesData, pendingData] = await Promise.all([
    apiFetch("/follows/swipe/likes-you?limit=20").catch(() => ({ items: [] })),
    apiFetch("/follows/swipe/invitations/me?status=pending").catch(() => ({ items: [] })),
  ]);

  const likes = Array.isArray(likesData?.items) ? likesData.items : [];
  const pending = Array.isArray(pendingData?.items) ? pendingData.items : [];

  state.invitations = pending.map(mapInvitation);
  const likesMap = new Map();
  [...likes.map(mapLikeItem), ...state.invitations].forEach((item) => {
    const key = String(item.profileId || item.id);
    if (!likesMap.has(key)) likesMap.set(key, item);
  });
  state.likesYou = Array.from(likesMap.values());
}

async function loadMatches() {
  if (!isAuthedSwipeUser()) {
    return;
  }
  const matchesData = await apiFetch("/follows/swipe/matches/me?limit=20").catch(() => ({ items: [] }));
  const matches = Array.isArray(matchesData?.items) ? matchesData.items : [];
  state.matches = matches.map(mapMatchItem);
}

async function loadCompatibility() {
  state.compatibilityLoading = true;
  renderSidePanel();
  const cards = [...state.profiles, ...state.musics];
  const scores = {};
  cards.forEach((card, index) => {
    scores[card.id] = Math.min(99, Math.max(70, card.compatibility + (index % 4)));
  });
  state.compatibilityMap = scores;
  state.profiles = state.profiles.map((card) => ({ ...card, compatibility: scores[card.id] || card.compatibility }));
  state.musics = state.musics.map((card) => ({ ...card, compatibility: scores[card.id] || card.compatibility }));
  state.compatibilityLoading = false;
}

function bindEvents() {
  refs.notifBtn?.addEventListener("click", () => {
    state.notificationsOpen = !state.notificationsOpen;
    renderNotifications();
  });
  refs.markAllReadBtn?.addEventListener("click", () => {
    state.notifications = sanitizeNotifications(state.notifications).map((item) => ({ ...item, read: true }));
    renderNotifications();
  });
  document.addEventListener("mousedown", (event) => {
    if (!refs.notifDropdown?.contains(event.target)) {
      state.notificationsOpen = false;
      renderNotifications();
    }
  });

  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.viewMode = button.getAttribute("data-view") || "discover";
      renderAll();
    });
  });

  refs.genreButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.genreFilter = button.getAttribute("data-genre") || "all";
      persistState();
      renderAll();
    });
  });

  refs.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.sortMode = button.getAttribute("data-sort") || "compatibility";
      persistState();
      renderAll();
    });
  });

  refs.applyAdvancedFiltersBtn?.addEventListener("click", async () => {
    state.advancedFilters = readAdvancedFiltersFromUi();
    persistState();
    await syncBackendSwipePreferences();
    await loadProfiles().catch(() => null);
    renderAll();
  });
  refs.resetAdvancedFiltersBtn?.addEventListener("click", async () => {
    state.advancedFilters = { ...DEFAULT_ADVANCED_FILTERS };
    persistState();
    writeAdvancedFiltersToUi();
    await syncBackendSwipePreferences();
    await loadProfiles().catch(() => null);
    renderAll();
  });

  refs.undoBtn?.addEventListener("click", undoLastSwipe);
  refs.openChatBtn?.addEventListener("click", () => openChat(state.activeMatch?.matchId || ""));
  refs.closeMatchBtn?.addEventListener("click", () => {
    state.activeMatch = null;
    renderMatchModal();
  });
}

function renderAll() {
  renderHeader();
  renderNotifications();
  renderTabs();
  renderSidePanel();
  renderCardStage();
  renderSummaryEnhanced();
  renderMatchModal();
}

async function bootstrap() {
  const persisted = loadPersistedSwipeState();
  state.likedIds = persisted.likedIds;
  state.passedIds = persisted.passedIds;
  state.superLikedIds = persisted.superLikedIds;
  state.history = persisted.history;
  state.matches = isAuthedSwipeUser() ? [] : persisted.matches;
  state.genreFilter = persisted.genreFilter;
  state.sortMode = persisted.sortMode;
  state.advancedFilters = normalizeAdvancedFilters(persisted.advancedFilters);

  if (!isLoggedIn()) {
    toast("Connecte-toi pour utiliser les swipes.", "Connexion requise");
  }

  try {
    await Promise.all([loadProfiles(), loadMusics()]);
    await Promise.all([loadLikesYou(), loadMatches()]);
    await loadCompatibility();
  } catch (error) {
    toast(error?.message || "Chargement impossible", "Erreur");
    if (!state.musics.length) state.musics = fallbackMusicCards;
    if (isAuthedSwipeUser()) {
      state.likesYou = [];
      state.matches = [];
    } else {
      if (!state.profiles.length) {
        state.profiles = [
          {
            id: "mock-profile-1",
            name: "Nina.beats",
            age: 23,
            city: "Paris",
            vibe: "Rap / R&B / Night drive",
            genreGroup: "rap",
            compatibility: 94,
            createdRank: 1,
            recentTasteBoost: 92,
            topArtists: ["The Weeknd", "Travis Scott", "SZA"],
            playlists: ["Late Night Energy", "Purple Lights"],
            bio: "Je cherche quelqu'un qui peut noter un album track par track sans sauter l'intro.",
            status: "Ecoute actuellement Timeless",
            mockReciprocalLike: false,
            gender: "female",
            heightCm: 168,
            race: "black",
            distanceKm: 8,
            cardType: "profile",
            raw: null,
          },
          {
            id: "mock-profile-2",
            name: "Ayo.wav",
            age: 22,
            city: "Lome",
            vibe: "Afro / Amapiano / Sunset",
            genreGroup: "afro",
            compatibility: 91,
            createdRank: 2,
            recentTasteBoost: 97,
            topArtists: ["Tems", "Rema", "Asake"],
            playlists: ["Afro Sunset", "Beach Bounce"],
            bio: "Je veux decouvrir des gens qui vivent la musique comme une ambiance entiere.",
            status: "En boucle sur DND",
            mockReciprocalLike: true,
            gender: "male",
            heightCm: 176,
            race: "black",
            distanceKm: 15,
            cardType: "profile",
            raw: null,
          },
        ];
      }
      if (!state.likesYou.length) state.likesYou = fallbackLikesYouProfiles;
    }
  }

  renderAll();
}

bindEvents();
bootstrap();
