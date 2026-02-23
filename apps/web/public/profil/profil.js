import { apiFetch, toast, escapeHtml, getTokens, serverLogout, resolveMediaUrl } from "/noyau/app.js";
import { applyI18n } from "/noyau/i18n.js";

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
const publicationMetaFields = document.querySelector("#publicationMetaFields");
const profileMediaModal = document.querySelector("#profileMediaModal");
const profileMediaBackdrop = document.querySelector("#profileMediaBackdrop");
const profileMediaBody = document.querySelector("#profileMediaBody");

let currentProfileUserId = "";
let isOwnProfile = false;
let pendingUploadDataUrl = "";
let pendingUploadType = "";
let composerBound = false;
let composerUserId = "";
let profilePostsTab = "publications";

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
    <div style="margin-top:10px"><a class="btn primary" href="/connexion/connexion.html">Se connecter</a></div>
  `;
  socialMeta.innerHTML = "";
  socialLists.innerHTML = "";
  profilePostsSection.innerHTML = "";
}

function renderProfileCard(u, opts = {}) {
  const coverUrl = resolveMediaUrl(u.cover_url || "");
  const avatarUrl = resolveMediaUrl(u.avatar_url || "");
  const coverStyle = coverUrl ? `background-image:url('${escapeHtml(coverUrl)}');` : "";

  const avatar = avatarUrl
    ? `<img alt="" src="${escapeHtml(avatarUrl)}" class="snap-avatar-img" />`
    : `<div class="snap-avatar-fallback">${escapeHtml(String(u.display_name || "U").slice(0, 1).toUpperCase())}</div>`;

  const showFollow = Boolean(opts.showFollow);
  const following = Boolean(opts.following);
  const isSelf = !showFollow;
  const followBtn = showFollow
    ? `<button id="followToggleBtn" class="btn ${following ? "" : "primary"}" type="button">${following ? "Ne plus suivre" : "Suivre"}</button>`
    : "";
  const followersCount = Number(opts.followersCount || 0);
  const location = String(u.location || "").trim();
  const birthDate = String(u.birth_date || "").trim();
  const gender = String(u.gender || "").trim();
  const website = String(u.website || "").trim();
  const infoBadges = [
    location ? `<span class="pill">${escapeHtml(location)}</span>` : "",
    gender ? `<span class="pill">Sexe: ${escapeHtml(gender)}</span>` : "",
    birthDate ? `<span class="pill">Anniv: ${escapeHtml(birthDate.slice(0, 10))}</span>` : "",
    website ? `<a class="pill" href="${escapeHtml(website)}" target="_blank" rel="noreferrer">Site</a>` : "",
  ]
    .filter(Boolean)
    .join("");

  profileView.innerHTML = `
    <section class="snap-profile">
      <div class="snap-hero" style="${coverStyle}">
        <div class="snap-topbar">
          <div></div>
          <div class="row" style="gap:8px">
            ${isSelf ? `<a class="snap-icon-btn" href="/profil/profil-modifier.html" aria-label="Modifier">&#9998;</a>` : ""}
            ${isSelf ? `<a class="snap-icon-btn" href="/parametres/parametres.html" aria-label="Parametres">&#9881;</a>` : ""}
          </div>
        </div>
        <div class="snap-overlay"></div>
        <div class="snap-identity-wrap">
          <div class="snap-avatar">${avatar}</div>
          <div>
            <div class="snap-name">${escapeHtml(u.display_name || "-")}</div>
            <div class="snap-sub">@${escapeHtml(u.username || "username")} · ${followersCount} followers</div>
          </div>
        </div>
      </div>
      <div class="snap-profile-main">
        <div class="row" style="gap:10px;flex-wrap:wrap">
          ${showFollow ? followBtn : `<button class="btn" type="button">Mon compte</button>`}
          ${isSelf ? `<a class="btn" href="/parametres/parametres.html">Parametres</a>` : ""}
        </div>
        ${infoBadges ? `<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">${infoBadges}</div>` : ""}
        <p class="snap-bio">${escapeHtml(u.bio || "Bio vide...")}</p>
        <small style="color:var(--muted)">${escapeHtml(u.email || "")}</small>
      </div>
    </section>
  `;
}

function renderSocialMeta(data) {
  socialMeta.innerHTML = `
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px">
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
                    `<a class="pill" href="/profil/profil.html?user=${encodeURIComponent(String(u.id || ""))}" style="display:inline-flex;margin:4px 6px 0 0">@${escapeHtml(
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
                    `<a class="pill" href="/profil/profil.html?user=${encodeURIComponent(String(u.id || ""))}" style="display:inline-flex;margin:4px 6px 0 0">@${escapeHtml(
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

function normalizeEntryType(value) {
  const v = String(value || "").toLowerCase();
  if (v === "story") return "story";
  if (v === "post") return "publication";
  return "publication";
}

function normalizeMediaKind(value) {
  const v = String(value || "").toLowerCase();
  return v === "video" ? "video" : "image";
}

function normalizePostMeta(raw) {
  const tagsRaw = Array.isArray(raw?.tags) ? raw.tags : String(raw?.tags || "").split(",");
  const tags = tagsRaw
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  return {
    location: String(raw?.location || "").trim().slice(0, 80),
    tags,
    visibility: String(raw?.visibility || "public") === "followers" ? "followers" : "public",
    allow_likes: raw?.allow_likes !== false,
    allow_comments: raw?.allow_comments !== false,
  };
}

function normalizePostEntry(raw) {
  const entryType = normalizeEntryType(raw?.entry_type);
  const mediaKind = normalizeMediaKind(raw?.media_kind);
  const caption = String(raw?.caption || raw?.description || "").trim();
  const comments = Array.isArray(raw?.comments) ? raw.comments : [];
  const meta = normalizePostMeta(raw?.meta || raw);
  return {
    id: String(raw?.id || crypto.randomUUID()),
    user_id: String(raw?.user_id || ""),
    entry_type: entryType,
    media_kind: mediaKind,
    media_data: String(raw?.media_data || ""),
    caption,
    description: caption,
    likes_count: Number(raw?.likes_count || 0),
    comments_count: Number(raw?.comments_count || comments.length || 0),
    comments,
    meta,
    created_at: raw?.created_at || new Date().toISOString(),
  };
}

function readPosts(userId) {
  try {
    const raw = localStorage.getItem(postStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((p) => normalizePostEntry(p)) : [];
  } catch {
    return [];
  }
}

function writePosts(userId, entries) {
  const normalized = Array.isArray(entries) ? entries.map((p) => normalizePostEntry(p)) : [];
  localStorage.setItem(postStorageKey(userId), JSON.stringify(normalized));
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

function closeProfileMediaModal() {
  profileMediaModal?.setAttribute("hidden", "");
  if (!composerModal?.hasAttribute("hidden")) return;
  document.body.classList.remove("comments-open");
}

function openProfileMediaModal(post, opts = {}) {
  if (!profileMediaBody || !post) return;
  const canManage = Boolean(opts.canManage);
  const title = post.entry_type === "story" ? "Story" : post.media_kind === "video" ? "Reel" : "Publication";
  const mediaNode = post.media_kind === "video"
    ? `<video controls autoplay preload="metadata" src="${escapeHtml(post.media_data || "")}" class="snap-viewer-media"></video>`
    : `<img alt="" src="${escapeHtml(post.media_data || "")}" class="snap-viewer-media" />`;
  const canEdit = canManage && post.entry_type === "publication";
  const meta = normalizePostMeta(post?.meta || {});
  const tagsLabel = meta.tags.length ? `#${meta.tags.join(" #")}` : "";

  profileMediaBody.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center;gap:8px">
      <span class="badge">${title}</span>
      <small style="color:var(--muted)">${formatRelativeFromIso(post.created_at)}</small>
    </div>
    <div style="margin-top:10px">${mediaNode}</div>
    ${
      post.caption
        ? `<p class="snap-viewer-caption">${escapeHtml(post.caption)}</p>`
        : ""
    }
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
      <span class="badge">Likes: ${Number(post.likes_count || 0)}</span>
      <span class="badge">Commentaires: ${Number(post.comments_count || 0)}</span>
      ${post.entry_type === "publication" ? `<span class="badge">Visibilite: ${escapeHtml(meta.visibility)}</span>` : ""}
      ${post.entry_type === "publication" ? `<span class="badge">Likes autorises: ${meta.allow_likes ? "ON" : "OFF"}</span>` : ""}
      ${post.entry_type === "publication" ? `<span class="badge">Commentaires autorises: ${meta.allow_comments ? "ON" : "OFF"}</span>` : ""}
      ${post.entry_type === "publication" && meta.location ? `<span class="badge">Lieu: ${escapeHtml(meta.location)}</span>` : ""}
      ${post.entry_type === "publication" && tagsLabel ? `<span class="badge">${escapeHtml(tagsLabel)}</span>` : ""}
    </div>
    ${
      canManage
        ? `<div class="row" style="gap:8px;margin-top:12px">
            ${canEdit ? `<button id="editPostBtn" class="btn" type="button">Modifier</button>` : ""}
            <button id="deletePostBtn" class="btn danger" type="button">Supprimer</button>
            <button id="closePostModalBtn" class="btn" type="button">Fermer</button>
          </div>`
        : `<div class="row" style="gap:8px;margin-top:12px"><button id="closePostModalBtn" class="btn" type="button">Fermer</button></div>`
    }
    ${
      canEdit
        ? `<form id="editPostForm" class="form" style="margin-top:10px" hidden>
            <label>Description</label>
            <textarea id="editPostCaptionInput" class="input" rows="4" maxlength="600">${escapeHtml(post.caption || "")}</textarea>
            <div class="two">
              <div>
                <label>Lieu</label>
                <input id="editPostLocationInput" class="input" maxlength="80" value="${escapeHtml(meta.location || "")}" />
              </div>
              <div>
                <label>Tags (separes par virgule)</label>
                <input id="editPostTagsInput" class="input" maxlength="120" value="${escapeHtml(meta.tags.join(", "))}" />
              </div>
            </div>
            <div class="two">
              <div>
                <label>Visibilite</label>
                <select id="editPostVisibilityInput" class="input">
                  <option value="public" ${meta.visibility === "public" ? "selected" : ""}>Public</option>
                  <option value="followers" ${meta.visibility === "followers" ? "selected" : ""}>Followers</option>
                </select>
              </div>
              <div class="row" style="gap:12px;align-items:center;padding-top:24px">
                <label style="display:flex;gap:6px;align-items:center"><input id="editPostAllowLikesInput" type="checkbox" ${meta.allow_likes ? "checked" : ""} /> Likes actifs</label>
                <label style="display:flex;gap:6px;align-items:center"><input id="editPostAllowCommentsInput" type="checkbox" ${meta.allow_comments ? "checked" : ""} /> Commentaires actifs</label>
              </div>
            </div>
            <div class="row" style="gap:8px">
              <button class="btn primary" type="submit">Enregistrer</button>
              <button id="cancelEditPostBtn" class="btn" type="button">Annuler</button>
            </div>
          </form>`
        : ""
    }
  `;

  profileMediaBody.querySelector("#closePostModalBtn")?.addEventListener("click", closeProfileMediaModal);
  profileMediaBody.querySelector("#deletePostBtn")?.addEventListener("click", () => {
    if (!currentProfileUserId) return;
    const ok = window.confirm("Supprimer ce contenu ?");
    if (!ok) return;
    const next = readPosts(currentProfileUserId).filter((p) => String(p.id || "") !== String(post.id || ""));
    writePosts(currentProfileUserId, next);
    renderProfilePosts({ id: currentProfileUserId }, { canCreate: isOwnProfile, canManage: isOwnProfile });
    closeProfileMediaModal();
    toast("Contenu supprime.", "OK");
  });

  const editBtn = profileMediaBody.querySelector("#editPostBtn");
  const editForm = profileMediaBody.querySelector("#editPostForm");
  const cancelEditBtn = profileMediaBody.querySelector("#cancelEditPostBtn");
  editBtn?.addEventListener("click", () => editForm?.removeAttribute("hidden"));
  cancelEditBtn?.addEventListener("click", () => editForm?.setAttribute("hidden", ""));
  editForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentProfileUserId || post.entry_type !== "publication") return;
    const input = profileMediaBody.querySelector("#editPostCaptionInput");
    const locationInput = profileMediaBody.querySelector("#editPostLocationInput");
    const tagsInput = profileMediaBody.querySelector("#editPostTagsInput");
    const visibilityInput = profileMediaBody.querySelector("#editPostVisibilityInput");
    const allowLikesInput = profileMediaBody.querySelector("#editPostAllowLikesInput");
    const allowCommentsInput = profileMediaBody.querySelector("#editPostAllowCommentsInput");
    const nextCaption = String(input?.value || "").trim().slice(0, 600);
    const nextMeta = normalizePostMeta({
      location: String(locationInput?.value || ""),
      tags: String(tagsInput?.value || ""),
      visibility: String(visibilityInput?.value || "public"),
      allow_likes: Boolean(allowLikesInput?.checked),
      allow_comments: Boolean(allowCommentsInput?.checked),
    });
    const next = readPosts(currentProfileUserId).map((p) =>
      String(p.id || "") === String(post.id || "")
        ? { ...p, caption: nextCaption, description: nextCaption, meta: nextMeta }
        : p
    );
    writePosts(currentProfileUserId, next);
    const updated = next.find((p) => String(p.id || "") === String(post.id || ""));
    renderProfilePosts({ id: currentProfileUserId }, { canCreate: isOwnProfile, canManage: isOwnProfile });
    if (updated) openProfileMediaModal(updated, opts);
    toast("Publication modifiee.", "OK");
  });

  profileMediaModal?.removeAttribute("hidden");
  document.body.classList.add("comments-open");
}

function filterPostsByTab(posts, tab) {
  if (tab === "stories") return posts.filter((p) => p.entry_type === "story");
  if (tab === "reels") return posts.filter((p) => p.entry_type === "publication" && p.media_kind === "video");
  return posts.filter((p) => p.entry_type === "publication" && p.media_kind !== "video");
}

function renderProfilePosts(user, opts = {}) {
  if (!profilePostsSection) return;
  const userId = String(user?.id || "");
  if (!userId) {
    profilePostsSection.innerHTML = "";
    return;
  }

  const posts = readPosts(userId).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const canCreate = Boolean(opts.canCreate);
  const canManage = Boolean(opts.canManage);
  const publicationsCount = posts.filter((p) => p.entry_type === "publication" && p.media_kind !== "video").length;
  const reelsCount = posts.filter((p) => p.entry_type === "publication" && p.media_kind === "video").length;
  const storiesCount = posts.filter((p) => p.entry_type === "story").length;
  const filtered = filterPostsByTab(posts, profilePostsTab);

  const header = `
    <section class="snap-media-section">
      <div class="snap-media-tabs">
        <button class="snap-tab ${profilePostsTab === "publications" ? "is-active" : ""}" type="button" data-tab="publications">Publications <small>(${publicationsCount})</small></button>
        <button class="snap-tab ${profilePostsTab === "reels" ? "is-active" : ""}" type="button" data-tab="reels">Reels <small>(${reelsCount})</small></button>
        <button class="snap-tab ${profilePostsTab === "stories" ? "is-active" : ""}" type="button" data-tab="stories">Stories <small>(${storiesCount})</small></button>
      </div>
      <div class="row" style="justify-content:space-between;align-items:center;margin-top:8px">
        ${
          canCreate
            ? `<button id="openComposerInlineBtn" class="btn primary" type="button">+ Ajouter</button>`
            : `<span class="badge">${posts.length} element(s)</span>`
        }
        <small style="color:var(--muted)">Appuie sur un media pour ouvrir</small>
      </div>
      <div id="profilePostsList" class="snap-media-grid"></div>
    </section>
  `;

  profilePostsSection.innerHTML = header;

  const list = profilePostsSection.querySelector("#profilePostsList");
  if (!list) return;

  if (!filtered.length) {
    list.innerHTML = `<small class="snap-media-empty">Aucun contenu dans cet onglet.</small>`;
  } else {
    list.innerHTML = filtered
      .map((p) => {
        const media = p.media_kind === "video"
          ? `<video preload="metadata" src="${escapeHtml(p.media_data || "")}" class="snap-media-tile-media"></video>`
          : `<img alt="" src="${escapeHtml(p.media_data || "")}" class="snap-media-tile-media" />`;
        return `
          <article class="snap-media-tile" role="button" tabindex="0" data-open-post-id="${escapeHtml(String(p.id || ""))}">
            ${media}
            <div class="snap-media-tile-overlay">
              <div class="row" style="justify-content:space-between;align-items:center">
                <span class="badge">${p.entry_type === "story" ? "Story" : p.media_kind === "video" ? "Reel" : "Publication"}</span>
                <small>${formatRelativeFromIso(p.created_at)}</small>
              </div>
              ${p.caption ? `<div class="snap-media-caption">${escapeHtml(p.caption)}</div>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  profilePostsSection.querySelector("#openComposerInlineBtn")?.addEventListener("click", openComposer);
  profilePostsSection.querySelectorAll(".snap-tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      profilePostsTab = String(btn.getAttribute("data-tab") || "publications");
      renderProfilePosts(user, opts);
    });
  });
  list.querySelectorAll("[data-open-post-id]").forEach((tile) => {
    const open = () => {
      const postId = String(tile.getAttribute("data-open-post-id") || "");
      const post = posts.find((p) => String(p.id || "") === postId);
      if (!post) return;
      openProfileMediaModal(post, { canManage });
    };
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

function openComposer() {
  if (!isOwnProfile) {
    toast("Creation reservee a ton profil.", "Info");
    return;
  }
  closeProfileMediaModal();
  composerModal?.removeAttribute("hidden");
  document.body.classList.add("comments-open");
}

function toggleComposerMetaVisibility() {
  if (!composerForm || !publicationMetaFields) return;
  const typeField = composerForm.elements.namedItem("entry_type");
  const entryType = String(typeField?.value || "publication");
  publicationMetaFields.hidden = entryType !== "publication";
}

function closeComposer() {
  composerModal?.setAttribute("hidden", "");
  document.body.classList.remove("comments-open");
  if (composerForm) composerForm.reset();
  toggleComposerMetaVisibility();
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
  const typeField = composerForm.elements.namedItem("entry_type");
  typeField?.addEventListener("change", toggleComposerMetaVisibility);
  toggleComposerMetaVisibility();
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
    const locationField = composerForm.elements.namedItem("meta_location");
    const tagsField = composerForm.elements.namedItem("meta_tags");
    const visibilityField = composerForm.elements.namedItem("meta_visibility");
    const allowLikesField = composerForm.elements.namedItem("meta_allow_likes");
    const allowCommentsField = composerForm.elements.namedItem("meta_allow_comments");
    const entryType = String(typeField?.value || "publication") === "story" ? "story" : "publication";
    const caption = String(captionField?.value || "").trim().slice(0, 600);
    const meta = normalizePostMeta({
      location: String(locationField?.value || ""),
      tags: String(tagsField?.value || ""),
      visibility: String(visibilityField?.value || "public"),
      allow_likes: Boolean(allowLikesField?.checked),
      allow_comments: Boolean(allowCommentsField?.checked),
    });
    const current = readPosts(composerUserId);
    const next = [
      {
        id: crypto.randomUUID(),
        user_id: composerUserId,
        entry_type: entryType,
        media_kind: pendingUploadType || "image",
        media_data: pendingUploadDataUrl,
        caption,
        description: caption,
        likes_count: 0,
        comments_count: 0,
        comments: [],
        meta,
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
  renderProfileCard(meData.user, { showFollow: false, followersCount: Number(followData?.followers_count || 0) });
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
  renderProfileCard(data.user, {
    showFollow: Boolean(t.accessToken),
    following: Boolean(data.is_following),
    followersCount: Number(data?.followers_count || 0),
  });
  renderSocialMeta(data);
  renderSocialLists(data);
  renderProfilePosts(data.user, { canCreate: false, canManage: false });
  if (addContentBtn) addContentBtn.style.display = "none";
  if (composerModal) composerModal.setAttribute("hidden", "");
  closeProfileMediaModal();

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
      if (editBtn) editBtn.style.display = "none";
      if (addContentBtn) addContentBtn.style.display = "";
      closeProfileMediaModal();
      await loadSelfProfile();
      return;
    }

    const me = getTokens().accessToken ? await apiFetch("/auth/me").catch(() => null) : null;
    const meId = String(me?.user?.id || "");
    if (meId && meId === viewUserId) {
      if (editBtn) editBtn.style.display = "none";
      if (addContentBtn) addContentBtn.style.display = "";
      closeProfileMediaModal();
      await loadSelfProfile();
      return;
    }

    if (editBtn) editBtn.style.display = "none";
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
    window.location.href = "/connexion/connexion.html";
  } catch (err) {
    toast(err?.message || "Erreur suppression compte", "Erreur");
  }
});

profileMediaBackdrop?.addEventListener("click", closeProfileMediaModal);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeComposer();
  closeProfileMediaModal();
});

applyI18n(document);
loadProfile();

