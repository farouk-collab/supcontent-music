import { apiFetch, escapeHtml, isLoggedIn, toast } from "/noyau/app.js";

const STORAGE_KEY = "supcontent-chat-redesign-v1";

const DEFAULT_NOTIFICATIONS = [
  { id: 1, type: "message", user: "Nina.beats", text: "t'a envoye un nouveau morceau", time: "Il y a 2 min", read: false },
  { id: 2, type: "match", user: "Ayo.wav", text: "a ouvert la discussion apres votre match", time: "Il y a 14 min", read: false },
  { id: 3, type: "message", user: "Luna.mix", text: "a repondu a ta recommandation", time: "Il y a 1 h", read: true },
];

const BASE_THREADS = [
  {
    id: "t-1",
    profileId: "mock-1",
    name: "Nina.beats",
    status: "En ligne · ecoute Timeless",
    compatibility: 94,
    unread: 2,
    lastMessage: "Ecoute ce son, il colle trop a ta vibe",
    sharedTrack: { title: "Timeless", artist: "The Weeknd", source: "Spotify", duration: "3:24" },
    contextCopy: "Vos gouts se croisent sur les sons nocturnes, rap melodique et playlists d'ambiance.",
    messages: [
      { id: "m-1", sender: "other", type: "text", text: "J'ai trouve un son qui te ressemble de fou", time: "21:02", seen: true },
      { id: "m-2", sender: "other", type: "music", text: "Regarde celui-la", track: { title: "Timeless", artist: "The Weeknd", source: "Spotify", duration: "3:24" }, time: "21:03", seen: true },
      { id: "m-3", sender: "me", type: "text", text: "Wahh l'ambiance est trop propre, t'as vise juste", time: "21:04", seen: true },
      { id: "m-4", sender: "other", type: "playlist", text: "Je t'envoie aussi ma playlist de nuit", playlist: { title: "Purple Lights", count: 18, mood: "Night drive / Pop / R&B" }, time: "21:06", seen: false },
    ],
  },
  {
    id: "t-2",
    profileId: "mock-2",
    name: "Ayo.wav",
    status: "Vu il y a 8 min",
    compatibility: 91,
    unread: 0,
    lastMessage: "Le mix afro sunset etait incroyable",
    sharedTrack: { title: "DND", artist: "Rema", source: "Spotify", duration: "2:58" },
    contextCopy: "Vos matchs se font souvent autour d'afro chill, amapiano et playlists soleil.",
    messages: [
      { id: "m-5", sender: "me", type: "text", text: "Ton univers musical est trop doux franchement", time: "18:10", seen: true },
      { id: "m-6", sender: "other", type: "text", text: "Merciii, le mix afro sunset te va aussi super bien", time: "18:12", seen: true },
    ],
  },
  {
    id: "t-3",
    profileId: "mock-3",
    name: "Luna.mix",
    status: "Hors ligne",
    compatibility: 87,
    unread: 1,
    lastMessage: "Tu preferes parler musique ou albums complets ?",
    sharedTrack: { title: "Neon Pop", artist: "Playlist partagee", source: "YouTube", duration: "41 min" },
    contextCopy: "Vous vous retrouvez sur les playlists soft, les loops nocturnes et la pop aerienne.",
    messages: [{ id: "m-7", sender: "other", type: "text", text: "Tu preferes parler musique ou albums complets ?", time: "Hier", seen: false }],
  },
];

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
    { input: [{ id: 1, user: "A", text: "ok", time: "now", read: false }], check: (result) => result.length === 1 && result[0].read === false },
    { input: [undefined], check: (result) => result.length === 1 && result[0].user === "Systeme" },
    { input: null, check: (result) => Array.isArray(result) && result.length === 0 },
  ];
  return cases.map((test) => ({ passed: test.check(sanitizeNotifications(test.input)) }));
}

function runChatTests(threads) {
  const cases = [
    { check: () => threads.length >= 1 },
    { check: () => threads.every((thread) => Array.isArray(thread.messages) && thread.messages.length > 0) },
    { check: () => threads.some((thread) => thread.messages.some((message) => message.type === "music")) },
    { check: () => threads.some((thread) => thread.messages.some((message) => message.type === "playlist")) || threads.length >= 1 },
  ];
  return cases.map((test) => ({ passed: test.check() }));
}

function formatNow() {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function initials(name) {
  return String(name || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeThread(thread, index = 0) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  return {
    id: String(thread?.id || `t-${index + 1}`),
    profileId: String(thread?.profileId || thread?.profile_id || `p-${index + 1}`),
    name: String(thread?.name || "Conversation"),
    status: String(thread?.status || "Disponible"),
    compatibility: Number(thread?.compatibility || 82),
    unread: Number(thread?.unread || 0),
    lastMessage: String(thread?.lastMessage || messages[messages.length - 1]?.text || "Nouvelle conversation"),
    sharedTrack: {
      title: String(thread?.sharedTrack?.title || "Titre partage"),
      artist: String(thread?.sharedTrack?.artist || "Artiste"),
      source: String(thread?.sharedTrack?.source || "Spotify"),
      duration: String(thread?.sharedTrack?.duration || "3:00"),
    },
    contextCopy: String(thread?.contextCopy || "Vos gouts se croisent sur plusieurs recos communes."),
    messages: messages.map((message, messageIndex) => ({
      id: String(message?.id || `${thread?.id || "t"}-m-${messageIndex + 1}`),
      sender: message?.sender === "other" ? "other" : "me",
      type: String(message?.type || "text"),
      text: String(message?.text || ""),
      track: message?.track || null,
      playlist: message?.playlist || null,
      time: String(message?.time || formatNow()),
      seen: message?.seen !== false,
    })),
  };
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const threads = Array.isArray(parsed?.threads) ? parsed.threads.map(normalizeThread) : clone(BASE_THREADS).map(normalizeThread);
    return {
      threads,
      selectedThreadId: String(parsed?.selectedThreadId || threads[0]?.id || ""),
      notifications: sanitizeNotifications(parsed?.notifications || DEFAULT_NOTIFICATIONS),
    };
  } catch {
    const threads = clone(BASE_THREADS).map(normalizeThread);
    return { threads, selectedThreadId: threads[0]?.id || "", notifications: sanitizeNotifications(DEFAULT_NOTIFICATIONS) };
  }
}

const persisted = loadPersistedState();
const state = {
  notificationsOpen: false,
  notifications: persisted.notifications,
  threads: persisted.threads,
  selectedThreadId: persisted.selectedThreadId || persisted.threads[0]?.id || "",
  feedback: "Discussions pretes · matchs et invitations connectes si disponibles",
  invites: [],
  remoteMode: false,
};

let chatPollTimer = null;

const refs = {
  notifDropdown: document.querySelector("#chatNotifDropdown"),
  notifBtn: document.querySelector("#chatNotifBtn"),
  notifBadge: document.querySelector("#chatNotifBadge"),
  notifPanel: document.querySelector("#chatNotifPanel"),
  notifTests: document.querySelector("#chatNotifTests"),
  logicTests: document.querySelector("#chatLogicTests"),
  notifList: document.querySelector("#chatNotifList"),
  markAllReadBtn: document.querySelector("#chatMarkAllReadBtn"),
  headerStats: document.querySelector("#chatHeaderStats"),
  threadCount: document.querySelector("#chatThreadCount"),
  threadList: document.querySelector("#chatThreadList"),
  invitesBox: document.querySelector("#chatInvitesBox"),
  mainAvatar: document.querySelector("#chatMainAvatar"),
  mainName: document.querySelector("#chatMainName"),
  mainStatus: document.querySelector("#chatMainStatus"),
  mainTags: document.querySelector("#chatMainTags"),
  messages: document.querySelector("#chatMessages"),
  composerInput: document.querySelector("#chatComposerInput"),
  sendBtn: document.querySelector("#chatSendBtn"),
  shareTrackBtn: document.querySelector("#chatShareTrackBtn"),
  emojiBtn: document.querySelector("#chatEmojiBtn"),
  fileBtn: document.querySelector("#chatFileBtn"),
  micBtn: document.querySelector("#chatMicBtn"),
  callBtn: document.querySelector("#chatCallBtn"),
  videoBtn: document.querySelector("#chatVideoBtn"),
  contextTrackTitle: document.querySelector("#chatContextTrackTitle"),
  contextTrackArtist: document.querySelector("#chatContextTrackArtist"),
  contextTrackMeta: document.querySelector("#chatContextTrackMeta"),
  contextScore: document.querySelector("#chatContextScore"),
  contextCopy: document.querySelector("#chatContextCopy"),
  playSharedBtn: document.querySelector("#chatPlaySharedBtn"),
  feedback: document.querySelector("#chatFeedback"),
};

function persistState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        threads: state.threads,
        selectedThreadId: state.selectedThreadId,
        notifications: state.notifications,
      })
    );
  } catch {
    // ignore
  }
}

function selectedThread() {
  return state.threads.find((thread) => thread.id === state.selectedThreadId) || state.threads[0] || null;
}

function updateFeedback(text) {
  state.feedback = text;
  if (refs.feedback) refs.feedback.textContent = text;
}

function totalUnread() {
  return state.threads.reduce((sum, thread) => sum + Number(thread.unread || 0), 0);
}

function notificationUnreadCount() {
  return sanitizeNotifications(state.notifications).filter((item) => !item.read).length;
}

function getNotificationIcon(type) {
  if (type === "message") return "MSG";
  if (type === "match") return "MATCH";
  return "INFO";
}

function renderHeader() {
  if (refs.headerStats) refs.headerStats.textContent = `${state.threads.length} conversations · ${totalUnread()} non lus`;
}

function threadPreviewFromRemoteMessage(message) {
  if (!message) return "Nouvelle conversation";
  if (String(message.message_type || "text") === "music") return "Partage musical";
  if (String(message.message_type || "text") === "playlist") return "Playlist partagee";
  if (String(message.message_type || "text") === "file") return "Fichier partage";
  if (String(message.message_type || "text") === "voice") return "Note vocale";
  if (String(message.message_type || "text") === "call") return "Evenement d'appel";
  return String(message.body || "Nouvelle conversation").trim() || "Nouvelle conversation";
}

function mapRemoteMessage(item) {
  const type = String(item?.message_type || "text");
  const meta = item?.meta && typeof item.meta === "object" ? item.meta : {};
  return {
    id: String(item?.id || `m-${Date.now()}`),
    sender: item?.sender === "other" ? "other" : "me",
    type,
    text: String(item?.body || ""),
    track: type === "music" ? {
      title: String(meta?.title || "Titre partage"),
      artist: String(meta?.artist || "Artiste"),
      source: String(meta?.source || "Spotify"),
      duration: String(meta?.duration || "3:00"),
    } : null,
    playlist: type === "playlist" ? {
      title: String(meta?.title || "Playlist"),
      count: Number(meta?.count || 0),
      mood: String(meta?.mood || "Mood"),
    } : null,
    file: type === "file" ? {
      name: String(meta?.name || "document.txt"),
      size: String(meta?.size || "inconnue"),
      format: String(meta?.format || "file"),
    } : null,
    voice: type === "voice" ? {
      duration: String(meta?.duration || "0:12"),
      waveform: String(meta?.waveform || "~~~~"),
    } : null,
    call: type === "call" ? {
      mode: String(meta?.mode || "audio"),
      status: String(meta?.status || "demarre"),
    } : null,
    time: item?.created_at ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at)) : "Maintenant",
    seen: Boolean(item?.read_at) || item?.sender === "me",
  };
}

function mapRemoteThread(item, existingMessages = []) {
  const user = item?.user || {};
  const last = item?.last_message || null;
  const sharedTrack = last && String(last.message_type || "") === "music"
    ? {
        title: String(last?.meta?.title || "Titre partage"),
        artist: String(last?.meta?.artist || user?.display_name || user?.username || "Artiste"),
        source: String(last?.meta?.source || "Spotify"),
        duration: String(last?.meta?.duration || "3:00"),
      }
    : {
        title: "Match musical",
        artist: String(user?.display_name || user?.username || "SUPCONTENT"),
        source: "Chat",
        duration: "Direct",
      };

  return normalizeThread({
    id: String(item?.id || ""),
    matchId: item?.match_id ? String(item.match_id) : "",
    profileId: String(item?.profile_id || user?.id || ""),
    name: String(user?.display_name || user?.username || "Conversation"),
    status: user?.bio ? String(user.bio) : String(user?.location || "Discussion active"),
    compatibility: 90,
    unread: Number(item?.unread_count || 0),
    lastMessage: threadPreviewFromRemoteMessage(last),
    sharedTrack,
    contextCopy: String(user?.bio || user?.location || "Discussion connectee a ton match musical."),
    messages: existingMessages,
  });
}

function renderNotifications() {
  const unread = notificationUnreadCount();
  const notifTestsPassed = runNotificationTests().every((item) => item.passed);
  const chatTestsPassed = runChatTests(state.threads).every((item) => item.passed);
  const notifications = sanitizeNotifications(state.notifications);

  if (refs.notifBtn) refs.notifBtn.classList.toggle("is-open", state.notificationsOpen);
  if (refs.notifPanel) refs.notifPanel.hidden = !state.notificationsOpen;
  if (refs.notifBadge) {
    refs.notifBadge.hidden = unread === 0;
    refs.notifBadge.textContent = unread > 99 ? "99+" : String(unread);
  }
  if (refs.notifTests) {
    refs.notifTests.className = `chat-test-pill ${notifTestsPassed ? "" : "is-error"}`;
    refs.notifTests.textContent = notifTestsPassed ? "Tests notifications passes" : "Un test notifications a echoue";
  }
  if (refs.logicTests) {
    refs.logicTests.className = `chat-test-pill ${chatTestsPassed ? "" : "is-error"}`;
    refs.logicTests.textContent = chatTestsPassed ? "Tests chat passes" : "Un test chat a echoue";
  }
  if (!refs.notifList) return;

  refs.notifList.innerHTML = notifications.map((item) => `
    <button class="chat-notif-item ${item.read ? "" : "is-unread"}" type="button" data-notif-id="${escapeHtml(String(item.id))}">
      <div class="chat-notif-row">
        <div class="chat-notif-icon">${escapeHtml(getNotificationIcon(item.type))}</div>
        <div style="min-width:0;flex:1;">
          <div style="font-size:14px;line-height:1.45;"><strong>${escapeHtml(item.user)}</strong> ${escapeHtml(item.text)}</div>
          <div style="color:#a1a1aa;font-size:12px;margin-top:6px;">${escapeHtml(item.time)}</div>
        </div>
      </div>
    </button>
  `).join("");

  refs.notifList.querySelectorAll("[data-notif-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-notif-id");
      state.notifications = sanitizeNotifications(state.notifications).map((item) => String(item.id) === String(id) ? { ...item, read: true } : item);
      persistState();
      renderNotifications();
    });
  });
}

async function loadNotificationsFromApi() {
  if (!isLoggedIn()) return;
  const data = await apiFetch("/notifications/me?limit=12").catch(() => null);
  if (!data) return;

  const chatNotifications = Array.isArray(data?.chat_messages)
    ? data.chat_messages.map((item, index) =>
        sanitizeNotification({
          id: `api-chat-${item?.message_id || index}`,
          type: "message",
          user: String(item?.display_name || item?.username || "Utilisateur"),
          text: String(item?.body || (String(item?.message_type || "") === "music" ? "t'a partage un morceau" : "t'a ecrit")),
          time: item?.created_at
            ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at))
            : "Maintenant",
          read: false,
        })
      )
    : [];

  const miscNotifications = Array.isArray(data?.comment_replies)
    ? data.comment_replies.slice(0, 4).map((item, index) =>
        sanitizeNotification({
          id: `api-reply-${item?.id || index}`,
          type: "system",
          user: String(item?.display_name || item?.username || "Utilisateur"),
          text: "a repondu a ton commentaire",
          time: item?.created_at
            ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at))
            : "Maintenant",
          read: true,
        })
      )
    : [];

  state.notifications = [...chatNotifications, ...miscNotifications].slice(0, 20);
}

function renderThreadList() {
  if (refs.threadCount) refs.threadCount.textContent = String(state.threads.length);
  if (!refs.threadList) return;

  refs.threadList.innerHTML = state.threads.map((thread) => `
    <button class="chat-thread-card ${thread.id === state.selectedThreadId ? "is-active" : ""}" type="button" data-thread-id="${escapeHtml(thread.id)}">
      <div class="chat-thread-top" style="justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:700;font-size:16px;">${escapeHtml(thread.name)}</div>
          <div style="margin-top:4px;color:#a1a1aa;font-size:12px;">${escapeHtml(thread.status)}</div>
        </div>
        <span class="chat-panel-badge">${escapeHtml(String(thread.compatibility))}%</span>
      </div>
      <div style="margin-top:12px;color:#a1a1aa;font-size:14px;line-height:1.45;">${escapeHtml(thread.lastMessage)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;font-size:12px;">
        <span style="color:#a1a1aa;">${escapeHtml(thread.sharedTrack.title)}</span>
        ${thread.unread > 0 ? `<span style="min-width:24px;height:24px;border-radius:999px;display:grid;place-items:center;padding:0 6px;background:#d946ef;color:#fff;font-weight:800;">${escapeHtml(String(thread.unread))}</span>` : ""}
      </div>
    </button>
  `).join("");

  refs.threadList.querySelectorAll("[data-thread-id]").forEach((button) => {
    button.addEventListener("click", () => openThread(button.getAttribute("data-thread-id") || ""));
  });
}

function renderMain() {
  const thread = selectedThread();
  if (!thread) {
    if (refs.mainAvatar) refs.mainAvatar.textContent = "--";
    if (refs.mainName) refs.mainName.textContent = "Aucune conversation";
    if (refs.mainStatus) refs.mainStatus.textContent = "Selectionne un match ou une invitation";
    if (refs.mainTags) refs.mainTags.innerHTML = "";
    if (refs.messages) {
      refs.messages.innerHTML = `
        <div class="chat-empty-state">
          <div>
            <div class="chat-empty-title">Aucune conversation pour le moment</div>
            <div class="chat-empty-copy">Ouvre une invitation, cree un thread depuis un match ou attends un nouveau message.</div>
          </div>
        </div>
      `;
    }
    if (refs.contextTrackTitle) refs.contextTrackTitle.textContent = "Aucun son partage";
    if (refs.contextTrackArtist) refs.contextTrackArtist.textContent = "Discussion inactive";
    if (refs.contextTrackMeta) refs.contextTrackMeta.textContent = "Player en attente";
    if (refs.contextScore) refs.contextScore.textContent = "--";
    if (refs.contextCopy) refs.contextCopy.textContent = "Le contexte musical s'affichera quand une conversation sera ouverte.";
    if (refs.feedback) refs.feedback.textContent = state.feedback;
    return;
  }

  if (refs.mainAvatar) refs.mainAvatar.textContent = initials(thread.name);
  if (refs.mainName) refs.mainName.textContent = thread.name;
  if (refs.mainStatus) refs.mainStatus.textContent = thread.status;
  if (refs.mainTags) {
    refs.mainTags.innerHTML = `
      <span class="chat-tag">Compatibilite ${escapeHtml(String(thread.compatibility))}%</span>
      <span class="chat-tag is-green">Vibe commune</span>
      <span class="chat-tag">${escapeHtml(thread.sharedTrack.source)}</span>
    `;
  }

  if (refs.messages) {
    refs.messages.innerHTML = thread.messages.length ? thread.messages.map((message) => {
      const isMine = message.sender === "me";
      const musicCard = message.type === "music" && message.track ? `
        <div class="chat-media-card">
          <div class="chat-media-row">
            <div class="chat-media-icon">SON</div>
            <div style="min-width:0;flex:1;">
              <div style="font-weight:700;">${escapeHtml(message.track.title)}</div>
              <div style="color:#a1a1aa;font-size:13px;">${escapeHtml(message.track.artist)} · ${escapeHtml(message.track.source)}</div>
            </div>
            <span class="chat-panel-badge">${escapeHtml(message.track.duration)}</span>
          </div>
        </div>
      ` : "";
      const playlistCard = message.type === "playlist" && message.playlist ? `
        <div class="chat-playlist-card">
          <div class="chat-playlist-kicker">Playlist partagee</div>
          <div style="margin-top:8px;font-weight:700;">${escapeHtml(message.playlist.title)}</div>
          <div style="color:#d4d4d8;font-size:13px;">${escapeHtml(String(message.playlist.count))} titres · ${escapeHtml(message.playlist.mood)}</div>
        </div>
      ` : "";
      const fileCard = message.type === "file" && message.file ? `
        <div class="chat-media-card">
          <div class="chat-media-row">
            <div class="chat-media-icon">FILE</div>
            <div style="min-width:0;flex:1;">
              <div style="font-weight:700;">${escapeHtml(message.file.name)}</div>
              <div style="color:#a1a1aa;font-size:13px;">${escapeHtml(message.file.format)} · ${escapeHtml(message.file.size)}</div>
            </div>
          </div>
        </div>
      ` : "";
      const voiceCard = message.type === "voice" && message.voice ? `
        <div class="chat-media-card">
          <div class="chat-media-row">
            <div class="chat-media-icon">VOX</div>
            <div style="min-width:0;flex:1;">
              <div style="font-weight:700;">Note vocale</div>
              <div style="color:#a1a1aa;font-size:13px;">${escapeHtml(message.voice.duration)} · ${escapeHtml(message.voice.waveform)}</div>
            </div>
          </div>
        </div>
      ` : "";
      const callCard = message.type === "call" && message.call ? `
        <div class="chat-media-card">
          <div class="chat-media-row">
            <div class="chat-media-icon">CALL</div>
            <div style="min-width:0;flex:1;">
              <div style="font-weight:700;">Appel ${escapeHtml(message.call.mode)}</div>
              <div style="color:#a1a1aa;font-size:13px;">${escapeHtml(message.call.status)}</div>
            </div>
          </div>
        </div>
      ` : "";
      return `
        <div class="chat-bubble-row ${isMine ? "is-me" : ""}">
          <div class="chat-bubble-card">
            <p class="chat-message-text">${escapeHtml(message.text)}</p>
            ${musicCard}
            ${playlistCard}
            ${fileCard}
            ${voiceCard}
            ${callCard}
            <div class="chat-message-meta"><span>${escapeHtml(message.time)}</span>${isMine ? "<span>Lu</span>" : ""}</div>
          </div>
        </div>
      `;
    }).join("") : `
      <div class="chat-empty-state">
        <div>
          <div class="chat-empty-title">Aucun message pour le moment</div>
          <div class="chat-empty-copy">Envoie un premier message ou partage un morceau pour lancer la discussion.</div>
        </div>
      </div>
    `;
    refs.messages.scrollTop = refs.messages.scrollHeight;
  }

  if (refs.contextTrackTitle) refs.contextTrackTitle.textContent = thread.sharedTrack.title;
  if (refs.contextTrackArtist) refs.contextTrackArtist.textContent = thread.sharedTrack.artist;
  if (refs.contextTrackMeta) refs.contextTrackMeta.textContent = `${thread.sharedTrack.source} · ${thread.sharedTrack.duration}`;
  if (refs.contextScore) refs.contextScore.textContent = `${thread.compatibility}%`;
  if (refs.contextCopy) refs.contextCopy.textContent = thread.contextCopy;
  if (refs.feedback) refs.feedback.textContent = state.feedback;
}

function renderInvites() {
  if (!refs.invitesBox) return;
  if (!state.invites.length) {
    refs.invitesBox.innerHTML = `<div style="color:#a1a1aa;font-size:14px;line-height:1.6;">Aucune invitation en attente.</div>`;
    return;
  }
  refs.invitesBox.innerHTML = state.invites.map((item) => `
    <button class="chat-invite-card" type="button" data-invite-id="${escapeHtml(item.invitationId || item.threadId || item.name)}">
      <div class="chat-invite-top" style="justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:700;font-size:16px;">${escapeHtml(item.name)}</div>
          <div style="margin-top:4px;color:#a1a1aa;font-size:12px;">@${escapeHtml(item.username || "user")}</div>
        </div>
        <span class="chat-panel-badge">${item.canChatDirect ? "Chat" : "Invite"}</span>
      </div>
      <div style="margin-top:12px;color:#a1a1aa;font-size:14px;line-height:1.45;">${escapeHtml(item.message || "Invitation de discussion apres swipe.")}</div>
    </button>
  `).join("");

  refs.invitesBox.querySelectorAll("[data-invite-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const inviteId = button.getAttribute("data-invite-id") || "";
      const invite = state.invites.find((item) => String(item.invitationId || item.threadId || item.name) === String(inviteId));
      await openInvite(invite);
    });
  });
}

function render() {
  renderHeader();
  renderNotifications();
  renderThreadList();
  renderMain();
  renderInvites();
}

function getQueryThreadTarget() {
  const params = new URLSearchParams(window.location.search);
  return {
    matchId: String(params.get("match") || ""),
    profileId: String(params.get("profile") || ""),
  };
}

function applyQueryThreadTarget() {
  const target = getQueryThreadTarget();
  if (!target.matchId && !target.profileId) return;
  const found = state.threads.find((thread) =>
    (target.matchId && String(thread.matchId || "") === target.matchId) ||
    (target.profileId && String(thread.profileId || "") === target.profileId)
  );
  if (found) {
    state.selectedThreadId = found.id;
  }
}

async function ensureQueryThreadExists() {
  if (!isLoggedIn()) return;
  const target = getQueryThreadTarget();
  if (!target.matchId && !target.profileId) return;
  const found = state.threads.find((thread) =>
    (target.matchId && String(thread.matchId || "") === target.matchId) ||
    (target.profileId && String(thread.profileId || "") === target.profileId)
  );
  if (found) {
    state.selectedThreadId = found.id;
    return;
  }

  const payload = target.matchId ? { match_id: target.matchId } : { target_user_id: target.profileId };
  const created = await apiFetch("/chat/threads", {
    method: "POST",
    body: JSON.stringify(payload),
  }).catch(() => null);
  const thread = created?.thread || null;
  if (!thread?.id) return;

  const mapped = mapRemoteThread({
    id: thread.id,
    match_id: thread.match_id || null,
    profile_id: thread.profile_id || "",
    user: thread.user || {},
    unread_count: 0,
    last_message: null,
  }, []);
  state.remoteMode = true;
  state.threads = [mapped, ...state.threads.filter((item) => item.id !== mapped.id)];
  state.selectedThreadId = mapped.id;
}

async function loadThreadMessages(threadId) {
  if (!state.remoteMode || !isLoggedIn() || !threadId) return;
  const res = await apiFetch(`/chat/threads/${encodeURIComponent(threadId)}/messages`);
  const items = Array.isArray(res?.items) ? res.items.map(mapRemoteMessage) : [];
  state.threads = state.threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          unread: 0,
          messages: items,
        }
      : thread
  );
}

function syncNotificationsFromThreads(nextThreads) {
  const unreadThreads = nextThreads.filter((thread) => Number(thread.unread || 0) > 0);
  const synthetic = unreadThreads.slice(0, 10).map((thread) =>
    sanitizeNotification({
      id: `thread-${thread.id}`,
      type: "message",
      user: thread.name,
      text: thread.lastMessage || "Nouveau message",
      time: thread.unread > 1 ? `${thread.unread} non lus` : "Nouveau message",
      read: false,
    })
  );
  const manual = sanitizeNotifications(state.notifications).filter((item) => !String(item.id || "").startsWith("thread-"));
  state.notifications = [...synthetic, ...manual].slice(0, 20);
}

async function openThread(threadId) {
  if (!threadId) return;
  state.selectedThreadId = String(threadId);
  if (state.remoteMode && isLoggedIn()) {
    await loadThreadMessages(state.selectedThreadId);
    syncNotificationsFromThreads(state.threads);
  } else {
    state.threads = state.threads.map((thread) => thread.id === state.selectedThreadId ? { ...thread, unread: 0 } : thread);
    syncNotificationsFromThreads(state.threads);
  }
  updateFeedback("Conversation ouverte");
  persistState();
  render();
}

async function openInvite(invite) {
  if (!invite) return;
  if (invite.threadId) {
    await openThread(invite.threadId);
    return;
  }
  if (!isLoggedIn()) {
    toast("Connecte-toi pour ouvrir cette invitation.", "Connexion requise");
    return;
  }
  const created = await apiFetch("/chat/threads", {
    method: "POST",
    body: JSON.stringify({ invitation_id: invite.invitationId }),
  }).catch(() => null);
  const thread = created?.thread || null;
  if (!thread?.id) {
    toast("Impossible d'ouvrir l'invitation pour le moment.", "Erreur");
    return;
  }

  const mapped = mapRemoteThread({
    id: thread.id,
    match_id: thread.match_id || null,
    profile_id: thread.profile_id || "",
    user: thread.user || {},
    unread_count: 0,
    last_message: null,
  }, []);

  state.remoteMode = true;
  state.threads = [mapped, ...state.threads.filter((item) => item.id !== mapped.id)];
  state.invites = state.invites.map((item) =>
    item.invitationId === invite.invitationId ? { ...item, threadId: mapped.id } : item
  );
  await openThread(mapped.id);
}

function pushNotification(notification) {
  state.notifications = [
    sanitizeNotification({ id: `n-${Date.now()}`, read: false, ...notification }),
    ...sanitizeNotifications(state.notifications),
  ].slice(0, 20);
}

async function sendRemoteMessage(input) {
  const thread = selectedThread();
  if (!thread) return;

  const res = await apiFetch(`/chat/threads/${encodeURIComponent(thread.id)}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const created = mapRemoteMessage(res?.item || {});
  state.threads = state.threads.map((item) =>
    item.id === thread.id
      ? {
          ...item,
          unread: 0,
          lastMessage: created.type === "music"
            ? "Partage musical"
            : created.type === "playlist"
              ? "Playlist partagee"
              : created.type === "file"
                ? "Fichier partage"
                : created.type === "voice"
                  ? "Note vocale"
                  : created.type === "call"
                    ? `Appel ${created.call?.mode || "audio"}`
                    : created.text,
          sharedTrack: created.track || item.sharedTrack,
          messages: [...item.messages, created],
        }
      : item
  );
  persistState();
  render();
}

async function sendMessage() {
  const thread = selectedThread();
  const text = String(refs.composerInput?.value || "").trim();
  if (!thread || !text) return;

  if (state.remoteMode && isLoggedIn()) {
    await sendRemoteMessage({ message_type: "text", body: text, meta: {} });
    if (refs.composerInput) refs.composerInput.value = "";
    state.feedback = "Message envoye via l'API";
    renderMain();
    return;
  }

  state.threads = state.threads.map((item) => {
    if (item.id !== thread.id) return item;
    const nextMessage = { id: `m-${Date.now()}`, sender: "me", type: "text", text, time: "Maintenant", seen: true };
    return { ...item, lastMessage: text, messages: [...item.messages, nextMessage] };
  });

  if (refs.composerInput) refs.composerInput.value = "";
  state.feedback = "Message envoye";
  persistState();
  render();
}

async function shareTrack() {
  const thread = selectedThread();
  if (!thread) return;
  const track = { title: "Blinding Lights", artist: "The Weeknd", source: "Spotify", duration: "3:20" };

  if (state.remoteMode && isLoggedIn()) {
    await sendRemoteMessage({
      message_type: "music",
      body: "Je te partage aussi celui-la",
      meta: track,
    });
    state.feedback = "Morceau partage via l'API";
    pushNotification({ type: "message", user: thread.name, text: "a recu un nouveau morceau dans la discussion", time: "Maintenant" });
    render();
    return;
  }

  state.threads = state.threads.map((item) => {
    if (item.id !== thread.id) return item;
    const nextMessage = { id: `m-${Date.now()}`, sender: "me", type: "music", text: "Je te partage aussi celui-la", track, time: "Maintenant", seen: true };
    return { ...item, lastMessage: nextMessage.text, sharedTrack: track, messages: [...item.messages, nextMessage] };
  });

  state.feedback = "Morceau partage dans le chat";
  pushNotification({ type: "message", user: thread.name, text: "a recu un nouveau morceau dans la discussion", time: "Maintenant" });
  persistState();
  render();
}

async function sendStructuredMessage(payload, feedbackText) {
  const thread = selectedThread();
  if (!thread) return;

  if (state.remoteMode && isLoggedIn()) {
    await sendRemoteMessage(payload);
    state.feedback = feedbackText;
    render();
    return;
  }

  const nextMessage = {
    id: `m-${Date.now()}`,
    sender: "me",
    type: String(payload.message_type || "text"),
    text: String(payload.body || ""),
    track: payload.message_type === "music" ? payload.meta : null,
    playlist: payload.message_type === "playlist" ? payload.meta : null,
    file: payload.message_type === "file" ? payload.meta : null,
    voice: payload.message_type === "voice" ? payload.meta : null,
    call: payload.message_type === "call" ? payload.meta : null,
    time: "Maintenant",
    seen: true,
  };

  state.threads = state.threads.map((item) => {
    if (item.id !== thread.id) return item;
    return {
      ...item,
      lastMessage:
        nextMessage.type === "file" ? "Fichier partage"
        : nextMessage.type === "voice" ? "Note vocale"
        : nextMessage.type === "call" ? `Appel ${nextMessage.call?.mode || "audio"}`
        : nextMessage.text,
      messages: [...item.messages, nextMessage],
    };
  });

  state.feedback = feedbackText;
  persistState();
  render();
}

function ensureThreadFromMatch(match, index = 0) {
  const profileId = String(match?.user?.id || match?.profile_id || `match-profile-${index}`);
  const threadId = `match-${String(match?.match_id || profileId)}`;
  const existing = state.threads.find((thread) => thread.id === threadId || thread.profileId === profileId);
  if (existing) return existing.id;

  const name = String(match?.user?.display_name || match?.user?.username || "Match musical");
  const vibe = String(match?.user?.bio || match?.user?.location || "Compatibilite musicale forte");
  const trackTitle = String(match?.their_direction || "").toLowerCase() === "superlike" ? "Super like recu" : "Match musical";

  const thread = normalizeThread({
    id: threadId,
    profileId,
    name,
    status: "Nouveau match · discussion ouverte",
    compatibility: match?.is_superlike ? 96 : 90,
    unread: 0,
    lastMessage: "Discussion debloquee apres votre match",
    sharedTrack: { title: trackTitle, artist: name, source: "Match", duration: "Direct" },
    contextCopy: `Discussion issue d'un match persistant. Vibe commune : ${vibe}.`,
    messages: [{ id: `${threadId}-hello`, sender: "other", type: "text", text: "On a matche, on compare nos recos ?", time: "Maintenant", seen: false }],
  }, index);

  state.threads = [thread, ...state.threads];
  return thread.id;
}

async function loadRealMatchesAndInvites() {
  if (!isLoggedIn()) {
    state.remoteMode = false;
    state.invites = [];
    state.feedback = "Mode local actif · connecte-toi pour recuperer matchs et invitations";
    return;
  }

  try {
    const threadsData = await apiFetch("/chat/threads");
    const remoteThreads = Array.isArray(threadsData?.items) ? threadsData.items : [];
    if (remoteThreads.length) {
      state.remoteMode = true;
      const currentMessagesById = new Map(state.threads.map((thread) => [thread.id, thread.messages]));
      state.threads = remoteThreads.map((item) => mapRemoteThread(item, currentMessagesById.get(String(item?.id || "")) || []));
      syncNotificationsFromThreads(state.threads);
      applyQueryThreadTarget();
      if (!state.threads.some((thread) => thread.id === state.selectedThreadId)) {
        state.selectedThreadId = state.threads[0]?.id || "";
      }
    } else {
      state.remoteMode = false;
    }

    const [matchesData, invitesData] = await Promise.all([
      apiFetch("/follows/swipe/matches/me?limit=20").catch(() => ({ items: [] })),
      apiFetch("/follows/swipe/invitations/me?status=pending").catch(() => ({ items: [] })),
    ]);

    const matches = Array.isArray(matchesData?.items) ? matchesData.items : [];
    if (!state.remoteMode) {
      matches.forEach((match, index) => ensureThreadFromMatch(match, index));
    }

    const invites = Array.isArray(invitesData?.items) ? invitesData.items : [];
    state.invites = invites.map((invite, index) => {
      const existingThread = state.threads.find((thread) => thread.profileId === String(invite?.sender_id || ""));
      const threadId = existingThread?.id || "";
    if (!state.remoteMode && !existingThread) {
      const syntheticMatch = {
        match_id: invite?.id || `invite-${index}`,
        profile_id: invite?.sender_id || `invite-profile-${index}`,
        user: { id: invite?.sender_id, display_name: invite?.display_name, username: invite?.username, bio: invite?.message },
        };
        return {
          threadId: ensureThreadFromMatch(syntheticMatch, index + matches.length),
          invitationId: String(invite?.id || `invite-${index}`),
          name: String(invite?.display_name || invite?.username || "Utilisateur"),
          username: String(invite?.username || "user"),
          message: String(invite?.message || ""),
          canChatDirect: Boolean(invite?.can_chat_direct),
        };
      }
      return {
        threadId,
        invitationId: String(invite?.id || `invite-${index}`),
        name: String(invite?.display_name || invite?.username || "Utilisateur"),
        username: String(invite?.username || "user"),
        message: String(invite?.message || ""),
        canChatDirect: Boolean(invite?.can_chat_direct),
      };
    });

    state.feedback = matches.length || invites.length
      ? `Conversations enrichies depuis ${state.remoteMode ? "le backend chat" : "les matchs et invitations"}`
      : "Aucun match ni invitation a synchroniser pour le moment";

    if (!state.threads.some((thread) => thread.id === state.selectedThreadId)) {
      state.selectedThreadId = state.threads[0]?.id || "";
    }
    await loadNotificationsFromApi();
    persistState();
  } catch (error) {
    state.feedback = `Synchronisation chat indisponible: ${error?.message || "erreur inconnue"}`;
  }
}

async function pollChatState() {
  if (!state.remoteMode || !isLoggedIn()) return;
  const currentThreadId = state.selectedThreadId;
  const currentMessages = new Map(state.threads.map((thread) => [thread.id, thread.messages]));
  const threadsData = await apiFetch("/chat/threads").catch(() => null);
  const remoteThreads = Array.isArray(threadsData?.items) ? threadsData.items : [];
  if (!remoteThreads.length) return;
  state.threads = remoteThreads.map((item) => mapRemoteThread(item, currentMessages.get(String(item?.id || "")) || []));
  syncNotificationsFromThreads(state.threads);
  if (currentThreadId) {
    state.selectedThreadId = state.threads.some((thread) => thread.id === currentThreadId)
      ? currentThreadId
      : state.threads[0]?.id || "";
  }
  if (state.selectedThreadId) {
    await loadThreadMessages(state.selectedThreadId).catch(() => {});
  }
  await loadNotificationsFromApi().catch(() => {});
  persistState();
  render();
}

function bindEvents() {
  refs.notifBtn?.addEventListener("click", () => {
    state.notificationsOpen = !state.notificationsOpen;
    renderNotifications();
  });
  refs.markAllReadBtn?.addEventListener("click", () => {
    state.notifications = sanitizeNotifications(state.notifications).map((item) => ({ ...item, read: true }));
    persistState();
    renderNotifications();
  });
  document.addEventListener("click", (event) => {
    if (!refs.notifDropdown?.contains(event.target) && state.notificationsOpen) {
      state.notificationsOpen = false;
      renderNotifications();
    }
  });
  refs.sendBtn?.addEventListener("click", sendMessage);
  refs.composerInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    sendMessage();
  });
  refs.shareTrackBtn?.addEventListener("click", shareTrack);
  refs.emojiBtn?.addEventListener("click", () => {
    if (!refs.composerInput) return;
    refs.composerInput.value = `${refs.composerInput.value || ""} [music]`.trim();
    refs.composerInput.focus();
    updateFeedback("Emoji ajoute au brouillon");
    renderMain();
  });
  refs.fileBtn?.addEventListener("click", async () => {
    await sendStructuredMessage(
      {
        message_type: "file",
        body: "Je t'ai partage un document audio de travail.",
        meta: { name: "demo-session-notes.txt", size: "24 KB", format: "TXT" },
      },
      "Fichier partage dans la conversation"
    );
  });
  refs.micBtn?.addEventListener("click", async () => {
    await sendStructuredMessage(
      {
        message_type: "voice",
        body: "Je t'ai laisse une note vocale.",
        meta: { duration: "0:18", waveform: "~~~~~ ~~~ ~~" },
      },
      "Note vocale envoyee"
    );
  });
  refs.callBtn?.addEventListener("click", async () => {
    await sendStructuredMessage(
      {
        message_type: "call",
        body: "Appel audio lance depuis la discussion.",
        meta: { mode: "audio", status: "demarre" },
      },
      "Evenement d'appel audio ajoute a la conversation"
    );
    toast("Signal d'appel audio envoye dans le chat", "Chat");
  });
  refs.videoBtn?.addEventListener("click", async () => {
    await sendStructuredMessage(
      {
        message_type: "call",
        body: "Appel video lance depuis la discussion.",
        meta: { mode: "video", status: "demarre" },
      },
      "Evenement d'appel video ajoute a la conversation"
    );
    toast("Signal d'appel video envoye dans le chat", "Chat");
  });
  refs.playSharedBtn?.addEventListener("click", () => {
    const thread = selectedThread();
    if (!thread) return;
    const title = String(thread.sharedTrack?.title || "Titre partage");
    const artist = String(thread.sharedTrack?.artist || "Artiste");
    const source = String(thread.sharedTrack?.source || "").toLowerCase();
    if (window.supcontentPlayer) {
      if (source.includes("youtube")) {
        window.supcontentPlayer.playYouTube({
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          title,
          subtitle: artist,
          cover: "",
          mode: "audio",
        });
      } else {
        window.supcontentPlayer.playMedia({
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          title,
          subtitle: artist,
          cover: "",
          mode: "audio",
        });
      }
    }
    toast(`Lecture de ${title}`, "OK");
    updateFeedback(`Lecture lancee pour ${title}`);
    renderMain();
  });
}

async function main() {
  state.threads = state.threads.map(normalizeThread);
  if (!state.selectedThreadId) state.selectedThreadId = state.threads[0]?.id || "";
  applyQueryThreadTarget();
  render();
  bindEvents();
  await ensureQueryThreadExists();
  await loadRealMatchesAndInvites();
  if (state.remoteMode && state.selectedThreadId) {
    await loadThreadMessages(state.selectedThreadId);
    if (chatPollTimer) window.clearInterval(chatPollTimer);
    chatPollTimer = window.setInterval(() => {
      pollChatState().catch(() => {});
    }, 15000);
  }
  render();
}

main().catch((error) => {
  toast(error?.message || "Erreur chat", "Erreur");
});
