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

async function load(opts = {}) {
  const forceRefresh = Boolean(opts?.forceRefresh);
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

