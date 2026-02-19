import { apiFetch, toast, escapeHtml, getTokens } from "/app.js";

console.log("PROFILE-EDIT JS LOADED ✅");

const statusBadge = document.querySelector("#statusBadge");
const accessLenEl = document.querySelector("#accessLen");
const previewBox = document.querySelector("#previewBox");
const refreshBtn = document.querySelector("#refreshBtn");
const updateForm = document.querySelector("#updateForm");

let currentUser = null;

// URLs temporaires pour preview local
let avatarObjectUrl = null;
let coverObjectUrl = null;

function updateTokenStats(){
  const t = getTokens();
  accessLenEl.textContent = String(t.accessToken.length);
  statusBadge.textContent = t.accessToken ? "Connecté ✅" : "Non connecté ❌";
  return t;
}

function setField(name, value){
  const el = updateForm.elements[name];
  if (!el) return;
  el.value = value ?? "";
}

function fillForm(u){
  setField("display_name", u.display_name);
  setField("username", u.username);
  setField("bio", u.bio);
  setField("website", u.website);
  setField("location", u.location);
  setField("gender", u.gender);

  // IMPORTANT: input[type=date] veut du YYYY-MM-DD
  // Si ton API renvoie "2005-02-23T00:00:00.000Z" on coupe à 10
  const bd = u.birth_date ? String(u.birth_date).slice(0, 10) : "";
  setField("birth_date", bd);
}

function cleanupObjectUrls(){
  if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
  if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
  avatarObjectUrl = null;
  coverObjectUrl = null;
}

function renderPreview(u){
  const avatarUrl = avatarObjectUrl || u.avatar_url || "";
  const coverUrl = coverObjectUrl || u.cover_url || "";

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
          <div style="font-weight:900;font-size:20px">${escapeHtml(u.display_name || "—")}</div>
          <div style="color:var(--muted)">@${escapeHtml(u.username || "username")}</div>
        </div>
      </div>
      <div style="padding:0 14px 14px 14px;color:var(--muted)">
        <div>${escapeHtml(u.bio || "Bio vide…")}</div>
        <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
          ${u.website ? `<a class="pill" href="${escapeHtml(u.website)}" target="_blank" rel="noreferrer">Site</a>` : ""}
          ${u.location ? `<span class="badge">${escapeHtml(u.location)}</span>` : ""}
          ${u.gender ? `<span class="badge">${escapeHtml(u.gender)}</span>` : ""}
          ${u.birth_date ? `<span class="badge">🎂 ${escapeHtml(String(u.birth_date).slice(0,10))}</span>` : ""}
        </div>
        <small style="display:block;margin-top:10px;color:var(--muted)">
          (Les images choisies sur ton PC sont juste en preview pour l’instant)
        </small>
      </div>
    </div>
  `;
}

function getTextPayloadFromForm(){
  const fd = new FormData(updateForm);

  // On enlève les fichiers du payload texte
  fd.delete("avatar_file");
  fd.delete("cover_file");

  const payload = Object.fromEntries(fd.entries());

  // Normalisation: trim sur certains champs
  if (typeof payload.display_name === "string") payload.display_name = payload.display_name.trim();
  if (typeof payload.username === "string") payload.username = payload.username.trim();
  if (typeof payload.bio === "string") payload.bio = payload.bio.trim();
  if (typeof payload.location === "string") payload.location = payload.location.trim();
  if (typeof payload.website === "string") payload.website = payload.website.trim();

  return payload;
}

async function loadMe(){
  const t = updateTokenStats();
  if (!t.accessToken) {
    previewBox.innerHTML = `<small style="color:#ffb0b0">Connexion requise. Va sur /auth.html</small>`;
    // redirect after brief pause
    setTimeout(() => { window.location.href = "/auth.html"; }, 1200);
    return;
  }

  try{
    const r = await apiFetch("/auth/me");
    currentUser = r.user;
    fillForm(currentUser);
    renderPreview(currentUser);
  }catch(err){
    console.error(err);
    toast(err?.message || "Erreur /auth/me", "Erreur");
    previewBox.innerHTML = `<small style="color:#ffb0b0">${escapeHtml(err?.message || "Erreur")}</small>`;
  }
}

// Preview fichiers (sans upload, étape 3)
function hookFilePreview(){
  const avatarInput = updateForm.elements["avatar_file"];
  const coverInput = updateForm.elements["cover_file"];

  avatarInput?.addEventListener("change", () => {
    cleanupObjectUrls();
    const f = avatarInput.files?.[0];
    if (f) avatarObjectUrl = URL.createObjectURL(f);
    renderPreview(currentUser || {});
  });

  coverInput?.addEventListener("change", () => {
    cleanupObjectUrls();
    const f = coverInput.files?.[0];
    if (f) coverObjectUrl = URL.createObjectURL(f);
    renderPreview(currentUser || {});
  });
}

updateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  try{
    const payload = getTextPayloadFromForm();

    // PATCH texte (OK maintenant)
    const r = await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify(payload) });
    currentUser = r.user;

    toast("Infos enregistrées ✅", "OK");
    fillForm(currentUser);
    renderPreview(currentUser);

    // On garde les previews fichiers (pas encore upload)
    toast("Images: preview OK (upload étape 3).", "Info");
  }catch(err){
    console.error(err);
    toast(err?.message || "Erreur update", "Erreur");
  }
});

refreshBtn.addEventListener("click", loadMe);

hookFilePreview();
loadMe();
