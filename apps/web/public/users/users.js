import { apiFetch, escapeHtml, toast, isLoggedIn, resolveMediaUrl } from "/core/app.js";

const form = document.querySelector("#usersSearchForm");
const resultsBox = document.querySelector("#usersResults");

function userCard(u) {
  const avatar = resolveMediaUrl(String(u.avatar_url || "").trim());
  const id = String(u.id || "");
  const username = String(u.username || "user");
  const displayName = String(u.display_name || username);
  const bio = String(u.bio || "");
  const followers = Number(u.followers_count || 0);
  const following = Number(u.following_count || 0);
  const isFollowing = Boolean(u.is_following);

  return `
    <div class="row" style="justify-content:space-between;gap:12px;border:1px solid var(--border);border-radius:12px;padding:10px;margin-top:10px">
      <div class="row" style="gap:10px;align-items:center;min-width:0">
        <div style="width:48px;height:48px;border-radius:999px;overflow:hidden;border:1px solid var(--border);background:rgba(255,255,255,.06)">
          ${avatar ? `<img src="${escapeHtml(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover" />` : ""}
        </div>
        <div style="min-width:0">
          <div style="font-weight:700">${escapeHtml(displayName)}</div>
          <div style="color:var(--muted)">@${escapeHtml(username)}</div>
          ${bio ? `<div style="color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px">${escapeHtml(bio)}</div>` : ""}
          <div class="row" style="gap:6px;margin-top:4px;flex-wrap:wrap">
            <span class="badge">Followers: ${followers}</span>
            <span class="badge">Following: ${following}</span>
          </div>
        </div>
      </div>
      <div class="row" style="gap:8px;align-items:center">
        <a class="btn" href="/profile/profile.html?user=${encodeURIComponent(id)}">Voir profil</a>
        ${
          isLoggedIn()
            ? `<button class="btn ${isFollowing ? "" : "primary"}" data-follow-toggle="1" data-user-id="${escapeHtml(id)}" data-following="${
                isFollowing ? "1" : "0"
              }" type="button">${isFollowing ? "Ne plus suivre" : "Suivre"}</button>`
            : ""
        }
      </div>
    </div>
  `;
}

async function bindFollowActions() {
  resultsBox.querySelectorAll("[data-follow-toggle='1']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const userId = btn.getAttribute("data-user-id");
        const following = btn.getAttribute("data-following") === "1";
        if (!userId) return;
        if (following) {
          await apiFetch(`/follows/${encodeURIComponent(userId)}`, { method: "DELETE" });
          btn.setAttribute("data-following", "0");
          btn.textContent = "Suivre";
          btn.classList.add("primary");
        } else {
          await apiFetch(`/follows/${encodeURIComponent(userId)}`, { method: "POST" });
          btn.setAttribute("data-following", "1");
          btn.textContent = "Ne plus suivre";
          btn.classList.remove("primary");
        }
      } catch (err) {
        toast(err?.message || "Action follow impossible", "Erreur");
      }
    });
  });
}

async function searchUsers(q) {
  resultsBox.innerHTML = `<small>Recherche en cours...</small>`;
  try {
    const data = await apiFetch(`/users/search?q=${encodeURIComponent(q)}&limit=20`);
    const users = Array.isArray(data?.users) ? data.users : [];
    if (!users.length) {
      resultsBox.innerHTML = `<small>Aucun utilisateur trouvé.</small>`;
      return;
    }
    resultsBox.innerHTML = users.map(userCard).join("");
    await bindFollowActions();
  } catch (err) {
    resultsBox.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err?.message || "Erreur")}</small>`;
    toast(err?.message || "Recherche utilisateurs impossible", "Erreur");
  }
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const q = String(fd.get("q") || "").trim();
  if (!q) return;
  searchUsers(q);
});
