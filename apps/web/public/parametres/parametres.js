import { apiFetch, toast, isLoggedIn } from "/noyau/app.js";
import { applyI18n, getLanguage, setLanguage } from "/noyau/i18n.js";

const accountPrivateEl = document.querySelector("#accountPrivate");
const hideLocationEl = document.querySelector("#hideLocation");
const notifMessagesEl = document.querySelector("#notifMessages");
const notifCommentsEl = document.querySelector("#notifComments");
const notifFollowsEl = document.querySelector("#notifFollows");
const hiddenWordsEl = document.querySelector("#hiddenWords");
const languageEl = document.querySelector("#language");
const useDistanceFilterEl = document.querySelector("#useDistanceFilter");
const swipeLiveLocationEl = document.querySelector("#swipeLiveLocation");
const maxDistanceKmEl = document.querySelector("#maxDistanceKm");
const swipeMinAgeEl = document.querySelector("#swipeMinAge");
const swipeMaxAgeEl = document.querySelector("#swipeMaxAge");
const useMyLocationBtn = document.querySelector("#useMyLocationBtn");
const clearMyLocationBtn = document.querySelector("#clearMyLocationBtn");
const locationInfo = document.querySelector("#locationInfo");
const saveSettingsBtn = document.querySelector("#saveSettingsBtn");
const blockedList = document.querySelector("#blockedList");
const blockUserIdInput = document.querySelector("#blockUserIdInput");
const blockUserBtn = document.querySelector("#blockUserBtn");

let latitude = null;
let longitude = null;
let liveLocationWatchId = null;
let liveLocationSaveTimer = 0;
const LIVE_LOCATION_STORAGE_KEY = "supcontent_swipe_live_location";

function selectedGenders() {
  return Array.from(document.querySelectorAll("input[name='genderPref']:checked")).map((el) => String(el.value || ""));
}

function setSelectedGenders(values) {
  const set = new Set((values || []).map((x) => String(x || "")));
  document.querySelectorAll("input[name='genderPref']").forEach((el) => {
    el.checked = set.has(String(el.value || ""));
  });
}

function parseHiddenWords(rawText) {
  return String(rawText || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function renderLocationInfo() {
  if (!locationInfo) return;
  if (latitude == null || longitude == null) {
    locationInfo.textContent = "Position: non definie";
    return;
  }
  const live = liveLocationWatchId != null ? " (live)" : "";
  locationInfo.textContent = `Position: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}${live}`;
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

async function syncSwipePrefsOnly() {
  const minAgeRaw = Number.parseInt(String(swipeMinAgeEl?.value || "18"), 10);
  const maxAgeRaw = Number.parseInt(String(swipeMaxAgeEl?.value || "99"), 10);
  const minAgeBase = Number.isFinite(minAgeRaw) ? Math.max(13, Math.min(99, minAgeRaw)) : 18;
  const maxAgeBase = Number.isFinite(maxAgeRaw) ? Math.max(13, Math.min(99, maxAgeRaw)) : 99;
  const minAge = Math.min(minAgeBase, maxAgeBase);
  const maxAge = Math.max(minAgeBase, maxAgeBase);
  if (swipeMinAgeEl) swipeMinAgeEl.value = String(minAge);
  if (swipeMaxAgeEl) swipeMaxAgeEl.value = String(maxAge);
  await apiFetch("/follows/swipe/preferences", {
    method: "PUT",
    body: JSON.stringify({
      use_distance_filter: Boolean(useDistanceFilterEl.checked),
      max_distance_km: Number.parseInt(String(maxDistanceKmEl.value || "50"), 10),
      min_age: minAge,
      max_age: maxAge,
      preferred_genders: selectedGenders(),
      latitude,
      longitude,
    }),
  });
}

function scheduleLiveLocationSync() {
  if (liveLocationSaveTimer) clearTimeout(liveLocationSaveTimer);
  liveLocationSaveTimer = setTimeout(() => {
    syncSwipePrefsOnly().catch(() => {});
  }, 1200);
}

function stopLiveLocationWatch() {
  if (liveLocationWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(liveLocationWatchId);
  }
  liveLocationWatchId = null;
  renderLocationInfo();
}

function startLiveLocationWatch() {
  if (!navigator.geolocation) {
    toast("Geolocalisation indisponible.", "Erreur");
    if (swipeLiveLocationEl) swipeLiveLocationEl.checked = false;
    writeLiveLocationPreference(false);
    return;
  }
  if (liveLocationWatchId != null) return;
  liveLocationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      latitude = Number(pos.coords.latitude);
      longitude = Number(pos.coords.longitude);
      renderLocationInfo();
      scheduleLiveLocationSync();
    },
    () => {
      stopLiveLocationWatch();
      if (swipeLiveLocationEl) swipeLiveLocationEl.checked = false;
      writeLiveLocationPreference(false);
      toast("Localisation live refusee.", "Erreur");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
  renderLocationInfo();
}

function renderBlocked(items) {
  if (!blockedList) return;
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) {
    blockedList.innerHTML = "<small>Aucun compte bloque.</small>";
    return;
  }
  blockedList.innerHTML = arr
    .map(
      (u) => `
      <div class="settings-row">
        <span>@${u.username || u.display_name || u.id}</span>
        <button class="btn" data-unblock-id="${u.id}" type="button">Debloquer</button>
      </div>
    `
    )
    .join("");
  blockedList.querySelectorAll("[data-unblock-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-unblock-id");
      if (!uid) return;
      try {
        await apiFetch(`/follows/settings/blocked/${encodeURIComponent(uid)}`, { method: "DELETE" });
        await loadBlocked();
        toast("Compte debloque.", "OK");
      } catch (err) {
        toast(err?.message || "Deblocage impossible", "Erreur");
      }
    });
  });
}

async function loadBlocked() {
  try {
    const data = await apiFetch("/follows/settings/blocked");
    renderBlocked(data?.items || []);
  } catch (err) {
    blockedList.innerHTML = `<small style="color:#ffb0b0">${err?.message || "Erreur"}</small>`;
  }
}

async function loadAllSettings() {
  if (!isLoggedIn()) {
    toast("Connecte-toi pour acceder aux parametres.", "Connexion");
    return;
  }
  try {
    const [swipeData, settingsData] = await Promise.all([
      apiFetch("/follows/swipe/preferences"),
      apiFetch("/follows/settings/me"),
    ]);
    const sp = swipeData?.preferences || {};
    useDistanceFilterEl.checked = Boolean(sp.use_distance_filter);
    maxDistanceKmEl.value = String(Number(sp.max_distance_km || 50));
    if (swipeMinAgeEl) swipeMinAgeEl.value = String(Number(sp.min_age || 18));
    if (swipeMaxAgeEl) swipeMaxAgeEl.value = String(Number(sp.max_age || 99));
    setSelectedGenders(Array.isArray(sp.preferred_genders) ? sp.preferred_genders : []);
    latitude = sp.latitude == null ? null : Number(sp.latitude);
    longitude = sp.longitude == null ? null : Number(sp.longitude);
    const livePref = readLiveLocationPreference();
    if (swipeLiveLocationEl) swipeLiveLocationEl.checked = livePref;
    if (livePref) startLiveLocationWatch();
    renderLocationInfo();

    const s = settingsData?.settings || {};
    accountPrivateEl.checked = Boolean(s.account_private);
    hideLocationEl.checked = Boolean(s.hide_location);
    languageEl.value = String(s.language || "fr");
    setLanguage(languageEl.value);
    applyI18n(document);
    const notif = s.notifications_prefs && typeof s.notifications_prefs === "object" ? s.notifications_prefs : {};
    notifMessagesEl.checked = notif.messages !== false;
    notifCommentsEl.checked = notif.comments !== false;
    notifFollowsEl.checked = notif.follows !== false;
    hiddenWordsEl.value = Array.isArray(s.hidden_words) ? s.hidden_words.join(", ") : "";

    await loadBlocked();
  } catch (err) {
    toast(err?.message || "Impossible de charger les parametres", "Erreur");
  }
}

async function saveAllSettings() {
  try {
    const minAgeRaw = Number.parseInt(String(swipeMinAgeEl?.value || "18"), 10);
    const maxAgeRaw = Number.parseInt(String(swipeMaxAgeEl?.value || "99"), 10);
    const minAgeBase = Number.isFinite(minAgeRaw) ? Math.max(13, Math.min(99, minAgeRaw)) : 18;
    const maxAgeBase = Number.isFinite(maxAgeRaw) ? Math.max(13, Math.min(99, maxAgeRaw)) : 99;
    const minAge = Math.min(minAgeBase, maxAgeBase);
    const maxAge = Math.max(minAgeBase, maxAgeBase);
    if (swipeMinAgeEl) swipeMinAgeEl.value = String(minAge);
    if (swipeMaxAgeEl) swipeMaxAgeEl.value = String(maxAge);
    await Promise.all([
      apiFetch("/follows/swipe/preferences", {
        method: "PUT",
        body: JSON.stringify({
          use_distance_filter: Boolean(useDistanceFilterEl.checked),
          max_distance_km: Number.parseInt(String(maxDistanceKmEl.value || "50"), 10),
          min_age: minAge,
          max_age: maxAge,
          preferred_genders: selectedGenders(),
          latitude,
          longitude,
        }),
      }),
      apiFetch("/follows/settings/me", {
        method: "PUT",
        body: JSON.stringify({
          account_private: Boolean(accountPrivateEl.checked),
          hide_location: Boolean(hideLocationEl.checked),
          language: String(languageEl.value || "fr"),
          hidden_words: parseHiddenWords(hiddenWordsEl.value),
          notifications_prefs: {
            messages: Boolean(notifMessagesEl.checked),
            comments: Boolean(notifCommentsEl.checked),
            follows: Boolean(notifFollowsEl.checked),
          },
        }),
      }),
    ]);
    toast("Parametres enregistres.", "OK");
  } catch (err) {
    toast(err?.message || "Enregistrement impossible", "Erreur");
  }
}

useMyLocationBtn?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    toast("Geolocalisation indisponible.", "Erreur");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      latitude = Number(pos.coords.latitude);
      longitude = Number(pos.coords.longitude);
      renderLocationInfo();
      toast("Position mise a jour.", "OK");
      scheduleLiveLocationSync();
    },
    () => {
      toast("Permission localisation refusee.", "Erreur");
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

clearMyLocationBtn?.addEventListener("click", () => {
  stopLiveLocationWatch();
  if (swipeLiveLocationEl) swipeLiveLocationEl.checked = false;
  writeLiveLocationPreference(false);
  latitude = null;
  longitude = null;
  renderLocationInfo();
  toast("Position effacee (pense a enregistrer).", "Info");
});

swipeLiveLocationEl?.addEventListener("change", () => {
  const enabled = Boolean(swipeLiveLocationEl.checked);
  writeLiveLocationPreference(enabled);
  if (enabled) {
    startLiveLocationWatch();
    return;
  }
  stopLiveLocationWatch();
});

languageEl?.addEventListener("change", () => {
  setLanguage(languageEl.value);
  applyI18n(document);
});

saveSettingsBtn?.addEventListener("click", saveAllSettings);

blockUserBtn?.addEventListener("click", async () => {
  const uid = String(blockUserIdInput?.value || "").trim();
  if (!uid) return;
  try {
    await apiFetch(`/follows/settings/blocked/${encodeURIComponent(uid)}`, { method: "POST" });
    blockUserIdInput.value = "";
    await loadBlocked();
    toast("Compte bloque.", "OK");
  } catch (err) {
    toast(err?.message || "Blocage impossible", "Erreur");
  }
});

window.addEventListener("beforeunload", () => stopLiveLocationWatch());

setLanguage(getLanguage());
applyI18n(document);
if (languageEl) languageEl.value = getLanguage();
loadAllSettings();
