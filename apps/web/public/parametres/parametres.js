import { apiFetch, requireLogin, toast, applyAppPreferences, saveAppPreferences } from "/noyau/app.js";
import { applyI18n, getLanguage, setLanguage, t } from "/noyau/i18n.js";

const LIVE_LOCATION_STORAGE_KEY = "supcontent_swipe_live_location";
const APP_SETTINGS_STORAGE_KEY = "supcontent-app-settings-v1";

const DEFAULT_SETTINGS = {
  profileVisibility: "followers",
  hideLocation: true,
  messages: true,
  comments: true,
  newFollowers: true,
  mutedWords: "insulte1, insulte2, spoiler...",
  distanceFilter: true,
  liveLocation: false,
  maxDistance: 50,
  minAge: 17,
  maxAge: 99,
  genders: {
    male: true,
    female: true,
    other: true,
    discret: false,
  },
  useMyPosition: true,
  position: "Aucune",
  language: "Francais",
  theme: "Sombre",
  accentColor: "Vert emeraude",
  autoplayVideo: true,
  reducedDataMode: false,
  soundEffects: true,
  safeMode: true,
  compactMode: false,
};

const state = {
  settings: structuredClone(DEFAULT_SETTINGS),
  latitude: null,
  longitude: null,
  liveLocationWatchId: null,
  liveLocationSaveTimer: 0,
  blockedUsers: [],
};

const els = {
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  profileVisibility: document.querySelector("#profileVisibility"),
  hideLocation: document.querySelector("#hideLocation"),
  notifMessages: document.querySelector("#notifMessages"),
  notifComments: document.querySelector("#notifComments"),
  notifFollows: document.querySelector("#notifFollows"),
  hiddenWords: document.querySelector("#hiddenWords"),
  useDistanceFilter: document.querySelector("#useDistanceFilter"),
  swipeLiveLocation: document.querySelector("#swipeLiveLocation"),
  maxDistanceKm: document.querySelector("#maxDistanceKm"),
  swipeMinAge: document.querySelector("#swipeMinAge"),
  swipeMaxAge: document.querySelector("#swipeMaxAge"),
  useMyLocationBtn: document.querySelector("#useMyLocationBtn"),
  clearMyLocationBtn: document.querySelector("#clearMyLocationBtn"),
  locationInfo: document.querySelector("#locationInfo"),
  language: document.querySelector("#language"),
  themeDarkBtn: document.querySelector("#themeDarkBtn"),
  themeLightBtn: document.querySelector("#themeLightBtn"),
  accentChoices: Array.from(document.querySelectorAll(".accent-choice")),
  autoplayVideo: document.querySelector("#autoplayVideo"),
  reducedDataMode: document.querySelector("#reducedDataMode"),
  soundEffects: document.querySelector("#soundEffects"),
  safeMode: document.querySelector("#safeMode"),
  compactMode: document.querySelector("#compactMode"),
  summaryList: document.querySelector("#summaryList"),
  validationBox: document.querySelector("#validationBox"),
  feedbackText: document.querySelector("#feedbackText"),
  blockedList: document.querySelector("#blockedList"),
  blockUserIdInput: document.querySelector("#blockUserIdInput"),
  blockUserBtn: document.querySelector("#blockUserBtn"),
};

function setFeedback(text) {
  if (els.feedbackText) els.feedbackText.textContent = text || "Parametres prets";
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

function loadAppSettings() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      theme: String(parsed.theme || DEFAULT_SETTINGS.theme),
      accentColor: String(parsed.accentColor || DEFAULT_SETTINGS.accentColor),
      autoplayVideo: parsed.autoplayVideo !== false,
      reducedDataMode: Boolean(parsed.reducedDataMode),
      soundEffects: parsed.soundEffects !== false,
      safeMode: parsed.safeMode !== false,
      compactMode: Boolean(parsed.compactMode),
    };
  } catch {
    return {
      theme: DEFAULT_SETTINGS.theme,
      accentColor: DEFAULT_SETTINGS.accentColor,
      autoplayVideo: DEFAULT_SETTINGS.autoplayVideo,
      reducedDataMode: DEFAULT_SETTINGS.reducedDataMode,
      soundEffects: DEFAULT_SETTINGS.soundEffects,
      safeMode: DEFAULT_SETTINGS.safeMode,
      compactMode: DEFAULT_SETTINGS.compactMode,
    };
  }
}

function persistAppSettings() {
  saveAppPreferences({
    theme: state.settings.theme,
    accentColor: state.settings.accentColor,
    autoplayVideo: state.settings.autoplayVideo,
    reducedDataMode: state.settings.reducedDataMode,
    soundEffects: state.settings.soundEffects,
    safeMode: state.settings.safeMode,
    compactMode: state.settings.compactMode,
  });
}

function applyVisualPreferences() {
  applyAppPreferences({
    theme: state.settings.theme,
    accentColor: state.settings.accentColor,
  });
}

function runSettingsTests(current) {
  return [
    { name: "age min inferieur a age max", passed: Number(current.minAge) <= Number(current.maxAge) },
    { name: "distance max positive", passed: Number(current.maxDistance) >= 0 },
    { name: "au moins un sexe coche", passed: Object.values(current.genders).some(Boolean) },
    { name: "theme valide", passed: ["Sombre", "Clair"].includes(current.theme) },
    { name: "langue definie", passed: Boolean(current.language) },
  ];
}

function updateToggle(el, checked) {
  if (!el) return;
  el.classList.toggle("is-on", Boolean(checked));
  el.setAttribute("aria-pressed", checked ? "true" : "false");
}

function selectedGenders() {
  return Array.from(document.querySelectorAll("input[name='genderPref']:checked")).map((el) => String(el.value || ""));
}

function setSelectedGenders(values) {
  const set = new Set((values || []).map((item) => String(item || "")));
  document.querySelectorAll("input[name='genderPref']").forEach((input) => {
    input.checked = set.has(String(input.value || ""));
  });
  state.settings.genders = {
    male: set.has("male"),
    female: set.has("female"),
    other: set.has("other"),
    discret: set.has("prefer_not_to_say"),
  };
}

function parseHiddenWords(rawText) {
  return String(rawText || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function refreshStateFromInputs() {
  state.settings.profileVisibility = String(els.profileVisibility?.value || "followers");
  state.settings.hideLocation = els.hideLocation?.classList.contains("is-on") ?? true;
  state.settings.messages = els.notifMessages?.classList.contains("is-on") ?? true;
  state.settings.comments = els.notifComments?.classList.contains("is-on") ?? true;
  state.settings.newFollowers = els.notifFollows?.classList.contains("is-on") ?? true;
  state.settings.mutedWords = String(els.hiddenWords?.value || "");
  state.settings.distanceFilter = els.useDistanceFilter?.classList.contains("is-on") ?? true;
  state.settings.liveLocation = els.swipeLiveLocation?.classList.contains("is-on") ?? false;
  state.settings.maxDistance = Number.parseInt(String(els.maxDistanceKm?.value || "50"), 10) || 0;
  state.settings.minAge = Number.parseInt(String(els.swipeMinAge?.value || "17"), 10) || 17;
  state.settings.maxAge = Number.parseInt(String(els.swipeMaxAge?.value || "99"), 10) || 99;
  state.settings.language = String(els.language?.selectedOptions?.[0]?.textContent || "Francais");
  state.settings.theme = els.themeLightBtn?.classList.contains("is-active") ? "Clair" : "Sombre";
  state.settings.accentColor =
    els.accentChoices.find((button) => button.classList.contains("is-active"))?.dataset.accent || "Vert emeraude";
  state.settings.autoplayVideo = els.autoplayVideo?.classList.contains("is-on") ?? true;
  state.settings.reducedDataMode = els.reducedDataMode?.classList.contains("is-on") ?? false;
  state.settings.soundEffects = els.soundEffects?.classList.contains("is-on") ?? true;
  state.settings.safeMode = els.safeMode?.classList.contains("is-on") ?? true;
  state.settings.compactMode = els.compactMode?.classList.contains("is-on") ?? false;
  state.settings.position =
    state.latitude == null || state.longitude == null
      ? "Aucune"
      : `${Number(state.latitude).toFixed(5)}, ${Number(state.longitude).toFixed(5)}`;
}

function renderLocationInfo() {
  refreshStateFromInputs();
  if (!els.locationInfo) return;
  if (state.latitude == null || state.longitude == null) {
    els.locationInfo.textContent = "Position: non definie";
    return;
  }
  const live = state.liveLocationWatchId != null ? " (live)" : "";
  els.locationInfo.textContent = `Position: ${Number(state.latitude).toFixed(5)}, ${Number(state.longitude).toFixed(
    5
  )}${live}`;
}

function renderSummary() {
  refreshStateFromInputs();
  if (!els.summaryList) return;
  const rows = [
    [t("account_privacy"), state.settings.profileVisibility],
    [t("hide_location"), state.settings.hideLocation ? "oui" : "non"],
    [t("messages"), state.settings.messages ? "actives" : "desactives"],
    [t("new_followers"), state.settings.newFollowers ? "actives" : "desactives"],
    ["Position", state.settings.position],
    [t("language"), state.settings.language],
    [t("theme"), state.settings.theme],
    [t("accent_color"), state.settings.accentColor],
    [t("sound_effects"), state.settings.soundEffects ? "oui" : "non"],
    [t("data_saver_mode"), state.settings.reducedDataMode ? "oui" : "non"],
    [t("enhanced_security"), state.settings.safeMode ? "oui" : "non"],
  ];
  els.summaryList.innerHTML = rows
    .map(
      ([label, value]) =>
        `<div class="summary-row"><span>${label}</span><span style="color:var(--accent)">${String(value)}</span></div>`
    )
    .join("");
}

function renderValidation() {
  refreshStateFromInputs();
  const tests = runSettingsTests(state.settings);
  const allTestsPassed = tests.every((test) => test.passed);
  if (!els.validationBox) return;
  els.validationBox.classList.toggle("is-ok", allTestsPassed);
  els.validationBox.classList.toggle("is-bad", !allTestsPassed);
  if (allTestsPassed) {
    els.validationBox.textContent = "Tests parametres passes";
    return;
  }
  const failed = tests.filter((test) => !test.passed).map((test) => test.name).join(" · ");
  els.validationBox.textContent = `Un test parametres a echoue: ${failed}`;
}

function renderThemeChoices() {
  els.themeDarkBtn?.classList.toggle("is-active", state.settings.theme === "Sombre");
  els.themeLightBtn?.classList.toggle("is-active", state.settings.theme === "Clair");
}

function renderAccentChoices() {
  els.accentChoices.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.accent === state.settings.accentColor);
  });
}

function renderToggles() {
  updateToggle(els.hideLocation, state.settings.hideLocation);
  updateToggle(els.notifMessages, state.settings.messages);
  updateToggle(els.notifComments, state.settings.comments);
  updateToggle(els.notifFollows, state.settings.newFollowers);
  updateToggle(els.useDistanceFilter, state.settings.distanceFilter);
  updateToggle(els.swipeLiveLocation, state.settings.liveLocation);
  updateToggle(els.autoplayVideo, state.settings.autoplayVideo);
  updateToggle(els.reducedDataMode, state.settings.reducedDataMode);
  updateToggle(els.soundEffects, state.settings.soundEffects);
  updateToggle(els.safeMode, state.settings.safeMode);
  updateToggle(els.compactMode, state.settings.compactMode);
}

function renderInputs() {
  if (els.profileVisibility) els.profileVisibility.value = state.settings.profileVisibility;
  if (els.hiddenWords) els.hiddenWords.value = state.settings.mutedWords;
  if (els.maxDistanceKm) els.maxDistanceKm.value = String(state.settings.maxDistance);
  if (els.swipeMinAge) els.swipeMinAge.value = String(state.settings.minAge);
  if (els.swipeMaxAge) els.swipeMaxAge.value = String(state.settings.maxAge);
  if (els.language) {
    const langValue =
      state.settings.language === "English"
        ? "en"
        : state.settings.language === "Espanol"
          ? "es"
          : state.settings.language === "Deutsch"
            ? "de"
            : "fr";
    els.language.value = langValue;
  }
  renderToggles();
  renderThemeChoices();
  renderAccentChoices();
  applyVisualPreferences();
  setSelectedGenders([
    state.settings.genders.male ? "male" : "",
    state.settings.genders.female ? "female" : "",
    state.settings.genders.other ? "other" : "",
    state.settings.genders.discret ? "prefer_not_to_say" : "",
  ]);
  renderLocationInfo();
  renderSummary();
  renderValidation();
}

function stopLiveLocationWatch() {
  if (state.liveLocationWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(state.liveLocationWatchId);
  }
  state.liveLocationWatchId = null;
  renderLocationInfo();
}

async function syncSwipePrefsOnly() {
  sanitizeAges();
  await apiFetch("/follows/swipe/preferences", {
    method: "PUT",
    body: JSON.stringify({
      use_distance_filter: Boolean(state.settings.distanceFilter),
      max_distance_km: Number(state.settings.maxDistance),
      min_age: Number(state.settings.minAge),
      max_age: Number(state.settings.maxAge),
      preferred_genders: selectedGenders(),
      latitude: state.latitude,
      longitude: state.longitude,
    }),
  });
}

function scheduleLiveLocationSync() {
  if (state.liveLocationSaveTimer) clearTimeout(state.liveLocationSaveTimer);
  state.liveLocationSaveTimer = setTimeout(() => {
    syncSwipePrefsOnly().catch(() => {});
  }, 1200);
}

function startLiveLocationWatch() {
  if (!navigator.geolocation) {
    toast("Geolocalisation indisponible.", "Erreur");
    state.settings.liveLocation = false;
    writeLiveLocationPreference(false);
    renderInputs();
    return;
  }
  if (state.liveLocationWatchId != null) return;
  state.liveLocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      state.latitude = Number(position.coords.latitude);
      state.longitude = Number(position.coords.longitude);
      renderLocationInfo();
      scheduleLiveLocationSync();
    },
    () => {
      stopLiveLocationWatch();
      state.settings.liveLocation = false;
      writeLiveLocationPreference(false);
      renderInputs();
      toast("Localisation live refusee.", "Erreur");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
}

function sanitizeAges() {
  const minAgeRaw = Number.parseInt(String(state.settings.minAge || "17"), 10);
  const maxAgeRaw = Number.parseInt(String(state.settings.maxAge || "99"), 10);
  const minAgeBase = Number.isFinite(minAgeRaw) ? Math.max(17, Math.min(99, minAgeRaw)) : 17;
  const maxAgeBase = Number.isFinite(maxAgeRaw) ? Math.max(17, Math.min(99, maxAgeRaw)) : 99;
  state.settings.minAge = Math.min(minAgeBase, maxAgeBase);
  state.settings.maxAge = Math.max(minAgeBase, maxAgeBase);
}

function renderBlocked(items) {
  state.blockedUsers = Array.isArray(items) ? items : [];
  if (!els.blockedList) return;
  if (!state.blockedUsers.length) {
    els.blockedList.innerHTML = `<div class="blocked-empty">Aucun compte bloque.</div>`;
    return;
  }
  els.blockedList.innerHTML = state.blockedUsers
    .map(
      (user) => `
        <div class="summary-row">
          <span>@${user.username || user.display_name || user.id}</span>
          <button class="ghost-btn unblock-btn" type="button" data-unblock-id="${user.id}">Debloquer</button>
        </div>
      `
    )
    .join("");

  els.blockedList.querySelectorAll(".unblock-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-unblock-id");
      if (!userId) return;
      try {
        await apiFetch(`/follows/settings/blocked/${encodeURIComponent(userId)}`, { method: "DELETE" });
        await loadBlocked();
        setFeedback("Compte debloque.");
        toast("Compte debloque.", "Succes");
      } catch (error) {
        toast(error?.message || "Deblocage impossible", "Erreur");
      }
    });
  });
}

async function loadBlocked() {
  try {
    const data = await apiFetch("/follows/settings/blocked");
    renderBlocked(data?.items || []);
  } catch (error) {
    renderBlocked([]);
    setFeedback(error?.message || "Impossible de charger les comptes bloques");
  }
}

async function loadAllSettings() {
  if (!requireLogin({ message: "Connecte-toi pour acceder aux parametres." })) {
    setFeedback("Connexion requise pour charger les parametres");
    return;
  }
  try {
    setFeedback("Chargement des parametres...");
    const [swipeData, settingsData] = await Promise.all([
      apiFetch("/follows/swipe/preferences"),
      apiFetch("/follows/settings/me"),
    ]);

    const swipePrefs = swipeData?.preferences || {};
    const socialSettings = settingsData?.settings || {};
    const appSettings = loadAppSettings();

    state.settings.profileVisibility = socialSettings.account_private ? "private" : "followers";
    state.settings.hideLocation = Boolean(socialSettings.hide_location);
    state.settings.messages = socialSettings.notifications_prefs?.messages !== false;
    state.settings.comments = socialSettings.notifications_prefs?.comments !== false;
    state.settings.newFollowers = socialSettings.notifications_prefs?.follows !== false;
    state.settings.mutedWords = Array.isArray(socialSettings.hidden_words)
      ? socialSettings.hidden_words.join(", ")
      : DEFAULT_SETTINGS.mutedWords;
    state.settings.distanceFilter = Boolean(swipePrefs.use_distance_filter);
    state.settings.liveLocation = readLiveLocationPreference();
    state.settings.maxDistance = Number(swipePrefs.max_distance_km || 50);
    state.settings.minAge = Number(swipePrefs.min_age || 17);
    state.settings.maxAge = Number(swipePrefs.max_age || 99);
    state.settings.genders = {
      male: Array.isArray(swipePrefs.preferred_genders) ? swipePrefs.preferred_genders.includes("male") : true,
      female: Array.isArray(swipePrefs.preferred_genders) ? swipePrefs.preferred_genders.includes("female") : true,
      other: Array.isArray(swipePrefs.preferred_genders) ? swipePrefs.preferred_genders.includes("other") : true,
      discret: Array.isArray(swipePrefs.preferred_genders)
        ? swipePrefs.preferred_genders.includes("prefer_not_to_say")
        : false,
    };
    state.latitude = swipePrefs.latitude == null ? null : Number(swipePrefs.latitude);
    state.longitude = swipePrefs.longitude == null ? null : Number(swipePrefs.longitude);
    state.settings.position =
      state.latitude == null || state.longitude == null
        ? "Aucune"
        : `${Number(state.latitude).toFixed(5)}, ${Number(state.longitude).toFixed(5)}`;
    state.settings.language =
      socialSettings.language === "en"
        ? "English"
        : socialSettings.language === "es"
          ? "Espanol"
          : socialSettings.language === "de"
            ? "Deutsch"
            : "Francais";

    Object.assign(state.settings, appSettings);

    setLanguage(String(socialSettings.language || getLanguage() || "fr"));
    applyI18n(document);
    renderInputs();

    if (state.settings.liveLocation) startLiveLocationWatch();
    await loadBlocked();
    setFeedback("Parametres charges.");
  } catch (error) {
    setFeedback(error?.message || "Impossible de charger les parametres");
    toast(error?.message || "Impossible de charger les parametres", "Erreur");
  }
}

async function saveAllSettings() {
  try {
    refreshStateFromInputs();
    sanitizeAges();
    persistAppSettings();

    const visibility = state.settings.profileVisibility;
    await Promise.all([
      apiFetch("/follows/swipe/preferences", {
        method: "PUT",
        body: JSON.stringify({
          use_distance_filter: Boolean(state.settings.distanceFilter),
          max_distance_km: Number(state.settings.maxDistance),
          min_age: Number(state.settings.minAge),
          max_age: Number(state.settings.maxAge),
          preferred_genders: selectedGenders(),
          latitude: state.latitude,
          longitude: state.longitude,
        }),
      }),
      apiFetch("/follows/settings/me", {
        method: "PUT",
        body: JSON.stringify({
          account_private: visibility === "private",
          hide_location: Boolean(state.settings.hideLocation),
          language: String(els.language?.value || "fr"),
          hidden_words: parseHiddenWords(state.settings.mutedWords),
          notifications_prefs: {
            messages: Boolean(state.settings.messages),
            comments: Boolean(state.settings.comments),
            follows: Boolean(state.settings.newFollowers),
          },
        }),
      }),
    ]);

    renderInputs();
    setFeedback("Parametres mis a jour");
    toast("Parametres enregistres.", "Succes");
  } catch (error) {
    setFeedback(error?.message || "Enregistrement impossible");
    toast(error?.message || "Enregistrement impossible", "Erreur");
  }
}

function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  renderInputs();
}

function bindToggle(el, key, afterToggle) {
  el?.addEventListener("click", () => {
    toggleSetting(key);
    if (typeof afterToggle === "function") afterToggle();
  });
}

function bindInputs() {
  bindToggle(els.hideLocation, "hideLocation");
  bindToggle(els.notifMessages, "messages");
  bindToggle(els.notifComments, "comments");
  bindToggle(els.notifFollows, "newFollowers");
  bindToggle(els.useDistanceFilter, "distanceFilter");
  bindToggle(els.autoplayVideo, "autoplayVideo");
  bindToggle(els.reducedDataMode, "reducedDataMode");
  bindToggle(els.soundEffects, "soundEffects");
  bindToggle(els.safeMode, "safeMode");
  bindToggle(els.compactMode, "compactMode");
  bindToggle(els.swipeLiveLocation, "liveLocation", () => {
    writeLiveLocationPreference(state.settings.liveLocation);
    if (state.settings.liveLocation) startLiveLocationWatch();
    else stopLiveLocationWatch();
    renderInputs();
  });

  els.profileVisibility?.addEventListener("change", () => {
    state.settings.profileVisibility = els.profileVisibility.value;
    renderSummary();
    renderValidation();
  });

  [els.hiddenWords, els.maxDistanceKm, els.swipeMinAge, els.swipeMaxAge, els.language].forEach((input) => {
    input?.addEventListener("input", () => {
      refreshStateFromInputs();
      renderSummary();
      renderValidation();
    });
    input?.addEventListener("change", () => {
      refreshStateFromInputs();
      renderSummary();
      renderValidation();
    });
  });

  document.querySelectorAll("input[name='genderPref']").forEach((input) => {
    input.addEventListener("change", () => {
      refreshStateFromInputs();
      renderSummary();
      renderValidation();
    });
  });

  els.themeDarkBtn?.addEventListener("click", () => {
    state.settings.theme = "Sombre";
    persistAppSettings();
    renderInputs();
  });

  els.themeLightBtn?.addEventListener("click", () => {
    state.settings.theme = "Clair";
    persistAppSettings();
    renderInputs();
  });

  els.accentChoices.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.accentColor = button.dataset.accent || "Vert emeraude";
      persistAppSettings();
      renderInputs();
    });
  });

  els.useMyLocationBtn?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      toast("Geolocalisation indisponible.", "Erreur");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.latitude = Number(position.coords.latitude);
        state.longitude = Number(position.coords.longitude);
        state.settings.useMyPosition = true;
        renderLocationInfo();
        renderSummary();
        setFeedback("Position utilisateur activee");
        scheduleLiveLocationSync();
      },
      () => {
        toast("Permission localisation refusee.", "Erreur");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  els.clearMyLocationBtn?.addEventListener("click", () => {
    stopLiveLocationWatch();
    writeLiveLocationPreference(false);
    state.settings.liveLocation = false;
    state.latitude = null;
    state.longitude = null;
    state.settings.position = "Aucune";
    renderInputs();
    setFeedback("Position effacee");
  });

  els.language?.addEventListener("change", () => {
    const lang = els.language.value || "fr";
    setLanguage(lang);
    applyI18n(document);
    renderSummary();
    renderValidation();
    setFeedback("Langue mise a jour");
  });

  els.saveSettingsBtn?.addEventListener("click", saveAllSettings);

  els.blockUserBtn?.addEventListener("click", async () => {
    const userId = String(els.blockUserIdInput?.value || "").trim();
    if (!userId) return;
    try {
      await apiFetch(`/follows/settings/blocked/${encodeURIComponent(userId)}`, { method: "POST" });
      if (els.blockUserIdInput) els.blockUserIdInput.value = "";
      await loadBlocked();
      setFeedback("Compte bloque.");
      toast("Compte bloque.", "Succes");
    } catch (error) {
      toast(error?.message || "Blocage impossible", "Erreur");
    }
  });
}

window.addEventListener("beforeunload", () => stopLiveLocationWatch());

function init() {
  setFeedback("Parametres prets");
  bindInputs();
  setLanguage(getLanguage());
  applyI18n(document);
  renderInputs();
  loadAllSettings();
}

init();
