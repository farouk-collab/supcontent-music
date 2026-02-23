import { apiFetch, escapeHtml, isLoggedIn } from "/noyau/app.js";
import { applyI18n, t } from "/noyau/i18n.js";

const invitesBox = document.querySelector("#invitesBox");

function invitationCard(it) {
  const name = String(it?.display_name || "Utilisateur");
  const username = String(it?.username || "utilisateur");
  const avatar = String(it?.avatar_url || "");
  const msg = String(it?.message || "");
  const canChat = Boolean(it?.can_chat_direct);
  return `
    <article class="invite-card">
      <div class="row" style="gap:10px;align-items:center">
        ${
          avatar
            ? `<img class="avatar-sm" src="${escapeHtml(avatar)}" alt="avatar ${escapeHtml(name)}" />`
            : `<div class="avatar-sm avatar-fallback">${escapeHtml(name.slice(0, 1).toUpperCase() || "U")}</div>`
        }
        <div style="min-width:0">
          <strong>${escapeHtml(name)}</strong>
          <div style="color:var(--muted)">@${escapeHtml(username)}</div>
        </div>
      </div>
      <p style="margin:8px 0 6px 0">${escapeHtml(msg || t("no_message"))}</p>
      <small style="color:${canChat ? "#16a34a" : "var(--muted)"}">
        ${canChat ? t("chat_direct_allowed") : t("invite_pending_chat_blocked")}
      </small>
    </article>
  `;
}

async function loadInvitations() {
  if (!invitesBox) return;
  if (!isLoggedIn()) {
    invitesBox.innerHTML = `<small>${escapeHtml(t("login_to_see_invites"))}</small>`;
    return;
  }
  invitesBox.innerHTML = `<small>${escapeHtml(t("loading_invitations"))}</small>`;
  try {
    const data = await apiFetch("/follows/swipe/invitations/me?status=pending");
    const items = Array.isArray(data?.items) ? data.items : [];
    invitesBox.innerHTML = items.length ? items.map(invitationCard).join("") : `<small>${escapeHtml(t("no_invites"))}</small>`;
  } catch (err) {
    invitesBox.innerHTML = `<small style="color:#ffb0b0">${escapeHtml(err?.message || t("invite_error"))}</small>`;
  }
}

applyI18n(document);
loadInvitations();
