import { apiFetch, toast, getTokens, serverLogout } from "/app.js";

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

function pickItems(data) {
  return data?.items || data?.tracks?.items || data?.albums?.items || data?.artists?.items || [];
}

function makeTile(item) {
  const img = item?.images?.[0]?.url || item?.album?.images?.[0]?.url || item?.album?.images?.[1]?.url || "";

  const title = item?.name || "Sans titre";
  const sub = item?.artists?.map((a) => a.name).join(", ") || item?.type || "";
  const type = item?.type || "track";
  const id = item?.id || "";

  const a = document.createElement("a");
  a.className = "tile";
  a.href = id ? `/media?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}` : "#";
  a.style.textDecoration = "none";
  a.style.color = "inherit";

  const cover = document.createElement("div");
  cover.className = "cover";
  if (img) cover.style.backgroundImage = `url('${img}')`;

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
  a.href = person.href || "/profile.html";
  a.style.textDecoration = "none";
  a.style.color = "inherit";

  const ring = document.createElement("div");
  ring.className = "story-ring";

  const avatar = document.createElement("div");
  avatar.className = "story-avatar";
  if (person.avatar) avatar.style.backgroundImage = `url('${person.avatar}')`;
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

function fillStories(trackEl) {
  if (!trackEl) return;

  const followed = [
    { name: "Ayoub", handle: "@ayoub93", avatar: "https://i.pravatar.cc/160?img=12", href: "/profile.html" },
    { name: "Lea", handle: "@lea.music", avatar: "https://i.pravatar.cc/160?img=47", href: "/profile.html" },
    { name: "Nora", handle: "@nora.vibes", avatar: "https://i.pravatar.cc/160?img=33", href: "/profile.html" },
    { name: "Ibra", handle: "@ibra.flow", avatar: "https://i.pravatar.cc/160?img=53", href: "/profile.html" },
    { name: "Maya", handle: "@maya.pop", avatar: "https://i.pravatar.cc/160?img=24", href: "/profile.html" },
    { name: "Rayan", handle: "@rayan.rap", avatar: "https://i.pravatar.cc/160?img=61", href: "/profile.html" },
  ];

  trackEl.innerHTML = "";
  followed.forEach((p) => trackEl.appendChild(makeStoryTile(p)));
}

async function fillTrack(trackEl, { q, type = "track", limit = 10 }) {
  trackEl.innerHTML = `<small style="color:var(--muted)">Chargement Spotify...</small>`;

  try {
    const data = await apiFetch(`/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&page=1&limit=${limit}`);
    const items = pickItems(data);

    trackEl.innerHTML = "";
    if (!items.length) {
      trackEl.innerHTML = `<small style="color:var(--muted)">Aucun resultat pour "${q}".</small>`;
      return;
    }

    items.forEach((it) => trackEl.appendChild(makeTile(it)));
  } catch (err) {
    console.error("Spotify fill error:", err);
    trackEl.innerHTML = `<small style="color:#ffb0b0">Erreur: ${err?.message || "Spotify"}</small>`;
    toast(err?.message || "Erreur Spotify", "Erreur");
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
  fillStories(document.querySelector("#storiesTrack"));

  const sections = [
    { key: "trending", q: "Top hits", type: "track" },
    { key: "rap", q: "Rap francais", type: "track" },
    { key: "afro", q: "Afrobeats", type: "track" },
    { key: "pop", q: "Pop hits", type: "track" },
  ];

  for (const s of sections) {
    enhanceCarousel(s.key);
    const trackEl = document.querySelector(`.carousel-track[data-track="${s.key}"]`);
    if (trackEl) await fillTrack(trackEl, { q: s.q, type: s.type, limit: 10 });
  }
}

main();
