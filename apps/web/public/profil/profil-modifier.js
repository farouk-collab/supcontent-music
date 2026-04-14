import { API_BASE, apiFetch, escapeHtml, getTokens, requireLogin, resolveMediaUrl, toast } from "/noyau/app.js";

const ACCEPTED_FILE_TEXT = "PNG/JPG/WebP (max 3MB)";
const MAX_UPLOAD_SIZE = 3 * 1024 * 1024;
const INITIAL_FEEDBACK =
  "Ici on preview les fichiers choisis puis on les enregistre au clic sur Enregistrer.";

const state = {
  currentUser: null,
  saveCount: 0,
  avatarObjectUrl: "",
  coverObjectUrl: "",
};

const els = {
  form: document.querySelector("#updateForm"),
  displayName: document.querySelector("#displayNameInput"),
  username: document.querySelector("#usernameInput"),
  bio: document.querySelector("#bioInput"),
  website: document.querySelector("#websiteInput"),
  location: document.querySelector("#locationInput"),
  birthDate: document.querySelector("#birthDateInput"),
  gender: document.querySelector("#genderInput"),
  avatarFile: document.querySelector("#avatarFileInput"),
  coverFile: document.querySelector("#coverFileInput"),
  refreshBtn: document.querySelector("#refreshBtn"),
  statusBadge: document.querySelector("#statusBadge"),
  accessLen: document.querySelector("#accessLen"),
  saveCount: document.querySelector("#saveCount"),
  avatarPreviewMedia: document.querySelector("#avatarPreviewMedia"),
  avatarPreviewSubtitle: document.querySelector("#avatarPreviewSubtitle"),
  avatarPreviewName: document.querySelector("#avatarPreviewName"),
  coverPreviewMedia: document.querySelector("#coverPreviewMedia"),
  coverPreviewSubtitle: document.querySelector("#coverPreviewSubtitle"),
  coverPreviewName: document.querySelector("#coverPreviewName"),
  miniDisplayName: document.querySelector("#miniDisplayName"),
  miniUsername: document.querySelector("#miniUsername"),
  miniBio: document.querySelector("#miniBio"),
  validationBox: document.querySelector("#validationBox"),
  feedbackBox: document.querySelector("#feedbackBox"),
};

function setFeedback(text) {
  if (els.feedbackBox) els.feedbackBox.textContent = text || INITIAL_FEEDBACK;
}

function setSaveCount(value) {
  state.saveCount = Number(value || 0);
  if (els.saveCount) els.saveCount.textContent = String(state.saveCount);
}

function updateTokenStats() {
  const { accessToken } = getTokens();
  if (els.accessLen) els.accessLen.textContent = String(accessToken.length || 0);
  if (!els.statusBadge) return;
  const connected = accessToken.length > 0;
  els.statusBadge.textContent = connected ? "⚑ Connecte" : "⚑ Invite";
  els.statusBadge.classList.toggle("is-ok", connected);
}

function normalizeGender(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "homme" || raw === "male" || raw === "m") return "male";
  if (raw === "femme" || raw === "female" || raw === "f") return "female";
  if (raw === "autre" || raw === "other") return "other";
  if (raw === "prefere ne pas dire" || raw === "prefer_not_to_say") return "prefer_not_to_say";
  return "";
}

function formatGender(value) {
  const normalized = normalizeGender(value);
  if (normalized === "male") return "Homme";
  if (normalized === "female") return "Femme";
  if (normalized === "other") return "Autre";
  if (normalized === "prefer_not_to_say") return "Prefere ne pas dire";
  return "-";
}

function readFormState() {
  return {
    displayName: String(els.displayName?.value || "").trim(),
    username: String(els.username?.value || "").trim(),
    bio: String(els.bio?.value || "").trim(),
    website: String(els.website?.value || "").trim(),
    location: String(els.location?.value || "").trim(),
    birthDate: String(els.birthDate?.value || "").trim(),
    gender: String(els.gender?.value || "").trim(),
    profileFile: els.avatarFile?.files?.[0] || null,
    coverFile: els.coverFile?.files?.[0] || null,
  };
}

function runEditProfileTests(formState) {
  const usernameOk = /^[a-zA-Z0-9_]{3,30}$/.test(formState.username);
  const birthDateOk = !formState.birthDate || /^\d{4}-\d{2}-\d{2}$/.test(formState.birthDate);
  const cases = [
    { name: "username valide", passed: usernameOk },
    { name: "date au format YYYY-MM-DD", passed: birthDateOk },
    { name: "nom affiche rempli", passed: formState.displayName.length > 0 },
  ];
  return cases;
}

function renderValidation() {
  const tests = runEditProfileTests(readFormState());
  const allTestsPassed = tests.every((test) => test.passed);
  if (!els.validationBox) return;
  els.validationBox.classList.toggle("is-ok", allTestsPassed);
  els.validationBox.classList.toggle("is-bad", !allTestsPassed);
  if (allTestsPassed) {
    els.validationBox.textContent = "✓ Tests page profil-modifier passes";
    return;
  }
  const failed = tests.filter((test) => !test.passed).map((test) => test.name).join(" · ");
  els.validationBox.textContent = `Un test page profil-modifier a echoue: ${failed}`;
}

function renderMiniProfile() {
  const formState = readFormState();
  if (els.miniDisplayName) els.miniDisplayName.textContent = formState.displayName || "-";
  if (els.miniUsername) els.miniUsername.textContent = `@${formState.username || "username"}`;
  if (els.miniBio) els.miniBio.textContent = formState.bio || "Bio vide...";
}

function previewMarkup(src, fallbackText, accent) {
  if (src) {
    return `<img alt="" src="${escapeHtml(src)}" />`;
  }
  return `<div style="width:100%;height:100%;display:grid;place-items:center;background:${accent};color:#e4e4e7;font-size:14px;font-weight:700;">${escapeHtml(
    fallbackText
  )}</div>`;
}

function getAvatarPreviewSource() {
  if (state.avatarObjectUrl) return state.avatarObjectUrl;
  return resolveMediaUrl(state.currentUser?.avatar_url || "");
}

function getCoverPreviewSource() {
  if (state.coverObjectUrl) return state.coverObjectUrl;
  return resolveMediaUrl(state.currentUser?.cover_url || "");
}

function renderFilePreview(kind) {
  const formState = readFormState();
  const isAvatar = kind === "avatar";
  const src = isAvatar ? getAvatarPreviewSource() : getCoverPreviewSource();
  const previewMedia = isAvatar ? els.avatarPreviewMedia : els.coverPreviewMedia;
  const previewSubtitle = isAvatar ? els.avatarPreviewSubtitle : els.coverPreviewSubtitle;
  const previewName = isAvatar ? els.avatarPreviewName : els.coverPreviewName;
  const file = isAvatar ? formState.profileFile : formState.coverFile;
  const defaultSubtitle = isAvatar
    ? `${formState.displayName || "-"} · @${formState.username || "username"}`
    : formState.bio || "Aucune description pour la couverture";
  const fallbackText = isAvatar ? "Avatar" : "Couverture";
  const accent = isAvatar
    ? "linear-gradient(135deg, rgba(16,185,129,.26), rgba(24,24,27,.92), rgba(59,130,246,.24))"
    : "linear-gradient(135deg, rgba(236,72,153,.26), rgba(24,24,27,.92), rgba(16,185,129,.24))";

  if (previewMedia) {
    previewMedia.innerHTML = previewMarkup(src, fallbackText, accent);
  }
  if (previewSubtitle) {
    previewSubtitle.textContent = file ? `Previsualisation prete pour ${file.name}` : defaultSubtitle;
  }
  if (previewName) {
    previewName.textContent = file?.name || "Aucun fichier choisi";
  }
}

function renderAllPreview() {
  renderMiniProfile();
  renderValidation();
  renderFilePreview("avatar");
  renderFilePreview("cover");
}

function revokeObjectUrl(kind) {
  const key = kind === "avatar" ? "avatarObjectUrl" : "coverObjectUrl";
  if (state[key]) {
    URL.revokeObjectURL(state[key]);
    state[key] = "";
  }
}

function fillFormFromUser(user) {
  if (!user) return;
  els.displayName.value = String(user.display_name || user.name || "");
  els.username.value = String(user.username || "");
  els.bio.value = String(user.bio || "");
  els.website.value = String(user.website || "");
  els.location.value = String(user.location || "");
  els.birthDate.value = String(user.birth_date || "").slice(0, 10);
  els.gender.value = normalizeGender(user.gender);
}

async function uploadImage(kind, file) {
  if (!file) return "";
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error(`Fichier trop lourd (${ACCEPTED_FILE_TEXT})`);
  }
  const { accessToken } = getTokens();
  if (!accessToken) {
    throw new Error("Connexion requise avant upload");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/upload/${kind}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.erreur || `Upload ${kind} impossible`);
  }

  return String(data?.url || "");
}

async function loadCurrentUser() {
  updateTokenStats();
  if (!requireLogin({ message: "Connecte-toi pour modifier ton profil." })) {
    setFeedback("Connexion requise pour charger le formulaire");
    return;
  }

  try {
    setFeedback("Chargement du profil...");
    const data = await apiFetch("/auth/me");
    state.currentUser = data?.user || null;
    fillFormFromUser(state.currentUser);
    renderAllPreview();
    setFeedback("Profil charge. Tu peux modifier puis enregistrer.");
  } catch (error) {
    setFeedback(error?.message || "Impossible de charger le profil");
    toast(error?.message || "Impossible de charger le profil", "Erreur");
  }
}

async function handleSave(event) {
  event.preventDefault();
  updateTokenStats();

  const formState = readFormState();
  const tests = runEditProfileTests(formState);
  const failed = tests.find((test) => !test.passed);
  if (failed) {
    setFeedback(`Validation incomplete: ${failed.name}`);
    renderValidation();
    return;
  }

  try {
    setFeedback("Enregistrement en cours...");

    let avatarUrl = state.currentUser?.avatar_url || "";
    let coverUrl = state.currentUser?.cover_url || "";

    if (formState.profileFile) avatarUrl = await uploadImage("avatar", formState.profileFile);
    if (formState.coverFile) coverUrl = await uploadImage("cover", formState.coverFile);

    const payload = {
      display_name: formState.displayName,
      username: formState.username,
      bio: formState.bio,
      website: formState.website,
      location: formState.location,
      birth_date: formState.birthDate || null,
      gender: formState.gender || null,
      avatar_url: avatarUrl || null,
      cover_url: coverUrl || null,
    };

    const data = await apiFetch("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    state.currentUser = data?.user || {
      ...(state.currentUser || {}),
      ...payload,
    };

    setSaveCount(state.saveCount + 1);
    revokeObjectUrl("avatar");
    revokeObjectUrl("cover");
    if (els.avatarFile) els.avatarFile.value = "";
    if (els.coverFile) els.coverFile.value = "";
    fillFormFromUser(state.currentUser);
    renderAllPreview();
    setFeedback("Profil enregistre avec succes.");
    toast("Profil mis a jour", "Succes");
  } catch (error) {
    setFeedback(error?.message || "Erreur pendant la sauvegarde");
    toast(error?.message || "Erreur pendant la sauvegarde", "Erreur");
  }
}

function handleFileChange(kind, event) {
  const file = event.target.files?.[0] || null;
  revokeObjectUrl(kind);
  if (file) {
    const objectUrl = URL.createObjectURL(file);
    if (kind === "avatar") state.avatarObjectUrl = objectUrl;
    else state.coverObjectUrl = objectUrl;
    setFeedback(`Previsualisation prete pour ${file.name}`);
  } else {
    setFeedback("Aucun fichier selectionne");
  }
  renderAllPreview();
}

function bindLiveUpdates() {
  const inputs = [
    els.displayName,
    els.username,
    els.bio,
    els.website,
    els.location,
    els.birthDate,
    els.gender,
  ];

  inputs.forEach((input) => {
    input?.addEventListener("input", () => {
      if (input === els.username) {
        els.username.value = els.username.value.replace(/\s+/g, "");
      }
      renderAllPreview();
    });
    input?.addEventListener("change", renderAllPreview);
  });

  els.avatarFile?.addEventListener("change", (event) => handleFileChange("avatar", event));
  els.coverFile?.addEventListener("change", (event) => handleFileChange("cover", event));
  els.refreshBtn?.addEventListener("click", loadCurrentUser);
  els.form?.addEventListener("submit", handleSave);
}

function init() {
  setSaveCount(0);
  updateTokenStats();
  setFeedback(INITIAL_FEEDBACK);
  bindLiveUpdates();
  renderAllPreview();
  loadCurrentUser();
}

window.addEventListener("beforeunload", () => {
  revokeObjectUrl("avatar");
  revokeObjectUrl("cover");
});

init();
