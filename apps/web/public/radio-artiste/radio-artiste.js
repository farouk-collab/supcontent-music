import { apiFetch, escapeHtml, requireLogin, toast } from "/noyau/app.js";

const FALLBACK_LIVE_ROOMS = [
  {
    id: "live-1",
    title: "Afro Night Session",
    host: "Ayo.wav",
    host_verified: true,
    host_user_id: null,
    category: "Live DJ Set",
    listeners: 1842,
    likes: 12300,
    type: "video",
    track: "Afro Sunset - Live Edit",
    tags: ["Afro", "Live", "Dance"],
    gradient_key: "emerald-fuchsia",
    captions_text: "Bienvenue dans la room, on monte en energie dans 20 secondes.",
    comments: [
      { id: "m1", author: "nina.beats", text: "Le live est incroyable" },
      { id: "m2", author: "daxwritz", text: "La transition est trop propre" },
      { id: "m3", author: "temsdaily", text: "On veut la playlist apres" },
      { id: "m4", author: "ayo.wav", text: "Le drop arrive dans 20 secondes" },
    ],
    queue: ["Ayo.wav", "Nina Beats", "DJ Nova"],
    moments: ["Drop a 12:40", "Guest annonce", "Nouveau son exclusif"],
    membership: {
      joined: false,
      liked: false,
      gift_sent: false,
      muted: false,
      camera_view: "host",
      is_following_host: true,
    },
  },
  {
    id: "live-2",
    title: "Studio Talk & Beatmaking",
    host: "Nina Beats",
    host_verified: true,
    host_user_id: null,
    category: "Studio Room",
    listeners: 731,
    likes: 4800,
    type: "audio",
    track: "Work in progress beat",
    tags: ["Studio", "Beatmaking", "Q&A"],
    gradient_key: "blue-emerald",
    captions_text: "Bienvenue dans la room, on monte en energie dans 20 secondes.",
    comments: [
      { id: "m5", author: "ayo.wav", text: "Montre la basse encore une fois" },
      { id: "m6", author: "farouk", text: "Le kick est super propre" },
      { id: "m7", author: "luna.mix", text: "On veut entendre la version finale" },
    ],
    queue: ["Nina Beats", "Farouk", "Luna Mix"],
    moments: ["Q&A ouvert", "Preview d'un nouveau beat", "Vote du public"],
    membership: {
      joined: false,
      liked: false,
      gift_sent: false,
      muted: false,
      camera_view: "host",
      is_following_host: false,
    },
  },
  {
    id: "live-3",
    title: "Open Mic Late Show",
    host: "DJ Nova",
    host_verified: false,
    host_user_id: null,
    category: "Open Mic",
    listeners: 409,
    likes: 2190,
    type: "video",
    track: "Freestyle session",
    tags: ["Open mic", "Rap", "Freestyle"],
    gradient_key: "amber-rose",
    captions_text: "Bienvenue dans la room, on monte en energie dans 20 secondes.",
    comments: [
      { id: "m8", author: "ayo.wav", text: "Le prochain passage va etre lourd" },
      { id: "m9", author: "nina.beats", text: "J'attends la partie refrains" },
    ],
    queue: ["DJ Nova", "Ayo.wav", "Tems Daily"],
    moments: ["Battle imminente", "Vote du public", "Guest entrant"],
    membership: {
      joined: false,
      liked: false,
      gift_sent: false,
      muted: false,
      camera_view: "host",
      is_following_host: false,
    },
  },
];

const FALLBACK_SCHEDULED_LIVES = [
  { id: "s1", title: "Afro Mood Radio", scheduled_for: "2026-04-12T22:30:00.000Z", host: "Tems Daily" },
  { id: "s2", title: "Beat Critique Live", scheduled_for: "2026-04-12T23:15:00.000Z", host: "Nina Beats" },
  { id: "s3", title: "Midnight Club Set", scheduled_for: "2026-04-13T00:00:00.000Z", host: "Ayo.wav" },
];

const GRADIENTS = {
  "emerald-fuchsia": "linear-gradient(135deg, rgba(16,185,129,.22), rgba(0,0,0,.88), rgba(217,70,239,.18))",
  "blue-emerald": "linear-gradient(135deg, rgba(59,130,246,.22), rgba(0,0,0,.88), rgba(16,185,129,.16))",
  "amber-rose": "linear-gradient(135deg, rgba(245,158,11,.20), rgba(0,0,0,.88), rgba(244,63,94,.18))",
  "emerald-blue": "linear-gradient(135deg, rgba(16,185,129,.22), rgba(0,0,0,.88), rgba(59,130,246,.16))",
};

const state = {
  rooms: FALLBACK_LIVE_ROOMS.slice(),
  scheduled: FALLBACK_SCHEDULED_LIVES.slice(),
  activeRoomId: FALLBACK_LIVE_ROOMS[0].id,
  feedback: "Chargement des rooms live...",
  liveExpanded: false,
  chatOpen: false,
  loading: false,
  usingFallback: true,
};

const refs = {
  feedback: document.querySelector("#liveFeedback"),
  roomsCount: document.querySelector("#liveRoomsCount"),
  roomsList: document.querySelector("#liveRoomsList"),
  scheduledList: document.querySelector("#liveScheduledList"),
  activeTitle: document.querySelector("#liveActiveTitle"),
  activeMeta: document.querySelector("#liveActiveMeta"),
  activeTags: document.querySelector("#liveActiveTags"),
  verifiedBadge: document.querySelector("#liveVerifiedBadge"),
  joinBtn: document.querySelector("#liveJoinBtn"),
  followBtn: document.querySelector("#liveFollowBtn"),
  stage: document.querySelector("#liveStage"),
  stageVisual: document.querySelector("#liveStageVisual"),
  stageType: document.querySelector("#liveStageType"),
  audiencePill: document.querySelector("#liveAudiencePill"),
  trackPill: document.querySelector("#liveTrackPill"),
  overlayComments: document.querySelector("#liveOverlayComments"),
  hostName: document.querySelector("#liveHostName"),
  caption: document.querySelector("#liveCaption"),
  likeBtn: document.querySelector("#liveLikeBtn"),
  giftBtn: document.querySelector("#liveGiftBtn"),
  captionBtn: document.querySelector("#liveCaptionBtn"),
  chatToggleBtn: document.querySelector("#liveChatToggleBtn"),
  expandBtn: document.querySelector("#liveExpandBtn"),
  chatPanel: document.querySelector("#liveChatPanel"),
  closeChatBtn: document.querySelector("#liveCloseChatBtn"),
  chatList: document.querySelector("#liveChatList"),
  openChatBtn: document.querySelector("#liveOpenChatBtn"),
  messageInput: document.querySelector("#liveMessageInput"),
  sendBtn: document.querySelector("#liveSendBtn"),
  muteCard: document.querySelector("#liveMuteCard"),
  muteIconWrap: document.querySelector("#liveMuteIconWrap"),
  muteTitle: document.querySelector("#liveMuteTitle"),
  cameraCard: document.querySelector("#liveCameraCard"),
  cameraIconWrap: document.querySelector("#liveCameraIconWrap"),
  cameraTitle: document.querySelector("#liveCameraTitle"),
  queueIconWrap: document.querySelector("#liveQueueIconWrap"),
  queueText: document.querySelector("#liveQueueText"),
  momentsIconWrap: document.querySelector("#liveMomentsIconWrap"),
  momentsText: document.querySelector("#liveMomentsText"),
  shareBtn: document.querySelector("#liveShareBtn"),
  reminderBtn: document.querySelector("#liveReminderBtn"),
  trackBtn: document.querySelector("#liveTrackBtn"),
  validation: document.querySelector("#liveValidation"),
};

let pollTimer = 0;
let overlayTimer = 0;

function iconSvg(name) {
  const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  switch (name) {
    case "live":
      return `<svg ${common}><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.48"></path><path d="M7.76 16.24a6 6 0 0 1 0-8.48"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M4.93 19.07a10 10 0 0 1 0-14.14"></path></svg>`;
    case "users":
      return `<svg ${common}><path d="M16 21a4 4 0 0 0-8 0"></path><circle cx="12" cy="7" r="3"></circle><path d="M22 21a4 4 0 0 0-3-3.87"></path><path d="M2 21a4 4 0 0 1 3-3.87"></path></svg>`;
    case "heart":
      return `<svg ${common}><path d="m12 20-1.45-1.32C5.4 14.03 2 10.95 2 7.5A4.5 4.5 0 0 1 6.5 3c1.74 0 3.41.81 4.5 2.09A6.03 6.03 0 0 1 15.5 3 4.5 4.5 0 0 1 20 7.5c0 3.45-3.4 6.53-8.55 11.18Z"></path></svg>`;
    case "mic":
      return `<svg ${common}><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0"></path><path d="M12 17v5"></path><path d="M8 22h8"></path></svg>`;
    case "camera":
      return `<svg ${common}><path d="m15 10 4.55-2.73A1 1 0 0 1 21 8.14v7.72a1 1 0 0 1-1.45.87L15 14"></path><rect x="3" y="6" width="12" height="12" rx="2"></rect></svg>`;
    case "expand":
      return `<svg ${common}><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="m21 3-7 7"></path><path d="m3 21 7-7"></path></svg>`;
    case "collapse":
      return `<svg ${common}><path d="M9 3H3v6"></path><path d="M15 21h6v-6"></path><path d="m3 3 7 7"></path><path d="m21 21-7-7"></path></svg>`;
    case "video":
      return `<svg ${common}><path d="m15 10 4.55-2.73A1 1 0 0 1 21 8.14v7.72a1 1 0 0 1-1.45.87L15 14"></path><rect x="3" y="6" width="12" height="12" rx="2"></rect></svg>`;
    case "music":
      return `<svg ${common}><path d="M9 18V5l10-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    case "host":
      return `<svg ${common}><path d="m12 3 2.7 5.47L21 9.4l-4.5 4.38 1.06 6.22L12 17.2 6.44 20l1.06-6.22L3 9.4l6.3-.93Z"></path></svg>`;
    case "flame":
      return `<svg ${common}><path d="M12.5 3.5c.8 2.8-.8 4.6-2.5 6.2-1.7 1.6-2.8 3-2.8 5.1A4.8 4.8 0 0 0 12 20a4.8 4.8 0 0 0 4.8-5.2c0-3.4-2.3-5.4-4.3-7.1-.6-.6-1.2-1.2 0-4.2Z"></path></svg>`;
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="8"></circle></svg>`;
  }
}

function formatAudience(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value || 0);
}

function formatScheduledTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function gradientFromKey(key) {
  return GRADIENTS[String(key || "")] || GRADIENTS["emerald-fuchsia"];
}

function activeRoom() {
  return state.rooms.find((room) => room.id === state.activeRoomId) || state.rooms[0] || null;
}

function patchActiveRoom(update) {
  const room = activeRoom();
  if (!room) return;
  state.rooms = state.rooms.map((item) => (item.id === room.id ? { ...item, ...update } : item));
}

function patchActiveMembership(update) {
  const room = activeRoom();
  if (!room) return;
  state.rooms = state.rooms.map((item) =>
    item.id === room.id
      ? { ...item, membership: { ...(item.membership || {}), ...update } }
      : item
  );
}

function setFeedback(message) {
  state.feedback = message;
  if (refs.feedback) refs.feedback.textContent = message;
}

function runLiveTests(room, comments) {
  return [
    { name: "au moins 3 rooms live", passed: state.rooms.length >= 3 },
    { name: "room active definie", passed: Boolean(room?.id) },
    { name: "chat disponible", passed: Array.isArray(comments) && comments.length > 0 },
    { name: "planning live present", passed: state.scheduled.length >= 2 },
  ];
}

function renderRooms() {
  refs.roomsCount.textContent = `${state.rooms.length} live`;
  refs.roomsList.innerHTML = state.rooms
    .map(
      (room) => `
        <button class="live-room-btn ${room.id === state.activeRoomId ? "is-active" : ""}" type="button" data-room-id="${escapeHtml(room.id)}">
          <div class="live-row">
            <div>
              <div class="live-room-title">${escapeHtml(room.title)}</div>
              <div class="live-room-sub">${escapeHtml(room.host)} - ${escapeHtml(room.category)}</div>
            </div>
            <span class="live-badge is-live">live</span>
          </div>
          <div class="live-tag-row">
            <span class="live-tag">${escapeHtml(formatAudience(room.listeners))} auditeurs</span>
            <span class="live-tag">${escapeHtml(room.type)}</span>
            ${(room.tags || []).map((tag) => `<span class="live-tag is-green">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </button>
      `
    )
    .join("");
}

function renderScheduledLives() {
  refs.scheduledList.innerHTML = state.scheduled
    .map(
      (item) => `
        <div class="live-schedule-item">
          <div class="live-room-title">${escapeHtml(item.title)}</div>
          <div class="live-room-sub">${escapeHtml(item.host || "")}</div>
          <div class="live-tag-row">
            <span class="live-tag">${escapeHtml(formatScheduledTime(item.scheduled_for))}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderStageVisual(room) {
  const icon = room.type === "video" ? iconSvg("video") : iconSvg("music");
  refs.stage.style.background = gradientFromKey(room.gradient_key);
  refs.stageVisual.innerHTML = icon;
  refs.stageType.textContent = room.type === "video" ? "Live video en cours" : "Live audio room";
}

function renderOverlayComments(room) {
  const comments = (room.comments || []).slice(-3);
  refs.overlayComments.hidden = !state.liveExpanded;
  refs.overlayComments.innerHTML = comments
    .map(
      (comment) => `
        <div class="live-overlay-item">
          <strong>@${escapeHtml(comment.author)}</strong> - ${escapeHtml(comment.text)}
        </div>
      `
    )
    .join("");
}

function renderChat(room) {
  refs.chatPanel.hidden = !(state.liveExpanded && state.chatOpen);
  refs.chatList.innerHTML = (room.comments || [])
    .slice(-6)
    .map((comment) => `<div class="live-chat-item"><strong>@${escapeHtml(comment.author)}</strong> - ${escapeHtml(comment.text)}</div>`)
    .join("");
}

function renderActiveRoom() {
  const room = activeRoom();
  if (!room) return;

  const membership = room.membership || {};
  refs.activeTitle.textContent = room.title;
  refs.activeMeta.textContent = `${room.host} - ${room.category}`;
  refs.verifiedBadge.hidden = !room.host_verified;
  refs.activeTags.innerHTML = `
    ${(room.tags || []).map((tag) => `<span class="live-tag is-green">${escapeHtml(tag)}</span>`).join("")}
    <span class="live-tag">${escapeHtml(formatAudience(room.listeners))} viewers</span>
    <span class="live-tag">${escapeHtml(formatAudience(room.likes))} likes</span>
  `;
  refs.joinBtn.textContent = membership.joined ? "Dans la room" : "Rejoindre";
  refs.followBtn.textContent = membership.is_following_host ? "Suivi" : "Suivre l'host";
  refs.followBtn.classList.toggle("is-emerald", Boolean(membership.is_following_host));
  refs.audiencePill.textContent = `${formatAudience(room.listeners)} viewers`;
  refs.trackPill.textContent = room.track || "Track en cours";
  refs.hostName.textContent = room.host;
  refs.caption.hidden = !room.captions_text;
  refs.caption.textContent = room.captions_text || "";
  refs.captionBtn.classList.toggle("is-emerald", Boolean(membership.captions_enabled));
  refs.captionBtn.textContent = membership.captions_enabled ? "Sous-titres actifs" : "Sous-titres";
  refs.likeBtn.textContent = membership.liked ? "Like retire" : "Liker";
  refs.giftBtn.textContent = membership.gift_sent ? "Cadeau envoye" : "Envoyer un cadeau";
  refs.chatToggleBtn.textContent = state.chatOpen ? "Chat ouvert" : "Chat";
  refs.expandBtn.innerHTML = `${state.liveExpanded ? iconSvg("collapse") : iconSvg("expand")} ${state.liveExpanded ? "Reduire" : "Agrandir"}`;
  refs.reminderBtn.textContent = membership.reminder_set ? "Rappel actif" : "Ajouter aux rappels live";
  refs.reminderBtn.classList.toggle("is-emerald", Boolean(membership.reminder_set));
  refs.stage.classList.toggle("is-expanded", state.liveExpanded);

  refs.muteIconWrap.innerHTML = iconSvg("mic");
  refs.muteTitle.textContent = membership.muted ? "Micro coupe" : "Micro ouvert";
  refs.cameraIconWrap.innerHTML = iconSvg("camera");
  refs.cameraTitle.textContent = `Vue : ${membership.camera_view || "host"}`;
  refs.queueIconWrap.innerHTML = iconSvg("host");
  refs.queueText.textContent = (room.queue || []).join(" - ");
  refs.momentsIconWrap.innerHTML = iconSvg("flame");
  refs.momentsText.textContent = (room.moments || []).join(" - ");

  renderStageVisual(room);
  renderOverlayComments(room);
  renderChat(room);
}

function renderValidation() {
  const room = activeRoom();
  const tests = runLiveTests(room, room?.comments || []);
  const allPassed = tests.every((test) => test.passed);
  refs.validation.classList.toggle("is-ko", !allPassed);
  refs.validation.textContent = allPassed ? "Tests page live passes" : "Un test page live a echoue";
}

function render() {
  renderRooms();
  renderScheduledLives();
  renderActiveRoom();
  renderValidation();
  setFeedback(state.feedback);
}

function switchRoom(roomId) {
  if (!state.rooms.some((room) => room.id === roomId)) return;
  state.activeRoomId = roomId;
  state.liveExpanded = false;
  state.chatOpen = false;
  const room = activeRoom();
  setFeedback(room ? `Room selectionnee : ${room.title}` : "Room selectionnee");
  render();
}

async function loadLiveData({ silent = false } = {}) {
  if (!silent) {
    state.loading = true;
    setFeedback("Chargement des rooms live...");
  }

  try {
    const data = await apiFetch("/live/rooms");
    const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
    const scheduled = Array.isArray(data?.scheduled) ? data.scheduled : [];
    if (!rooms.length) throw new Error("Aucune room live disponible");

    state.rooms = rooms;
    state.scheduled = scheduled;
    state.usingFallback = false;

    if (!state.rooms.some((room) => room.id === state.activeRoomId)) {
      state.activeRoomId = state.rooms[0].id;
    }

    if (!silent) {
      setFeedback("Rooms live chargees depuis l'API");
    }
    render();
  } catch (error) {
    state.usingFallback = true;
    if (!silent) {
      setFeedback("API live indisponible, mode demo active");
      toast(error?.message || "Mode demo active", "Live");
    }
    render();
  } finally {
    state.loading = false;
  }
}

async function joinRoom() {
  const room = activeRoom();
  if (!room) return;
  if (state.usingFallback) {
    patchActiveMembership({ joined: true });
    setFeedback(`Tu as rejoint ${room.title}`);
    render();
    return;
  }
  if (!requireLogin()) return;

  try {
    await apiFetch(`/live/rooms/${encodeURIComponent(room.id)}/join`, { method: "POST" });
    patchActiveMembership({ joined: true });
    setFeedback(`Tu as rejoint ${room.title}`);
    render();
  } catch (error) {
    setFeedback(error?.message || "Impossible de rejoindre la room");
  }
}

async function toggleFollowHost() {
  const room = activeRoom();
  if (!room) return;
  if (!room.host_user_id) {
    patchActiveMembership({ is_following_host: !room.membership?.is_following_host });
    setFeedback(room.membership?.is_following_host ? `Tu ne suis plus ${room.host}` : `Tu suis maintenant ${room.host}`);
    render();
    return;
  }
  if (!requireLogin()) return;

  try {
    const alreadyFollowing = Boolean(room.membership?.is_following_host);
    await apiFetch(`/follows/${encodeURIComponent(room.host_user_id)}`, {
      method: alreadyFollowing ? "DELETE" : "POST",
    });
    patchActiveMembership({ is_following_host: !alreadyFollowing });
    setFeedback(alreadyFollowing ? `Tu ne suis plus ${room.host}` : `Tu suis maintenant ${room.host}`);
    render();
  } catch (error) {
    setFeedback(error?.message || "Impossible de mettre a jour le suivi");
  }
}

async function toggleLikeLive() {
  const room = activeRoom();
  if (!room) return;
  if (state.usingFallback) {
    const liked = !room.membership?.liked;
    patchActiveMembership({ liked });
    patchActiveRoom({ likes: Math.max(0, Number(room.likes || 0) + (liked ? 1 : -1)) });
    setFeedback(liked ? "Live like" : "Like retire du live");
    render();
    return;
  }
  if (!requireLogin()) return;

  try {
    const data = await apiFetch(`/live/rooms/${encodeURIComponent(room.id)}/like`, { method: "POST" });
    patchActiveMembership({ liked: !!data?.liked });
    patchActiveRoom({ likes: Number(data?.likes_count || room.likes || 0) });
    setFeedback(data?.liked ? "Live like" : "Like retire du live");
    render();
  } catch (error) {
    setFeedback(error?.message || "Impossible de liker le live");
  }
}

async function sendGift() {
  const room = activeRoom();
  if (!room) return;
  if (state.usingFallback) {
    patchActiveMembership({ gift_sent: true });
    setFeedback(`Cadeau envoye a ${room.host}`);
    render();
    return;
  }
  if (!requireLogin()) return;

  try {
    await apiFetch(`/live/rooms/${encodeURIComponent(room.id)}/gift`, { method: "POST" });
    patchActiveMembership({ gift_sent: true });
    setFeedback(`Cadeau envoye a ${room.host}`);
    render();
  } catch (error) {
    setFeedback(error?.message || "Impossible d'envoyer le cadeau");
  }
}

async function sendComment() {
  const room = activeRoom();
  if (!room) return;
  const clean = String(refs.messageInput.value || "").trim();
  if (!clean) return;

  if (state.usingFallback) {
    const nextMessage = { id: `msg-${Date.now()}`, author: "toi", text: clean };
    patchActiveMembership({ joined: true });
    patchActiveRoom({ comments: [...(room.comments || []), nextMessage] });
    refs.messageInput.value = "";
    setFeedback("Message envoye dans le live");
    render();
    return;
  }
  if (!requireLogin()) return;

  try {
    const data = await apiFetch(`/live/rooms/${encodeURIComponent(room.id)}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: clean }),
    });
    const nextMessage = data?.message;
    patchActiveMembership({ joined: true });
    patchActiveRoom({ comments: [...(room.comments || []), nextMessage] });
    refs.messageInput.value = "";
    setFeedback("Message envoye dans le live");
    render();
  } catch (error) {
    setFeedback(error?.message || "Impossible d'envoyer le message");
  }
}

function toggleChatPanel() {
  if (!state.liveExpanded) {
    state.liveExpanded = true;
    state.chatOpen = true;
    setFeedback("Live agrandi avec chat ouvert");
    render();
    return;
  }
  state.chatOpen = !state.chatOpen;
  setFeedback(state.chatOpen ? "Chat live ouvert" : "Chat live ferme");
  render();
}

function toggleExpandLive() {
  state.liveExpanded = !state.liveExpanded;
  if (!state.liveExpanded) state.chatOpen = false;
  setFeedback(state.liveExpanded ? "Live agrandi" : "Live reduit");
  render();
}

async function syncLivePreferences(nextMembership) {
  const room = activeRoom();
  if (!room) return;
  patchActiveMembership(nextMembership);
  patchActiveRoom({
    captions_text: nextMembership.captions_enabled
      ? (room.captions_text || "Bienvenue dans la room, on monte en energie dans 20 secondes.")
      : null,
  });
  render();

  if (state.usingFallback) return;
  if (!requireLogin({ redirect: false, message: "Connecte-toi pour enregistrer tes preferences live." })) {
    await loadLiveData({ silent: true });
    render();
    return;
  }

  try {
    const membership = {
      muted: Boolean(nextMembership.muted),
      captions_enabled: Boolean(nextMembership.captions_enabled),
      camera_view: String(nextMembership.camera_view || "host"),
    };
    await apiFetch(`/live/rooms/${encodeURIComponent(room.id)}/preferences`, {
      method: "POST",
      body: JSON.stringify(membership),
    });
  } catch (error) {
    setFeedback(error?.message || "Impossible d'enregistrer la preference live");
    await loadLiveData({ silent: true });
    render();
  }
}

async function toggleCaptions() {
  const room = activeRoom();
  if (!room) return;
  const nextEnabled = !room.membership?.captions_enabled;
  await syncLivePreferences({
    ...room.membership,
    captions_enabled: nextEnabled,
  });
  setFeedback(nextEnabled ? "Sous-titres actifs" : "Sous-titres masques");
}

async function toggleMute() {
  const room = activeRoom();
  if (!room) return;
  const nextMuted = !room.membership?.muted;
  await syncLivePreferences({
    ...room.membership,
    muted: nextMuted,
  });
  setFeedback(nextMuted ? "Micro coupe" : "Micro ouvert");
}

async function cycleCameraView() {
  const room = activeRoom();
  if (!room) return;
  const current = String(room.membership?.camera_view || "host");
  const next = current === "host" ? "stage" : current === "stage" ? "audience" : "host";
  await syncLivePreferences({
    ...room.membership,
    camera_view: next,
  });
  setFeedback(`Vue changee : ${next}`);
}

function bindEvents() {
  refs.roomsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-room-id]");
    if (!button) return;
    switchRoom(button.getAttribute("data-room-id"));
  });

  refs.joinBtn.addEventListener("click", joinRoom);
  refs.followBtn.addEventListener("click", toggleFollowHost);
  refs.likeBtn.addEventListener("click", toggleLikeLive);
  refs.giftBtn.addEventListener("click", sendGift);
  refs.captionBtn.addEventListener("click", toggleCaptions);
  refs.chatToggleBtn.addEventListener("click", toggleChatPanel);
  refs.expandBtn.addEventListener("click", toggleExpandLive);
  refs.closeChatBtn.addEventListener("click", () => {
    state.chatOpen = false;
    setFeedback("Chat live ferme");
    render();
  });
  refs.openChatBtn.addEventListener("click", () => {
    state.chatOpen = true;
    setFeedback("Chat live ouvert");
    render();
  });
  refs.sendBtn.addEventListener("click", sendComment);
  refs.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendComment();
  });
  refs.muteCard.addEventListener("click", toggleMute);
  refs.cameraCard.addEventListener("click", cycleCameraView);

  refs.shareBtn.addEventListener("click", async () => {
    const room = activeRoom();
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.id)}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      setFeedback(`Lien de partage copie pour ${room.title}`);
      toast("Lien de partage copie", "Live");
    } catch {
      setFeedback("Impossible de copier le lien de partage");
    }
  });

  refs.reminderBtn.addEventListener("click", async () => {
    const room = activeRoom();
    if (!room) return;
    if (state.usingFallback) {
      patchActiveMembership({ reminder_set: !room.membership?.reminder_set });
      setFeedback(room.membership?.reminder_set ? `Rappel retire pour ${room.title}` : `Rappel ajoute pour ${room.title}`);
      render();
      return;
    }
    if (!requireLogin({ redirect: false, message: "Connecte-toi pour enregistrer un rappel live." })) return;
    try {
      const data = await apiFetch(`/live/rooms/${encodeURIComponent(room.id)}/reminder`, { method: "POST" });
      patchActiveMembership({ reminder_set: !!data?.reminder_set });
      setFeedback(data?.reminder_set ? `Rappel ajoute pour ${room.title}` : `Rappel retire pour ${room.title}`);
      render();
    } catch (error) {
      setFeedback(error?.message || "Impossible d'enregistrer le rappel");
    }
  });

  refs.trackBtn.addEventListener("click", () => {
    const room = activeRoom();
    if (!room) return;
    if (window.supcontentPlayer?.playMedia) {
      window.supcontentPlayer.playMedia({
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        title: room.track || room.title,
        subtitle: room.host || "Live",
        cover: "",
        mode: room.type === "video" ? "video" : "audio",
      });
      setFeedback(`Track ouverte : ${room.track}`);
      toast("Track ouverte dans le player", "Live");
      return;
    }
    setFeedback(`Track ouverte : ${room.track}`);
  });
}

function startOverlayTimer() {
  if (overlayTimer) window.clearInterval(overlayTimer);
  overlayTimer = window.setInterval(() => {
    if (!state.liveExpanded) return;
    renderOverlayComments(activeRoom() || { comments: [] });
  }, 2500);
}

function startPolling() {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => {
    if (document.hidden) return;
    loadLiveData({ silent: true });
  }, 12000);
}

function applyQueryRoom() {
  const roomId = new URLSearchParams(window.location.search).get("room");
  if (roomId && state.rooms.some((room) => room.id === roomId)) {
    state.activeRoomId = roomId;
  }
}

async function init() {
  bindEvents();
  render();
  applyQueryRoom();
  startOverlayTimer();
  startPolling();
  await loadLiveData();
  applyQueryRoom();
  render();
}

init();
