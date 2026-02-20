import { qs, toast, escapeHtml } from "/app.js";
import { renderMediaDetails } from "/media/details.js";
import { createSocialController } from "/media/social.js";

const box = document.querySelector("#box");
const socialBox = document.querySelector("#socialBox");
const commentsSheet = document.querySelector("#commentsSheet");
const openCommentsBtn = document.querySelector("#openCommentsBtn");
const closeCommentsBtn = document.querySelector("#closeCommentsBtn");
const commentsBackdrop = document.querySelector("#commentsBackdrop");

const social = createSocialController({
  socialBox,
  commentsSheet,
  commentsBackdrop,
  openCommentsBtn,
  closeCommentsBtn,
});

async function load() {
  const type = qs("type");
  const id = qs("id");
  if (!type || !id) {
    box.innerHTML = `<small>Parametres manquants. Reviens sur <a href="/search/search.html">Recherche</a>.</small>`;
    socialBox.innerHTML = "";
    return;
  }

  try {
    await renderMediaDetails(type, id, box);
    await social.loadSocial(type, id);
  } catch (err) {
    box.innerHTML = `<small style="color:#ffb0b0">Erreur: ${escapeHtml(err?.message || "Erreur")}</small>`;
    socialBox.innerHTML = "";
    toast(err?.message || "Erreur media", "Erreur media");
  }
}

load();
