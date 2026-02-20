import { apiFetch, escapeHtml } from "/app.js";

function pickImage(item) {
  const candidates = [
    ...(Array.isArray(item?.images) ? item.images : []),
    ...(Array.isArray(item?.album?.images) ? item.album.images : []),
  ];
  if (!candidates.length) return "";
  return candidates[0]?.url || candidates[0] || "";
}

function row(label, value) {
  return `<div class="row" style="margin-top:8px"><span class="badge">${escapeHtml(label)}</span><div style="color:var(--muted)">${value}</div></div>`;
}

function compactNumber(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function formatDuration(ms) {
  const total = Math.floor(Number(ms || 0) / 1000);
  if (!Number.isFinite(total) || total <= 0) return "";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mediaDescription(type, data) {
  if (type === "track") {
    const artists = Array.isArray(data?.artists) ? data.artists.map((a) => a.name).filter(Boolean).join(", ") : "";
    const album = data?.album?.name ? `sur l'album ${data.album.name}` : "";
    return `Titre de ${artists || "artiste inconnu"} ${album}`.trim();
  }
  if (type === "album") {
    const artists = Array.isArray(data?.artists) ? data.artists.map((a) => a.name).filter(Boolean).join(", ") : "";
    return `Album de ${artists || "artiste inconnu"}`.trim();
  }
  if (type === "artist") {
    return "Artiste Spotify avec statistiques de popularite et genres";
  }
  return "";
}

export async function renderMediaDetails(type, id, box) {
  const data = await apiFetch(`/media/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
  const img = pickImage(data);
  const name = data.name || "";
  const subtitle = data.artists ? data.artists.map((a) => a.name).join(", ") : data.genres ? data.genres.join(", ") : "";
  const desc = mediaDescription(type, data);

  const infoRows = [];
  if (desc) infoRows.push(row("Description", escapeHtml(desc)));

  const popularity = typeof data.popularity === "number" ? data.popularity : null;
  if (popularity != null) infoRows.push(row("Ecoutes / Popularite", `${escapeHtml(String(popularity))}/100`));

  const genres = Array.isArray(data.genres) ? data.genres.filter(Boolean).join(", ") : "";
  if (genres) infoRows.push(row("Genre", escapeHtml(genres)));

  let audienceTotal = null;
  if (type === "artist" && typeof data?.followers?.total === "number") {
    audienceTotal = Number(data.followers.total);
  } else if (type === "track" || type === "album") {
    const artistId = String(data?.artists?.[0]?.id || data?.album?.artists?.[0]?.id || "").trim();
    if (artistId) {
      try {
        const artistMain = await apiFetch(`/media/artist/${encodeURIComponent(artistId)}`);
        if (typeof artistMain?.followers?.total === "number") {
          audienceTotal = Number(artistMain.followers.total);
        }
      } catch {
        audienceTotal = null;
      }
    }
  }
  infoRows.push(row("Audience", audienceTotal != null ? escapeHtml(compactNumber(audienceTotal)) : "Indisponible"));

  if (type === "track") {
    if (data?.album?.name) infoRows.push(row("Album", escapeHtml(data.album.name)));
    if (data?.album?.release_date) infoRows.push(row("Sortie", escapeHtml(data.album.release_date)));
    const d = formatDuration(data?.duration_ms);
    if (d) infoRows.push(row("Duree", escapeHtml(d)));
    if (typeof data?.explicit === "boolean") infoRows.push(row("Explicit", data.explicit ? "Oui" : "Non"));
  } else if (type === "album") {
    if (data?.release_date) infoRows.push(row("Sortie", escapeHtml(data.release_date)));
    if (typeof data?.total_tracks === "number") infoRows.push(row("Pistes", escapeHtml(String(data.total_tracks))));
    if (data?.label) infoRows.push(row("Label", escapeHtml(data.label)));
  }

  box.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div>
        <h2 style="margin:0">${escapeHtml(name)}</h2>
        <div style="color:var(--muted);margin-top:6px">${escapeHtml(subtitle)}</div>
        <div style="margin-top:10px" class="row">
          <span class="badge">${escapeHtml(type)}</span>
          <span class="badge">id: <code>${escapeHtml(id)}</code></span>
        </div>
      </div>
      <div style="width:180px;max-width:42vw">
        <div class="item" style="min-height:auto">
          <div class="cover" style="height:180px">
            ${img ? `<img src="${escapeHtml(img)}" alt="">` : `<div class="badge">no image</div>`}
          </div>
        </div>
      </div>
    </div>
    <hr/>
    ${infoRows.join("")}
    ${
      data.external_urls?.spotify
        ? row(
            "Spotify",
            `<a class="pill" target="_blank" rel="noreferrer" href="${escapeHtml(data.external_urls.spotify)}">Ouvrir sur Spotify</a>`
          )
        : ""
    }
  `;
}
