import { apiFetch, toast, getTokens, escapeHtml, resolveMediaUrl } from "/core/app.js";

function mediaHref(type, id) {
  const safeType = String(type || "").trim();
  const safeId = String(id || "").trim();
  if (!safeType || !safeId) return "#";
  const q = `type=${encodeURIComponent(safeType)}&id=${encodeURIComponent(safeId)}`;
  return `/media/media.html?${q}#${q}`;
}

function openNotifSheet() {
  const sheet = document.querySelector("#notifSheet");
  if (!sheet) return;
  sheet.removeAttribute("hidden");
  document.body.classList.add("comments-open");
}

function closeNotifSheet() {
  const sheet = document.querySelector("#notifSheet");
  if (!sheet) return;
  sheet.setAttribute("hidden", "");
  document.body.classList.remove("comments-open");
}

function renderNotifUserRows(items = [], emptyText = "Aucun element") {
  if (!items.length) return `<small style="color:var(--muted)">${emptyText}</small>`;
  return items
    .map(
      (u) => `
      <div class="news-item" style="grid-template-columns:40px 1fr auto">
        <div class="news-cover" style="width:40px;height:40px;border-radius:999px">
          ${u.avatar_url ? `<img src="${escapeHtml(resolveMediaUrl(String(u.avatar_url)))}" alt="">` : `<span class="badge">U</span>`}
        </div>
        <div>
          <div class="news-title">@${escapeHtml(String(u.username || "user"))}</div>
          <div class="news-sub">${escapeHtml(String(u.display_name || ""))}</div>
        </div>
        <a class="btn" href="/profile/profile.html?user=${encodeURIComponent(String(u.id || ""))}">Voir</a>
      </div>
    `
    )
    .join("");
}

async function loadNotifications(onFollowSuccess) {
  const followersBox = document.querySelector("#notifFollowers");
  const repliesBox = document.querySelector("#notifReplies");
  const suggestionsBox = document.querySelector("#notifSuggestions");
  if (!followersBox || !repliesBox || !suggestionsBox) return;

  if (!getTokens().accessToken) {
    followersBox.innerHTML = `<small>Connecte-toi pour les notifications.</small>`;
    repliesBox.innerHTML = "";
    suggestionsBox.innerHTML = "";
    return;
  }

  followersBox.innerHTML = `<small>Chargement...</small>`;
  repliesBox.innerHTML = "";
  suggestionsBox.innerHTML = "";
  try {
    const data = await apiFetch("/notifications/me?limit=8");
    const followers = Array.isArray(data?.followers) ? data.followers : [];
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
    const replies = Array.isArray(data?.comment_replies) ? data.comment_replies : [];

    followersBox.innerHTML = `
      <h4 style="margin:0 0 8px 0">Nouveaux followers</h4>
      ${renderNotifUserRows(followers, "Aucun nouveau follower.")}
    `;

    repliesBox.innerHTML = `
      <h4 style="margin:0 0 8px 0">Reponses a tes commentaires</h4>
      ${
        replies.length
          ? replies
              .map(
                (r) => `
                <a class="news-item" href="${mediaHref(r.media_type, r.media_id)}">
                  <div class="news-cover" style="width:40px;height:40px;border-radius:999px">
                    ${r.avatar_url ? `<img src="${escapeHtml(resolveMediaUrl(String(r.avatar_url)))}" alt="">` : `<span class="badge">R</span>`}
                  </div>
                  <div>
                    <div class="news-title">@${escapeHtml(String(r.username || "user"))} t'a repondu</div>
                    <div class="news-sub">${escapeHtml(String(r.body || "").slice(0, 110) || "Voir la reponse")}</div>
                  </div>
                </a>
              `
              )
              .join("")
          : `<small style="color:var(--muted)">Aucune reponse recente.</small>`
      }
    `;

    suggestionsBox.innerHTML = `
      <h4 style="margin:0 0 8px 0">Suggestions a suivre</h4>
      ${
        suggestions.length
          ? suggestions
              .map(
                (u) => `
                <div class="news-item" style="grid-template-columns:40px 1fr auto">
                  <div class="news-cover" style="width:40px;height:40px;border-radius:999px">
                    ${u.avatar_url ? `<img src="${escapeHtml(resolveMediaUrl(String(u.avatar_url)))}" alt="">` : `<span class="badge">S</span>`}
                  </div>
                  <div>
                    <div class="news-title">@${escapeHtml(String(u.username || "user"))}</div>
                    <div class="news-sub">${escapeHtml(String(u.display_name || ""))} - ${Number(u.followers_count || 0)} followers</div>
                  </div>
                  <button class="btn primary notif-follow-btn" type="button" data-user-id="${escapeHtml(String(u.id || ""))}">Suivre</button>
                </div>
              `
              )
              .join("")
          : `<small style="color:var(--muted)">Pas de suggestion pour l'instant.</small>`
      }
    `;

    suggestionsBox.querySelectorAll(".notif-follow-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = String(btn.getAttribute("data-user-id") || "");
        if (!userId) return;
        try {
          await apiFetch(`/follows/${encodeURIComponent(userId)}`, { method: "POST" });
          btn.textContent = "Suivi";
          btn.setAttribute("disabled", "disabled");
          if (typeof onFollowSuccess === "function") await onFollowSuccess();
        } catch (err) {
          toast(err?.message || "Action follow impossible", "Erreur");
        }
      });
    });
  } catch (err) {
    followersBox.innerHTML = `<small style="color:#ffb0b0">Erreur notifications.</small>`;
    toast(err?.message || "Erreur notifications", "Erreur");
  }
}

export function initHomeNotifications(onFollowSuccess) {
  const notifBtn = document.querySelector("#homeNotifBtn");
  const backdrop = document.querySelector("#notifBackdrop");
  const closeBtn = document.querySelector("#closeNotifBtn");

  notifBtn?.addEventListener("click", async () => {
    openNotifSheet();
    await loadNotifications(onFollowSuccess);
  });
  backdrop?.addEventListener("click", closeNotifSheet);
  closeBtn?.addEventListener("click", closeNotifSheet);
}
