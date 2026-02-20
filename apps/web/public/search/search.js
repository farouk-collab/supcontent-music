import { apiFetch, toast, escapeHtml } from "/app.js";

const form = document.querySelector("#searchForm");
const results = document.querySelector("#results");
const hint = document.querySelector("#hint");

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
  const img = pickImage(it);
  const name = it.name || "";
  const id = it.id;
  const type = it.type;
  const sub = it.artists ? it.artists.map((a) => a.name).join(", ") : it.genres ? it.genres.join(", ") : "";
  const href = `/media/media.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;

  return `
    <a class="item" href="${href}">
      <div class="cover">${img ? `<img src="${escapeHtml(img)}" alt="">` : `<div class="badge">no image</div>`}</div>
      <div class="meta">
        <div class="title">${escapeHtml(name)}</div>
        <div class="sub">${escapeHtml(sub)}</div>
        <div class="badge">Ouvrir détail</div>
      </div>
    </a>
  `;
}

async function doSearch(q, type, limit) {
  results.innerHTML = `<small>Chargement...</small>`;
  hint.textContent = "";
  try {
    const data = await apiFetch(`/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`);
    const items = pickItems(data);
    if (!items.length) {
      results.innerHTML = `<small>Aucun résultat</small>`;
      return;
    }
    results.innerHTML = items.map(renderItem).join("");
    const withImageCount = items.filter((it) => Boolean(pickImage(it))).length;
    hint.textContent = `Résultats: ${items.length} | Images: ${withImageCount}`;
  } catch (err) {
    results.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err.message)}</small>`;
    toast(err.message, "Erreur recherche");
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

doSearch("daft punk", "artist", 10);
