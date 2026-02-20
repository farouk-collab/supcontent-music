import { apiFetch, toast, escapeHtml, isLoggedIn, getTokens } from "/app.js";

const API = "http://localhost:1234";

const STICKERS = [
  { id: "heart", url: "/stk/heart.svg" },
  { id: "fire", url: "/stk/fire.svg" },
  { id: "clap", url: "/stk/clap.svg" },
  { id: "wow", url: "/stk/wow.svg" },
  { id: "love", url: "/stk/love.svg" },
  { id: "party", url: "/stk/party.svg" },
  { id: "cry", url: "/stk/cry.svg" },
  { id: "music", url: "/stk/music.svg" },
];

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
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.startsWith("/")) return `<img class="cmt-sticker-img" src="${escapeHtml(s)}" alt="sticker" />`;
  return "";
}

function stickerPickerHtml() {
  return STICKERS.map(
    (s) =>
      `<button class="reaction-chip sticker-chip" data-pick-sticker="${escapeHtml(s.url)}" type="button"><img src="${escapeHtml(
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

  const isCurrentSocialUser = (userId) => {
    const current = String(currentSocialUserId || "").trim();
    const target = String(userId || "").trim();
    return Boolean(current && target && current === target);
  };

  function renderReply(comment, reviewId, depth = 0) {
    const up = Number(comment.votes_up || 0);
    const down = Number(comment.votes_down || 0);
    const myVote = String(comment.my_vote || "");
    const author = String(comment.display_name || "utilisateur");
    const canEdit = isCurrentSocialUser(comment.user_id);
    const canDelete = canEdit || isCurrentSocialUser(comment.review_user_id);

    return `
      <div class="cmt-reply" style="margin-left:${depth * 16}px">
        <div class="cmt-avatar">${escapeHtml(avatarLetter(author))}</div>
        <div class="cmt-main">
          <div class="cmt-meta"><strong>@${escapeHtml(author)}</strong> <span>${escapeHtml(formatAgo(comment.created_at))}</span></div>
          <div class="cmt-body">${escapeHtml(comment.body || "")}</div>
          ${renderSticker(comment.sticker)}
          ${comment.image_url ? `<img class="cmt-image" src="${escapeHtml(comment.image_url)}" alt="image commentaire" />` : ""}
          <div class="cmt-actions">
            <button class="cmt-action ${myVote === "up" ? "is-active" : ""}" data-vote-comment="up" data-cid="${escapeHtml(comment.id)}" type="button">👍 ${up}</button>
            <button class="cmt-action ${myVote === "down" ? "is-danger" : ""}" data-vote-comment="down" data-cid="${escapeHtml(comment.id)}" type="button">👎 ${down}</button>
            <button class="cmt-action" data-reply-comment="1" data-rid="${escapeHtml(reviewId)}" data-cid="${escapeHtml(comment.id)}" type="button">Repondre</button>
            ${canEdit ? `<button class="cmt-action" data-edit-comment="1" data-cid="${escapeHtml(comment.id)}" type="button">Modifier</button>` : ""}
            ${canDelete ? `<button class="cmt-action" data-del-comment="1" data-cid="${escapeHtml(comment.id)}" type="button">Supprimer</button>` : ""}
          </div>
          ${(comment.replies || []).map((r) => renderReply(r, reviewId, depth + 1)).join("")}
        </div>
      </div>
    `;
  }

  function renderReviewItem(review) {
    const myVote = String(review.my_vote || "");
    const author = String(review.display_name || "utilisateur");
    const replies = buildCommentTree(review.comments || []);
    const canManage = isCurrentSocialUser(review.user_id);

    return `
      <div class="cmt-item">
        <div class="cmt-avatar">${escapeHtml(avatarLetter(author))}</div>
        <div class="cmt-main">
          <div class="cmt-meta"><strong>@${escapeHtml(author)}</strong> <span>${escapeHtml(formatAgo(review.created_at))}</span></div>
          <div class="cmt-body">${escapeHtml(review.body || "")}</div>
          ${renderSticker(review.sticker)}
          ${review.image_url ? `<img class="cmt-image" src="${escapeHtml(review.image_url)}" alt="image avis" />` : ""}
          <div class="cmt-actions">
            <button class="cmt-action ${myVote === "up" ? "is-active" : ""}" data-vote-review="up" data-rid="${escapeHtml(review.id)}" type="button">👍 ${Number(
      review.likes_count || 0
    )}</button>
            <button class="cmt-action ${myVote === "down" ? "is-danger" : ""}" data-vote-review="down" data-rid="${escapeHtml(review.id)}" type="button">👎 ${Number(
      review.dislikes_count || 0
    )}</button>
            <span class="cmt-action">${Number(review.rating || 0)}/5</span>
            <button class="cmt-action" data-toggle-reply="${escapeHtml(review.id)}" type="button">Repondre</button>
            ${canManage ? `<button class="cmt-action" data-edit-review="1" data-rid="${escapeHtml(review.id)}" data-rating="${escapeHtml(String(Number(review.rating || 5)))}" type="button">Modifier</button>` : ""}
            ${canManage ? `<button class="cmt-action" data-del-review="1" data-rid="${escapeHtml(review.id)}" type="button">Supprimer</button>` : ""}
          </div>

          <form data-comment-form="1" data-rid="${escapeHtml(review.id)}" class="cmt-compose cmt-compose-inline" hidden>
            <input class="input" name="body" placeholder="Ajouter une reponse..." />
            <input type="hidden" name="parent_comment_id" value="" />
            <input type="hidden" name="image_url" value="" />
            <input type="hidden" name="sticker" value="" />
            <input type="file" name="image_file" accept="image/png,image/jpeg,image/webp" style="display:none" />
            <div class="cmt-tools">
              <button class="cmt-plus" data-add-image="1" type="button">+</button>
              <button class="cmt-action" data-open-stickers="1" type="button">Sticker</button>
              <button class="btn" type="submit">Envoyer</button>
              <button class="cmt-action" data-cancel-reply="1" data-rid="${escapeHtml(review.id)}" type="button">Annuler</button>
            </div>
            <div class="composer-preview" data-preview="1"></div>
            <div class="sticker-strip" data-stickers="1" hidden>${stickerPickerHtml()}</div>
          </form>

          <div class="cmt-replies-title">${Number(review.comments_count || 0)} reponses</div>
          <div class="cmt-replies">
            ${replies.map((r) => renderReply(r, review.id)).join("")}
          </div>
        </div>
      </div>
    `;
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
        const s = btn.getAttribute("data-pick-sticker") || "";
        if (stickerInput) stickerInput.value = s;
        if (preview) preview.innerHTML = `${preview.innerHTML}<div class="composer-pill">Sticker</div><img class="composer-preview-image" src="${escapeHtml(s)}" alt="sticker preview" />`;
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
          const rating = Number(btn.getAttribute("data-rating") || 5);
          const bodyNode = btn.closest(".cmt-main")?.querySelector(".cmt-body");
          const currentBody = String(bodyNode?.textContent || "").trim();
          const nextBody = window.prompt("Modifier ton commentaire:", currentBody);
          if (nextBody == null) return;
          await apiFetch(`/social/media/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews`, {
            method: "POST",
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
    socialBox.innerHTML = `<small>Chargement commentaires...</small>`;
    try {
      const data = await apiFetch(`/social/media/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
      currentSocialUserId = String(data?.current_user_id || "");
      const s = data?.summary || {};
      const reviewsRaw = Array.isArray(data?.reviews) ? data.reviews : [];
      const reviews = sortReviews(reviewsRaw);
      const authed = isLoggedIn();
      const totalCount = Number(s.comment_count || 0) + Number(s.review_count || 0);

      socialBox.innerHTML = `
        <div class="cmt-header">
          <div class="cmt-title">${totalCount} commentaires</div>
          <div class="cmt-sort-wrap">
            <button id="sortBtn" class="cmt-sort-btn" type="button">Trier par</button>
            <div id="sortMenu" class="cmt-sort-menu" hidden>
              <button class="cmt-sort-item" data-sort="popular" type="button">Les plus populaires</button>
              <button class="cmt-sort-item" data-sort="recent" type="button">Les plus recents</button>
            </div>
          </div>
        </div>

        ${
          authed
            ? `
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
              <div class="sticker-strip" data-stickers="1" hidden>${stickerPickerHtml()}</div>
            </form>
          `
            : `<small style="display:block;margin-top:10px">Connecte-toi pour commenter.</small>`
        }

        <div class="cmt-list">
          ${reviews.map(renderReviewItem).join("") || `<small>Aucun commentaire pour le moment.</small>`}
        </div>
      `;

      await bindSocialActions(type, id);
    } catch (err) {
      currentSocialUserId = "";
      socialBox.innerHTML = `<small style="color:#ffb0b0">Erreur social: ${escapeHtml(err?.message || "Erreur")}</small>`;
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
