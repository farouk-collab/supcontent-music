import { escapeHtml } from "/noyau/app.js";

const STORAGE_KEY = "supcontent_global_player_v1";
const DISMISS_KEY = "supcontent_global_player_dismissed_v1";

let root = null;
let coverEl = null;
let titleEl = null;
let subEl = null;
let playPauseBtn = null;
let prevBtn = null;
let nextBtn = null;
let modeBtn = null;
let expandBtn = null;
let closeBtn = null;
let backBtn = null;
let hostEl = null;
let fileMediaEl = null;
let seekEl = null;
let volEl = null;
let curEl = null;
let durEl = null;

let ytApiReady = null;
let ytPlayer = null;
let saveTimer = null;
let current = null;
let expanded = false;

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

function clearDismissed() {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function youtubeParams(rawUrl) {
  try {
    const u = new URL(String(rawUrl || ""));
    const host = String(u.hostname || "").toLowerCase();
    if (!(host.includes("youtube.com") || host.includes("youtu.be") || host.includes("music.youtube.com"))) {
      return { videoId: "", listId: "" };
    }

    const listId = String(u.searchParams.get("list") || "").trim();
    let videoId = String(u.searchParams.get("v") || "").trim();

    if (!videoId && host.includes("youtu.be")) {
      videoId = String(u.pathname || "").replace(/^\/+/, "").split("/")[0] || "";
    }
    if (!videoId && u.pathname.startsWith("/shorts/")) {
      videoId = String(u.pathname.split("/")[2] || "").trim();
    }

    return { videoId, listId };
  } catch {
    return { videoId: "", listId: "" };
  }
}

function ensureYtApi() {
  if (ytApiReady) return ytApiReady;

  ytApiReady = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };

    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });

  return ytApiReady;
}

function stopSaveTimer() {
  if (!saveTimer) return;
  window.clearInterval(saveTimer);
  saveTimer = null;
}

function formatTime(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds || 0)));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getCurrentTimeSeconds() {
  if (!current) return 0;

  if (current.provider === "file" && fileMediaEl) {
    return Number(fileMediaEl.currentTime || 0);
  }

  if (current.provider === "youtube" && ytPlayer?.getCurrentTime) {
    try {
      return Number(ytPlayer.getCurrentTime() || 0);
    } catch {
      return 0;
    }
  }

  return 0;
}

function getDurationSeconds() {
  if (!current) return 0;

  if (current.provider === "file" && fileMediaEl) {
    return Number(fileMediaEl.duration || 0);
  }

  if (current.provider === "youtube" && ytPlayer?.getDuration) {
    try {
      return Number(ytPlayer.getDuration() || 0);
    } catch {
      return 0;
    }
  }

  return 0;
}

function setPlayPauseIcon(playing) {
  if (!playPauseBtn) return;
  const isPlaying = Boolean(playing);
  playPauseBtn.textContent = isPlaying ? "⏸️" : "▶️";
  playPauseBtn.title = isPlaying ? "Pause" : "Lecture";
  playPauseBtn.setAttribute("aria-label", playPauseBtn.title);
}

function updateTimeline() {
  if (!curEl || !durEl || !seekEl) return;
  const cur = getCurrentTimeSeconds();
  const dur = getDurationSeconds();
  curEl.textContent = formatTime(cur);
  durEl.textContent = formatTime(dur);
  const pct = dur > 0 ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;
  seekEl.value = String(pct);
}

function setUiVisible(visible) {
  if (!root) return;
  root.hidden = !visible;
  document.body.classList.toggle("has-global-player", Boolean(visible));
}

function setExpanded(on) {
  if (!root) return;
  expanded = Boolean(on);
  root.classList.toggle("is-expanded", expanded);
  if (backBtn) backBtn.hidden = !expanded;
  if (expandBtn) {
    expandBtn.textContent = expanded ? "↩" : "⛶";
    expandBtn.title = expanded ? "Retour" : "Grand ecran";
    expandBtn.setAttribute("aria-label", expandBtn.title);
  }
}

function renderMeta(meta) {
  if (!root) return;

  titleEl.textContent = String(meta?.title || "Lecture");
  subEl.textContent = String(meta?.subtitle || "");

  if (meta?.cover) {
    coverEl.innerHTML = `<img src="${escapeHtml(String(meta.cover))}" alt="" />`;
  } else {
    coverEl.innerHTML = "";
  }

  const mode = String(meta?.mode || "video");
  root.classList.toggle("audio-only", mode === "audio");
  modeBtn.textContent = mode === "audio" ? "🎵" : "🎬";
  modeBtn.title = mode === "audio" ? "Mode audio" : "Mode video";
  modeBtn.setAttribute("aria-label", modeBtn.title);

  if (expandBtn) {
    expandBtn.hidden = mode !== "video";
  }
}

function destroyEngines() {
  if (fileMediaEl) {
    fileMediaEl.pause();
    fileMediaEl.removeAttribute("src");
    fileMediaEl.load();
  }

  if (ytPlayer?.destroy) {
    try {
      ytPlayer.destroy();
    } catch {
      // ignore
    }
  }
  ytPlayer = null;

  // Keep host mounted for file video playback. Remove only previous youtube host.
  const ytHost = hostEl?.querySelector("#sc-global-yt-host");
  if (ytHost) ytHost.remove();

  if (hostEl && fileMediaEl && fileMediaEl.parentElement !== hostEl) {
    hostEl.appendChild(fileMediaEl);
  }

  stopSaveTimer();
}

function snapshot() {
  if (!current) return;

  const next = { ...current, updatedAt: Date.now() };
  if (next.provider === "file" && fileMediaEl) {
    next.time = Number(fileMediaEl.currentTime || 0);
    next.playing = !fileMediaEl.paused;
  }
  if (next.provider === "youtube" && ytPlayer?.getCurrentTime) {
    try {
      next.time = Number(ytPlayer.getCurrentTime() || 0);
      const st = Number(ytPlayer.getPlayerState?.() ?? -1);
      next.playing = st === 1 || st === 3;
    } catch {
      // ignore
    }
  }

  current = next;
  setPlayPauseIcon(next.playing);
  updateTimeline();
  writeState(next);
}

function startSnapshotLoop() {
  stopSaveTimer();
  saveTimer = window.setInterval(snapshot, 1000);
}

function hasYouTubePlaylist() {
  return Boolean(current?.provider === "youtube" && current?.listId && ytPlayer);
}

async function playYouTube(state) {
  const { videoId, listId } = youtubeParams(state.url);
  if (!videoId && !listId) return false;

  await ensureYtApi();

  hostEl.innerHTML = '<div id="sc-global-yt-host" style="position:absolute;inset:0"></div>';

  const playerVars = {
    autoplay: state.playing ? 1 : 0,
    controls: 1,
    rel: 0,
    modestbranding: 1,
    playsinline: 1,
    origin: window.location.origin,
    start: Math.max(0, Math.floor(Number(state.time || 0))),
  };
  if (listId) {
    playerVars.list = listId;
    playerVars.listType = "playlist";
  }

  ytPlayer = new window.YT.Player("sc-global-yt-host", {
    videoId: videoId || undefined,
    playerVars,
    events: {
      onReady: () => {
        if (listId && !videoId && ytPlayer?.loadPlaylist) {
          try {
            ytPlayer.loadPlaylist(listId, 0, Math.max(0, Math.floor(Number(state.time || 0))));
          } catch {
            // ignore
          }
        }

        if (state.playing && ytPlayer?.playVideo) {
          try {
            ytPlayer.playVideo();
          } catch {
            // ignore
          }
        }
      },
      onStateChange: () => snapshot(),
    },
  });

  if (ytPlayer?.setVolume) {
    try {
      ytPlayer.setVolume(Math.round(Number(volEl?.value || 1) * 100));
    } catch {
      // ignore
    }
  }

  startSnapshotLoop();
  return true;
}

function playFile(state) {
  const src = String(state.url || "").trim();
  if (!src) return false;

  if (hostEl && fileMediaEl && fileMediaEl.parentElement !== hostEl) {
    hostEl.appendChild(fileMediaEl);
  }

  fileMediaEl.src = src;
  fileMediaEl.currentTime = Math.max(0, Number(state.time || 0));
  fileMediaEl.volume = Math.max(0, Math.min(1, Number(volEl?.value || 1)));
  if (state.playing) {
    fileMediaEl.play().catch(() => setPlayPauseIcon(false));
  }
  startSnapshotLoop();
  return true;
}

function start(state) {
  if (!root) buildUi();

  const yt = state.provider === "youtube" ? youtubeParams(state.url) : { listId: "", videoId: "" };

  current = {
    provider: state.provider === "youtube" ? "youtube" : "file",
    url: String(state.url || "").trim(),
    listId: yt.listId || "",
    title: String(state.title || "Lecture"),
    subtitle: String(state.subtitle || ""),
    cover: String(state.cover || ""),
    mode: state.mode === "audio" ? "audio" : "video",
    playing: state.playing !== false,
    time: Math.max(0, Number(state.time || 0)),
    updatedAt: Date.now(),
  };

  renderMeta(current);
  clearDismissed();
  setUiVisible(true);
  setExpanded(false);
  destroyEngines();

  if (current.provider === "youtube") {
    playYouTube(current).then((ok) => {
      if (!ok) stop();
    });
  } else {
    const ok = playFile(current);
    if (!ok) stop();
  }

  setPlayPauseIcon(current.playing);
  updateTimeline();
  writeState(current);
}

function togglePlayPause() {
  if (!current) return;

  if (current.provider === "file" && fileMediaEl) {
    if (fileMediaEl.paused) fileMediaEl.play().catch(() => {});
    else fileMediaEl.pause();
    snapshot();
    return;
  }

  if (current.provider === "youtube" && ytPlayer) {
    const st = Number(ytPlayer.getPlayerState?.() ?? -1);
    if (st === 1 || st === 3) ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
    snapshot();
  }
}

function previousAction() {
  if (!current) return;

  if (hasYouTubePlaylist() && ytPlayer?.previousVideo) {
    try {
      ytPlayer.previousVideo();
      snapshot();
      return;
    } catch {
      // fallback below
    }
  }

  if (current.provider === "file" && fileMediaEl) {
    fileMediaEl.currentTime = Math.max(0, Number(fileMediaEl.currentTime || 0) - 10);
    snapshot();
    return;
  }

  if (current.provider === "youtube" && ytPlayer?.seekTo && ytPlayer?.getCurrentTime) {
    try {
      const now = Number(ytPlayer.getCurrentTime() || 0);
      ytPlayer.seekTo(Math.max(0, now - 10), true);
      snapshot();
    } catch {
      // ignore
    }
  }
}

function nextAction() {
  if (!current) return;

  if (hasYouTubePlaylist() && ytPlayer?.nextVideo) {
    try {
      ytPlayer.nextVideo();
      snapshot();
      return;
    } catch {
      // fallback below
    }
  }

  if (current.provider === "file" && fileMediaEl) {
    fileMediaEl.currentTime = Math.max(0, Number(fileMediaEl.currentTime || 0) + 10);
    snapshot();
    return;
  }

  if (current.provider === "youtube" && ytPlayer?.seekTo && ytPlayer?.getCurrentTime) {
    try {
      const now = Number(ytPlayer.getCurrentTime() || 0);
      ytPlayer.seekTo(Math.max(0, now + 10), true);
      snapshot();
    } catch {
      // ignore
    }
  }
}

function toggleMode() {
  if (!current) return;
  current.mode = current.mode === "audio" ? "video" : "audio";
  renderMeta(current);
  if (current.mode === "audio") setExpanded(false);
  snapshot();
}

function toggleExpanded() {
  if (!current || current.mode !== "video") return;
  setExpanded(!expanded);
}

function stop() {
  destroyEngines();
  expanded = false;
  setUiVisible(false);
  if (root) root.remove();

  root = null;
  coverEl = null;
  titleEl = null;
  subEl = null;
  playPauseBtn = null;
  prevBtn = null;
  nextBtn = null;
  modeBtn = null;
  expandBtn = null;
  closeBtn = null;
  hostEl = null;
  fileMediaEl = null;
  seekEl = null;
  volEl = null;
  curEl = null;
  durEl = null;
  current = null;

  markDismissed();
  clearState();
  document.body.classList.remove("has-global-player");
}

function restore() {
  if (isDismissed()) return;
  if (!root) buildUi();
  const st = readState();
  if (!st?.url) return;
  start({ ...st, playing: st.playing !== false });
}

function bindUiEvents() {
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  prevBtn?.addEventListener("click", previousAction);
  playPauseBtn?.addEventListener("click", togglePlayPause);
  nextBtn?.addEventListener("click", nextAction);
  modeBtn?.addEventListener("click", toggleMode);
  expandBtn?.addEventListener("click", toggleExpanded);
  backBtn?.addEventListener("click", () => setExpanded(false));

  hostEl?.addEventListener("click", (ev) => {
    if (ev.target === hostEl && expanded) setExpanded(false);
  });

  const hardClose = (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    stop();
  };
  closeBtn?.addEventListener("click", hardClose);
  closeBtn?.addEventListener("pointerdown", hardClose);

  seekEl?.addEventListener("input", () => {
    if (!current) return;
    const dur = getDurationSeconds();
    const pct = Number(seekEl.value || 0);
    const target = dur > 0 ? (pct / 100) * dur : 0;

    if (current.provider === "file" && fileMediaEl) {
      fileMediaEl.currentTime = Math.max(0, target);
      snapshot();
      return;
    }

    if (current.provider === "youtube" && ytPlayer?.seekTo) {
      try {
        ytPlayer.seekTo(Math.max(0, target), true);
      } catch {
        // ignore
      }
      snapshot();
    }
  });

  volEl?.addEventListener("input", () => {
    const v = Math.max(0, Math.min(1, Number(volEl.value || 1)));

    if (fileMediaEl) fileMediaEl.volume = v;

    if (ytPlayer?.setVolume) {
      try {
        ytPlayer.setVolume(Math.round(v * 100));
      } catch {
        // ignore
      }
    }
  });

  fileMediaEl?.addEventListener("timeupdate", snapshot);
  fileMediaEl?.addEventListener("play", snapshot);
  fileMediaEl?.addEventListener("pause", snapshot);
  fileMediaEl?.addEventListener("loadedmetadata", updateTimeline);
}

function buildUi() {
  const existing = document.querySelector("#globalMiniPlayer");
  if (existing) {
    root = existing;
    coverEl = existing.querySelector("#gmpCover");
    titleEl = existing.querySelector("#gmpTitle");
    subEl = existing.querySelector("#gmpSub");
    hostEl = existing.querySelector("#gmpHost");
    playPauseBtn = existing.querySelector("#gmpPlayPause");
    prevBtn = existing.querySelector("#gmpPrev");
    nextBtn = existing.querySelector("#gmpNext");
    modeBtn = existing.querySelector("#gmpMode");
    expandBtn = existing.querySelector("#gmpExpand");
    closeBtn = existing.querySelector("#gmpClose");
    backBtn = existing.querySelector("#gmpBack");
    seekEl = existing.querySelector("#gmpSeek");
    volEl = existing.querySelector("#gmpVol");
    curEl = existing.querySelector("#gmpCur");
    durEl = existing.querySelector("#gmpDur");
    fileMediaEl = existing.querySelector("video");
    bindUiEvents();
    return;
  }

  const el = document.createElement("div");
  el.id = "globalMiniPlayer";
  el.className = "spotify-player audio-only";
  el.hidden = true;
  el.innerHTML = `
    <div class="gmp-left">
      <div class="gmp-cover" id="gmpCover"></div>
      <div class="gmp-meta">
        <div class="gmp-title" id="gmpTitle">Lecture</div>
        <div class="gmp-sub" id="gmpSub"></div>
      </div>
    </div>
    <div class="gmp-center">
      <div class="gmp-actions">
        <button class="btn icon" type="button" id="gmpMode" aria-label="Mode video" title="Mode video">🎬</button>
        <button class="btn icon" type="button" id="gmpPrev" aria-label="Precedent" title="Precedent">⏮️</button>
        <button class="btn icon main" type="button" id="gmpPlayPause" aria-label="Lecture/Pause" title="Lecture/Pause">▶️</button>
        <button class="btn icon" type="button" id="gmpNext" aria-label="Suivant" title="Suivant">⏭️</button>
      </div>
      <div class="gmp-progress">
        <small id="gmpCur">0:00</small>
        <input id="gmpSeek" class="gmp-seek" type="range" min="0" max="100" step="1" value="0" />
        <small id="gmpDur">0:00</small>
      </div>
    </div>
    <div class="gmp-right">
      <button class="btn icon" type="button" id="gmpExpand" aria-label="Grand ecran" title="Grand ecran">⛶</button>
      <input id="gmpVol" class="gmp-vol" type="range" min="0" max="1" step="0.01" value="1" />
      <button class="btn danger icon" type="button" id="gmpClose" aria-label="Fermer" title="Fermer">✖️</button>
    </div>
    <div class="gmp-video-host" id="gmpHost">
      <button class="btn icon gmp-video-back" type="button" id="gmpBack" aria-label="Retour" title="Retour" hidden>↩</button>
    </div>
  `;
  document.body.appendChild(el);

  root = el;
  coverEl = el.querySelector("#gmpCover");
  titleEl = el.querySelector("#gmpTitle");
  subEl = el.querySelector("#gmpSub");
  hostEl = el.querySelector("#gmpHost");
  playPauseBtn = el.querySelector("#gmpPlayPause");
  prevBtn = el.querySelector("#gmpPrev");
  nextBtn = el.querySelector("#gmpNext");
  modeBtn = el.querySelector("#gmpMode");
  expandBtn = el.querySelector("#gmpExpand");
  closeBtn = el.querySelector("#gmpClose");
  backBtn = el.querySelector("#gmpBack");
  seekEl = el.querySelector("#gmpSeek");
  volEl = el.querySelector("#gmpVol");
  curEl = el.querySelector("#gmpCur");
  durEl = el.querySelector("#gmpDur");

  fileMediaEl = document.createElement("video");
  fileMediaEl.preload = "metadata";
  fileMediaEl.controls = false;
  fileMediaEl.playsInline = true;
  fileMediaEl.style.width = "100%";
  fileMediaEl.style.height = "100%";
  fileMediaEl.style.objectFit = "contain";
  fileMediaEl.volume = 1;
  hostEl.appendChild(fileMediaEl);

  bindUiEvents();
  setExpanded(false);
}

export function initGlobalPlayer() {
  buildUi();
  restore();

  window.supcontentPlayer = {
    playYouTube({ url, title = "YouTube", subtitle = "", cover = "", mode = "video" }) {
      start({ provider: "youtube", url, title, subtitle, cover, mode, playing: true });
    },
    playMedia({ url, title = "Media", subtitle = "", cover = "", mode = "video" }) {
      start({ provider: "file", url, title, subtitle, cover, mode, playing: true });
    },
    stop,
    state: () => ({ ...(current || {}) }),
  };

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !root?.hidden) {
      if (expanded) setExpanded(false);
      else stop();
    }
  });
}
