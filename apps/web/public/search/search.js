import { apiFetch, toast, escapeHtml, isLoggedIn, resolveMediaUrl } from "/core/app.js";

const form = document.querySelector("#searchForm");
const usersForm = document.querySelector("#usersSearchForm");
const results = document.querySelector("#results");
const hint = document.querySelector("#hint");
const usersResults = document.querySelector("#usersResults");

function mediaHref(type, id) {
  const safeType = String(type || "").trim();
  const safeId = String(id || "").trim();
  if (!safeType || !safeId) return "#";
  const q = `type=${encodeURIComponent(safeType)}&id=${encodeURIComponent(safeId)}`;
  return `/media/media.html?${q}#${q}`;
}

function pickItems(data) {
  return data?.items || data?.tracks?.items || data?.albums?.items || data?.artists?.items || [];
}

function pickImage(item) {
  const candidates = [
    ...(Array.isArray(item?.images) ? item.images : []),
    ...(Array.isArray(item?.album?.images) ? item.album.images : []),
  ];
  if (!candidates.length) return "";
  return candidates[0]?.url || candidates[0] || "";
}

function renderItem(it) {
  const img = resolveMediaUrl(pickImage(it));
  const name = it.name || "";
  const id = it.id;
  const type = it.type;
  const sub = it.artists ? it.artists.map((a) => a.name).join(", ") : it.genres ? it.genres.join(", ") : "";
  const href = mediaHref(type, id);

  return `
    <a class="item" href="${href}">
      <div class="cover">${img ? `<img src="${escapeHtml(img)}" alt="">` : `<div class="badge">no image</div>`}</div>
      <div class="meta">
        <div class="title">${escapeHtml(name)}</div>
        <div class="sub">${escapeHtml(sub)}</div>
        <div class="badge">Ouvrir detail</div>
      </div>
    </a>
  `;
}

function userCard(u) {
  const id = String(u.id || "");
  const username = String(u.username || "user");
  const displayName = String(u.display_name || username);
  const avatar = resolveMediaUrl(String(u.avatar_url || ""));
  const followers = Number(u.followers_count || 0);
  const following = Number(u.following_count || 0);
  const followingByMe = Boolean(u.is_following);

  return `
    <div class="row" style="justify-content:space-between;gap:10px;border:1px solid var(--border);padding:10px;border-radius:12px;margin-top:8px">
      <div class="row" style="gap:10px;align-items:center;min-width:0">
        <div style="width:42px;height:42px;border-radius:999px;overflow:hidden;border:1px solid var(--border);background:rgba(255,255,255,.06)">
          ${avatar ? `<img src="${escapeHtml(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover" />` : ""}
        </div>
        <div>
          <div style="font-weight:700">${escapeHtml(displayName)}</div>
          <div style="color:var(--muted)">@${escapeHtml(username)}</div>
          <div class="row" style="gap:6px;margin-top:4px">
            <span class="badge">Followers: ${followers}</span>
            <span class="badge">Following: ${following}</span>
          </div>
        </div>
      </div>
      <div class="row" style="gap:8px;align-items:center">
        <a class="btn" href="/profile/profile.html?user=${encodeURIComponent(id)}">Voir profil</a>
        ${
          isLoggedIn()
            ? `<button class="btn ${followingByMe ? "" : "primary"}" data-follow-toggle="1" data-user-id="${escapeHtml(
                id
              )}" data-following="${followingByMe ? "1" : "0"}" type="button">${followingByMe ? "Ne plus suivre" : "Suivre"}</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function bindFollowActions() {
  usersResults?.querySelectorAll("[data-follow-toggle='1']").forEach((btn) => {
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

async function doSearch(q, type, limit) {
  results.innerHTML = `<small>Chargement...</small>`;
  hint.textContent = "";
  try {
    const mediaData = await apiFetch(`/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`);

    const items = pickItems(mediaData);

    if (!items.length) {
      results.innerHTML = `<small>Aucun resultat</small>`;
    } else {
      results.innerHTML = items.map(renderItem).join("");
      const withImageCount = items.filter((it) => Boolean(pickImage(it))).length;
      hint.textContent = `Resultats: ${items.length} | Images: ${withImageCount}`;
    }
  } catch (err) {
    results.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err.message || "Erreur")}</small>`;
    toast(err.message || "Erreur recherche", "Erreur recherche");
  }
}

async function doUsersSearch(q) {
  const clean = String(q || "").trim();
  if (!usersResults) return;
  if (!clean) {
    usersResults.innerHTML = `<small>Fais une recherche pour voir les comptes.</small>`;
    return;
  }
  usersResults.innerHTML = `<small>Chargement utilisateurs...</small>`;
  try {
    const usersData = await apiFetch(`/users/search?q=${encodeURIComponent(clean)}&limit=12`);
    const users = Array.isArray(usersData?.users) ? usersData.users : [];
    usersResults.innerHTML = users.length ? users.map(userCard).join("") : `<small>Aucun utilisateur trouve.</small>`;
    bindFollowActions();
  } catch (err) {
    usersResults.innerHTML = `<small style="color:#ffb0b0">Erreur recherche utilisateurs.</small>`;
    toast(err?.message || "Erreur recherche utilisateurs", "Erreur");
  }
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const q = String(fd.get("q") || "").trim();
  const type = String(fd.get("type") || "artist");
  const limit = String(fd.get("limit") || "10");
  doSearch(q, type, limit);
});

usersForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(usersForm);
  const q = String(fd.get("user_q") || "").trim();
  doUsersSearch(q);
});

doSearch("daft punk", "artist", 10);
