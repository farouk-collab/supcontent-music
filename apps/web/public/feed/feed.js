import { apiFetch, toast, getTokens, serverLogout, escapeHtml, resolveMediaUrl } from "/core/app.js";
import { initHomeNotifications } from "/notifications/notifications.js";

console.log("INDEX JS LOADED");

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

  if (hint) hint.textContent = isAuthed ? "Connecte" : "Non connecte";
}

function bindLogout() {
  const logoutLink = document.querySelector('[data-auth="logout"]');
  if (!logoutLink) return;
  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    await serverLogout();
    syncAuthUI();
    toast("Deconnecte.", "OK");
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
  const albumUrl = String(item?.album?.images?.[0]?.url || "").trim();
  const fallbackUrl = String(item?.images?.[0]?.url || "").trim();
  const pick = albumUrl || fallbackUrl;
  if (!pick) return "";
  if (!/^https?:\/\//i.test(pick)) return "";
  if (pick.startsWith("/stk/")) return "";
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
  a.className = "tile story-tile";
  a.href = person.href || "/profile/profile.html";
  a.style.textDecoration = "none";
  a.style.color = "inherit";

  const ring = document.createElement("div");
  ring.className = "story-ring";

  const avatar = document.createElement("div");
  avatar.className = "story-avatar";
  if (person.avatar) avatar.style.backgroundImage = `url('${resolveMediaUrl(person.avatar)}')`;
  else avatar.textContent = "o";
  ring.appendChild(avatar);

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
  if (!getTokens().accessToken) {
    if (trackEl) trackEl.innerHTML = `<small style="color:var(--muted)">Connecte-toi pour voir tes abonnements.</small>`;
    if (homeTrackEl) homeTrackEl.innerHTML = `<small style="color:var(--muted)">Connecte-toi pour voir les stories.</small>`;
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
        href: "/profile/profile.html?compose=1",
      });
    }
    for (const u of following) {
      people.push({
        id: String(u.id || ""),
        name: u.display_name || u.username || "profil",
        handle: `@${u.username || "user"}`,
        avatar: u.avatar_url || "",
        href: `/profile/profile.html?user=${encodeURIComponent(String(u.id || ""))}`,
      });
    }

    const withStories = people
      .map((p) => {
        const stories = readUserStories(p.id);
        return { ...p, hasStory: stories.length > 0 };
      })
      .filter((p) => p.id === String(me?.id || "") || p.hasStory);

    fillStories(trackEl, withStories);
    fillStories(homeTrackEl, withStories);
  } catch {
    if (trackEl) trackEl.innerHTML = `<small style="color:#ffb0b0">Impossible de charger les abonnements.</small>`;
    if (homeTrackEl) homeTrackEl.innerHTML = `<small style="color:#ffb0b0">Impossible de charger les stories.</small>`;
  }
}

function bindHomeHeaderActions() {
  const addBtn = document.querySelector("#homeAddStoryBtn");

  addBtn?.addEventListener("click", () => {
    if (!getTokens().accessToken) {
      window.location.href = "/auth/auth.html";
      return;
    }
    window.location.href = "/profile/profile.html?compose=1";
  });
  initHomeNotifications(loadStoriesFromFollowing);
}

function renderReleaseCard(it) {
  const href = it?.id ? mediaHref("album", it.id) : "#";
  const title = it?.name || "Sans titre";
  const img = it?.image || "";
  const artists = Array.isArray(it?.artists) ? it.artists.join(", ") : "";
  const date = it?.release_date || "";
  return `
    <a class="news-item" href="${href}">
      <div class="news-cover">${img ? `<img src="${img}" alt="">` : `<span class="badge">album</span>`}</div>
      <div>
        <div class="news-title">${title}</div>
        <div class="news-sub">${artists}</div>
        <div class="news-meta">${date}</div>
      </div>
    </a>
  `;
}

function renderCommunityCard(it) {
  const href = mediaHref(it.media_type, it.media_id);
  const mediaName = it?.media?.name || it.media_id;
  const mediaSub = it?.media?.subtitle || "";
  const img = it?.media?.image || "";
  const kind = it.kind === "review" ? "Review" : "Commentaire";
  const rating = typeof it.rating === "number" ? ` • ${it.rating}/5` : "";
  const author = it.display_name || "Utilisateur";
  const text = it.text || "";
  return `
    <a class="news-item" href="${href}">
      <div class="news-cover">${img ? `<img src="${img}" alt="">` : `<span class="badge">${it.media_type}</span>`}</div>
      <div>
        <div class="news-title">${mediaName}</div>
        <div class="news-sub">${mediaSub}</div>
        <div class="news-meta">${kind}${rating} • par ${author}</div>
        ${text ? `<div class="news-text">${text}</div>` : ""}
      </div>
    </a>
  `;
}

async function loadMusicNews() {
  const releasesBox = document.querySelector("#newsReleases");
  const communityBox = document.querySelector("#newsCommunity");
  if (!releasesBox || !communityBox) return;

  releasesBox.innerHTML = `<small>Chargement...</small>`;
  communityBox.innerHTML = `<small>Chargement...</small>`;

  try {
    const data = await apiFetch("/music/news?limit=8");
    const releases = Array.isArray(data?.releases) ? data.releases : [];
    const community = Array.isArray(data?.community) ? data.community : [];

    releasesBox.innerHTML = releases.length
      ? releases.slice(0, 8).map(renderReleaseCard).join("")
      : `<small>Aucune nouvelle sortie.</small>`;
    communityBox.innerHTML = community.length
      ? community.slice(0, 8).map(renderCommunityCard).join("")
      : `<small>Pas encore d'activite communautaire.</small>`;
  } catch (err) {
    releasesBox.innerHTML = `<small style="color:#ffb0b0">Erreur actualites.</small>`;
    communityBox.innerHTML = `<small style="color:#ffb0b0">Erreur actualites.</small>`;
    toast(err?.message || "Erreur actualites musique", "Erreur");
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
    <a class="news-item" href="${href}">
      <div class="news-cover">${image ? `<img src="${image}" alt="">` : `<span class="badge">${escapeHtml(String(it.media_type || ""))}</span>`}</div>
      <div>
        <div class="news-title">${escapeHtml(media.name || it.media_id || "")}</div>
        <div class="news-sub">${escapeHtml(media.subtitle || "")}</div>
        <div class="news-meta">${escapeHtml(who)} ${escapeHtml(kindLabel)}${escapeHtml(rating)}</div>
        ${text ? `<div class="news-text">${escapeHtml(text)}</div>` : ""}
      </div>
    </a>
  `;
}

async function loadFollowingFeed() {
  const box = document.querySelector("#followingFeed");
  if (!box) return;

  if (!getTokens().accessToken) {
    box.innerHTML = `<small>Connecte-toi pour voir le fil de tes abonnements.</small>`;
    return;
  }

  box.innerHTML = `<small>Chargement feed...</small>`;
  try {
    const data = await apiFetch("/feed/me?limit=12");
    const items = Array.isArray(data?.items) ? data.items : [];
    box.innerHTML = items.length
      ? items.map(renderFollowingFeedItem).join("")
      : `<small>Aucune activite recente des comptes suivis.</small>`;
  } catch (err) {
    box.innerHTML = `<small style="color:#ffb0b0">Erreur feed.</small>`;
    toast(err?.message || "Erreur feed", "Erreur");
  }
}

async function fillTrack(trackEl, { q, type = "track", limit = 10 }) {
  trackEl.innerHTML = `<small style="color:var(--muted)">Chargement Spotify...</small>`;
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
    const heroRow = document.querySelector(".hero .row");
    if (!heroRow) return;
    const btn = document.createElement("button");
    btn.id = "connectSpotifyBtn";
    btn.type = "button";
    btn.className = "btn";
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
        setFeedModeHint("personnalise Spotify");
      } catch (err) {
        console.warn("Personalized feed failed, fallback to global:", err);
        data = await apiFetch("/music/categories?limit=12");
        setFeedModeHint("global (fallback)");
      }
    } else {
      if (hasSupcontentSession) ensureSpotifyConnectButton();
      data = await apiFetch("/music/categories?limit=12");
      setFeedModeHint(hasSupcontentSession ? "global (Spotify non connecte)" : "global");
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
      if (!items.length) {
        trackEl.innerHTML = personalizedMode
          ? `<small style="color:var(--muted)">Pas assez d'historique Spotify pour cette categorie.</small>`
          : `<small style="color:var(--muted)">Aucun titre disponible pour le moment (Spotify limite les requetes).</small>`;
        continue;
      }
      items.forEach((it) => trackEl.appendChild(makeTile(it)));
    }
  } catch (err) {
    console.error("Spotify categories fill error:", err);
    for (const key of categoryKeys) {
      const trackEl = document.querySelector(`.carousel-track[data-track="${key}"]`);
      if (trackEl) {
        trackEl.innerHTML = `<small style="color:#ffb0b0">Erreur Spotify categories.</small>`;
      }
    }
    toast(err?.message || "Erreur Spotify categories", "Erreur");
  }
}

function enhanceCarousel(key) {
  const track = document.querySelector(`.carousel-track[data-track="${key}"]`);
  const prev = document.querySelector(`[data-car-prev="${key}"]`);
  const next = document.querySelector(`[data-car-next="${key}"]`);
  if (!track) return;

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
  const start = () => {
    if (timer) return;
    timer = setInterval(() => {
      const max = track.scrollWidth - track.clientWidth;
      const atEnd = track.scrollLeft >= max - 4;
      track.scrollBy({ left: atEnd ? -max : 240, behavior: "smooth" });
    }, 2200);
  };
  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  track.addEventListener("mouseenter", stop);
  track.addEventListener("mouseleave", start);
  start();
}

async function main() {
  syncAuthUI();
  bindLogout();
  bindHomeHeaderActions();
  await loadStoriesFromFollowing();
  await loadFollowingFeed();
  await loadMusicNews();
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
  await loadMusicCategories();
}

main();
