import { qs, toast, escapeHtml } from "/noyau/app.js";
import { renderMediaDetails } from "/media/details.js";
import { createSocialController } from "/media/social.js";

const box = document.querySelector("#box");
const socialBox = document.querySelector("#socialBox");
const commentsSheet = document.querySelector("#commentsSheet");
const openCommentsBtn = document.querySelector("#openCommentsBtn");
const closeCommentsBtn = document.querySelector("#closeCommentsBtn");
const commentsBackdrop = document.querySelector("#commentsBackdrop");
const backBtn = document.querySelector("#backBtn");
const refreshInfoBtn = document.querySelector("#refreshInfoBtn");

const social = createSocialController({
  socialBox,
  commentsSheet,
  commentsBackdrop,
  openCommentsBtn,
  closeCommentsBtn,
});

function readMediaParams() {
  let type = qs("type");
  let id = qs("id");

  if (!type || !id) {
    const hash = String(window.location.hash || "");
    const hashQuery = hash.startsWith("#?") ? hash.slice(2) : hash.startsWith("#") ? hash.slice(1) : "";
    if (hashQuery) {
      const hp = new URLSearchParams(hashQuery);
      type = type || String(hp.get("type") || "");
      id = id || String(hp.get("id") || "");
    }
  }

  if (!type || !id) {
    const m = String(window.location.pathname || "").match(/\/media\/(track|album|artist)\/([A-Za-z0-9]+)$/i);
    if (m) {
      type = type || String(m[1] || "");
      id = id || String(m[2] || "");
    }
  }

  return { type: String(type || "").trim(), id: String(id || "").trim() };
}

function readExternalParams() {
  let ext = qs("ext");
  let rawUrl = qs("url");

  if (!ext || !rawUrl) {
    const hash = String(window.location.hash || "");
    const hashQuery = hash.startsWith("#?") ? hash.slice(2) : hash.startsWith("#") ? hash.slice(1) : "";
    if (hashQuery) {
      const hp = new URLSearchParams(hashQuery);
      ext = ext || String(hp.get("ext") || "");
      rawUrl = rawUrl || String(hp.get("url") || "");
    }
  }

  return {
    ext: String(ext || "").trim().toLowerCase(),
    rawUrl: String(rawUrl || "").trim(),
  };
}

function extractYouTubeIds(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = String(u.hostname || "").toLowerCase();
    const isYouTube =
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("music.youtube.com");
    if (!isYouTube) return { videoId: "", listId: "" };

    const listId = String(u.searchParams.get("list") || "").trim();
    let videoId = String(u.searchParams.get("v") || "").trim();

    if (!videoId && host.includes("youtu.be")) {
      videoId = String(u.pathname || "").replace(/^\/+/, "").split("/")[0] || "";
    }
    if (!videoId && u.pathname.startsWith("/shorts/")) {
      videoId = String(u.pathname.split("/")[2] || "").trim();
    }
    return { videoId, listId };
  } catch {
    return { videoId: "", listId: "" };
  }
}

function buildYouTubeEmbed(rawUrl) {
  const { videoId, listId } = extractYouTubeIds(rawUrl);
  if (videoId && listId) {
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?list=${encodeURIComponent(listId)}&autoplay=1`;
  }
  if (videoId) {
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
  }
  if (listId) {
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(listId)}`;
  }
  return "";
}

async function load(opts = {}) {
  const forceRefresh = Boolean(opts?.forceRefresh);
  const { ext, rawUrl } = readExternalParams();
  if (ext === "youtube" && rawUrl) {
    const globalPlayer = window.supcontentPlayer;
    if (globalPlayer?.playYouTube) {
      globalPlayer.playYouTube({ url: rawUrl, title: "YouTube", subtitle: "Lecture en cours", mode: "video" });
      box.innerHTML = `
        <div style="display:grid;gap:10px">
          <h2 style="margin:0">Lecture YouTube lancée</h2>
          <small>Le mini-player global en bas continue la lecture même si tu changes de page.</small>
        </div>
      `;
      socialBox.innerHTML = `<small>Commentaires internes non disponibles pour les liens externes.</small>`;
      openCommentsBtn?.setAttribute("disabled", "disabled");
      return;
    }

    const embed = buildYouTubeEmbed(rawUrl);
    if (!embed) {
      box.innerHTML = `<small style="color:#ffb0b0">Lien YouTube invalide ou non pris en charge.</small>`;
      socialBox.innerHTML = "";
      openCommentsBtn?.setAttribute("disabled", "disabled");
      return;
    }
    box.innerHTML = `
      <div style="display:grid;gap:12px">
        <h2 style="margin:0">Lecture YouTube intégrée</h2>
        <div style="position:relative;width:100%;padding-top:56.25%;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:#000">
          <iframe
            src="${escapeHtml(embed)}"
            title="YouTube player"
            style="position:absolute;inset:0;width:100%;height:100%;border:0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    `;
    socialBox.innerHTML = `<small>Commentaires internes non disponibles pour les liens externes.</small>`;
    openCommentsBtn?.setAttribute("disabled", "disabled");
    return;
  }

  const { type, id } = readMediaParams();
  if (!type || !id) {
    box.innerHTML = `
      <small>
        Parametres manquants. Ouvre un media depuis <a href="/recherche/recherche.html">Recherche</a>.
        <br/>URL actuelle: <code>${escapeHtml(window.location.href)}</code>
      </small>
    `;
    socialBox.innerHTML = "";
    return;
  }

  try {
    openCommentsBtn?.removeAttribute("disabled");
    await renderMediaDetails(type, id, box, { forceRefresh });
    if (!forceRefresh) {
      await social.loadSocial(type, id);
    }
  } catch (err) {
    box.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err?.message || "Erreur")}</small>`;
    socialBox.innerHTML = "";
    toast(err?.message || "Erreur media", "Erreur media");
  }
}

load();

backBtn?.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "/accueil/accueil";
});

refreshInfoBtn?.addEventListener("click", async () => {
  refreshInfoBtn.setAttribute("disabled", "disabled");
  try {
    await load({ forceRefresh: true });
    toast("Infos media rafraichies.", "OK");
  } catch {
    // handled in load
  } finally {
    refreshInfoBtn.removeAttribute("disabled");
  }
});

