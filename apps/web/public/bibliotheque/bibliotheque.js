import { apiFetch, toast, escapeHtml, resolveMediaUrl, requireLogin } from "/noyau/app.js";

const collectionsBox = document.querySelector("#collectionsBox");
const refreshBtn = document.querySelector("#refreshBtn");
const newListBtn = document.querySelector("#newListBtn");
const playHeroBtn = document.querySelector("#playHeroBtn");
const heroTitle = document.querySelector("#heroTitle");
const heroDesc = document.querySelector("#heroDesc");
const heroCover = document.querySelector("#heroCover");
const chips = Array.from(document.querySelectorAll(".library-chip[data-filter]"));
const nowPlayingCover = document.querySelector("#nowPlayingCover");
const nowPlayingTitle = document.querySelector("#nowPlayingTitle");
const nowPlayingSub = document.querySelector("#nowPlayingSub");
const openNowBtn = document.querySelector("#openNowBtn");
const favoriteNowBtn = document.querySelector("#favoriteNowBtn");
const similarBox = document.querySelector("#similarBox");
const mergePlaylistsBtn = document.querySelector("#mergePlaylistsBtn");
const playMusicBtn = document.querySelector("#playMusicBtn");
const syncPlatformsBtn = document.querySelector("#syncPlatformsBtn");
const favoritesOnlyBtn = document.querySelector("#favoritesOnlyBtn");
const FAV_STORAGE_KEY = "supcontent_library_favs_v1";

let currentFilter = "all";
let allRows = [];
let currentNow = null;
let mergedMode = false;
let showFavoritesOnly = false;
const favorites = new Set(readFavorites());

function readFavorites() {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((x) => String(x || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function persistFavorites() {
  localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
}

function mediaHref(type, id) {
  const safeType = String(type || "").trim();
  const safeId = String(id || "").trim();
  if (!safeType || !safeId) return "#";
  const q = `type=${encodeURIComponent(safeType)}&id=${encodeURIComponent(safeId)}`;
  return `/media/media.html?${q}#${q}`;
}

function isYouTubeUrl(url) {
  const s = String(url || "").toLowerCase();
  return s.includes("youtube.com") || s.includes("youtu.be") || s.includes("music.youtube.com");
}

function externalYouTubeHref(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return "#";
  const q = `ext=youtube&url=${encodeURIComponent(safeUrl)}`;
  return `/media/media.html?${q}#${q}`;
}

function mediaTargetHref(row) {
  const yt =
    String(row?.youtube_url || "").trim() ||
    String(row?.source_url || "").trim() ||
    String(row?.spotify_url || "").trim();
  if (yt && isYouTubeUrl(yt)) return externalYouTubeHref(yt);
  return row?.href || "#";
}

function playRowInline(row) {
  const player = window.supcontentPlayer;
  if (!player?.playYouTube) return false;
  const yt =
    String(row?.youtube_url || "").trim() ||
    String(row?.source_url || "").trim() ||
    String(row?.spotify_url || "").trim();
  if (!yt || !isYouTubeUrl(yt)) return false;
  player.playYouTube({
    url: yt,
    title: String(row?.name || "YouTube"),
    subtitle: String(row?.subtitle || row?.collectionName || ""),
    cover: String(row?.image || ""),
    mode: "audio",
  });
  return true;
}

function normalizeRows(collections) {
  const rows = [];
  for (const col of collections) {
    const items = Array.isArray(col?.items) ? col.items : [];
    for (const it of items) {
      rows.push({
        collectionId: String(col?.id || ""),
        collectionName: String(col?.name || "Playlist"),
        media_type: String(it?.media_type || ""),
        media_id: String(it?.media_id || ""),
        name: String(it?.media?.name || it?.media_id || "Sans titre"),
        subtitle: String(it?.media?.subtitle || ""),
        image: resolveMediaUrl(it?.media?.image || ""),
        href: mediaHref(it?.media_type, it?.media_id),
        spotify_url: String(it?.media?.spotify_url || ""),
        source_url: String(it?.media?.source_url || ""),
        youtube_url: String(it?.media?.youtube_url || ""),
      });
    }
  }
  return rows;
}

function applyFilter(rows) {
  let out = currentFilter === "all" ? rows : rows.filter((r) => r.media_type === currentFilter);
  if (mergedMode) {
    const seen = new Set();
    out = out.filter((r) => {
      const k = `${r.media_type}:${r.media_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  if (showFavoritesOnly) {
    out = out.filter((r) => favorites.has(`${r.media_type}:${r.media_id}`));
  }
  return out;
}

function renderHero(rows) {
  const first = rows[0] || null;
  if (!first) {
    heroTitle.textContent = "Bibliothèque vide";
    heroDesc.textContent = "Ajoute des titres/album/artistes dans tes collections.";
    heroCover.innerHTML = "";
    return;
  }
  heroTitle.textContent = first.collectionName;
  heroDesc.textContent = `Playlist ambiance • ${rows.length} éléments`;
  heroCover.innerHTML = first.image ? `<img src="${escapeHtml(first.image)}" alt="" />` : `<div class="badge">Aucune image</div>`;
}

function renderNow(row) {
  currentNow = row || null;
  if (!row) {
    nowPlayingCover.innerHTML = "";
    nowPlayingTitle.textContent = "Aucune lecture";
    nowPlayingSub.textContent = "Sélectionne un titre à gauche.";
    favoriteNowBtn.textContent = "Favori";
    similarBox.innerHTML = "";
    return;
  }

  nowPlayingCover.innerHTML = row.image ? `<img src="${escapeHtml(row.image)}" alt="" />` : `<div class="badge">No cover</div>`;
  nowPlayingTitle.textContent = row.name;
  nowPlayingSub.textContent = row.subtitle || row.collectionName;
  const key = `${row.media_type}:${row.media_id}`;
  favoriteNowBtn.textContent = favorites.has(key) ? "Retirer favori" : "Favori";

  const similars = allRows
    .filter((x) => x.media_type === row.media_type && x.media_id !== row.media_id)
    .slice(0, 6);
  similarBox.innerHTML = similars.length
    ? similars
        .map(
          (s) => `
        <button class="library-item" type="button" data-now="${escapeHtml(`${s.media_type}:${s.media_id}`)}">
          ${s.image ? `<img src="${escapeHtml(s.image)}" alt="" />` : `<span class="badge">${escapeHtml(s.media_type)}</span>`}
          <div class="meta"><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.subtitle || s.collectionName)}</small></div>
        </button>
      `
        )
        .join("")
    : `<small>Aucune suggestion.</small>`;

  similarBox.querySelectorAll("[data-now]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key2 = String(btn.getAttribute("data-now") || "");
      const target = allRows.find((x) => `${x.media_type}:${x.media_id}` === key2);
      if (target) renderNow(target);
    });
  });
}

function renderGrid() {
  const rows = applyFilter(allRows);
  renderHero(rows);

  if (!rows.length) {
    collectionsBox.innerHTML = `<small>Aucun élément pour ce filtre.</small>`;
    renderNow(null);
    return;
  }

  collectionsBox.innerHTML = rows
    .map(
      (r) => `
      <button class="library-item" type="button" data-open="${escapeHtml(`${r.media_type}:${r.media_id}`)}">
        ${r.image ? `<img src="${escapeHtml(r.image)}" alt="" />` : `<span class="badge">${escapeHtml(r.media_type)}</span>`}
        <div class="meta">
          <strong>${escapeHtml(r.name)}</strong>
          <small>${escapeHtml(r.subtitle || r.collectionName)}</small>
        </div>
        <span class="badge">${favorites.has(`${r.media_type}:${r.media_id}`) ? "★" : escapeHtml(r.media_type)}</span>
      </button>
    `
    )
    .join("");

  collectionsBox.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = String(btn.getAttribute("data-open") || "");
      const row = allRows.find((x) => `${x.media_type}:${x.media_id}` === key);
      if (row) renderNow(row);
    });
  });

  if (!currentNow) renderNow(rows[0]);
}

async function loadCollections() {
  if (!requireLogin({ redirect: false })) {
    collectionsBox.innerHTML = `<small>Connecte-toi pour afficher ta bibliothèque.</small>`;
    return;
  }
  collectionsBox.innerHTML = `<small>Chargement...</small>`;
  try {
    const r = await apiFetch("/collections/me?include_items=1");
    const collections = Array.isArray(r?.collections) ? r.collections : [];
    allRows = normalizeRows(collections);
    renderGrid();
  } catch (err) {
    const msg = String(err?.message || "");
    if (/token manquant/i.test(msg)) {
      collectionsBox.innerHTML = `<small>Connecte-toi pour afficher ta bibliothèque.</small>`;
      return;
    }
    collectionsBox.innerHTML = `<small style="color:#ffb0b0">${escapeHtml(msg || "Erreur")}</small>`;
    toast(msg || "Erreur chargement bibliothèque", "Erreur");
  }
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const v = String(chip.getAttribute("data-filter") || "all");
    currentFilter = ["all", "track", "artist", "album"].includes(v) ? v : "all";
    chips.forEach((c) => c.classList.toggle("is-active", c === chip));
    renderGrid();
  });
});

refreshBtn?.addEventListener("click", () => {
  if (!requireLogin({ redirect: true })) return;
  loadCollections().catch((err) => toast(err?.message || "Erreur", "Erreur"));
});

newListBtn?.addEventListener("click", async () => {
  if (!requireLogin({ redirect: true })) return;
  const name = window.prompt("Nom de la nouvelle playlist :", "");
  if (!name || !name.trim()) return;
  try {
    await apiFetch("/collections", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), is_public: false }),
    });
    toast("Playlist créée.", "OK");
    await loadCollections();
  } catch (err) {
    toast(err?.message || "Création impossible", "Erreur");
  }
});

playHeroBtn?.addEventListener("click", () => {
  const target = applyFilter(allRows)[0] || null;
  if (!target) return;
  if (playRowInline(target)) return;
  window.location.href = mediaTargetHref(target);
});

openNowBtn?.addEventListener("click", () => {
  if (!currentNow) return;
  if (playRowInline(currentNow)) return;
  window.location.href = mediaTargetHref(currentNow);
});

favoriteNowBtn?.addEventListener("click", () => {
  if (!requireLogin({ redirect: true })) return;
  if (!currentNow) return;
  const key = `${currentNow.media_type}:${currentNow.media_id}`;
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  persistFavorites();
  renderNow(currentNow);
  renderGrid();
});

mergePlaylistsBtn?.addEventListener("click", () => {
  if (!requireLogin({ redirect: true })) return;
  mergedMode = !mergedMode;
  mergePlaylistsBtn.classList.toggle("primary", mergedMode);
  mergePlaylistsBtn.textContent = mergedMode ? "Mode fusion actif" : "Fusionner les playlists";
  renderGrid();
});

playMusicBtn?.addEventListener("click", () => {
  const target = applyFilter(allRows)[0] || currentNow || null;
  if (!target) return;
  if (playRowInline(target)) return;
  window.location.href = mediaTargetHref(target);
});

syncPlatformsBtn?.addEventListener("click", async () => {
  if (!requireLogin({ redirect: true })) return;
  try {
    await loadCollections();
    toast("Synchronisation terminée.", "OK");
  } catch (err) {
    toast(err?.message || "Sync impossible", "Erreur");
  }
});

favoritesOnlyBtn?.addEventListener("click", () => {
  if (!requireLogin({ redirect: true })) return;
  showFavoritesOnly = !showFavoritesOnly;
  favoritesOnlyBtn.classList.toggle("primary", showFavoritesOnly);
  favoritesOnlyBtn.textContent = showFavoritesOnly ? "Tous les éléments" : "Favoris uniquement";
  renderGrid();
});

loadCollections().catch((err) => toast(err?.message || "Erreur", "Erreur"));
