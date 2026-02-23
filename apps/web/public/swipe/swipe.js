import { apiFetch, escapeHtml, isLoggedIn, toast } from "/noyau/app.js";
import { applyI18n, t } from "/noyau/i18n.js";

const modeProfilesBtn = document.querySelector("#modeProfilesBtn");
const modeMusicBtn = document.querySelector("#modeMusicBtn");
const swipeCard = document.querySelector("#swipeCard");
const swipeCardWrap = document.querySelector("#swipeCardWrap");
const profileActions = document.querySelector("#profileActions");
const musicActions = document.querySelector("#musicActions");
const passBtn = document.querySelector("#passBtn");
const likeBtn = document.querySelector("#likeBtn");
const musicPassBtn = document.querySelector("#musicPassBtn");
const musicLikeBtn = document.querySelector("#musicLikeBtn");
const inviteMessageInput = document.querySelector("#inviteMessageInput");
const inviteMessageCount = document.querySelector("#inviteMessageCount");
const swipeHintPass = document.querySelector("#swipeHintPass");
const swipeHintLike = document.querySelector("#swipeHintLike");
const swipeFiltersFab = document.querySelector("#swipeFiltersFab");
const swipeFiltersBackdrop = document.querySelector("#swipeFiltersBackdrop");
const profileFilters = document.querySelector("#profileFilters");
const closeProfileFiltersBtn = document.querySelector("#closeProfileFiltersBtn");
const applyProfileFiltersBtn = document.querySelector("#applyProfileFiltersBtn");
const swipeUseDistanceFilter = document.querySelector("#swipeUseDistanceFilter");
const swipeLiveLocation = document.querySelector("#swipeLiveLocation");
const swipeMinAge = document.querySelector("#swipeMinAge");
const swipeMaxAge = document.querySelector("#swipeMaxAge");
const swipeAgeRuleInfo = document.querySelector("#swipeAgeRuleInfo");
const swipeMaxDistanceKm = document.querySelector("#swipeMaxDistanceKm");
const swipeUseLocationBtn = document.querySelector("#swipeUseLocationBtn");
const swipeClearLocationBtn = document.querySelector("#swipeClearLocationBtn");
const swipeLocationInfo = document.querySelector("#swipeLocationInfo");

let mode = "profiles";
let profiles = [];
let musics = [];
let dragStartX = 0;
let dragLiveX = 0;
const INVITE_MAX_LEN = 180;
let filterLatitude = null;
let filterLongitude = null;
let liveLocationWatchId = null;
let liveLocationSaveTimer = 0;
let liveLocationRefreshTimer = 0;
const LIVE_LOCATION_STORAGE_KEY = "supcontent_swipe_live_location";
let allowedMinAge = 18;
let allowedMaxAge = 99;

function setFiltersOpen(open) {
  if (!profileFilters || !swipeFiltersBackdrop) return;
  const next = Boolean(open);
  profileFilters.hidden = !next;
  swipeFiltersBackdrop.hidden = !next;
  swipeFiltersFab?.setAttribute("aria-expanded", String(next));
}

function updateModeButtons() {
  modeProfilesBtn?.classList.toggle("primary", mode === "profiles");
  modeMusicBtn?.classList.toggle("primary", mode === "music");
  if (modeProfilesBtn && mode !== "profiles") modeProfilesBtn.classList.remove("primary");
  if (modeMusicBtn && mode !== "music") modeMusicBtn.classList.remove("primary");
  if (profileActions) profileActions.hidden = mode !== "profiles";
  if (musicActions) musicActions.hidden = mode !== "music";
  if (swipeFiltersFab) swipeFiltersFab.hidden = mode !== "profiles";
  if (mode !== "profiles") setFiltersOpen(false);
}

function currentProfile() {
  return profiles[0] || null;
}

function currentMusic() {
  return musics[0] || null;
}

function profileCardHtml(item) {
  const name = String(item?.display_name || "Utilisateur");
  const username = String(item?.username || "");
  const bio = String(item?.bio || "");
  const location = String(item?.location || "");
  const avatar = String(item?.avatar_url || "").trim();
  const followers = Number(item?.followers_count || 0);
  const gender = String(item?.gender || "").trim();
  const distance = item?.distance_km == null ? null : Number(item.distance_km);
  const relation = item?.is_followed_by ? "Te suit deja" : item?.is_following ? "Tu le suis deja" : "Nouveau profil";
  const age = item?.age == null ? null : Number(item.age);
  return `
    <article class="swipe-card-inner">
      <div class="row" style="gap:12px;align-items:center">
        ${
          avatar
            ? `<img class="avatar-lg" src="${escapeHtml(avatar)}" alt="avatar ${escapeHtml(name)}" />`
            : `<div class="avatar-lg avatar-fallback">${escapeHtml(name.slice(0, 1).toUpperCase() || "U")}</div>`
        }
        <div>
          <h3 style="margin:0">${escapeHtml(name)}</h3>
          <small style="color:var(--muted)">@${escapeHtml(username || "utilisateur")}</small>
        </div>
      </div>
      <p style="margin-top:10px">${escapeHtml(bio || "Aucune bio")}</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <span class="badge">Followers: ${followers}</span>
        ${location ? `<span class="badge">Lieu: ${escapeHtml(location)}</span>` : ""}
        ${gender ? `<span class="badge">Sexe: ${escapeHtml(gender)}</span>` : ""}
        ${Number.isFinite(age) ? `<span class="badge">Age: ${age}</span>` : ""}
        ${distance != null && Number.isFinite(distance) ? `<span class="badge">Distance: ${distance} km</span>` : ""}
        <span class="badge">${escapeHtml(relation)}</span>
      </div>
    </article>
  `;
}

function musicCardHtml(item) {
  const media = item?.media || {};
  const name = String(media?.name || `${item?.media_type || "track"} ${item?.media_id || ""}`);
  const subtitle = String(media?.subtitle || "");
  const image = String(media?.image || "");
  const rating = Number(item?.avg_rating || 0);
  const reviews = Number(item?.review_count || 0);
  const spotifyUrl = String(media?.spotify_url || "");
  return `
    <article class="swipe-card-inner">
      ${
        image
          ? `<img class="swipe-cover" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />`
          : `<div class="swipe-cover swipe-cover-fallback">Apercu indisponible</div>`
      }
      <h3 style="margin:10px 0 4px 0">${escapeHtml(name)}</h3>
      ${subtitle ? `<small style="color:var(--muted)">${escapeHtml(subtitle)}</small>` : ""}
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
        <span class="badge">Type: ${escapeHtml(item?.media_type || "track")}</span>
        <span class="badge">Notes: ${rating}/5</span>
        <span class="badge">Reviews: ${reviews}</span>
      </div>
      ${spotifyUrl ? `<a class="btn" style="margin-top:10px" target="_blank" href="${escapeHtml(spotifyUrl)}">Ouvrir Spotify</a>` : ""}
    </article>
  `;
}

function renderCurrentCard() {
  if (!swipeCard) return;
  if (mode === "profiles") {
    const item = currentProfile();
    swipeCard.innerHTML = item
      ? profileCardHtml(item)
      : `<small>Aucun profil suggere pour le moment. Reviens plus tard.</small>`;
    return;
  }
  const item = currentMusic();
  swipeCard.innerHTML = item
    ? musicCardHtml(item)
    : `<small>Aucune musique recommandee pour le moment. Reviens plus tard.</small>`;
}

function normalizeInviteMessage(raw) {
  const clean = String(raw || "").trim();
  if (!clean) return "";
  return clean.slice(0, INVITE_MAX_LEN);
}

function updateInviteCount() {
  if (!inviteMessageInput || !inviteMessageCount) return;
  const len = String(inviteMessageInput.value || "").length;
  inviteMessageCount.textContent = `${len} / ${INVITE_MAX_LEN}`;
}

function selectedSwipeGenders() {
  return Array.from(document.querySelectorAll("input[name='swipeGenderPref']:checked")).map((el) => String(el.value || ""));
}

function setSelectedSwipeGenders(values) {
  const set = new Set((values || []).map((x) => String(x || "")));
  document.querySelectorAll("input[name='swipeGenderPref']").forEach((el) => {
    el.checked = set.has(String(el.value || ""));
  });
}

function renderSwipeLocationInfo() {
  if (!swipeLocationInfo) return;
  if (filterLatitude == null || filterLongitude == null) {
    swipeLocationInfo.textContent = t("position_undefined");
    return;
  }
  const live = liveLocationWatchId != null ? " (live)" : "";
  const label = t("position_undefined").replace(/:.*$/, "");
  swipeLocationInfo.textContent = `${label}: ${Number(filterLatitude).toFixed(5)}, ${Number(filterLongitude).toFixed(5)}${live}`;
}

function computeAgeFromBirthDate(raw) {
  const s = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return Number.isFinite(age) ? age : null;
}

function applyAgeBoundsToInputs() {
  if (swipeMinAge) {
    swipeMinAge.min = String(allowedMinAge);
    swipeMinAge.max = String(allowedMaxAge);
  }
  if (swipeMaxAge) {
    swipeMaxAge.min = String(allowedMinAge);
    swipeMaxAge.max = String(allowedMaxAge);
  }
  const minRaw = Number.parseInt(String(swipeMinAge?.value || allowedMinAge), 10);
  const maxRaw = Number.parseInt(String(swipeMaxAge?.value || allowedMaxAge), 10);
  const minBase = Number.isFinite(minRaw) ? Math.max(allowedMinAge, Math.min(allowedMaxAge, minRaw)) : allowedMinAge;
  const maxBase = Number.isFinite(maxRaw) ? Math.max(allowedMinAge, Math.min(allowedMaxAge, maxRaw)) : allowedMaxAge;
  const minVal = Math.min(minBase, maxBase);
  const maxVal = Math.max(minBase, maxBase);
  if (swipeMinAge) swipeMinAge.value = String(minVal);
  if (swipeMaxAge) swipeMaxAge.value = String(maxVal);
  if (swipeAgeRuleInfo) {
    swipeAgeRuleInfo.textContent = allowedMinAge >= 18
      ? t("minors_protection_adult")
      : t("minors_protection_minor");
  }
}

async function loadActorAgePolicy() {
  try {
    const me = await apiFetch("/auth/me");
    const age = computeAgeFromBirthDate(me?.user?.birth_date);
    const isMinor = age != null && age < 18;
    allowedMinAge = isMinor ? 13 : 18;
    allowedMaxAge = isMinor ? 17 : 99;
  } catch {
    allowedMinAge = 18;
    allowedMaxAge = 99;
  }
  applyAgeBoundsToInputs();
}

function readLiveLocationPreference() {
  try {
    return localStorage.getItem(LIVE_LOCATION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLiveLocationPreference(value) {
  try {
    localStorage.setItem(LIVE_LOCATION_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

async function flushLiveLocationSync() {
  try {
    await saveSwipeFilters();
  } catch {
    // silent
  }
  if (mode !== "profiles") return;
  try {
    await loadProfiles();
    renderCurrentCard();
  } catch {
    // silent
  }
}

function scheduleLiveLocationSync() {
  if (liveLocationSaveTimer) clearTimeout(liveLocationSaveTimer);
  if (liveLocationRefreshTimer) clearTimeout(liveLocationRefreshTimer);
  liveLocationSaveTimer = setTimeout(() => {
    flushLiveLocationSync();
  }, 1200);
  liveLocationRefreshTimer = setTimeout(() => {
    flushLiveLocationSync();
  }, 4200);
}

function stopLiveLocationWatch() {
  if (liveLocationWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(liveLocationWatchId);
  }
  liveLocationWatchId = null;
  renderSwipeLocationInfo();
}

function startLiveLocationWatch() {
  if (!navigator.geolocation) {
    toast("Geolocalisation indisponible.", "Erreur");
    if (swipeLiveLocation) swipeLiveLocation.checked = false;
    writeLiveLocationPreference(false);
    return;
  }
  if (liveLocationWatchId != null) return;
  liveLocationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      filterLatitude = Number(pos.coords.latitude);
      filterLongitude = Number(pos.coords.longitude);
      renderSwipeLocationInfo();
      scheduleLiveLocationSync();
    },
    () => {
      stopLiveLocationWatch();
      if (swipeLiveLocation) swipeLiveLocation.checked = false;
      writeLiveLocationPreference(false);
      toast("Localisation live refusee.", "Erreur");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
  renderSwipeLocationInfo();
}

async function loadSwipeFilters() {
  try {
    const data = await apiFetch("/follows/swipe/preferences");
    const p = data?.preferences || {};
    if (swipeUseDistanceFilter) swipeUseDistanceFilter.checked = Boolean(p.use_distance_filter);
    if (swipeMaxDistanceKm) swipeMaxDistanceKm.value = String(Number(p.max_distance_km || 50));
    if (swipeMinAge) swipeMinAge.value = String(Number(p.min_age || 18));
    if (swipeMaxAge) swipeMaxAge.value = String(Number(p.max_age || 99));
    applyAgeBoundsToInputs();
    setSelectedSwipeGenders(Array.isArray(p.preferred_genders) ? p.preferred_genders : []);
    filterLatitude = p.latitude == null ? null : Number(p.latitude);
    filterLongitude = p.longitude == null ? null : Number(p.longitude);
    const livePref = readLiveLocationPreference();
    if (swipeLiveLocation) swipeLiveLocation.checked = livePref;
    if (livePref) startLiveLocationWatch();
    renderSwipeLocationInfo();
  } catch {
    // silent
  }
}

async function saveSwipeFilters() {
  const minAgeRaw = Number.parseInt(String(swipeMinAge?.value || allowedMinAge), 10);
  const maxAgeRaw = Number.parseInt(String(swipeMaxAge?.value || allowedMaxAge), 10);
  const minAgeBase = Number.isFinite(minAgeRaw) ? Math.max(allowedMinAge, Math.min(allowedMaxAge, minAgeRaw)) : allowedMinAge;
  const maxAgeBase = Number.isFinite(maxAgeRaw) ? Math.max(allowedMinAge, Math.min(allowedMaxAge, maxAgeRaw)) : allowedMaxAge;
  const minAge = Math.min(minAgeBase, maxAgeBase);
  const maxAge = Math.max(minAgeBase, maxAgeBase);
  if (swipeMinAge) swipeMinAge.value = String(minAge);
  if (swipeMaxAge) swipeMaxAge.value = String(maxAge);
  await apiFetch("/follows/swipe/preferences", {
    method: "PUT",
    body: JSON.stringify({
      use_distance_filter: Boolean(swipeUseDistanceFilter?.checked),
      max_distance_km: Number.parseInt(String(swipeMaxDistanceKm?.value || "50"), 10),
      min_age: minAge,
      max_age: maxAge,
      preferred_genders: selectedSwipeGenders(),
      latitude: filterLatitude,
      longitude: filterLongitude,
    }),
  });
}

async function loadProfiles() {
  const data = await apiFetch("/follows/swipe/profiles?limit=20");
  profiles = Array.isArray(data?.items) ? data.items : [];
}

async function loadMusics() {
  const data = await apiFetch("/follows/swipe/music?limit=20");
  musics = Array.isArray(data?.items) ? data.items : [];
}

async function doProfileSwipe(direction) {
  const item = currentProfile();
  if (!item) return;
  try {
    const message = normalizeInviteMessage(inviteMessageInput?.value || "");
    const res = await apiFetch(`/follows/swipe/profiles/${encodeURIComponent(item.id)}`, {
      method: "POST",
      body: JSON.stringify({ direction, message }),
    });
    profiles.shift();
    renderCurrentCard();
    if (inviteMessageInput) inviteMessageInput.value = "";
    updateInviteCount();
    if (direction === "like") {
      if (res?.can_chat_direct) toast("Match mutuel: chat direct autorise.", "Match");
      else if (res?.invitation_created) toast("Follow envoye + invitation ajoutee dans Chat/Invitations.", "Info");
      else toast("Follow envoye. Chat direct dispo quand la personne te suit aussi.", "Info");
    } else {
      toast("Passe (je n'aime pas).", "Swipe");
    }
  } catch (err) {
    toast(err?.message || "Action impossible", "Erreur");
  }
}

async function doMusicSwipe(direction) {
  const item = currentMusic();
  if (!item) return;
  try {
    await apiFetch("/follows/swipe/music", {
      method: "POST",
      body: JSON.stringify({
        media_type: item.media_type,
        media_id: item.media_id,
        direction,
      }),
    });
    musics.shift();
    renderCurrentCard();
  } catch (err) {
    toast(err?.message || "Action musique impossible", "Erreur");
  }
}

function installSwipeGesture() {
  if (!swipeCardWrap || !swipeCard) return;
  swipeCardWrap.addEventListener("pointerdown", (e) => {
    dragStartX = e.clientX;
    dragLiveX = e.clientX;
    swipeCard.setPointerCapture?.(e.pointerId);
  });
  swipeCardWrap.addEventListener("pointermove", (e) => {
    if (!dragStartX) return;
    dragLiveX = e.clientX;
    const dx = dragLiveX - dragStartX;
    swipeCard.style.transform = `translateX(${dx}px) rotate(${dx * 0.03}deg)`;
    if (swipeHintPass) swipeHintPass.classList.toggle("is-visible", dx < -28);
    if (swipeHintLike) swipeHintLike.classList.toggle("is-visible", dx > 28);
  });
  swipeCardWrap.addEventListener("pointerup", async () => {
    const dx = dragLiveX - dragStartX;
    dragStartX = 0;
    dragLiveX = 0;
    swipeCard.style.transform = "";
    if (swipeHintPass) swipeHintPass.classList.remove("is-visible");
    if (swipeHintLike) swipeHintLike.classList.remove("is-visible");
    if (Math.abs(dx) < 80) return;
    // Regle explicite: gauche = pass (je n'aime pas), droite = like (j'aime)
    const direction = dx > 0 ? "like" : "pass";
    if (mode === "profiles") await doProfileSwipe(direction);
    else await doMusicSwipe(direction);
  });
}

async function bootstrap() {
  if (!isLoggedIn()) {
    toast("Connecte-toi pour utiliser les swipes.", "Connexion requise");
  }
  updateModeButtons();
  renderCurrentCard();
  try {
    await loadActorAgePolicy();
    await loadSwipeFilters();
    await Promise.all([loadProfiles(), loadMusics()]);
    renderCurrentCard();
  } catch (err) {
    toast(err?.message || "Chargement impossible", "Erreur");
  }
}

modeProfilesBtn?.addEventListener("click", () => {
  mode = "profiles";
  updateModeButtons();
  renderCurrentCard();
});

modeMusicBtn?.addEventListener("click", () => {
  mode = "music";
  updateModeButtons();
  renderCurrentCard();
});

passBtn?.addEventListener("click", async () => doProfileSwipe("pass"));
likeBtn?.addEventListener("click", async () => doProfileSwipe("like"));
musicPassBtn?.addEventListener("click", async () => doMusicSwipe("pass"));
musicLikeBtn?.addEventListener("click", async () => doMusicSwipe("like"));

inviteMessageInput?.addEventListener("input", () => {
  const v = String(inviteMessageInput.value || "");
  if (v.length > INVITE_MAX_LEN) {
    inviteMessageInput.value = v.slice(0, INVITE_MAX_LEN);
  }
  updateInviteCount();
});

document.querySelectorAll("[data-suggested-msg]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!inviteMessageInput) return;
    inviteMessageInput.value = normalizeInviteMessage(btn.getAttribute("data-suggested-msg") || "");
    updateInviteCount();
    inviteMessageInput.focus();
  });
});

applyProfileFiltersBtn?.addEventListener("click", async () => {
  try {
    await saveSwipeFilters();
    await loadProfiles();
    renderCurrentCard();
    setFiltersOpen(false);
    toast("Filtres appliques.", "OK");
  } catch (err) {
    toast(err?.message || "Filtres impossibles a appliquer", "Erreur");
  }
});

swipeUseLocationBtn?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    toast("Geolocalisation indisponible.", "Erreur");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      filterLatitude = Number(pos.coords.latitude);
      filterLongitude = Number(pos.coords.longitude);
      renderSwipeLocationInfo();
      toast("Position swipe mise a jour.", "OK");
      scheduleLiveLocationSync();
    },
    () => toast("Permission localisation refusee.", "Erreur"),
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

swipeClearLocationBtn?.addEventListener("click", () => {
  stopLiveLocationWatch();
  if (swipeLiveLocation) swipeLiveLocation.checked = false;
  writeLiveLocationPreference(false);
  filterLatitude = null;
  filterLongitude = null;
  renderSwipeLocationInfo();
  toast("Position swipe effacee.", "Info");
});

swipeLiveLocation?.addEventListener("change", () => {
  const enabled = Boolean(swipeLiveLocation.checked);
  writeLiveLocationPreference(enabled);
  if (enabled) {
    startLiveLocationWatch();
    return;
  }
  stopLiveLocationWatch();
});

swipeFiltersFab?.addEventListener("click", () => {
  setFiltersOpen(profileFilters?.hidden);
});

closeProfileFiltersBtn?.addEventListener("click", () => setFiltersOpen(false));
swipeFiltersBackdrop?.addEventListener("click", () => setFiltersOpen(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setFiltersOpen(false);
});
window.addEventListener("beforeunload", () => stopLiveLocationWatch());

installSwipeGesture();
applyI18n(document);
bootstrap();
updateInviteCount();
