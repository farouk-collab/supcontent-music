import { apiFetch, toast, getTokens, serverLogout, escapeHtml, resolveMediaUrl } from "/noyau/app.js";

console.log("INDEX JS LOADED");
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_NOTIFICATIONS = [
  { id: 1, type: "release", user: "Nina.beats", text: "a partage une nouvelle sortie : Timeless - The Weeknd", time: "Il y a 2 min", read: false },
  { id: 2, type: "community", user: "Ayo.wav", text: "a aime ta playlist Afro Sunset", time: "Il y a 8 min", read: false },
  { id: 3, type: "follow", user: "Luna.mix", text: "a commence a te suivre", time: "Il y a 21 min", read: false },
  { id: 4, type: "comment", user: "Melo", text: 'a commente ton post : "grosse ambiance ce son"', time: "Il y a 1 h", read: true },
  { id: 5, type: "playlist", user: "DJ Nova", text: "a ajoute ton morceau a la playlist Midnight Drive", time: "Il y a 2 h", read: true },
  { id: 6, type: "release", user: "Kez.fm", text: "a publie un extrait exclusif dans ses stories", time: "Il y a 3 h", read: true },
  { id: 7, type: "community", user: "SoundWave", text: 'a reposte ta review "Night Drive Energy"', time: "Hier", read: true },
];
const HOME_FORCE_MOCK = false;
const HOME_NOTIF_READ_KEY = "supcontent_home_notifications_read_v1";
const HOME_MOCK_STORIES = [
  { id: "me", name: "Votre story", handle: "@moi", avatar: "", href: "/profil/profil.html?compose=1", isSelf: true, hasStory: false },
  { id: "nina", name: "Nina", handle: "@nina.beats", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80", href: "#", hasStory: true },
  { id: "melo", name: "Melo", handle: "@melo", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80", href: "#", hasStory: false },
  { id: "ayo", name: "Ayo", handle: "@ayo.wav", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80", href: "#", hasStory: false },
  { id: "luna", name: "Luna", handle: "@luna.mix", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80", href: "#", hasStory: true },
  { id: "kez", name: "Kez", handle: "@kez.fm", avatar: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=300&q=80", href: "#", hasStory: false },
];
const HOME_MOCK_RELEASES = [
  { id: "rel-1", name: "Nouvel EP de Kovu - 6 titres", artists: ["Kovu"], image: "", release_date: "Vendredi" },
  { id: "rel-2", name: "Single surprise de Luma ce vendredi", artists: ["Luma"], image: "", release_date: "A l'instant" },
  { id: "rel-3", name: 'Playlist editoriale "Night Shift" mise a jour', artists: ["Editorial"], image: "", release_date: "Aujourd'hui" },
];
const HOME_MOCK_COMMUNITY = [
  { media_type: "track", media_id: "community-1", media: { name: "124 nouvelles playlists creees aujourd'hui", subtitle: "Activite plateforme", image: "" }, kind: "review", display_name: "Communaute", text: "La scene afro et rap bouge enormement ce soir." },
  { media_type: "track", media_id: "community-2", media: { name: "Le hashtag #AfroWave explose", subtitle: "Tendance", image: "" }, kind: "comment", display_name: "Communaute", text: "Les partages et stories accelerent dans toute l'app." },
  { media_type: "track", media_id: "community-3", media: { name: "8 reviews longues publiees cette semaine", subtitle: "Reviews", image: "" }, kind: "review", display_name: "Communaute", text: "Les utilisateurs commentent de plus en plus les sorties." },
];
const HOME_MOCK_FEED = [
  { media_type: "track", media_id: "timeless", display_name: "Nina.beats", kind: "share", text: "Production de fou. Le refrain me reste dans la tete depuis ce matin.", media: { name: "Timeless", subtitle: "The Weeknd", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80" } },
  { media_type: "album", media_id: "jungle-vibes", display_name: "Ayo.wav", kind: "review", text: "Album super propre pour rouler de nuit. Grosse ambiance afro chill.", media: { name: "Jungle Vibes", subtitle: "Afro Collective", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80" } },
];
const HOME_MOCK_CATEGORIES = {
  trending: [
    { id: "trend-1", type: "track", name: "HÉ TCHAI (feat. Jojo Le Barbu & Suspect95)", artists: [{ name: "Himra, Jojo le Barbu, Suspect95" }], image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "trend-2", type: "track", name: "CIEL", artists: [{ name: "GIMS" }], image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "trend-3", type: "track", name: "J’emmène au vent", artists: [{ name: "Louise Attaque" }], image: "https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "trend-4", type: "track", name: "Recommence-moi", artists: [{ name: "SANTA" }], image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80" }] } },
  ],
  rap: [
    { id: "rap-1", type: "track", name: "Bébé à panthère", artists: [{ name: "SDM, Niska" }], image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "rap-2", type: "track", name: "A7", artists: [{ name: "SCH" }], image: "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "rap-3", type: "track", name: "Air Max", artists: [{ name: "Gazo, Tiakola, Maes" }], image: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "rap-4", type: "track", name: "Paranoïenne", artists: [{ name: "L2B" }], image: "https://images.unsplash.com/photo-1507677428836-81f7639c8f26?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1507677428836-81f7639c8f26?auto=format&fit=crop&w=900&q=80" }] } },
  ],
  afro: [
    { id: "afro-1", type: "track", name: "Who’s Dat Girl", artists: [{ name: "Aya Starr, Rema" }], image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "afro-2", type: "track", name: "Calm Down", artists: [{ name: "Rema" }], image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "afro-3", type: "track", name: "Rush", artists: [{ name: "Ayra Starr" }], image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "afro-4", type: "track", name: "Charm", artists: [{ name: "Rema" }], image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80" }] } },
  ],
  pop: [
    { id: "pop-1", type: "track", name: "Dance The Night", artists: [{ name: "Dua Lipa" }], image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "pop-2", type: "track", name: "Flowers", artists: [{ name: "Miley Cyrus" }], image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "pop-3", type: "track", name: "As It Was", artists: [{ name: "Harry Styles" }], image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80" }] } },
    { id: "pop-4", type: "track", name: "yes, and?", artists: [{ name: "Ariana Grande" }], image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80", album: { images: [{ url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80" }] } },
  ],
};
let notificationsOpen = false;
let notifications = [];
let realtimeEnabled = true;
let realtimeConnected = false;
let lastRealtimeEvent = "Aucun evenement recu pour le moment";
let notificationsTimer = null;

function syncAuthUI() {
  const t = getTokens();

  const loginLink = document.querySelector('[data-auth="login"]');
  const profileLink = document.querySelector('[data-auth="profile"]');
  const logoutLink = document.querySelector('[data-auth="logout"]');

  const ctaAuth = document.querySelector('[data-cta="auth"]');
  const ctaProfile = document.querySelector('[data-cta="profile"]');

  const hint = document.querySelector("#sessionHint");

  const isAuthed = Boolean(t.accessToken);

  if (loginLink) loginLink.style.display = isAuthed ? "none" : "";
  if (profileLink) profileLink.style.display = isAuthed ? "" : "none";
  if (logoutLink) logoutLink.style.display = isAuthed ? "" : "none";

  if (ctaAuth) ctaAuth.style.display = isAuthed ? "none" : "";
  if (ctaProfile) ctaProfile.style.display = isAuthed ? "" : "none";

  if (hint) hint.textContent = isAuthed ? "Connecté" : "Non connecté";
}

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
  return Array.isArray(list) ? list.map((item, index) => sanitizeNotification(item, index)) : [];
}

function readNotificationReadMap() {
  try {
    const raw = localStorage.getItem(HOME_NOTIF_READ_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistNotificationReadMap(map) {
  try {
    localStorage.setItem(HOME_NOTIF_READ_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function relativeTimeFromDate(value) {
  try {
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs)) return "Maintenant";
    const diffMin = Math.max(0, Math.round(diffMs / 60000));
    if (diffMin < 1) return "Maintenant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) return `Il y a ${diffHour} h`;
    const diffDay = Math.round(diffHour / 24);
    return diffDay <= 1 ? "Hier" : `Il y a ${diffDay} j`;
  } catch {
    return "Maintenant";
  }
}

function mergeReadState(items) {
  const readMap = readNotificationReadMap();
  return sanitizeNotifications(items).map((item) => ({
    ...item,
    read: Boolean(readMap[String(item.id)]) || Boolean(item.read),
  }));
}

function mapApiNotifications(data) {
  const followers = Array.isArray(data?.followers) ? data.followers : [];
  const replies = Array.isArray(data?.comment_replies) ? data.comment_replies : [];
  const chatMessages = Array.isArray(data?.chat_messages) ? data.chat_messages : [];

  return mergeReadState([
    ...chatMessages.map((item, index) => ({
      id: `chat-${item?.message_id || index}`,
      type: "comment",
      user: String(item?.display_name || item?.username || "Utilisateur"),
      text: String(item?.body || (String(item?.message_type || "") === "music" ? "t'a partage un morceau" : "t'a ecrit")),
      time: relativeTimeFromDate(item?.created_at),
      read: false,
    })),
    ...followers.map((item, index) => ({
      id: `follow-${item?.id || index}-${item?.created_at || ""}`,
      type: "follow",
      user: String(item?.display_name || item?.username || "Utilisateur"),
      text: "a commence a te suivre",
      time: relativeTimeFromDate(item?.created_at),
      read: false,
    })),
    ...replies.map((item, index) => ({
      id: `reply-${item?.id || index}`,
      type: "comment",
      user: String(item?.display_name || item?.username || "Utilisateur"),
      text: `a repondu a ton commentaire : "${String(item?.body || "").slice(0, 80)}"`,
      time: relativeTimeFromDate(item?.created_at),
      read: false,
    })),
  ]);
}

function runNotificationTests() {
  const cases = [
    {
      name: "preserve une notification valide",
      input: [{ id: 1, type: "comment", user: "Test", text: "ok", time: "now", read: false }],
      check: (result) => result.length === 1 && result[0].read === false && result[0].user === "Test",
    },
    {
      name: "ajoute read=false si absent",
      input: [{ id: 2, type: "follow", user: "Test", text: "ok", time: "now" }],
      check: (result) => result.length === 1 && result[0].read === false,
    },
    {
      name: "gere undefined sans crash",
      input: [undefined],
      check: (result) => result.length === 1 && result[0].user === "Systeme" && result[0].read === true,
    },
    {
      name: "gere une valeur non tableau",
      input: null,
      check: (result) => Array.isArray(result) && result.length === 0,
    },
    {
      name: "gere un objet incomplet",
      input: [{ id: 3 }],
      check: (result) => result.length === 1 && result[0].text === "Nouvelle activite" && result[0].user === "Systeme",
    },
    {
      name: "normalise plusieurs entrees mixtes",
      input: [{ id: 4, read: 1 }, undefined, { user: "A" }],
      check: (result) => result.length === 3 && result[0].read === true && result[1].user === "Systeme",
    },
  ];
  return cases.map((test) => ({
    name: test.name,
    passed: test.check(sanitizeNotifications(test.input)),
  }));
}

function notifIcon(type) {
  const icons = {
    release: "?",
    community: "?",
    follow: "+",
    comment: "??",
    playlist: "?",
    system: "•",
  };
  return icons[type] || icons.system;
}

function unreadCount() {
  return sanitizeNotifications(notifications).filter((item) => !item.read).length;
}

function renderNotifications() {
  const badge = document.querySelector("#homeNotifBadge");
  const panel = document.querySelector("#homeNotifPanel");
  const list = document.querySelector("#homeNotifList");
  const stats = document.querySelector("#homeNotifStats");
  const status = document.querySelector("#homeNotifStatus");
  const lastEvent = document.querySelector("#homeLastEvent");
  const realtimeState = document.querySelector("#homeRealtimeState");
  const realtimeStateTop = document.querySelector("#homeRealtimeStateTop");
  const testsState = document.querySelector("#homeTestsState");
  const safeNotifications = sanitizeNotifications(notifications);
  const unread = unreadCount();
  const notificationTests = runNotificationTests();
  const testsPassed = notificationTests.every((test) => test.passed);

  if (badge) {
    badge.hidden = unread <= 0;
    badge.textContent = unread > 99 ? "99+" : String(unread);
  }
  if (panel) panel.hidden = !notificationsOpen;
  if (status) {
    status.textContent = realtimeEnabled
      ? realtimeConnected
        ? "Notifications synchronisees automatiquement depuis l'API."
        : "Connexion en cours ou aucune notification disponible."
      : "Synchronisation automatique coupee : le centre d'activite reste en mode manuel.";
  }
  if (stats) {
    stats.innerHTML = `
      <div class="home-stat-card">
        <span class="home-stat-label">Total</span>
        <strong>${safeNotifications.length}</strong>
        <span>${safeNotifications.length} notifications</span>
      </div>
      <div class="home-stat-card is-pink">
        <span class="home-stat-label">Non lues</span>
        <strong>${unread}</strong>
        <span>${unread} elements</span>
      </div>
      <div class="home-stat-card is-blue">
        <span class="home-stat-label">Mode</span>
        <strong>${realtimeEnabled ? (realtimeConnected ? "API live" : "Attente") : "Pause"}</strong>
        <span>${realtimeEnabled ? "Polling notifications actif" : "Mode manuel"}</span>
      </div>
    `;
  }
  if (lastEvent) {
    lastEvent.innerHTML = `<strong>Dernier evenement :</strong> ${escapeHtml(lastRealtimeEvent)}`;
  }
  if (realtimeState) {
    realtimeState.textContent = realtimeEnabled ? (realtimeConnected ? "Notifications connectées" : "Notifications en attente") : "Notifications en pause";
    realtimeState.className = `home-live-pill ${realtimeEnabled && realtimeConnected ? "is-live" : "is-offline"}`;
  }
  if (realtimeStateTop) {
    realtimeStateTop.textContent = realtimeEnabled ? (realtimeConnected ? "Notifications connectées" : "Notifications en attente") : "Notifications en pause";
    realtimeStateTop.className = `home-live-pill ${realtimeEnabled && realtimeConnected ? "is-live" : "is-offline"}`;
  }
  if (testsState) {
    testsState.textContent = testsPassed ? "Tests de robustesse passes" : "Un test de robustesse a echoue";
    testsState.className = `home-live-pill ${testsPassed ? "is-test-ok" : "is-test-ko"}`;
  }
  if (list) {
    list.innerHTML = safeNotifications.map((item) => `
      <button class="home-notif-item ${item.read ? "" : "is-unread"}" type="button" data-notif-id="${escapeHtml(String(item.id))}">
        <div class="home-notif-icon">${notifIcon(item.type)}</div>
        <div>
          <div class="home-notif-text-row">
            <div class="home-notif-text"><strong>${escapeHtml(item.user)}</strong> ${escapeHtml(item.text)}</div>
            ${item.read ? "" : '<span class="home-notif-dot" aria-hidden="true"></span>'}
          </div>
          <div class="home-notif-time">${escapeHtml(item.time)}</div>
        </div>
      </button>
    `).join("");
  }
}

function markAllNotificationsAsRead() {
  const readMap = readNotificationReadMap();
  notifications = sanitizeNotifications(notifications).map((item) => {
    readMap[String(item.id)] = true;
    return { ...item, read: true };
  });
  persistNotificationReadMap(readMap);
}

function markNotificationAsRead(id) {
  const readMap = readNotificationReadMap();
  readMap[String(id)] = true;
  persistNotificationReadMap(readMap);
  notifications = sanitizeNotifications(notifications).map((item) =>
    String(item.id) === String(id) ? { ...item, read: true } : item
  );
}

async function loadHomeNotifications({ silent = false } = {}) {
  if (!getTokens().accessToken) {
    realtimeConnected = false;
    notifications = mergeReadState(DEFAULT_NOTIFICATIONS);
    lastRealtimeEvent = "Connecte-toi pour synchroniser les notifications API";
    if (!silent) renderNotifications();
    return;
  }

  try {
    const data = await apiFetch("/notifications/me?limit=20");
    const nextItems = mapApiNotifications(data);
    notifications = nextItems.length ? nextItems : mergeReadState(DEFAULT_NOTIFICATIONS);
    realtimeConnected = true;
    const first = notifications[0];
    lastRealtimeEvent = first ? `${first.user} - ${first.text}` : "Aucune nouvelle notification";
  } catch (error) {
    realtimeConnected = false;
    notifications = mergeReadState(DEFAULT_NOTIFICATIONS);
    lastRealtimeEvent = error?.message || "Synchronisation notifications indisponible";
  }

  if (!silent) renderNotifications();
}

function pushMockNotification() {
  loadHomeNotifications({ silent: false }).catch(() => {});
  return;
  lastRealtimeEvent = `${next.user} • ${next.text}`;
  renderNotifications();
}

function startRealtimeNotifications() {
  if (notificationsTimer) clearInterval(notificationsTimer);
  if (!realtimeEnabled) return;
  notificationsTimer = window.setInterval(() => {
    if (document.hidden) return;
    loadHomeNotifications({ silent: false }).catch(() => {});
  }, 15000);
  /* legacy mock code removed
    lastRealtimeEvent = `${next.user} • ${next.text}`;
    renderNotifications();
    index += 1;
  */
}

function bindHomeNotifications() {
  notifications = mergeReadState(DEFAULT_NOTIFICATIONS);
  renderNotifications();
  loadHomeNotifications({ silent: false }).catch(() => {});
  startRealtimeNotifications();

  const dropdown = document.querySelector("#homeNotifDropdown");
  const toggle = document.querySelector("#homeNotifBtn");
  const markAllBtn = document.querySelector("#homeMarkAllReadBtn");
  const realtimeBtn = document.querySelector("#homeSocketToggle");
  const addPostBtn = document.querySelector("#homeAddPostBtn");
  const refreshStoriesBtn = document.querySelector("#refreshStoriesBtn");

  toggle?.addEventListener("click", () => {
    notificationsOpen = !notificationsOpen;
    renderNotifications();
  });
  markAllBtn?.addEventListener("click", markAllNotificationsAsRead);
  realtimeBtn?.addEventListener("click", () => {
    realtimeEnabled = !realtimeEnabled;
    realtimeBtn.textContent = realtimeEnabled ? "Couper la synchro" : "Relancer la synchro";
    renderNotifications();
    startRealtimeNotifications();
    if (realtimeEnabled) {
      loadHomeNotifications({ silent: false }).catch(() => {});
    }
  });
  addPostBtn?.addEventListener("click", () => {
    if (!getTokens().accessToken) {
      window.location.href = "/connexion/connexion.html";
      return;
    }
    window.location.href = "/profil/profil.html?compose=1";
  });
  refreshStoriesBtn?.addEventListener("click", () => {
    loadStoriesFromFollowing().catch((err) => toast(err?.message || "Erreur stories", "Erreur"));
  });

  document.addEventListener("mousedown", (event) => {
    if (!dropdown || !dropdown.contains(event.target)) {
      notificationsOpen = false;
      renderNotifications();
    }
  });

  document.addEventListener("click", (event) => {
    const notifItem = event.target.closest("[data-notif-id]");
    if (!notifItem) return;
    const notifId = String(notifItem.getAttribute("data-notif-id") || "");
    markNotificationAsRead(notifId);
  });
}

function bindLogout() {
  const logoutLink = document.querySelector('[data-auth="logout"]');
  if (!logoutLink) return;
  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    await serverLogout();
    syncAuthUI();
    toast("Déconnecté.", "OK");
  });
}

function mediaHref(type, id) {
  const safeType = String(type || "").trim();
  const safeId = String(id || "").trim();
  if (!safeType || !safeId) return "#";
  const q = `type=${encodeURIComponent(safeType)}&id=${encodeURIComponent(safeId)}`;
  return `/media/media.html?${q}#${q}`;
}

function getOriginalTrackImage(item) {
  const directUrl = String(item?.image || "").trim();
  const albumUrl = String(item?.album?.images?.[0]?.url || "").trim();
  const fallbackUrl = String(item?.images?.[0]?.url || "").trim();
  const pick = directUrl || albumUrl || fallbackUrl;
  if (!pick) return "";
  if (!/^https?:\/\//i.test(pick)) return "";
  if (pick.startsWith("/autocollants/")) return "";
  return pick;
}

function makeTile(item) {
  const img = getOriginalTrackImage(item);
  const title = item?.name || "Sans titre";
  const sub = item?.artists?.map((a) => a.name).join(", ") || item?.type || "";
  const type = item?.type || "track";
  const id = item?.id || "";

  const a = document.createElement("a");
  a.className = "tile";
  a.href = id ? mediaHref(type, id) : "#";
  a.style.textDecoration = "none";
  a.style.color = "inherit";

  const cover = document.createElement("div");
  cover.className = "cover";
  if (img) {
    const imageEl = document.createElement("img");
    imageEl.src = img;
    imageEl.alt = title;
    imageEl.loading = "lazy";
    imageEl.decoding = "async";
    cover.appendChild(imageEl);
  } else {
    cover.style.background = "linear-gradient(135deg, rgba(139,92,246,.55), rgba(34,197,94,.35))";
  }

  const meta = document.createElement("div");
  meta.className = "meta";

  const t = document.createElement("div");
  t.className = "title";
  t.textContent = title;

  const s = document.createElement("div");
  s.className = "sub";
  s.textContent = sub;

  meta.appendChild(t);
  meta.appendChild(s);

  a.appendChild(cover);
  a.appendChild(meta);

  return a;
}

function makeStoryTile(person) {
  const a = document.createElement("a");
  a.className = `tile story-tile ${person.hasStory ? "has-story" : ""} ${person.isSelf ? "is-self" : ""}`;
  a.href = person.href || "/profil/profil.html";
  a.style.textDecoration = "none";
  a.style.color = "inherit";

  const ring = document.createElement("div");
  ring.className = "story-ring";

  const avatar = document.createElement("div");
  avatar.className = "story-avatar";
  if (person.avatar) avatar.style.backgroundImage = `url('${resolveMediaUrl(person.avatar)}')`;
  else avatar.textContent = person.isSelf ? "+" : "o";
  ring.appendChild(avatar);

  if (person.hasStory && !person.isSelf) {
    const live = document.createElement("div");
    live.className = "story-live";
    live.textContent = "LIVE";
    ring.appendChild(live);
  }

  const t = document.createElement("div");
  t.className = "story-title";
  t.textContent = person.name || "profil";

  const s = document.createElement("div");
  s.className = "story-sub";
  s.textContent = person.handle || "";

  a.appendChild(ring);
  a.appendChild(t);
  a.appendChild(s);
  return a;
}

function readUserStories(userId) {
  try {
    const raw = localStorage.getItem(`supcontent_profile_posts_${String(userId || "")}`);
    const all = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(all)) return [];
    return all
      .filter((x) => String(x?.entry_type || "") === "story" && x?.media_data)
      .filter((x) => {
        const createdMs = new Date(String(x?.created_at || "")).getTime();
        if (!Number.isFinite(createdMs)) return false;
        return Date.now() - createdMs <= STORY_TTL_MS;
      })
      .sort((a, b) => new Date(String(b?.created_at || 0)).getTime() - new Date(String(a?.created_at || 0)).getTime());
  } catch {
    return [];
  }
}

function fillStories(trackEl, followed = []) {
  if (!trackEl) return;
  if (!followed.length) {
    trackEl.innerHTML = `<small style="color:var(--muted)">Aucun abonnement pour le moment.</small>`;
    return;
  }
  trackEl.innerHTML = "";
  followed.forEach((p) => trackEl.appendChild(makeStoryTile(p)));
}

async function loadStoriesFromFollowing() {
  const trackEl = document.querySelector("#storiesTrack");
  const homeTrackEl = document.querySelector("#homeStoriesTrack");
  if (!trackEl && !homeTrackEl) return;
  if (HOME_FORCE_MOCK) {
    fillStories(trackEl, HOME_MOCK_STORIES);
    fillStories(homeTrackEl, HOME_MOCK_STORIES);
    return;
  }
  if (!getTokens().accessToken) {
    if (trackEl) trackEl.innerHTML = `<small style="color:var(--muted)">Connecte-toi pour voir tes abonnements.</small>`;
    fillStories(homeTrackEl, HOME_MOCK_STORIES);
    return;
  }
  try {
    const [meData, data] = await Promise.all([apiFetch("/auth/me"), apiFetch("/follows/me?limit=30")]);
    const me = meData?.user || null;
    const following = Array.isArray(data?.following) ? data.following : [];
    const people = [];
    if (me?.id) {
      people.push({
        id: String(me.id),
        name: "Votre story",
        handle: `@${me.username || "moi"}`,
        avatar: me.avatar_url || "",
        href: "/profil/profil.html?compose=1",
        isSelf: true,
      });
    }
    for (const u of following) {
      people.push({
        id: String(u.id || ""),
        name: u.display_name || u.username || "profil",
        handle: `@${u.username || "user"}`,
        avatar: u.avatar_url || "",
        href: `/profil/profil.html?user=${encodeURIComponent(String(u.id || ""))}`,
      });
    }

    const withStories = people
      .map((p) => {
        const stories = readUserStories(p.id);
        return { ...p, hasStory: stories.length > 0 };
      })
      .filter((p) => p.id === String(me?.id || "") || p.hasStory);

    const rowsToRender = withStories.length ? withStories : HOME_MOCK_STORIES;
    fillStories(trackEl, rowsToRender);
    fillStories(homeTrackEl, rowsToRender);
  } catch {
    if (trackEl) trackEl.innerHTML = `<small style="color:#ffb0b0">Impossible de charger les abonnements.</small>`;
    fillStories(homeTrackEl, HOME_MOCK_STORIES);
  }
}

function bindHomeHeaderActions() {
  const addBtn = document.querySelector("#homeAddStoryBtn");

  addBtn?.addEventListener("click", () => {
    if (!getTokens().accessToken) {
      window.location.href = "/connexion/connexion.html";
      return;
    }
    window.location.href = "/profil/profil.html?compose=1";
  });
}

function renderReleaseCard(it) {
  const title = it?.name || "Sans titre";
  return `<div class="home-news-text-item">${escapeHtml(title)}</div>`;
}

function renderCommunityCard(it) {
  const href = mediaHref(it.media_type, it.media_id);
  const mediaName = it?.media?.name || it.media_id;
  const mediaSub = it?.media?.subtitle || "";
  const img = it?.media?.image || "";
  const kind = it.kind === "review" ? "Avis" : "Commentaire";
  const rating = typeof it.rating === "number" ? ` ? ${it.rating}/5` : "";
  const author = it.display_name || "Utilisateur";
  const text = it.text || "";
  return `
    <a class="news-item home-news-item" href="${href}">
      <div class="news-cover">${img ? `<img src="${img}" alt="">` : `<span class="badge">${it.media_type}</span>`}</div>
      <div>
        <div class="news-title">${mediaName}</div>
        <div class="news-sub">${mediaSub}</div>
        <div class="news-meta">${kind}${rating} ? par ${author}</div>
        ${text ? `<div class="news-text">${text}</div>` : ""}
      </div>
    </a>
  `;
}

function renderCommunityTextCard(it) {
  const primary = it?.media?.name || it?.text || it?.media_id || "Activit? communaut?";
  return `<div class="home-news-text-item">${escapeHtml(primary)}</div>`;
}

function renderMockNews() {
  const releasesBox = document.querySelector("#newsReleases");
  const communityBox = document.querySelector("#newsCommunity");
  if (releasesBox) releasesBox.innerHTML = HOME_MOCK_RELEASES.map(renderReleaseCard).join("");
  if (communityBox) communityBox.innerHTML = HOME_MOCK_COMMUNITY.map(renderCommunityTextCard).join("");
}

async function loadMusicNews() {
  const releasesBox = document.querySelector("#newsReleases");
  const communityBox = document.querySelector("#newsCommunity");
  if (!releasesBox || !communityBox) return;

  if (HOME_FORCE_MOCK) {
    releasesBox.innerHTML = HOME_MOCK_RELEASES.map(renderReleaseCard).join("");
    communityBox.innerHTML = HOME_MOCK_COMMUNITY.map(renderCommunityTextCard).join("");
    return;
  }

  releasesBox.innerHTML = `<small>Chargement...</small>`;
  communityBox.innerHTML = `<small>Chargement...</small>`;

  try {
    const data = await apiFetch("/music/news?limit=8");
    const releases = Array.isArray(data?.releases) ? data.releases : [];
    const community = Array.isArray(data?.community) ? data.community : [];

    if (!releases.length && !community.length) {
      renderMockNews();
      return;
    }

    releasesBox.innerHTML = releases.length
      ? releases.slice(0, 8).map(renderReleaseCard).join("")
      : HOME_MOCK_RELEASES.map(renderReleaseCard).join("");
    communityBox.innerHTML = community.length
      ? community.slice(0, 8).map(renderCommunityTextCard).join("")
      : HOME_MOCK_COMMUNITY.map(renderCommunityTextCard).join("");
  } catch (err) {
    renderMockNews();
    console.warn("Actualites musique en fallback mock:", err?.message || err);
  }
}

function renderFollowingFeedItem(it) {
  const media = it?.media || {};
  const href = mediaHref(it.media_type || "track", it.media_id || "");
  const who = it.display_name || it.username || "Utilisateur";
  const kind = String(it.kind || "activity");
  const kindLabel = kind === "review" ? "a publie une review" : kind === "comment" ? "a commente" : "a ajoute a sa collection";
  const rating = typeof it.rating === "number" ? ` - ${it.rating}/5` : "";
  const text = String(it.text || "");
  const image = media.image || "";
  return `
    <article class="home-feed-item">
      <div class="home-feed-head">
        <div>
          <div class="home-feed-user">${escapeHtml(who)}</div>
          <div class="home-feed-action">${escapeHtml(kindLabel)}${escapeHtml(rating)}</div>
        </div>
        <button class="btn home-soft-btn" type="button">Suivre</button>
      </div>
      <a class="home-feed-body" href="${href}">
        <div class="home-feed-cover">${image ? `<img src="${image}" alt="">` : `<span class="badge">${escapeHtml(String(it.media_type || ""))}</span>`}</div>
        <div>
          <div class="news-title">${escapeHtml(media.name || it.media_id || "")}</div>
          <div class="news-sub">${escapeHtml(media.subtitle || "")}</div>
          ${text ? `<div class="news-text">${escapeHtml(text)}</div>` : ""}
        </div>
      </a>
      <div class="home-feed-meta">
        <span>♡ ${Math.max(12, text.length)}</span>
        <span>ðŸ’¬ ${Math.max(3, Math.floor((text.length || 10) / 14))}</span>
        <span>↗ Partager</span>
      </div>
    </article>
  `;
}

async function loadFollowingFeed() {
  const box = document.querySelector("#followingFeed");
  if (!box) return;

  if (HOME_FORCE_MOCK) {
    box.innerHTML = HOME_MOCK_FEED.map(renderFollowingFeedItem).join("");
    return;
  }

  if (!getTokens().accessToken) {
    box.innerHTML = HOME_MOCK_FEED.map(renderFollowingFeedItem).join("");
    return;
  }

  box.innerHTML = `<small>Chargement feed...</small>`;
  try {
    const data = await apiFetch("/feed/me?limit=12");
    const items = Array.isArray(data?.items) ? data.items : [];
    box.innerHTML = items.length
      ? items.map(renderFollowingFeedItem).join("")
      : HOME_MOCK_FEED.map(renderFollowingFeedItem).join("");
  } catch (err) {
    box.innerHTML = HOME_MOCK_FEED.map(renderFollowingFeedItem).join("");
    toast(err?.message || "Erreur feed", "Erreur");
  }
}

async function fillTrack(trackEl, { q, type = "track", limit = 10 }) {
  trackEl.innerHTML = `<small style="color:var(--muted)">Chargement Spotify...</small>`;
}

function fillCategoryTracksFromMap(categories, keys) {
  for (const key of keys) {
    const trackEl = document.querySelector(`.carousel-track[data-track="${key}"]`);
    if (!trackEl) continue;
    trackEl.innerHTML = "";
    (categories[key] || []).forEach((item) => trackEl.appendChild(makeTile(item)));
  }
}

async function loadMusicCategories() {
  const categoryKeys = ["trending", "rap", "afro", "pop"];
  const fallbackSearchByCategory = {
    trending: "Top hits",
    rap: "Rap francais",
    afro: "Afrobeats",
    pop: "Pop hits",
  };
  const toDisplayTracks = (list) =>
    (Array.isArray(list) ? list : []).filter((it) => {
      if (String(it?.type || "track") !== "track") return false;
      return Boolean(getOriginalTrackImage(it));
    });
  const setFeedModeHint = (text) => {
    const hintEl = document.querySelector("#sessionHint");
    if (!hintEl) return;
    const base = hintEl.textContent || "";
    const cleanBase = String(base).replace(/\s*\|\s*Mode:.*$/i, "").trim();
    hintEl.textContent = cleanBase ? `${cleanBase} | Mode: ${text}` : `Mode: ${text}`;
  };
  const ensureSpotifyConnectButton = () => {
    if (document.querySelector("#connectSpotifyBtn")) return;
    const heroRow = document.querySelector(".home-hero-actions");
    if (!heroRow) return;
    const btn = document.createElement("button");
    btn.id = "connectSpotifyBtn";
    btn.type = "button";
    btn.className = "btn home-soft-btn";
    btn.textContent = "Connecter Spotify";
    btn.addEventListener("click", async () => {
      try {
        const returnTo = window.location.origin + window.location.pathname;
        const data = await apiFetch(`/auth/oauth/spotify/url?returnTo=${encodeURIComponent(returnTo)}`);
        const url = String(data?.url || "");
        if (!url) throw new Error("URL OAuth Spotify manquante");
        window.location.href = url;
      } catch (err) {
        toast(err?.message || "Connexion Spotify impossible", "Erreur");
      }
    });
    heroRow.appendChild(btn);
  };
  for (const key of categoryKeys) {
    const trackEl = document.querySelector(`.carousel-track[data-track="${key}"]`);
    if (trackEl) fillTrack(trackEl, {});
  }

  if (HOME_FORCE_MOCK) {
    setFeedModeHint("mock visuel");
    fillCategoryTracksFromMap(HOME_MOCK_CATEGORIES, categoryKeys);
    return;
  }

  try {
    let data = null;
    let personalizedMode = false;
    const hasSupcontentSession = Boolean(getTokens().accessToken);
    let spotifyConnected = false;
    if (hasSupcontentSession) {
      try {
        const st = await apiFetch("/auth/spotify/status");
        spotifyConnected = Boolean(st?.connected);
      } catch {
        spotifyConnected = false;
      }
    }

    if (spotifyConnected) {
      try {
        data = await apiFetch("/music/personalized?limit=12");
        personalizedMode = true;
        setFeedModeHint("personnalis? Spotify");
      } catch (err) {
        console.warn("Personalized feed failed, fallback to global:", err);
        data = await apiFetch("/music/categories?limit=12");
        setFeedModeHint("global (fallback)");
      }
    } else {
      if (hasSupcontentSession) ensureSpotifyConnectButton();
      data = await apiFetch("/music/categories?limit=12");
      setFeedModeHint(hasSupcontentSession ? "global (Spotify non connect?)" : "global");
    }

    const categories = data?.categories || {};
    const trendingPool = toDisplayTracks(categories?.trending?.items);

    for (const key of categoryKeys) {
      const trackEl = document.querySelector(`.carousel-track[data-track="${key}"]`);
      if (!trackEl) continue;
      let items = toDisplayTracks(categories?.[key]?.items);
      if (!items.length && !personalizedMode) {
        try {
          const q = fallbackSearchByCategory[key] || "Top hits";
          const fallbackData = await apiFetch(
            `/search?q=${encodeURIComponent(q)}&type=track&page=1&limit=10`
          );
          const rawItems = Array.isArray(fallbackData?.tracks?.items)
            ? fallbackData.tracks.items
            : Array.isArray(fallbackData?.items)
              ? fallbackData.items
              : [];
          items = toDisplayTracks(rawItems);
        } catch {
          items = [];
        }
      }
      if (!items.length && personalizedMode) {
        try {
          const q = fallbackSearchByCategory[key] || "Top hits";
          const fallbackData = await apiFetch(
            `/search?q=${encodeURIComponent(q)}&type=track&page=1&limit=10`
          );
          const rawItems = Array.isArray(fallbackData?.tracks?.items)
            ? fallbackData.tracks.items
            : Array.isArray(fallbackData?.items)
              ? fallbackData.items
              : [];
          items = toDisplayTracks(rawItems);
        } catch {
          items = [];
        }
      }
      if (!items.length && key !== "trending" && !personalizedMode && trendingPool.length) {
        items = trendingPool.slice(0, 10);
      }
      trackEl.innerHTML = "";
      const finalItems = items.length ? items : (HOME_MOCK_CATEGORIES[key] || []);
      finalItems.forEach((it) => trackEl.appendChild(makeTile(it)));
    }
  } catch (err) {
    console.warn("Spotify categories en fallback mock:", err?.message || err);
    setFeedModeHint("fallback visuel");
    fillCategoryTracksFromMap(HOME_MOCK_CATEGORIES, categoryKeys);
  }
}

function enhanceCarousel(key) {
  const track = document.querySelector(`.carousel-track[data-track="${key}"]`);
  const prev = document.querySelector(`[data-car-prev="${key}"]`);
  const next = document.querySelector(`[data-car-next="${key}"]`);
  if (!track || track.dataset.enhanced === "1") return;
  track.dataset.enhanced = "1";

  if (prev) {
    prev.innerHTML = "&#9664;";
    prev.setAttribute("aria-label", "Pr?c?dent");
  }
  if (next) {
    next.innerHTML = "&#9654;";
    next.setAttribute("aria-label", "Suivant");
  }

  track.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      track.scrollBy({ left: e.deltaY, behavior: "smooth" });
    },
    { passive: false }
  );

  const step = () => Math.max(260, track.clientWidth * 0.8);
  if (prev) prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  if (next) next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));

  let timer = null;
  const advance = () => {
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    if (max <= 24) return;
    const atEnd = track.scrollLeft >= max - 4;
    if (atEnd) {
      track.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    track.scrollBy({ left: Math.max(240, track.clientWidth * 0.55), behavior: "smooth" });
  };
  const start = () => {
    if (timer) return;
    timer = setInterval(() => {
      advance();
    }, 2200);
  };
  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  track.addEventListener("mouseenter", stop);
  track.addEventListener("mouseleave", start);
  window.setTimeout(start, 900);
  window.setTimeout(advance, 1200);
}

function deferAfterPaint(task) {
  const run = () => {
    window.setTimeout(() => {
      Promise.resolve()
        .then(task)
        .catch((err) => console.warn("Deferred home task failed:", err?.message || err));
    }, 0);
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    return;
  }

  run();
}

async function main() {
  syncAuthUI();
  bindLogout();
  bindHomeHeaderActions();
  bindHomeNotifications();
  const refreshFeedBtn = document.querySelector("#refreshFeedBtn");
  if (refreshFeedBtn) {
    refreshFeedBtn.addEventListener("click", () => {
      loadFollowingFeed().catch((err) => toast(err?.message || "Erreur feed", "Erreur"));
    });
  }
  const refreshNewsBtn = document.querySelector("#refreshNewsBtn");
  if (refreshNewsBtn) {
    refreshNewsBtn.addEventListener("click", () => {
      loadMusicNews().catch((err) => toast(err?.message || "Erreur actualites", "Erreur"));
    });
  }

  const sections = ["trending", "rap", "afro", "pop"];
  for (const key of sections) enhanceCarousel(key);

  Promise.allSettled([
    loadStoriesFromFollowing(),
    loadFollowingFeed(),
    loadMusicNews(),
  ]).catch(() => null);

  deferAfterPaint(() => loadMusicCategories());
}

main();


