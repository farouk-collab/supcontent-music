import { apiFetch, toast, escapeHtml, getTokens, serverLogout, resolveMediaUrl } from "/app.js";

console.log("PROFILE JS LOADED");

// elements presents dans profile.html (vue)
const profileView = document.querySelector("#profileView");
const refreshBtn = document.querySelector("#refreshBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const accessLenEl = document.querySelector("#accessLen");
const refreshLenEl = document.querySelector("#refreshLen");
const statusBadge = document.querySelector("#statusBadge");
const diagBox = document.querySelector("#diagBox");

// securite: si un element manque, on log et on stop proprement
function must(el, name) {
  if (!el) {
    console.error(`Element manquant dans profile.html: ${name}`);
    return false;
  }
  return true;
}

if (
  !must(profileView, "#profileView") ||
  !must(refreshBtn, "#refreshBtn") ||
  !must(logoutBtn, "#logoutBtn") ||
  !must(accessLenEl, "#accessLen") ||
  !must(refreshLenEl, "#refreshLen") ||
  !must(statusBadge, "#statusBadge") ||
  !must(diagBox, "#diagBox")
) {
  // On evite le crash addEventListener sur null
  throw new Error("profile.html ne contient pas tous les elements attendus.");
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
    <div style="margin-top:10px"><a class="btn primary" href="/auth.html">Se connecter</a></div>
  `;
}

function renderProfile(u) {
  const coverUrl = resolveMediaUrl(u.cover_url || "");
  const avatarUrl = resolveMediaUrl(u.avatar_url || "");

  const coverStyle = coverUrl
    ? `background-image:url('${escapeHtml(coverUrl)}'); background-size:cover; background-position:center;`
    : `background:linear-gradient(135deg, rgba(124,92,255,.25), rgba(0,255,209,.12));`;

  const avatar = avatarUrl
    ? `<img alt="" src="${escapeHtml(avatarUrl)}" style="width:84px;height:84px;border-radius:22px;object-fit:cover;border:1px solid rgba(255,255,255,.12)"/>`
    : `<div style="width:84px;height:84px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)"></div>`;

  profileView.innerHTML = `
    <div style="border:1px solid rgba(255,255,255,.10);border-radius:18px;overflow:hidden">
      <div style="height:160px;${coverStyle}"></div>

      <div style="padding:14px;display:flex;gap:14px;align-items:center">
        ${avatar}
        <div>
          <div style="font-weight:900;font-size:22px">${escapeHtml(u.display_name || "-")}</div>
          <div style="color:var(--muted)">@${escapeHtml(u.username || "username")}</div>
          <div style="margin-top:6px;color:var(--muted)">${escapeHtml(u.email || "")}</div>
        </div>
      </div>

      <div style="padding:0 14px 14px 14px;color:var(--muted)">
        <div>${escapeHtml(u.bio || "Bio vide...")}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${u.location ? `<span class="badge">${escapeHtml(u.location)}</span>` : ""}
          ${u.gender ? `<span class="badge">${escapeHtml(u.gender)}</span>` : ""}
          ${u.birth_date ? `<span class="badge">Date: ${escapeHtml(String(u.birth_date).slice(0,10))}</span>` : ""}
          ${u.website ? `<a class="pill" href="${escapeHtml(u.website)}" target="_blank" rel="noreferrer">Site</a>` : ""}
        </div>
      </div>
    </div>
  `;
}

async function loadMe() {
  const t = updateTokenStats();

  if (!t.accessToken) {
    renderNeedAuth("Aucun token trouve dans le navigateur (localStorage). Connecte-toi sur /auth.html.");
    return;
  }

  try {
    const r = await apiFetch("/auth/me");
    renderProfile(r.user);
  } catch (err) {
    console.error(err);
    toast(err?.message || "Erreur /auth/me", "Erreur");
    if (err?.status === 401) renderNeedAuth("401 Unauthorized : token manquant/expire. Reconnecte-toi.");
    else profileView.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err?.message || "")}</small>`;
  }
}

refreshBtn.addEventListener("click", loadMe);

logoutBtn.addEventListener("click", async () => {
  await serverLogout();
  updateTokenStats();
  toast("Déconnecté.", "OK");
  renderNeedAuth("Tokens supprimés. Reconnecte-toi.");
});

loadMe();
