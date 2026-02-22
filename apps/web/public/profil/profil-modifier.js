import { apiFetch, toast, escapeHtml, getTokens, resolveMediaUrl } from "/noyau/app.js";

const statusBadge = document.querySelector("#statusBadge");
const accessLenEl = document.querySelector("#accessLen");
const previewBox = document.querySelector("#previewBox");
const refreshBtn = document.querySelector("#refreshBtn");
const updateForm = document.querySelector("#updateForm");

let currentUser = null;
let avatarObjectUrl = null;
let coverObjectUrl = null;

function updateTokenStats() {
  const t = getTokens();
  accessLenEl.textContent = String(t.accessToken.length);
  statusBadge.textContent = t.accessToken ? "Connecte" : "Non connecte";
  return t;
}

function setField(name, value) {
  const el = updateForm.elements[name];
  if (!el) return;
  el.value = value ?? "";
}

function fillForm(u) {
  setField("display_name", u.display_name);
  setField("username", u.username);
  setField("bio", u.bio);
  setField("website", u.website);
  setField("location", u.location);
  setField("gender", u.gender);
  setField("birth_date", u.birth_date ? String(u.birth_date).slice(0, 10) : "");
}

function revokeUrl(kind) {
  if (kind === "avatar" && avatarObjectUrl) {
    URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = null;
  }
  if (kind === "cover" && coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl);
    coverObjectUrl = null;
  }
}

function renderPreview(u) {
  const avatarUrl = avatarObjectUrl || resolveMediaUrl(u.avatar_url || "");
  const coverUrl = coverObjectUrl || resolveMediaUrl(u.cover_url || "");

  const coverStyle = coverUrl
    ? `background-image:url('${escapeHtml(coverUrl)}'); background-size:cover; background-position:center;`
    : `background:linear-gradient(135deg, rgba(124,92,255,.25), rgba(0,255,209,.12));`;

  const avatar = avatarUrl
    ? `<img alt="" src="${escapeHtml(avatarUrl)}" style="width:72px;height:72px;border-radius:18px;object-fit:cover;border:1px solid rgba(255,255,255,.12)"/>`
    : `<div style="width:72px;height:72px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)"></div>`;

  previewBox.innerHTML = `
    <div style="border:1px solid rgba(255,255,255,.10);border-radius:18px;overflow:hidden">
      <div style="height:150px;${coverStyle}"></div>
      <div style="padding:14px;display:flex;gap:12px;align-items:center;margin-top:-34px">
        ${avatar}
        <div>
          <div style="font-weight:900;font-size:20px">${escapeHtml(u.display_name || "-")}</div>
          <div style="color:var(--muted)">@${escapeHtml(u.username || "username")}</div>
        </div>
      </div>
      <div style="padding:0 14px 14px 14px;color:var(--muted)">
        <div>${escapeHtml(u.bio || "Bio vide...")}</div>
      </div>
    </div>
  `;
}

function getTextPayloadFromForm() {
  const fd = new FormData(updateForm);
  fd.delete("avatar_file");
  fd.delete("cover_file");

  const payload = Object.fromEntries(fd.entries());
  if (typeof payload.display_name === "string") payload.display_name = payload.display_name.trim();
  if (typeof payload.username === "string") payload.username = payload.username.trim();
  if (typeof payload.bio === "string") payload.bio = payload.bio.trim();
  if (typeof payload.location === "string") payload.location = payload.location.trim();
  if (typeof payload.website === "string") payload.website = payload.website.trim();
  return payload;
}

async function uploadImage(kind, file) {
  if (!file) return null;
  const { accessToken } = getTokens();
  if (!accessToken) throw new Error("Session expiree. Reconnecte-toi.");

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`http://localhost:1234/upload/${encodeURIComponent(kind)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: fd,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.erreur || data?.error || "Upload image echoue";
    throw new Error(msg);
  }

  return data?.url || null;
}

async function loadMe() {
  const t = updateTokenStats();
  if (!t.accessToken) {
    previewBox.innerHTML = `<small style="color:#ffb0b0">Connexion requise. Va sur /connexion/connexion.html</small>`;
    setTimeout(() => {
      window.location.href = "/connexion/connexion.html";
    }, 1200);
    return;
  }

  try {
    const r = await apiFetch("/auth/me");
    currentUser = r.user;
    fillForm(currentUser);
    renderPreview(currentUser);
  } catch (err) {
    toast(err?.message || "Erreur /auth/me", "Erreur");
    previewBox.innerHTML = `<small style="color:#ffb0b0">${escapeHtml(err?.message || "Erreur")}</small>`;
  }
}

function hookFilePreview() {
  const avatarInput = updateForm.elements["avatar_file"];
  const coverInput = updateForm.elements["cover_file"];

  avatarInput?.addEventListener("change", () => {
    revokeUrl("avatar");
    const f = avatarInput.files?.[0];
    if (f) avatarObjectUrl = URL.createObjectURL(f);
    renderPreview(currentUser || {});
  });

  coverInput?.addEventListener("change", () => {
    revokeUrl("cover");
    const f = coverInput.files?.[0];
    if (f) coverObjectUrl = URL.createObjectURL(f);
    renderPreview(currentUser || {});
  });
}

updateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  try {
    const payload = getTextPayloadFromForm();
    const formData = new FormData(updateForm);
    const avatarFile = formData.get("avatar_file");
    const coverFile = formData.get("cover_file");

    if (avatarFile instanceof File && avatarFile.size > 0) {
      const avatarUrl = await uploadImage("avatar", avatarFile);
      if (avatarUrl) payload.avatar_url = avatarUrl;
    }
    if (coverFile instanceof File && coverFile.size > 0) {
      const coverUrl = await uploadImage("cover", coverFile);
      if (coverUrl) payload.cover_url = coverUrl;
    }

    const r = await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify(payload) });
    currentUser = r.user;

    toast("Profil enregistre.", "OK");
    fillForm(currentUser);
    revokeUrl("avatar");
    revokeUrl("cover");
    updateForm.reset();
    fillForm(currentUser);
    renderPreview(currentUser);
  } catch (err) {
    toast(err?.message || "Erreur update", "Erreur");
  }
});

refreshBtn.addEventListener("click", loadMe);

hookFilePreview();
loadMe();

