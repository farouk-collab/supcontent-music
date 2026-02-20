import { apiFetch, toast, escapeHtml } from "/app.js";

const statusAddForm = document.querySelector("#statusAddForm");
const createListForm = document.querySelector("#createListForm");
const collectionsBox = document.querySelector("#collectionsBox");
const refreshBtn = document.querySelector("#refreshBtn");

function statusLabel(code = "") {
  return (
    {
      a_voir: "A voir",
      en_cours: "En cours",
      termine: "Termine",
      abandonne: "Abandonne",
    }[code] || code
  );
}

function itemRow(collectionId, it) {
  const href = `/media/media.html?type=${encodeURIComponent(it.media_type)}&id=${encodeURIComponent(it.media_id)}`;
  const mediaName = it?.media?.name || it.media_id;
  const mediaSub = it?.media?.subtitle || "";
  const mediaImg = it?.media?.image || "";
  const social = it?.social || {};
  const reviewCount = Number(social.review_count || 0);
  const likeCount = Number(social.like_count || 0);
  const commentCount = Number(social.comment_count || 0);
  const avgRating = social.avg_rating == null ? null : Number(social.avg_rating);
  return `
    <div class="row" style="justify-content:space-between;border:1px solid var(--border);padding:8px 10px;border-radius:10px">
      <a class="row" href="${href}" style="gap:10px;align-items:center;min-width:0">
        <div style="width:44px;height:44px;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;flex:none">
          ${
            mediaImg
              ? `<img src="${escapeHtml(mediaImg)}" alt="" style="width:100%;height:100%;object-fit:cover" />`
              : `<span class="badge">${escapeHtml(it.media_type)}</span>`
          }
        </div>
        <div style="min-width:0">
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(mediaName)}</div>
          <div style="color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escapeHtml(mediaSub || it.media_id)}
          </div>
          <div class="row" style="gap:6px;margin-top:4px;flex-wrap:wrap">
            <span class="badge">reviews: ${reviewCount}</span>
            <span class="badge">likes: ${likeCount}</span>
            <span class="badge">commentaires: ${commentCount}</span>
            ${avgRating == null ? "" : `<span class="badge">note: ${escapeHtml(avgRating.toFixed(2))}/5</span>`}
          </div>
        </div>
      </a>
      <button class="btn danger" data-del-item="1" data-cid="${escapeHtml(collectionId)}" data-type="${escapeHtml(
    it.media_type
  )}" data-id="${escapeHtml(it.media_id)}" type="button">Retirer</button>
    </div>
  `;
}

function listCard(col) {
  const isStatus = Boolean(col.status_code);
  return `
    <div class="card" style="margin-top:10px">
      <div class="row" style="justify-content:space-between">
        <div class="row">
          <strong>${escapeHtml(col.name)}</strong>
          ${col.status_code ? `<span class="badge">${escapeHtml(statusLabel(col.status_code))}</span>` : ""}
          ${col.is_public ? `<span class="badge">Public</span>` : `<span class="badge">Prive</span>`}
        </div>
        ${
          isStatus
            ? ""
            : `<div class="row">
                 <button class="btn" data-edit-list="1" data-cid="${escapeHtml(col.id)}" data-name="${escapeHtml(
                col.name
              )}" data-public="${col.is_public ? "1" : "0"}" type="button">Editer</button>
                 <button class="btn danger" data-del-list="1" data-cid="${escapeHtml(col.id)}" type="button">Supprimer</button>
               </div>`
        }
      </div>
      <div style="margin-top:10px;display:grid;gap:8px">
        ${(col.items || []).map((it) => itemRow(col.id, it)).join("") || `<small>Aucune oeuvre</small>`}
      </div>
      <form class="row" style="margin-top:10px" data-add-item-form="1" data-cid="${escapeHtml(col.id)}">
        <select class="input" name="media_type" style="max-width:110px">
          <option value="track">track</option>
          <option value="album">album</option>
          <option value="artist">artist</option>
        </select>
        <input class="input" name="media_id" placeholder="spotify id" required />
        <button class="btn" type="submit">Ajouter</button>
      </form>
    </div>
  `;
}

async function loadCollections() {
  collectionsBox.innerHTML = `<small>Chargement...</small>`;
  try {
    const r = await apiFetch("/collections/me?include_items=1");
    const collections = r.collections || [];
    if (!collections.length) {
      collectionsBox.innerHTML = `<small>Aucune collection.</small>`;
      return;
    }
    collectionsBox.innerHTML = collections.map(listCard).join("");
    bindDynamicActions();
  } catch (err) {
    collectionsBox.innerHTML = `<small style="color:#ffb0b0">${escapeHtml(err?.message || "Erreur")}</small>`;
    toast(err?.message || "Erreur chargement collections", "Erreur");
  }
}

async function addStatusItem(e) {
  e.preventDefault();
  const fd = new FormData(statusAddForm);
  const media_type = String(fd.get("media_type") || "track");
  const status = String(fd.get("status") || "a_voir");
  const media_id = String(fd.get("media_id") || "").trim();
  if (!media_id) return;

  await apiFetch(`/collections/status/${encodeURIComponent(status)}/items`, {
    method: "POST",
    body: JSON.stringify({ media_type, media_id }),
  });
  toast("Oeuvre ajoutee au statut.", "OK");
  statusAddForm.reset();
  await loadCollections();
}

async function createList(e) {
  e.preventDefault();
  const fd = new FormData(createListForm);
  const name = String(fd.get("name") || "").trim();
  const is_public = fd.get("is_public") === "on";
  if (!name) return;
  await apiFetch("/collections", {
    method: "POST",
    body: JSON.stringify({ name, is_public }),
  });
  toast("Liste creee.", "OK");
  createListForm.reset();
  await loadCollections();
}

function bindDynamicActions() {
  collectionsBox.querySelectorAll("[data-add-item-form='1']").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cid = form.getAttribute("data-cid");
      const fd = new FormData(form);
      const media_type = String(fd.get("media_type") || "track");
      const media_id = String(fd.get("media_id") || "").trim();
      if (!cid || !media_id) return;
      await apiFetch(`/collections/${encodeURIComponent(cid)}/items`, {
        method: "POST",
        body: JSON.stringify({ media_type, media_id }),
      });
      toast("Oeuvre ajoutee a la liste.", "OK");
      await loadCollections();
    });
  });

  collectionsBox.querySelectorAll("[data-del-item='1']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cid = btn.getAttribute("data-cid");
      const type = btn.getAttribute("data-type");
      const id = btn.getAttribute("data-id");
      if (!cid || !type || !id) return;
      await apiFetch(`/collections/${encodeURIComponent(cid)}/items/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      toast("Oeuvre retiree.", "OK");
      await loadCollections();
    });
  });

  collectionsBox.querySelectorAll("[data-del-list='1']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cid = btn.getAttribute("data-cid");
      if (!cid) return;
      await apiFetch(`/collections/${encodeURIComponent(cid)}`, { method: "DELETE" });
      toast("Liste supprimee.", "OK");
      await loadCollections();
    });
  });

  collectionsBox.querySelectorAll("[data-edit-list='1']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cid = btn.getAttribute("data-cid");
      const currentName = btn.getAttribute("data-name") || "";
      const currentPublic = btn.getAttribute("data-public") === "1";
      if (!cid) return;
      const name = window.prompt("Nouveau nom de la liste", currentName);
      if (!name || !name.trim()) return;
      const is_public = window.confirm(
        `Visibilite publique ?\nOK = Public\nAnnuler = Prive\n(Etat actuel: ${currentPublic ? "Public" : "Prive"})`
      );
      await apiFetch(`/collections/${encodeURIComponent(cid)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), is_public }),
      });
      toast("Liste mise a jour.", "OK");
      await loadCollections();
    });
  });
}

statusAddForm?.addEventListener("submit", (e) => {
  addStatusItem(e).catch((err) => toast(err?.message || "Erreur", "Erreur"));
});
createListForm?.addEventListener("submit", (e) => {
  createList(e).catch((err) => toast(err?.message || "Erreur", "Erreur"));
});
refreshBtn?.addEventListener("click", () => {
  loadCollections().catch((err) => toast(err?.message || "Erreur", "Erreur"));
});

loadCollections().catch((err) => toast(err?.message || "Erreur", "Erreur"));
