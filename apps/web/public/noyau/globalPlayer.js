import { escapeHtml } from "/noyau/app.js";

const STORAGE_KEY = "supcontent_global_player_v1";
const DISMISS_KEY = "supcontent_global_player_dismissed_v1";

const DEMO_LYRICS = [
  { start: 0, end: 12, text: "Late night driving, city lights glow slow" },
  { start: 12, end: 26, text: "On danse encore meme quand le ciel tombe" },
  { start: 26, end: 40, text: "Your voice in the speakers, soft and low" },
  { start: 40, end: 58, text: "Je suis le rythme, tu suis l'ombre" },
  { start: 58, end: 76, text: "Afro sunset, colors on my skin" },
  { start: 76, end: 96, text: "Chaque minute frappe comme un tambour" },
  { start: 96, end: 120, text: "We move together, let the night begin" },
  { start: 120, end: 148, text: "Les paroles tombent au bon tempo toujours" },
  { start: 148, end: 176, text: "Hold that moment, don't let it fade away" },
  { start: 176, end: 214, text: "Encore une boucle avant le lever du jour" },
];

let root = null;
let expandedShellEl = null;
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
let stageMetaEl = null;
let lyricsPanelEl = null;
let subtitleOverlayEl = null;
let lyricsToggleBtn = null;
let subtitleToggleBtn = null;

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

function normalizeLyrics(rawLyrics, fallbackTitle) {
  const base = Array.isArray(rawLyrics) && rawLyrics.length
    ? rawLyrics
    : String(fallbackTitle || "").trim().toLowerCase() === "afro sunset"
      ? DEMO_LYRICS
      : [];

  return base
    .map((line) => ({
      start: Math.max(0, Number(line?.start || 0)),
      end: Math.max(0, Number(line?.end || 0)),
      text: String(line?.text || "").trim(),
    }))
    .filter((line) => line.text && line.end > line.start);
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

  return Number(current.time || 0);
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

  return Number(current.duration || 0);
}

function setPlayPauseIcon(playing) {
  if (!playPauseBtn) return;
  const isPlaying = Boolean(playing);
  playPauseBtn.textContent = isPlaying ? "||" : ">";
  playPauseBtn.title = isPlaying ? "Pause" : "Lecture";
  playPauseBtn.setAttribute("aria-label", playPauseBtn.title);
}

function findActiveLyric() {
  const lyrics = Array.isArray(current?.lyrics) ? current.lyrics : [];
  if (!lyrics.length) return { activeLine: null, nearby: [] };

  const now = getCurrentTimeSeconds();
  const index = lyrics.findIndex((line) => now >= line.start && now < line.end);
  const safeIndex = index === -1 ? 0 : index;
  return {
    activeLine: lyrics[safeIndex] || null,
    nearby: lyrics.slice(Math.max(0, safeIndex - 1), Math.min(lyrics.length, safeIndex + 3)),
  };
}

function renderLyrics() {
  if (!lyricsPanelEl || !subtitleOverlayEl || !lyricsToggleBtn || !subtitleToggleBtn) return;

  const hasLyrics = Array.isArray(current?.lyrics) && current.lyrics.length > 0;
  const enabled = Boolean(current?.lyricsEnabled);
  const subtitleStyle = String(current?.subtitleStyle || "overlay");
  const mode = String(current?.mode || "audio");
  const { activeLine, nearby } = findActiveLyric();

  lyricsToggleBtn.classList.toggle("is-active", enabled);
  subtitleToggleBtn.classList.toggle("is-active", subtitleStyle === "overlay");
  subtitleToggleBtn.textContent = subtitleStyle === "overlay" ? "Sous-titres overlay" : "Paroles panneau";
  lyricsToggleBtn.disabled = !hasLyrics;
  subtitleToggleBtn.disabled = !hasLyrics;

  const showOverlay = hasLyrics && enabled && mode === "video" && subtitleStyle === "overlay" && activeLine;
  subtitleOverlayEl.hidden = !showOverlay;
  subtitleOverlayEl.textContent = showOverlay ? activeLine.text : "";

  if (!hasLyrics) {
    lyricsPanelEl.innerHTML = `<p class="gmp-lyrics-empty">Paroles indisponibles pour cette lecture.</p>`;
    return;
  }

  if (!enabled) {
    lyricsPanelEl.innerHTML = `<p class="gmp-lyrics-empty">Active le bouton paroles pour afficher les mots au bon moment.</p>`;
    return;
  }

  if (mode === "video" && subtitleStyle === "overlay") {
    lyricsPanelEl.innerHTML = `<p class="gmp-lyrics-empty">Les paroles sont affichees directement sur la video.</p>`;
    return;
  }

  lyricsPanelEl.innerHTML = nearby
    .map((line) => `<p class="gmp-lyric-line ${activeLine?.text === line.text ? "is-active" : ""}">${escapeHtml(line.text)}</p>`)
    .join("");
}

function updateTimeline() {
  if (!curEl || !durEl || !seekEl) return;
  const cur = getCurrentTimeSeconds();
  const dur = getDurationSeconds();
  current.time = cur;
  current.duration = dur;
  curEl.textContent = formatTime(cur);
  durEl.textContent = formatTime(dur);
  seekEl.value = String(dur > 0 ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0);
  renderLyrics();
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
  if (expandedShellEl) expandedShellEl.hidden = !expanded;
  if (backBtn) backBtn.hidden = !expanded;
  if (expandBtn) {
    expandBtn.textContent = expanded ? "-" : "+";
    expandBtn.title = expanded ? "Reduire" : "Agrandir";
    expandBtn.setAttribute("aria-label", expandBtn.title);
  }
}

function renderMeta(meta) {
  if (!root) return;

  titleEl.textContent = String(meta?.title || "Lecture");
  subEl.textContent = String(meta?.subtitle || "");
  coverEl.innerHTML = meta?.cover
    ? `<img src="${escapeHtml(String(meta.cover))}" alt="" />`
    : `<span class="gmp-cover-fallback">${meta?.mode === "video" ? "V" : "A"}</span>`;

  root.classList.toggle("audio-only", String(meta?.mode || "audio") === "audio");
  modeBtn.textContent = meta?.mode === "audio" ? "A" : "V";
  modeBtn.title = meta?.mode === "audio" ? "Mode audio" : "Mode video";
  modeBtn.setAttribute("aria-label", modeBtn.title);

  if (stageMetaEl) {
    stageMetaEl.innerHTML = `
      <p class="gmp-kicker">Now Playing</p>
      <p class="gmp-stage-title">${escapeHtml(String(meta?.title || "Lecture"))}</p>
      <p class="gmp-stage-sub">${escapeHtml(String(meta?.subtitle || ""))}</p>
    `;
  }

  renderLyrics();
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
    next.duration = Number(fileMediaEl.duration || next.duration || 0);
    next.playing = !fileMediaEl.paused;
  }
  if (next.provider === "youtube" && ytPlayer?.getCurrentTime) {
    try {
      next.time = Number(ytPlayer.getCurrentTime() || 0);
      next.duration = Number(ytPlayer.getDuration?.() || next.duration || 0);
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
        const targetVolume = Math.round(Math.max(0, Math.min(1, Number(volEl?.value || 1))) * 100);
        try {
          ytPlayer?.setVolume?.(targetVolume);
        } catch {
          // ignore
        }

        if (listId && !videoId && ytPlayer?.loadPlaylist) {
          try {
            ytPlayer.loadPlaylist({
              list: listId,
              listType: "playlist",
              index: 0,
              startSeconds: Math.max(0, Math.floor(Number(state.time || 0))),
            });
          } catch {
            // ignore
          }
        }

        if (state.playing) {
          try {
            ytPlayer?.playVideo?.();
          } catch {
            // ignore
          }
        }
        snapshot();
      },
      onStateChange: () => snapshot(),
    },
  });

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
  fileMediaEl.volume = Math.max(0, Math.min(1, Number(state.volume ?? volEl?.value ?? 1)));
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
    duration: Math.max(0, Number(state.duration || 0)),
    volume: Math.max(0, Math.min(1, Number(state.volume ?? volEl?.value ?? 1))),
    lyrics: normalizeLyrics(state.lyrics, state.title),
    lyricsEnabled: state.lyricsEnabled !== false,
    subtitleStyle: state.subtitleStyle === "panel" ? "panel" : "overlay",
    updatedAt: Date.now(),
  };

  if (volEl) volEl.value = String(current.volume);

  renderMeta(current);
  clearDismissed();
  setUiVisible(true);
  setExpanded(false);
  destroyEngines();

  if (current.provider === "youtube") {
    playYouTube(current).then((ok) => {
      if (!ok) stop();
    });
  } else if (!playFile(current)) {
    stop();
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
      // ignore
    }
  }

  if (current.provider === "file" && fileMediaEl) {
    fileMediaEl.currentTime = Math.max(0, Number(fileMediaEl.currentTime || 0) - 10);
    snapshot();
    return;
  }

  if (current.provider === "youtube" && ytPlayer?.seekTo && ytPlayer?.getCurrentTime) {
    try {
      ytPlayer.seekTo(Math.max(0, Number(ytPlayer.getCurrentTime() || 0) - 10), true);
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
      // ignore
    }
  }

  if (current.provider === "file" && fileMediaEl) {
    fileMediaEl.currentTime = Math.max(0, Number(fileMediaEl.currentTime || 0) + 10);
    snapshot();
    return;
  }

  if (current.provider === "youtube" && ytPlayer?.seekTo && ytPlayer?.getCurrentTime) {
    try {
      ytPlayer.seekTo(Math.max(0, Number(ytPlayer.getCurrentTime() || 0) + 10), true);
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
  writeState(current);
}

function toggleLyrics() {
  if (!current?.lyrics?.length) return;
  current.lyricsEnabled = !current.lyricsEnabled;
  renderLyrics();
  writeState(current);
}

function toggleSubtitleStyle() {
  if (!current?.lyrics?.length) return;
  current.subtitleStyle = current.subtitleStyle === "overlay" ? "panel" : "overlay";
  renderLyrics();
  writeState(current);
}

function toggleExpanded() {
  if (!current) return;
  setExpanded(!expanded);
}

function stop() {
  destroyEngines();
  expanded = false;
  setUiVisible(false);
  if (root) root.remove();

  root = null;
  expandedShellEl = null;
  coverEl = null;
  titleEl = null;
  subEl = null;
  playPauseBtn = null;
  prevBtn = null;
  nextBtn = null;
  modeBtn = null;
  expandBtn = null;
  closeBtn = null;
  backBtn = null;
  hostEl = null;
  fileMediaEl = null;
  seekEl = null;
  volEl = null;
  curEl = null;
  durEl = null;
  stageMetaEl = null;
  lyricsPanelEl = null;
  subtitleOverlayEl = null;
  lyricsToggleBtn = null;
  subtitleToggleBtn = null;
  current = null;

  markDismissed();
  clearState();
  document.body.classList.remove("has-global-player");
}

function disposeDomOnly() {
  if (root) root.remove();
  root = null;
  expandedShellEl = null;
  coverEl = null;
  titleEl = null;
  subEl = null;
  playPauseBtn = null;
  prevBtn = null;
  nextBtn = null;
  modeBtn = null;
  expandBtn = null;
  closeBtn = null;
  backBtn = null;
  hostEl = null;
  fileMediaEl = null;
  seekEl = null;
  volEl = null;
  curEl = null;
  durEl = null;
  stageMetaEl = null;
  lyricsPanelEl = null;
  subtitleOverlayEl = null;
  lyricsToggleBtn = null;
  subtitleToggleBtn = null;
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
  lyricsToggleBtn?.addEventListener("click", toggleLyrics);
  subtitleToggleBtn?.addEventListener("click", toggleSubtitleStyle);

  const hardClose = (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    stop();
  };
  closeBtn?.addEventListener("click", hardClose);

  seekEl?.addEventListener("input", () => {
    if (!current) return;
    const dur = getDurationSeconds();
    const target = dur > 0 ? (Number(seekEl.value || 0) / 100) * dur : 0;

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
    if (current) current.volume = v;
    if (fileMediaEl) fileMediaEl.volume = v;
    try {
      ytPlayer?.setVolume?.(Math.round(v * 100));
    } catch {
      // ignore
    }
    if (current) writeState(current);
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
    expandedShellEl = existing.querySelector("#gmpExpandedShell");
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
    stageMetaEl = existing.querySelector("#gmpStageMeta");
    lyricsPanelEl = existing.querySelector("#gmpLyricsPanel");
    subtitleOverlayEl = existing.querySelector("#gmpSubtitleOverlay");
    lyricsToggleBtn = existing.querySelector("#gmpLyricsToggle");
    subtitleToggleBtn = existing.querySelector("#gmpSubtitleToggle");
    fileMediaEl = existing.querySelector("video");
    bindUiEvents();
    return;
  }

  const el = document.createElement("div");
  el.id = "globalMiniPlayer";
  el.className = "spotify-player audio-only";
  el.hidden = true;
  el.innerHTML = `
    <div class="gmp-expanded-shell" id="gmpExpandedShell" hidden>
      <div class="gmp-expanded-card">
        <div class="gmp-stage">
          <div class="gmp-stage-media">
            <div class="gmp-video-host" id="gmpHost">
              <button class="btn icon gmp-video-back" type="button" id="gmpBack" aria-label="Retour" title="Retour" hidden><</button>
            </div>
            <div class="gmp-subtitle-overlay" id="gmpSubtitleOverlay" hidden></div>
          </div>
          <div class="gmp-stage-meta" id="gmpStageMeta"></div>
        </div>
        <div class="gmp-expanded-side">
          <div class="gmp-side-card">
            <div class="gmp-side-row">
              <p class="gmp-side-title">Paroles synchronisees</p>
              <div class="gmp-toggle-row">
                <button class="gmp-pill-btn" type="button" id="gmpLyricsToggle">Paroles</button>
                <button class="gmp-pill-btn" type="button" id="gmpSubtitleToggle">Sous-titres overlay</button>
              </div>
            </div>
            <div class="gmp-lyrics-panel" id="gmpLyricsPanel"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="gmp-bar">
      <div class="gmp-left">
        <div class="gmp-cover" id="gmpCover"></div>
        <div class="gmp-meta">
          <div class="gmp-title" id="gmpTitle">Lecture</div>
          <div class="gmp-sub" id="gmpSub"></div>
        </div>
      </div>
      <div class="gmp-center">
        <div class="gmp-actions">
          <button class="btn icon" type="button" id="gmpMode" aria-label="Mode video" title="Mode video">V</button>
          <button class="btn icon" type="button" id="gmpPrev" aria-label="Precedent" title="Precedent"><<</button>
          <button class="btn icon main" type="button" id="gmpPlayPause" aria-label="Lecture/Pause" title="Lecture/Pause">></button>
          <button class="btn icon" type="button" id="gmpNext" aria-label="Suivant" title="Suivant">>></button>
        </div>
        <div class="gmp-progress">
          <small id="gmpCur">0:00</small>
          <input id="gmpSeek" class="gmp-seek" type="range" min="0" max="100" step="1" value="0" />
          <small id="gmpDur">0:00</small>
        </div>
      </div>
      <div class="gmp-right">
        <div class="gmp-volume-box">
          <span class="gmp-volume-label">Vol</span>
          <input id="gmpVol" class="gmp-vol" type="range" min="0" max="1" step="0.01" value="1" />
        </div>
        <button class="btn icon" type="button" id="gmpExpand" aria-label="Agrandir" title="Agrandir">+</button>
        <button class="btn danger icon" type="button" id="gmpClose" aria-label="Fermer" title="Fermer">x</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  root = el;
  expandedShellEl = el.querySelector("#gmpExpandedShell");
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
  stageMetaEl = el.querySelector("#gmpStageMeta");
  lyricsPanelEl = el.querySelector("#gmpLyricsPanel");
  subtitleOverlayEl = el.querySelector("#gmpSubtitleOverlay");
  lyricsToggleBtn = el.querySelector("#gmpLyricsToggle");
  subtitleToggleBtn = el.querySelector("#gmpSubtitleToggle");

  fileMediaEl = document.createElement("video");
  fileMediaEl.preload = "metadata";
  fileMediaEl.controls = false;
  fileMediaEl.playsInline = true;
  fileMediaEl.style.width = "100%";
  fileMediaEl.style.height = "100%";
  fileMediaEl.style.objectFit = "cover";
  fileMediaEl.volume = 1;
  hostEl.appendChild(fileMediaEl);

  bindUiEvents();
  setExpanded(false);
}

export function initGlobalPlayer() {
  buildUi();

  if (isDismissed()) {
    clearState();
    destroyEngines();
    disposeDomOnly();
  }

  buildUi();
  restore();

  window.supcontentPlayer = {
    playYouTube({ url, title = "YouTube", subtitle = "", cover = "", mode = "audio", lyrics = [] }) {
      start({ provider: "youtube", url, title, subtitle, cover, mode, lyrics, playing: true });
    },
    playMedia({ url, title = "Media", subtitle = "", cover = "", mode = "video", lyrics = [] }) {
      start({ provider: "file", url, title, subtitle, cover, mode, lyrics, playing: true });
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
