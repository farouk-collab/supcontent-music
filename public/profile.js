import { apiFetch, toast, escapeHtml, getTokens, clearTokens } from "/app.js";

const meBox = document.querySelector("#meBox");
const diagBox = document.querySelector("#diagBox");
const refreshBtn = document.querySelector("#refreshBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const accessLenEl = document.querySelector("#accessLen");
const refreshLenEl = document.querySelector("#refreshLen");
const statusBadge = document.querySelector("#statusBadge");

// menu dynamique (même logique que index.js)
function applyAuthUI() {
  const t = getTokens();
  const isAuthed = Boolean(t.accessToken);

  const loginEl = document.querySelector('[data-auth="login"]');
  const profileEl = document.querySelector('[data-auth="profile"]');
  const logoutEl = document.querySelector('[data-auth="logout"]');

  if (loginEl) loginEl.style.display = isAuthed ? "none" : "";
  if (profileEl) profileEl.style.display = isAuthed ? "" : "none";
  if (logoutEl) logoutEl.style.display = isAuthed ? "" : "none";

  if (logoutEl) {
    logoutEl.onclick = (e) => {
      e.preventDefault();
      clearTokens();
      toast("Déconnecté (tokens supprimés).", "OK");
      applyAuthUI();
      renderNeedAuth("Tokens supprimés. Reconnecte-toi.");
      updateTokenStats();
    };
  }
}

function updateTokenStats() {
  const t = getTokens();
  accessLenEl.textContent = String(t.accessToken.length);
  refreshLenEl.textContent = String(t.refreshToken.length);

  if (t.accessToken.length > 0) {
    statusBadge.textContent = "Token présent ✅";
  } else {
    statusBadge.textContent = "Non connecté ❌";
  }
}

function renderNeedAuth(errMsg) {
  meBox.innerHTML = `
    <div class="card" style="background:rgba(255,255,255,.03)">
      <h3 style="margin:0 0 8px 0">Connexion requise</h3>
      <p style="color:var(--muted);margin:0 0 10px 0">
        ${escapeHtml(errMsg || "Tu n'es pas connecté.")}
      </p>
      <a class="btn primary" href="/auth.html">Se connecter</a>
    </div>
  `;
}

async function loadMe() {
  applyAuthUI();
  updateTokenStats();

  const t = getTokens();

  diagBox.innerHTML = `
    <div>Origin page : <code>${escapeHtml(window.location.origin)}</code></div>
    <div>API cible : <code>http://localhost:1234</code></div>
    <div>Authorization envoyé : <strong>${t.accessToken ? "OUI" : "NON"}</strong></div>
  `;

  if (!t.accessToken) {
    renderNeedAuth("Aucun access token dans le navigateur (localStorage).");
    return;
  }

  try {
    const r = await apiFetch("/auth/me");
    const u = r.user;

    statusBadge.textContent = "Connecté ✅";

    meBox.innerHTML = `
      <div class="row">
        <span class="badge">ID</span> <code>${escapeHtml(u.id)}</code>
      </div>
      <div style="margin-top:10px">
        <div><strong>${escapeHtml(u.display_name || "")}</strong></div>
        <div style="color:var(--muted)">${escapeHtml(u.email || "")}</div>
        <div style="margin-top:8px;color:var(--muted)">${escapeHtml(u.bio || "(bio vide)")}</div>
      </div>
    `;
  } catch (err) {
    console.error("Erreur /auth/me:", err);
    const msg = err?.message || "Erreur /auth/me";
    toast(msg, "Erreur /auth/me");

    // si token invalide/expiré
    if (err?.status === 401) {
      renderNeedAuth("401 Unauthorized : token manquant/expiré. Reconnecte-toi.");
      statusBadge.textContent = "Non connecté ❌";
      return;
    }

    meBox.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(msg)}</small>`;
  }
}

refreshBtn?.addEventListener("click", loadMe);

logoutBtn?.addEventListener("click", () => {
  clearTokens();
  toast("Déconnecté (tokens supprimés).", "OK");
  applyAuthUI();
  updateTokenStats();
  renderNeedAuth("Tokens supprimés. Reconnecte-toi.");
});

loadMe();
