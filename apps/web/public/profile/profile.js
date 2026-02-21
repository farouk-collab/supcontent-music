import { apiFetch, toast, escapeHtml, getTokens, serverLogout, resolveMediaUrl } from "/core/app.js";

const profileView = document.querySelector("#profileView");
const socialMeta = document.querySelector("#socialMeta");
const socialLists = document.querySelector("#socialLists");
const refreshBtn = document.querySelector("#refreshBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const deleteAccountBtn = document.querySelector("#deleteAccountBtn");
const accessLenEl = document.querySelector("#accessLen");
const refreshLenEl = document.querySelector("#refreshLen");
const statusBadge = document.querySelector("#statusBadge");
const diagBox = document.querySelector("#diagBox");
const editBtn = document.querySelector("#editBtn");
const profilePostsSection = document.querySelector("#profilePostsSection");
const addContentBtn = document.querySelector("#addContentBtn");
const composerModal = document.querySelector("#composerModal");
const composerBackdrop = document.querySelector("#composerBackdrop");
const closeComposerBtn = document.querySelector("#closeComposerBtn");
const composerForm = document.querySelector("#composerForm");
const composerPreview = document.querySelector("#composerPreview");

let currentProfileUserId = "";
let isOwnProfile = false;
let pendingUploadDataUrl = "";
let pendingUploadType = "";
let composerBound = false;
let composerUserId = "";

function qs(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

function updateTokenStats() {
  const t = getTokens();
  accessLenEl.textContent = String(t.accessToken?.length || 0);
  refreshLenEl.textContent = String(t.refreshToken?.length || 0);
  statusBadge.textContent = t.accessToken ? "Connecte" : "Non connecte";
  diagBox.innerHTML = `
    <div>Origin: <code>${escapeHtml(location.origin)}</code></div>
    <div>Access token present: <strong>${t.accessToken ? "OUI" : "NON"}</strong></div>
    <div>Refresh token present: <strong>${t.refreshToken ? "OUI" : "NON"}</strong></div>
  `;
  return t;
}

function renderNeedAuth(msg) {
  profileView.innerHTML = `
    <div style="color:#ffb0b0"><strong>Connexion requise</strong></div>
    <div style="color:var(--muted);margin-top:6px">${escapeHtml(msg || "")}</div>
    <div style="margin-top:10px"><a class="btn primary" href="/auth/auth.html">Se connecter</a></div>
  `;
  socialMeta.innerHTML = "";
  socialLists.innerHTML = "";
  profilePostsSection.innerHTML = "";
}

function renderProfileCard(u, opts = {}) {
  const coverUrl = resolveMediaUrl(u.cover_url || "");
  const avatarUrl = resolveMediaUrl(u.avatar_url || "");
  const coverStyle = coverUrl
    ? `background-image:url('${escapeHtml(coverUrl)}'); background-size:cover; background-position:center;`
    : `background:linear-gradient(135deg, rgba(124,92,255,.25), rgba(0,255,209,.12));`;

  const avatar = avatarUrl
    ? `<img alt="" src="${escapeHtml(avatarUrl)}" style="width:84px;height:84px;border-radius:22px;object-fit:cover;border:1px solid rgba(255,255,255,.12)"/>`
    : `<div style="width:84px;height:84px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)"></div>`;

  const showFollow = Boolean(opts.showFollow);
  const following = Boolean(opts.following);
  const followBtn = showFollow
    ? `<button id="followToggleBtn" class="btn ${following ? "" : "primary"}" type="button">${following ? "Ne plus suivre" : "Suivre"}</button>`
    : "";

  profileView.innerHTML = `
    <div style="border:1px solid rgba(255,255,255,.10);border-radius:18px;overflow:hidden">
      <div style="height:160px;${coverStyle}"></div>
      <div style="padding:14px;display:flex;gap:14px;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:14px;align-items:center">
          ${avatar}
          <div>
            <div style="font-weight:900;font-size:22px">${escapeHtml(u.display_name || "-")}</div>
            <div style="color:var(--muted)">@${escapeHtml(u.username || "username")}</div>
            <div style="margin-top:6px;color:var(--muted)">${escapeHtml(u.email || "")}</div>
          </div>
        </div>
        <div>${followBtn}</div>
      </div>
      <div style="padding:0 14px 14px 14px;color:var(--muted)">
        <div>${escapeHtml(u.bio || "Bio vide...")}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${u.location ? `<span class="badge">${escapeHtml(u.location)}</span>` : ""}
          ${u.gender ? `<span class="badge">${escapeHtml(u.gender)}</span>` : ""}
          ${u.birth_date ? `<span class="badge">Date: ${escapeHtml(String(u.birth_date).slice(0, 10))}</span>` : ""}
          ${u.website ? `<a class="pill" href="${escapeHtml(u.website)}" target="_blank" rel="noreferrer">Site</a>` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderSocialMeta(data) {
  socialMeta.innerHTML = `
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <span class="badge">Followers: ${Number(data.followers_count || 0)}</span>
      <span class="badge">Following: ${Number(data.following_count || 0)}</span>
    </div>
  `;
}

function renderSocialLists(data) {
  const followers = Array.isArray(data.followers) ? data.followers : [];
  const following = Array.isArray(data.following) ? data.following : [];
  socialLists.innerHTML = `
    <div class="grid" style="margin-top:8px">
      <div class="card span6">
        <h3 style="margin:0 0 8px 0">Followers</h3>
        ${
          followers.length
            ? followers
                .slice(0, 10)
                .map(
                  (u) =>
                    `<a class="pill" href="/profile/profile.html?user=${encodeURIComponent(String(u.id || ""))}" style="display:inline-flex;margin:4px 6px 0 0">@${escapeHtml(
                      u.username || u.display_name || "user"
                    )}</a>`
                )
                .join("")
            : `<small style="color:var(--muted)">Aucun follower</small>`
        }
      </div>
      <div class="card span6">
        <h3 style="margin:0 0 8px 0">Following</h3>
        ${
          following.length
            ? following
                .slice(0, 10)
                .map(
                  (u) =>
                    `<a class="pill" href="/profile/profile.html?user=${encodeURIComponent(String(u.id || ""))}" style="display:inline-flex;margin:4px 6px 0 0">@${escapeHtml(
                      u.username || u.display_name || "user"
                    )}</a>`
                )
                .join("")
            : `<small style="color:var(--muted)">Aucun abonnement</small>`
        }
      </div>
    </div>
  `;
}

function postStorageKey(userId) {
  return `supcontent_profile_posts_${String(userId || "me")}`;
}

function readPosts(userId) {
  try {
    const raw = localStorage.getItem(postStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePosts(userId, entries) {
  localStorage.setItem(postStorageKey(userId), JSON.stringify(Array.isArray(entries) ? entries : []));
}

function formatRelativeFromIso(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "a l'instant";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

function renderProfilePosts(user, opts = {}) {
  if (!profilePostsSection) return;
  const userId = String(user?.id || "");
  if (!userId) {
    profilePostsSection.innerHTML = "";
    return;
  }

  const posts = readPosts(userId);
  const canCreate = Boolean(opts.canCreate);
  const canManage = Boolean(opts.canManage);

  const header = `
    <div class="card" style="margin-top:6px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h3 style="margin:0">Stories & publications</h3>
        ${
          canCreate
            ? `<button id="openComposerInlineBtn" class="btn primary" type="button">+ Ajouter</button>`
            : `<span class="badge">${posts.length} element(s)</span>`
        }
      </div>
      <small style="display:block;margin-top:6px;color:var(--muted)">Visible uniquement sur le profil.</small>
      <div id="profilePostsList" style="display:grid;gap:10px;margin-top:12px"></div>
    </div>
  `;

  profilePostsSection.innerHTML = header;

  const list = profilePostsSection.querySelector("#profilePostsList");
  if (!list) return;

  if (!posts.length) {
    list.innerHTML = `<small style="color:var(--muted)">Aucun contenu pour le moment.</small>`;
  } else {
    list.innerHTML = posts
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((p) => {
        const media = p.media_kind === "video"
          ? `<video controls preload="metadata" src="${escapeHtml(p.media_data || "")}" style="width:100%;max-height:340px;border-radius:12px;border:1px solid var(--border);background:#000"></video>`
          : `<img alt="" src="${escapeHtml(p.media_data || "")}" style="width:100%;max-height:340px;object-fit:cover;border-radius:12px;border:1px solid var(--border)" />`;
        return `
          <div class="card" style="padding:12px">
            <div class="row" style="justify-content:space-between;align-items:center">
              <div class="row" style="gap:8px">
                <span class="badge">${p.entry_type === "story" ? "Story" : "Publication"}</span>
                <small>${formatRelativeFromIso(p.created_at)}</small>
              </div>
              ${
                canManage
                  ? `<button class="btn danger delete-post-btn" type="button" data-post-id="${escapeHtml(String(p.id || ""))}">Supprimer</button>`
                  : ""
              }
            </div>
            <div style="margin-top:8px">${media}</div>
            ${p.caption ? `<div style="margin-top:8px;white-space:pre-wrap">${escapeHtml(p.caption)}</div>` : ""}
          </div>
        `;
      })
      .join("");
  }

  profilePostsSection.querySelector("#openComposerInlineBtn")?.addEventListener("click", openComposer);
  list.querySelectorAll(".delete-post-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const postId = String(btn.getAttribute("data-post-id") || "");
      if (!postId || !currentProfileUserId) return;
      const ok = window.confirm("Supprimer cette publication ?");
      if (!ok) return;
      const next = readPosts(currentProfileUserId).filter((p) => String(p.id || "") !== postId);
      writePosts(currentProfileUserId, next);
      renderProfilePosts(user, { canCreate, canManage });
      toast("Publication supprimee.", "OK");
    });
  });
}

function openComposer() {
  if (!isOwnProfile) {
    toast("Creation reservee a ton profil.", "Info");
    return;
  }
  composerModal?.removeAttribute("hidden");
  document.body.classList.add("comments-open");
}

function closeComposer() {
  composerModal?.setAttribute("hidden", "");
  document.body.classList.remove("comments-open");
  if (composerForm) composerForm.reset();
  if (composerPreview) composerPreview.innerHTML = "";
  pendingUploadDataUrl = "";
  pendingUploadType = "";
}

function bindComposer(user) {
  if (!composerForm || !composerModal || !user?.id) return;
  composerUserId = String(user.id);

  if (composerBound) return;
  composerBound = true;

  addContentBtn?.addEventListener("click", openComposer);
  composerBackdrop?.addEventListener("click", closeComposer);
  closeComposerBtn?.addEventListener("click", closeComposer);

  const fileInput = composerForm.elements.namedItem("media_file");
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      pendingUploadDataUrl = "";
      pendingUploadType = "";
      composerPreview.innerHTML = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingUploadDataUrl = String(reader.result || "");
      pendingUploadType = file.type.startsWith("video/") ? "video" : "image";
      composerPreview.innerHTML = pendingUploadType === "video"
        ? `<video controls src="${escapeHtml(pendingUploadDataUrl)}" style="width:100%;max-height:260px;border-radius:12px;border:1px solid var(--border);background:#000"></video>`
        : `<img alt="" src="${escapeHtml(pendingUploadDataUrl)}" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px;border:1px solid var(--border)" />`;
    };
    reader.readAsDataURL(file);
  });

  composerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isOwnProfile) {
      toast("Creation reservee a ton profil.", "Info");
      return;
    }
    if (!pendingUploadDataUrl) {
      toast("Ajoute une image ou video.", "Info");
      return;
    }

    const typeField = composerForm.elements.namedItem("entry_type");
    const captionField = composerForm.elements.namedItem("caption");
    const entryType = String(typeField?.value || "post") === "story" ? "story" : "post";
    const caption = String(captionField?.value || "").trim().slice(0, 600);
    const current = readPosts(composerUserId);
    const next = [
      {
        id: crypto.randomUUID(),
        user_id: composerUserId,
        entry_type: entryType,
        media_kind: pendingUploadType || "image",
        media_data: pendingUploadDataUrl,
        caption,
        created_at: new Date().toISOString()
      },
      ...current
    ].slice(0, 60);

    writePosts(composerUserId, next);
    renderProfilePosts({ id: composerUserId }, { canCreate: true, canManage: true });
    closeComposer();
    toast("Publication ajoutee au profil.", "OK");
  });
}

async function loadSelfProfile() {
  const t = updateTokenStats();
  if (!t.accessToken) {
    renderNeedAuth("Aucun token trouve dans le navigateur. Connecte-toi sur /auth.");
    return;
  }

  const [meData, followData] = await Promise.all([apiFetch("/auth/me"), apiFetch("/follows/me")]);
  currentProfileUserId = String(meData?.user?.id || "");
  isOwnProfile = true;
  renderProfileCard(meData.user, { showFollow: false });
  renderSocialMeta(followData);
  renderSocialLists(followData);
  renderProfilePosts(meData.user, { canCreate: true, canManage: true });
  bindComposer(meData.user);
  if (qs("compose") === "1") openComposer();
}

async function loadPublicProfile(viewUserId) {
  const t = updateTokenStats();
  const data = await apiFetch(`/follows/users/${encodeURIComponent(viewUserId)}`);
  currentProfileUserId = String(data?.user?.id || "");
  isOwnProfile = false;
  renderProfileCard(data.user, { showFollow: Boolean(t.accessToken), following: Boolean(data.is_following) });
  renderSocialMeta(data);
  renderSocialLists(data);
  renderProfilePosts(data.user, { canCreate: false, canManage: false });
  if (addContentBtn) addContentBtn.style.display = "none";
  if (composerModal) composerModal.setAttribute("hidden", "");

  const btn = document.querySelector("#followToggleBtn");
  btn?.addEventListener("click", async () => {
    try {
      if (!getTokens().accessToken) {
        toast("Connecte-toi pour suivre ce profil", "Info");
        return;
      }
      const currentlyFollowing = String(btn.textContent || "").toLowerCase().includes("ne plus");
      if (currentlyFollowing) await apiFetch(`/follows/${encodeURIComponent(viewUserId)}`, { method: "DELETE" });
      else await apiFetch(`/follows/${encodeURIComponent(viewUserId)}`, { method: "POST" });
      await loadPublicProfile(viewUserId);
    } catch (err) {
      toast(err?.message || "Action follow impossible", "Erreur");
    }
  });
}

async function loadProfile() {
  const viewUserId = qs("user");
  try {
    if (!viewUserId) {
      editBtn.style.display = "";
      if (addContentBtn) addContentBtn.style.display = "";
      await loadSelfProfile();
      return;
    }

    const me = getTokens().accessToken ? await apiFetch("/auth/me").catch(() => null) : null;
    const meId = String(me?.user?.id || "");
    if (meId && meId === viewUserId) {
      editBtn.style.display = "";
      if (addContentBtn) addContentBtn.style.display = "";
      await loadSelfProfile();
      return;
    }

    editBtn.style.display = "none";
    if (addContentBtn) addContentBtn.style.display = "none";
    await loadPublicProfile(viewUserId);
  } catch (err) {
    profileView.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err?.message || "")}</small>`;
    socialMeta.innerHTML = "";
    socialLists.innerHTML = "";
    profilePostsSection.innerHTML = "";
    toast(err?.message || "Erreur profil", "Erreur");
  }
}

refreshBtn.addEventListener("click", loadProfile);

logoutBtn.addEventListener("click", async () => {
  await serverLogout();
  updateTokenStats();
  toast("Deconnecte.", "OK");
  renderNeedAuth("Tokens supprimes. Reconnecte-toi.");
});

deleteAccountBtn.addEventListener("click", async () => {
  const first = window.confirm("Supprimer ton compte ? Cette action est definitive.");
  if (!first) return;
  const second = window.prompt("Tape SUPPRIMER pour confirmer");
  if (second !== "SUPPRIMER") {
    toast("Suppression annulee.", "Info");
    return;
  }
  try {
    await apiFetch("/auth/me", { method: "DELETE" });
    await serverLogout();
    updateTokenStats();
    toast("Compte supprime.", "OK");
    window.location.href = "/auth/auth.html";
  } catch (err) {
    toast(err?.message || "Erreur suppression compte", "Erreur");
  }
});

loadProfile();
