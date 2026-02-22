import { apiFetch, toast, escapeHtml, isLoggedIn, getTokens, resolveMediaUrl } from "/noyau/app.js";

const API = "http://localhost:1234";

const STICKERS = [
  { id: "heart", url: "/autocollants/heart.svg" },
  { id: "fire", url: "/autocollants/fire.svg" },
  { id: "clap", url: "/autocollants/clap.svg" },
  { id: "wow", url: "/autocollants/wow.svg" },
  { id: "love", url: "/autocollants/love.svg" },
  { id: "party", url: "/autocollants/party.svg" },
  { id: "cry", url: "/autocollants/cry.svg" },
  { id: "music", url: "/autocollants/music.svg" },
];

const COMMENTS_TEMPLATES_URL = "/commentaires/commentaires.html";
const SAVED_STICKERS_LIMIT = 48;
let commentsTemplatesPromise = null;

async function loadCommentsTemplates() {
  if (commentsTemplatesPromise) return commentsTemplatesPromise;
  commentsTemplatesPromise = (async () => {
    try {
      const res = await fetch(COMMENTS_TEMPLATES_URL, { cache: "no-store" });
      if (!res.ok) return new Map();
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const map = new Map();
      doc.querySelectorAll("template[id]").forEach((tpl) => {
        const id = String(tpl.getAttribute("id") || "").trim();
        if (!id) return;
        map.set(id, String(tpl.innerHTML || "").trim());
      });
      return map;
    } catch {
      return new Map();
    }
  })();
  return commentsTemplatesPromise;
}

function fillTemplate(html, values = {}) {
  return String(html || "").replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m, key) => String(values[key] ?? ""));
}

function normalizeMediaUrl(rawUrl) {
  return String(resolveMediaUrl(String(rawUrl || "").trim()) || "").trim();
}

function isGifUrl(rawUrl) {
  const u = String(rawUrl || "").toLowerCase();
  return /\.gif($|[?#])/.test(u) || u.includes("giphy.com") || u.includes("tenor.com");
}

function avatarLetter(name = "") {
  return String(name || "U").trim().slice(0, 1).toUpperCase() || "U";
}

function formatAgo(rawDate) {
  const d = new Date(rawDate);
  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const j = Math.floor(h / 24);
  if (j > 0) return `il y a ${j} j`;
  if (h > 0) return `il y a ${h} h`;
  const m = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return `il y a ${m} min`;
}

function renderSticker(v) {
  const s = normalizeMediaUrl(v);
  if (!s) return "";
  return `<img class="cmt-sticker-img" src="${escapeHtml(s)}" alt="sticker" />`;
}

function stickerPickerHtml({ savedStickers = [], savedGifs = [] } = {}) {
  return STICKERS.map(
    (s) =>
      `<button class="reaction-chip sticker-chip" data-pick-sticker="${escapeHtml(s.url)}" data-pick-kind="sticker" type="button"><img src="${escapeHtml(
        s.url
      )}" alt="${escapeHtml(s.id)}" /></button>`
  ).join("");
}

function buildCommentTree(comments) {
  const map = new Map();
  const roots = [];
  for (const c of comments || []) map.set(c.id, { ...c, replies: [] });
  for (const c of map.values()) {
    if (c.parent_comment_id && map.has(c.parent_comment_id)) map.get(c.parent_comment_id).replies.push(c);
    else roots.push(c);
  }
  return roots;
}

export function createSocialController({ socialBox, commentsSheet, commentsBackdrop, openCommentsBtn, closeCommentsBtn }) {
  let currentSort = "popular";
  let currentSocialUserId = "";
  let savedStickers = [];
  let savedGifs = [];
  let hiddenDefaultStickers = [];
  let templates = new Map();

  const isCurrentSocialUser = (userId) => {
    const current = String(currentSocialUserId || "").trim();
    const target = String(userId || "").trim();
    return Boolean(current && target && current === target);
  };

  function storageKey(kind) {
    const userId = String(currentSocialUserId || "").trim() || "guest";
    return `supcontent:social:${kind}:${userId}`;
  }

  function readSaved(kind) {
    try {
      const raw = window.localStorage.getItem(storageKey(kind));
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return Array.from(new Set(parsed.map((x) => normalizeMediaUrl(x)).filter(Boolean))).slice(0, SAVED_STICKERS_LIMIT);
    } catch {
      return [];
    }
  }

  function writeSaved(kind, values) {
    try {
      window.localStorage.setItem(storageKey(kind), JSON.stringify(values.slice(0, SAVED_STICKERS_LIMIT)));
    } catch {
      // ignore storage errors
    }
  }

  function loadSavedMedia() {
    savedStickers = readSaved("saved_stickers");
    savedGifs = readSaved("saved_gifs");
    hiddenDefaultStickers = readSaved("hidden_default_stickers");
  }

  function saveMedia(url, preferredKind = "") {
    const normalized = normalizeMediaUrl(url);
    if (!normalized) return false;
    const kind = preferredKind || (isGifUrl(normalized) ? "gif" : "sticker");
    if (kind === "gif") {
      const next = [normalized, ...savedGifs.filter((x) => x !== normalized)].slice(0, SAVED_STICKERS_LIMIT);
      savedGifs = next;
      writeSaved("saved_gifs", next);
      return true;
    }
    const next = [normalized, ...savedStickers.filter((x) => x !== normalized)].slice(0, SAVED_STICKERS_LIMIT);
    savedStickers = next;
    writeSaved("saved_stickers", next);
    return true;
  }

  function removeSavedMedia(url, preferredKind = "") {
    const normalized = normalizeMediaUrl(url);
    if (!normalized) return false;
    const kind = preferredKind || (isGifUrl(normalized) ? "gif" : "sticker");
    if (kind === "gif") {
      const next = savedGifs.filter((x) => x !== normalized);
      if (next.length === savedGifs.length) return false;
      savedGifs = next;
      writeSaved("saved_gifs", next);
      return true;
    }
    const next = savedStickers.filter((x) => x !== normalized);
    if (next.length === savedStickers.length) return false;
    savedStickers = next;
    writeSaved("saved_stickers", next);
    return true;
  }

  function hideDefaultSticker(url) {
    const normalized = normalizeMediaUrl(url);
    if (!normalized) return false;
    const next = [normalized, ...hiddenDefaultStickers.filter((x) => x !== normalized)].slice(0, SAVED_STICKERS_LIMIT);
    hiddenDefaultStickers = next;
    writeSaved("hidden_default_stickers", next);
    return true;
  }

  function renderReply(comment, reviewId, depth = 0) {
    const up = Number(comment.votes_up || 0);
    const down = Number(comment.votes_down || 0);
    const myVote = String(comment.my_vote || "");
    const author = String(comment.display_name || "utilisateur");
    const canEdit = isCurrentSocialUser(comment.user_id);
    const canDelete = canEdit || isCurrentSocialUser(comment.review_user_id);

    const resolvedStickerUrl = normalizeMediaUrl(comment.sticker);
    const resolvedImageUrl = normalizeMediaUrl(comment.image_url);
    const values = {
      MARGIN_LEFT: String(depth * 16),
      AVATAR: escapeHtml(avatarLetter(author)),
      AUTHOR: escapeHtml(author),
      AGO: escapeHtml(formatAgo(comment.created_at)),
      BODY: escapeHtml(comment.body || ""),
      STICKER_HTML: resolvedStickerUrl
        ? `<img class="cmt-sticker-img" data-save-media-direct="1" data-media-url="${escapeHtml(resolvedStickerUrl)}" data-media-kind="sticker" src="${escapeHtml(
            resolvedStickerUrl
          )}" alt="sticker" title="Cliquer pour enregistrer" />`
        : "",
      IMAGE_HTML: resolvedImageUrl
        ? `<img class="cmt-image" data-save-media-direct="1" data-media-url="${escapeHtml(resolvedImageUrl)}" data-media-kind="${escapeHtml(
            isGifUrl(resolvedImageUrl) ? "gif" : "sticker"
          )}" src="${escapeHtml(resolvedImageUrl)}" alt="image commentaire" title="Cliquer pour enregistrer" />`
        : "",
      UP_CLASS: myVote === "up" ? "is-active" : "",
      DOWN_CLASS: myVote === "down" ? "is-danger" : "",
      CID: escapeHtml(comment.id),
      RID: escapeHtml(reviewId),
      UP_COUNT: String(up),
      DOWN_COUNT: String(down),
      EDIT_COMMENT_BUTTON: canEdit
        ? `<button class="cmt-action" data-edit-comment="1" data-cid="${escapeHtml(comment.id)}" type="button">Modifier</button>`
        : "",
      DELETE_COMMENT_BUTTON: canDelete
        ? `<button class="cmt-action" data-del-comment="1" data-cid="${escapeHtml(comment.id)}" type="button">Supprimer</button>`
        : "",
      REPLIES_HTML: (comment.replies || []).map((r) => renderReply(r, reviewId, depth + 1)).join(""),
    };
    return fillTemplate(
      templates.get("tpl-reply-item") ||
        `
      <div class="cmt-reply" data-reply-offset="{{MARGIN_LEFT}}">
        <div class="cmt-avatar">{{AVATAR}}</div>
        <div class="cmt-main">
          <div class="cmt-meta"><strong>@{{AUTHOR}}</strong> <span>{{AGO}}</span></div>
          <div class="cmt-body">{{BODY}}</div>
          {{STICKER_HTML}}
          {{IMAGE_HTML}}
          <div class="cmt-actions">
            <button class="cmt-action {{UP_CLASS}}" data-vote-comment="up" data-cid="{{CID}}" type="button">&#128077; {{UP_COUNT}}</button>
            <button class="cmt-action {{DOWN_CLASS}}" data-vote-comment="down" data-cid="{{CID}}" type="button">&#128078; {{DOWN_COUNT}}</button>
            <button class="cmt-action" data-reply-comment="1" data-rid="{{RID}}" data-cid="{{CID}}" type="button">Repondre</button>
            {{EDIT_COMMENT_BUTTON}}
            {{DELETE_COMMENT_BUTTON}}
          </div>
          {{REPLIES_HTML}}
        </div>
      </div>
    `,
      values
    );
  }

  function renderReviewItem(review) {
    const myVote = String(review.my_vote || "");
    const author = String(review.display_name || "utilisateur");
    const replies = buildCommentTree(review.comments || []);
    const canManage = isCurrentSocialUser(review.user_id);

    const resolvedStickerUrl = normalizeMediaUrl(review.sticker);
    const resolvedImageUrl = normalizeMediaUrl(review.image_url);
    const reviewId = escapeHtml(review.id);
    const values = {
      AVATAR: escapeHtml(avatarLetter(author)),
      AUTHOR: escapeHtml(author),
      AGO: escapeHtml(formatAgo(review.created_at)),
      BODY: escapeHtml(review.body || ""),
      STICKER_HTML: resolvedStickerUrl
        ? `<img class="cmt-sticker-img" data-save-media-direct="1" data-media-url="${escapeHtml(resolvedStickerUrl)}" data-media-kind="sticker" src="${escapeHtml(
            resolvedStickerUrl
          )}" alt="sticker" title="Cliquer pour enregistrer" />`
        : "",
      IMAGE_HTML: resolvedImageUrl
        ? `<img class="cmt-image" data-save-media-direct="1" data-media-url="${escapeHtml(resolvedImageUrl)}" data-media-kind="${escapeHtml(
            isGifUrl(resolvedImageUrl) ? "gif" : "sticker"
          )}" src="${escapeHtml(resolvedImageUrl)}" alt="image avis" title="Cliquer pour enregistrer" />`
        : "",
      UP_CLASS: myVote === "up" ? "is-active" : "",
      DOWN_CLASS: myVote === "down" ? "is-danger" : "",
      RID: reviewId,
      UP_COUNT: String(Number(review.likes_count || 0)),
      DOWN_COUNT: String(Number(review.dislikes_count || 0)),
      RATING: String(Number(review.rating || 0)),
      EDIT_REVIEW_BUTTON: canManage
        ? `<button class="cmt-action" data-edit-review="1" data-rid="${reviewId}" data-rating="${escapeHtml(String(Number(review.rating || 5)))}" type="button">Modifier</button>`
        : "",
      DELETE_REVIEW_BUTTON: canManage
        ? `<button class="cmt-action" data-del-review="1" data-rid="${reviewId}" type="button">Supprimer</button>`
        : "",
      STICKER_PICKER: stickerPickerHtml({ savedStickers, savedGifs }),
      REPLIES_COUNT: String(Number(review.comments_count || 0)),
      REPLIES_HTML: replies.map((r) => renderReply(r, review.id)).join(""),
    };
    return fillTemplate(
      templates.get("tpl-review-item") ||
        `
      <div class="cmt-item">
        <div class="cmt-avatar">{{AVATAR}}</div>
        <div class="cmt-main">
          <div class="cmt-meta"><strong>@{{AUTHOR}}</strong> <span>{{AGO}}</span></div>
          <div class="cmt-body">{{BODY}}</div>
          {{STICKER_HTML}}
          {{IMAGE_HTML}}
          <div class="cmt-actions">
            <button class="cmt-action {{UP_CLASS}}" data-vote-review="up" data-rid="{{RID}}" type="button">&#128077; {{UP_COUNT}}</button>
            <button class="cmt-action {{DOWN_CLASS}}" data-vote-review="down" data-rid="{{RID}}" type="button">&#128078; {{DOWN_COUNT}}</button>
            <span class="cmt-action">{{RATING}}/5</span>
            <button class="cmt-action" data-toggle-reply="{{RID}}" type="button">Repondre</button>
            {{EDIT_REVIEW_BUTTON}}
            {{DELETE_REVIEW_BUTTON}}
          </div>
          <form data-comment-form="1" data-rid="{{RID}}" class="cmt-compose cmt-compose-inline" hidden>
            <input class="input" name="body" placeholder="Ajouter une reponse..." />
            <input type="hidden" name="parent_comment_id" value="" />
            <input type="hidden" name="image_url" value="" />
            <input type="hidden" name="sticker" value="" />
            <input type="file" name="image_file" accept="image/png,image/jpeg,image/webp" style="display:none" />
            <div class="cmt-tools">
              <button class="cmt-plus" data-add-image="1" type="button">+</button>
              <button class="cmt-action" data-open-stickers="1" type="button">Sticker</button>
              <button class="btn" type="submit">Envoyer</button>
              <button class="cmt-action" data-cancel-reply="1" data-rid="{{RID}}" type="button">Annuler</button>
            </div>
            <div class="composer-preview" data-preview="1"></div>
            <div class="sticker-strip" data-stickers="1" hidden>{{STICKER_PICKER}}</div>
          </form>
          <div class="cmt-replies-title">{{REPLIES_COUNT}} reponses</div>
          <div class="cmt-replies">{{REPLIES_HTML}}</div>
        </div>
      </div>
    `,
      values
    );
  }

  async function uploadSocialImage(file) {
    if (!file) return "";
    const form = new FormData();
    form.append("file", file);
    const { accessToken } = getTokens();
    const res = await fetch(`${API}/upload/social`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) throw new Error(data?.erreur || "Upload image impossible");
    return String(data?.url || "");
  }

  function wireComposer(form) {
    const fileInput = form.querySelector("input[name='image_file']");
    const imageUrlInput = form.querySelector("input[name='image_url']");
    const stickerInput = form.querySelector("input[name='sticker']");
    const preview = form.querySelector("[data-preview='1']");
    const stickerStrip = form.querySelector("[data-stickers='1']");

    form.querySelector("[data-add-image='1']")?.addEventListener("click", () => fileInput?.click());
    form.querySelector("[data-open-stickers='1']")?.addEventListener("click", () => {
      if (stickerStrip) stickerStrip.hidden = !stickerStrip.hidden;
    });

    fileInput?.addEventListener("change", () => {
      const f = fileInput.files?.[0];
      if (!f || !preview) return;
      const blobUrl = URL.createObjectURL(f);
      preview.innerHTML = `<div class="composer-pill">Image: ${escapeHtml(f.name)}</div><img class="composer-preview-image" src="${escapeHtml(
        blobUrl
      )}" alt="preview" />`;
    });

    form.querySelectorAll("[data-pick-sticker]").forEach((btn) => {
      btn.addEventListener("click", () => {
        form.querySelectorAll("[data-pick-sticker]").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        const s = btn.getAttribute("data-pick-sticker") || "";
        const kind = String(btn.getAttribute("data-pick-kind") || "sticker").toLowerCase();
        if (kind === "gif") {
          if (imageUrlInput) imageUrlInput.value = s;
          if (stickerInput) stickerInput.value = "";
        } else {
          if (stickerInput) stickerInput.value = s;
          if (imageUrlInput && !fileInput?.files?.length) imageUrlInput.value = "";
        }
        if (preview) {
          const label = kind === "gif" ? "GIF" : "Sticker";
          preview.innerHTML = `${preview.innerHTML}<div class="composer-pill">${label}</div><img class="composer-preview-image" src="${escapeHtml(
            s
          )}" alt="${escapeHtml(label.toLowerCase())} preview" />`;
        }
        toast(kind === "gif" ? "GIF selectionne." : "Sticker selectionne.", "OK");
      });
    });

    return async function resolveComposerPayload() {
      const file = fileInput?.files?.[0];
      let imageUrl = String(imageUrlInput?.value || "");
      if (file) {
        imageUrl = await uploadSocialImage(file);
        if (imageUrlInput) imageUrlInput.value = imageUrl;
      }
      return { image_url: imageUrl || null, sticker: String(stickerInput?.value || "").trim() || null };
    };
  }

  function sortReviews(reviews) {
    const arr = [...reviews];
    if (currentSort === "recent") {
      arr.sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime());
    } else {
      arr.sort((a, b) => {
        const scoreA = Number(a.likes_count || 0) * 2 + Number(a.comments_count || 0);
        const scoreB = Number(b.likes_count || 0) * 2 + Number(b.comments_count || 0);
        return scoreB - scoreA;
      });
    }
    return arr;
  }

  function applyReplyOffsets() {
    socialBox.querySelectorAll("[data-reply-offset]").forEach((el) => {
      const n = Number.parseInt(String(el.getAttribute("data-reply-offset") || "0"), 10);
      const offset = Number.isFinite(n) ? Math.max(0, n) : 0;
      el.style.marginLeft = `${offset}px`;
    });
  }

  function renderSavedMediaSection() {
    const savedItems = [
      ...savedStickers.map((url) => ({ url, kind: "sticker", source: "saved" })),
      ...savedGifs.map((url) => ({ url, kind: "gif", source: "saved" })),
    ];
    const savedUrls = new Set(savedItems.map((x) => x.url));
    const hiddenSet = new Set(hiddenDefaultStickers);
    const defaultItems = STICKERS.map((s) => normalizeMediaUrl(s.url))
      .filter(Boolean)
      .filter((url) => !hiddenSet.has(url))
      .filter((url) => !savedUrls.has(url))
      .map((url) => ({ url, kind: "sticker", source: "default" }));
    const mergedItems = [...savedItems, ...defaultItems];

    const itemsHtml = mergedItems
      .map((it) => {
        const removeButton = `<button class="cmt-saved-remove" data-remove-media-chip="1" data-media-url="${escapeHtml(
          it.url
        )}" data-media-kind="${escapeHtml(it.kind)}" data-media-source="${escapeHtml(
          it.source
        )}" type="button" aria-label="Supprimer">×</button>`;
        return `<div class="cmt-saved-item">
          <button class="cmt-saved-use" data-use-saved-media="1" data-media-url="${escapeHtml(
            it.url
          )}" data-media-kind="${escapeHtml(it.kind)}" type="button">
            <img src="${escapeHtml(it.url)}" alt="${escapeHtml(it.kind)}" />
          </button>
          ${removeButton}
        </div>`;
      })
      .join("");

    return `
      <section class="cmt-saved-zone" aria-label="Stickers enregistres">
        <div class="cmt-saved-title">Stickers et GIFs</div>
        <div class="cmt-saved-grid">${itemsHtml}</div>
      </section>
    `;
  }

  function openCommentsSheet() {
    if (!commentsSheet) return;
    commentsSheet.hidden = false;
    document.body.classList.add("comments-open");
  }

  function closeCommentsSheet() {
    if (!commentsSheet) return;
    commentsSheet.hidden = true;
    document.body.classList.remove("comments-open");
  }

  async function bindSocialActions(type, id) {
    socialBox.querySelector("#sortBtn")?.addEventListener("click", () => {
      const menu = socialBox.querySelector("#sortMenu");
      if (menu) menu.hidden = !menu.hidden;
    });

    socialBox.querySelectorAll("[data-sort]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        currentSort = btn.getAttribute("data-sort") || "popular";
        await loadSocial(type, id);
      });
    });

    socialBox.querySelectorAll("[data-save-media-direct='1']").forEach((el) => {
      el.addEventListener("click", async () => {
        const mediaUrl = el.getAttribute("data-media-url") || "";
        const mediaKind = String(el.getAttribute("data-media-kind") || "").toLowerCase();
        if (!mediaUrl) return;
        const ok = saveMedia(mediaUrl, mediaKind === "gif" ? "gif" : "");
        if (!ok) return;
        toast(mediaKind === "gif" ? "GIF enregistre." : "Sticker enregistre.", "OK");
        await loadSocial(type, id);
      });
    });

    socialBox.querySelectorAll("[data-use-saved-media='1']").forEach((el) => {
      el.addEventListener("click", () => {
        const mediaUrl = String(el.getAttribute("data-media-url") || "").trim();
        const mediaKind = String(el.getAttribute("data-media-kind") || "").toLowerCase();
        if (!mediaUrl) return;
        const topForm = socialBox.querySelector("#topCommentForm");
        if (!topForm) {
          toast("Connecte-toi pour reutiliser un sticker enregistre.", "Info");
          return;
        }
        const imageUrlInput = topForm.querySelector("input[name='image_url']");
        const stickerInput = topForm.querySelector("input[name='sticker']");
        const preview = topForm.querySelector("[data-preview='1']");
        if (mediaKind === "gif") {
          if (imageUrlInput) imageUrlInput.value = mediaUrl;
          if (stickerInput) stickerInput.value = "";
        } else {
          if (stickerInput) stickerInput.value = mediaUrl;
          if (imageUrlInput) imageUrlInput.value = "";
        }
        if (preview) {
          const label = mediaKind === "gif" ? "GIF" : "Sticker";
          preview.innerHTML = `<div class="composer-pill">${label}</div><img class="composer-preview-image" src="${escapeHtml(
            mediaUrl
          )}" alt="${escapeHtml(label.toLowerCase())} preview" />`;
        }
        topForm.scrollIntoView({ behavior: "smooth", block: "center" });
        topForm.querySelector("input[name='body']")?.focus();
      });
    });

    socialBox.querySelectorAll("[data-remove-media-chip='1']").forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mediaUrl = String(el.getAttribute("data-media-url") || "").trim();
        const mediaKind = String(el.getAttribute("data-media-kind") || "").toLowerCase();
        const mediaSource = String(el.getAttribute("data-media-source") || "").toLowerCase();
        if (!mediaUrl) return;
        const ok =
          mediaSource === "default"
            ? hideDefaultSticker(mediaUrl)
            : removeSavedMedia(mediaUrl, mediaKind === "gif" ? "gif" : "sticker");
        if (!ok) return;
        toast("Element supprime.", "OK");
        await loadSocial(type, id);
      });
    });

    const topComposer = socialBox.querySelector("#topCommentForm");
    if (topComposer) {
      const resolveTop = wireComposer(topComposer);
      topComposer.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const fd = new FormData(topComposer);
          const body = String(fd.get("body") || "").trim();
          const rating = Number(fd.get("rating") || 5);
          const extra = await resolveTop();
          if (!body && !extra.image_url && !extra.sticker) return;
          await apiFetch(`/social/media/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews`, {
            method: "POST",
            body: JSON.stringify({ rating, body, image_url: extra.image_url, sticker: extra.sticker }),
          });
          await loadSocial(type, id);
        } catch (err) {
          toast(err?.message || "Impossible d'envoyer", "Erreur");
        }
      });
    }

    socialBox.querySelectorAll("[data-vote-review]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const reviewId = btn.getAttribute("data-rid");
          const vote = btn.getAttribute("data-vote-review");
          if (!reviewId || !vote) return;
          await apiFetch(`/social/reviews/${encodeURIComponent(reviewId)}/vote`, {
            method: "POST",
            body: JSON.stringify({ vote }),
          });
          await loadSocial(type, id);
        } catch (err) {
          toast(err?.message || "Action impossible", "Erreur");
        }
      });
    });

    socialBox.querySelectorAll("[data-edit-review='1']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const reviewId = btn.getAttribute("data-rid");
          if (!reviewId) return;
          const rating = Number(btn.getAttribute("data-rating") || 5);
          const bodyNode = btn.closest(".cmt-main")?.querySelector(".cmt-body");
          const currentBody = String(bodyNode?.textContent || "").trim();
          const nextBody = window.prompt("Modifier ton commentaire:", currentBody);
          if (nextBody == null) return;
          await apiFetch(`/social/reviews/${encodeURIComponent(reviewId)}`, {
            method: "PATCH",
            body: JSON.stringify({ rating, body: String(nextBody).trim() }),
          });
          await loadSocial(type, id);
        } catch (err) {
          toast(err?.message || "Modification impossible", "Erreur");
        }
      });
    });

    socialBox.querySelectorAll("[data-del-review='1']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const reviewId = btn.getAttribute("data-rid");
          if (!reviewId) return;
          if (!window.confirm("Supprimer ce commentaire principal ?")) return;
          await apiFetch(`/social/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
          await loadSocial(type, id);
        } catch (err) {
          toast(err?.message || "Suppression impossible", "Erreur");
        }
      });
    });

    socialBox.querySelectorAll("[data-toggle-reply]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rid = btn.getAttribute("data-toggle-reply");
        if (!rid) return;
        const form = socialBox.querySelector(`form[data-comment-form='1'][data-rid='${rid}']`);
        if (!form) return;
        form.hidden = !form.hidden;
        if (!form.hidden) form.querySelector("input[name='body']")?.focus();
      });
    });

    socialBox.querySelectorAll("[data-comment-form='1']").forEach((form) => {
      const resolveReply = wireComposer(form);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const reviewId = form.getAttribute("data-rid");
          if (!reviewId) return;
          const fd = new FormData(form);
          const body = String(fd.get("body") || "").trim();
          const parent_comment_id = String(fd.get("parent_comment_id") || "").trim();
          const extra = await resolveReply();
          if (!body && !extra.image_url && !extra.sticker) return;
          await apiFetch(`/social/reviews/${encodeURIComponent(reviewId)}/comments`, {
            method: "POST",
            body: JSON.stringify({
              body,
              parent_comment_id: parent_comment_id || null,
              image_url: extra.image_url,
              sticker: extra.sticker,
            }),
          });
          await loadSocial(type, id);
        } catch (err) {
          toast(err?.message || "Commentaire impossible", "Erreur");
        }
      });
    });

    socialBox.querySelectorAll("[data-reply-comment='1']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const reviewId = btn.getAttribute("data-rid");
        const commentId = btn.getAttribute("data-cid");
        if (!reviewId || !commentId) return;
        const form = socialBox.querySelector(`form[data-comment-form='1'][data-rid='${reviewId}']`);
        if (!form) return;
        form.hidden = false;
        const input = form.querySelector("input[name='parent_comment_id']");
        if (input) input.value = commentId;
        form.querySelector("input[name='body']")?.focus();
      });
    });

    socialBox.querySelectorAll("[data-cancel-reply='1']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const reviewId = btn.getAttribute("data-rid");
        if (!reviewId) return;
        const form = socialBox.querySelector(`form[data-comment-form='1'][data-rid='${reviewId}']`);
        if (!form) return;
        const input = form.querySelector("input[name='parent_comment_id']");
        if (input) input.value = "";
        form.hidden = true;
      });
    });

    socialBox.querySelectorAll("[data-vote-comment]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const commentId = btn.getAttribute("data-cid");
          const vote = btn.getAttribute("data-vote-comment");
          if (!commentId || !vote) return;
          await apiFetch(`/social/comments/${encodeURIComponent(commentId)}/vote`, {
            method: "POST",
            body: JSON.stringify({ vote }),
          });
          await loadSocial(type, id);
        } catch (err) {
          toast(err?.message || "Vote impossible", "Erreur");
        }
      });
    });

    socialBox.querySelectorAll("[data-del-comment='1']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const commentId = btn.getAttribute("data-cid");
          if (!commentId) return;
          if (!window.confirm("Supprimer ce commentaire ?")) return;
          await apiFetch(`/social/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
          await loadSocial(type, id);
        } catch (err) {
          toast(err?.message || "Suppression impossible", "Erreur");
        }
      });
    });

    socialBox.querySelectorAll("[data-edit-comment='1']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const commentId = btn.getAttribute("data-cid");
          if (!commentId) return;
          const bodyNode = btn.closest(".cmt-main")?.querySelector(".cmt-body");
          const currentBody = String(bodyNode?.textContent || "").trim();
          const nextBody = window.prompt("Modifier ta reponse:", currentBody);
          if (nextBody == null) return;
          await apiFetch(`/social/comments/${encodeURIComponent(commentId)}`, {
            method: "PATCH",
            body: JSON.stringify({ body: String(nextBody).trim() }),
          });
          await loadSocial(type, id);
        } catch (err) {
          toast(err?.message || "Modification impossible", "Erreur");
        }
      });
    });
  }

  async function loadSocial(type, id) {
    if (!templates.size) {
      templates = await loadCommentsTemplates();
    }
    socialBox.innerHTML = fillTemplate(
      templates.get("tpl-social-loading") || `<small>Chargement commentaires...</small>`
    );
    try {
      const data = await apiFetch(`/social/media/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
      currentSocialUserId = String(data?.current_user_id || "");
      loadSavedMedia();
      const s = data?.summary || {};
      const reviewsRaw = Array.isArray(data?.reviews) ? data.reviews : [];
      const reviews = sortReviews(reviewsRaw);
      const authed = isLoggedIn();
      const totalCount = Number(s.comment_count || 0) + Number(s.review_count || 0);
      const topComposer = authed
        ? fillTemplate(
            templates.get("tpl-top-composer-auth") ||
              `
          <form id="topCommentForm" class="cmt-compose">
            <input type="hidden" name="rating" value="5" />
            <input class="input" name="body" placeholder="Ajoute un commentaire..." />
            <input type="hidden" name="image_url" value="" />
            <input type="hidden" name="sticker" value="" />
            <input type="file" name="image_file" accept="image/png,image/jpeg,image/webp" style="display:none" />
            <div class="cmt-tools">
              <button class="cmt-plus" data-add-image="1" type="button">+</button>
              <button class="cmt-action" data-open-stickers="1" type="button">Sticker</button>
              <button class="btn" type="submit">Publier</button>
            </div>
            <div class="composer-preview" data-preview="1"></div>
            <div class="sticker-strip" data-stickers="1" hidden>{{STICKER_PICKER}}</div>
          </form>
        `,
            { STICKER_PICKER: stickerPickerHtml({ savedStickers, savedGifs }) }
          )
        : fillTemplate(
            templates.get("tpl-top-composer-guest") ||
              `<small style="display:block;margin-top:10px">Connecte-toi pour commenter.</small>`
          );
      const reviewsHtml =
        reviews.map(renderReviewItem).join("") ||
        fillTemplate(templates.get("tpl-empty-state") || `<small>Aucun commentaire pour le moment.</small>`);

      socialBox.innerHTML = fillTemplate(
        templates.get("tpl-social-root") ||
          `
        <div class="cmt-header">
          <div class="cmt-title">{{TOTAL_COUNT}} commentaires</div>
          <div class="cmt-sort-wrap">
            <button id="sortBtn" class="cmt-sort-btn" type="button">Trier par</button>
            <div id="sortMenu" class="cmt-sort-menu" hidden>
              <button class="cmt-sort-item" data-sort="popular" type="button">Les plus populaires</button>
              <button class="cmt-sort-item" data-sort="recent" type="button">Les plus recents</button>
            </div>
          </div>
        </div>
        {{TOP_COMPOSER}}
        <div class="cmt-list">{{REVIEWS_HTML}}</div>
      `,
        {
          TOTAL_COUNT: String(totalCount),
          SAVED_MEDIA_SECTION: renderSavedMediaSection(),
          TOP_COMPOSER: topComposer,
          REVIEWS_HTML: reviewsHtml,
        }
      );
      applyReplyOffsets();

      await bindSocialActions(type, id);
    } catch (err) {
      currentSocialUserId = "";
      socialBox.innerHTML = fillTemplate(
        templates.get("tpl-social-error") || `<small style="color:#ffb0b0">Erreur social: {{ERROR}}</small>`,
        { ERROR: escapeHtml(err?.message || "Erreur") }
      );
    }
  }

  openCommentsBtn?.addEventListener("click", openCommentsSheet);
  closeCommentsBtn?.addEventListener("click", closeCommentsSheet);
  commentsBackdrop?.addEventListener("click", closeCommentsSheet);

  return {
    loadSocial,
    openCommentsSheet,
    closeCommentsSheet,
  };
}

