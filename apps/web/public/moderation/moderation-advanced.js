import { apiFetch, requireLogin, toast } from "/noyau/app.js";

async function checkAdmin() {
  if (!requireLogin({ redirect: true })) return false;
  try {
    const data = await apiFetch("/auth/me");
    return data?.user?.role === "admin";
  } catch { return false; }
}

function renderStars(n) {
  const r = Math.max(0, Math.min(5, Number(n) || 0));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

async function loadReports() {
  const el = document.getElementById("reportsList");
  if (!el) return;
  el.innerHTML = "<div class='empty'>Chargement…</div>";
  try {
    const data = await apiFetch("/admin/reports");
    const reports = data?.reports || [];
    if (!reports.length) { el.innerHTML = "<div class='empty'>Aucun signalement en attente.</div>"; return; }
    el.innerHTML = reports.map((r) => `
      <div class="card" id="report-${r.id}">
        <div class="card-head">
          <div>
            <span class="tag">${r.reason || "inappropriate"}</span>
            <span class="meta" style="margin-left:8px">Signalé par ${r.reporter_name || "?"} — ${timeAgo(r.created_at)}</span>
          </div>
          <span class="rating">${renderStars(r.rating)}</span>
        </div>
        <div class="body-text">${r.review_body ? `"${r.review_body}"` : "<em>Pas de texte</em>"}</div>
        <div class="meta">Par <strong>${r.author_name || r.author_username || "?"}</strong> · ${r.media_type || ""} · ${r.media_id || ""}</div>
        <div class="actions">
          <button class="btn btn-danger" onclick="deleteReview('${r.review_id}','${r.id}')">Supprimer la critique</button>
          <button class="btn btn-warn" onclick="featureReview('${r.review_id}')">⭐ Coup de cœur</button>
          <button class="btn" onclick="dismissReport('${r.id}')">Ignorer</button>
        </div>
      </div>
    `).join("");
  } catch (e) {
    el.innerHTML = `<div class='empty'>Erreur : ${e?.message || "impossible de charger"}</div>`;
  }
}

window.deleteReview = async (reviewId, reportId) => {
  if (!confirm("Supprimer cette critique ? Action irréversible.")) return;
  try {
    await apiFetch(`/admin/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
    document.getElementById(`report-${reportId}`)?.remove();
    toast("Critique supprimée.", "Succès");
    if (!document.querySelector("#reportsList .card"))
      document.getElementById("reportsList").innerHTML = "<div class='empty'>Aucun signalement en attente.</div>";
  } catch (e) { toast(e?.message || "Erreur suppression", "Erreur"); }
};

window.featureReview = async (reviewId) => {
  try {
    await apiFetch(`/admin/reviews/${encodeURIComponent(reviewId)}/featured`, { method: "PATCH", body: JSON.stringify({ featured: true }) });
    toast("Critique mise en avant !", "Succès");
  } catch (e) { toast(e?.message || "Erreur", "Erreur"); }
};

window.dismissReport = async (reportId) => {
  try {
    await apiFetch(`/admin/reports/${encodeURIComponent(reportId)}/dismiss`, { method: "PATCH" });
    document.getElementById(`report-${reportId}`)?.remove();
    toast("Signalement ignoré.", "Succès");
    if (!document.querySelector("#reportsList .card"))
      document.getElementById("reportsList").innerHTML = "<div class='empty'>Aucun signalement en attente.</div>";
  } catch (e) { toast(e?.message || "Erreur", "Erreur"); }
};

async function loadUsers(q = "") {
  const el = document.getElementById("usersList");
  if (!el) return;
  el.innerHTML = "<div class='empty'>Chargement…</div>";
  try {
    const url = q ? `/admin/users?q=${encodeURIComponent(q)}` : "/admin/users";
    const data = await apiFetch(url);
    const users = data?.users || [];
    if (!users.length) { el.innerHTML = "<div class='empty'>Aucun utilisateur trouvé.</div>"; return; }
    el.innerHTML = users.map((u) => `
      <div class="card" id="user-${u.id}">
        <div class="card-head">
          <div>
            <strong style="color:#e5e7eb">${u.display_name || u.username || "?"}</strong>
            <span class="user-role ${u.role === 'admin' ? 'role-admin' : u.banned ? 'role-banned' : 'role-user'}" style="margin-left:8px">
              ${u.banned ? "Banni" : (u.role || "user")}
            </span>
          </div>
          <span class="meta">${timeAgo(u.created_at)}</span>
        </div>
        <div class="meta">${u.email || "—"} · @${u.username || "—"}</div>
        <div class="actions">
          ${u.banned
            ? `<button class="btn btn-primary" onclick="unbanUser('${u.id}')">Débannir</button>`
            : `<button class="btn btn-danger" onclick="banUser('${u.id}')">Bannir</button>`
          }
          ${u.role !== "admin"
            ? `<button class="btn btn-warn" onclick="promoteUser('${u.id}')">Promouvoir admin</button>`
            : `<button class="btn" onclick="demoteUser('${u.id}')">Rétrograder</button>`
          }
        </div>
      </div>
    `).join("");
  } catch (e) {
    el.innerHTML = `<div class='empty'>Erreur : ${e?.message || "impossible de charger"}</div>`;
  }
}

window.banUser = async (userId) => {
  if (!confirm("Bannir cet utilisateur ?")) return;
  try {
    await apiFetch(`/admin/users/${encodeURIComponent(userId)}/ban`, { method: "POST" });
    toast("Utilisateur banni.", "Succès");
    loadUsers(document.getElementById("userSearch")?.value || "");
  } catch (e) { toast(e?.message || "Erreur", "Erreur"); }
};

window.unbanUser = async (userId) => {
  try {
    await apiFetch(`/admin/users/${encodeURIComponent(userId)}/unban`, { method: "POST" });
    toast("Utilisateur débanni.", "Succès");
    loadUsers(document.getElementById("userSearch")?.value || "");
  } catch (e) { toast(e?.message || "Erreur", "Erreur"); }
};

window.promoteUser = async (userId) => {
  try {
    await apiFetch(`/admin/users/${encodeURIComponent(userId)}/role`, { method: "PATCH", body: JSON.stringify({ role: "admin" }) });
    toast("Promu administrateur.", "Succès");
    loadUsers(document.getElementById("userSearch")?.value || "");
  } catch (e) { toast(e?.message || "Erreur", "Erreur"); }
};

window.demoteUser = async (userId) => {
  try {
    await apiFetch(`/admin/users/${encodeURIComponent(userId)}/role`, { method: "PATCH", body: JSON.stringify({ role: "user" }) });
    toast("Rétrogradé.", "Succès");
    loadUsers(document.getElementById("userSearch")?.value || "");
  } catch (e) { toast(e?.message || "Erreur", "Erreur"); }
};

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.getElementById(`tab-${tab}`)?.classList.add("is-active");
    if (tab === "reports") loadReports();
    if (tab === "users") loadUsers();
  });
});

document.getElementById("refreshReports")?.addEventListener("click", loadReports);
document.getElementById("searchUsersBtn")?.addEventListener("click", () => loadUsers(document.getElementById("userSearch")?.value || ""));
document.getElementById("userSearch")?.addEventListener("keydown", (e) => { if (e.key === "Enter") loadUsers(e.target.value || ""); });

async function init() {
  const isAdmin = await checkAdmin();
  if (!isAdmin) { document.getElementById("adminCheck").style.display = "block"; return; }
  document.getElementById("pageHeader").style.display = "block";
  document.getElementById("mainContent").style.display = "block";
  loadReports();
}

init();