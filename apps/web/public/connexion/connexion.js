import { apiFetch, setTokens, serverLogout, toast, getTokens, API_BASE } from "/noyau/app.js";

const rf = document.querySelector("#registerForm");
const lf = document.querySelector("#loginForm");
const logoutBtn = document.querySelector("#logoutBtn");
const googleLoginBtn = document.querySelector("#googleLoginBtn");
const forgotPasswordBtn = document.querySelector("#forgotPasswordBtn");

function afterAuth(r) {
  setTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });

  const t = getTokens();
  console.log("TOKENS SAVED:", {
    accessLen: t.accessToken.length,
    refreshLen: t.refreshToken.length,
  });

  toast("Connecte. Redirection...", "OK");
  setTimeout(() => (window.location.href = "/profil/profil.html"), 400);
}

function consumeOauthParams() {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("accessToken");
  const refreshToken = params.get("refreshToken");
  const provider = params.get("oauth");
  if (!accessToken || !refreshToken) return;

  setTokens({ accessToken, refreshToken });
  toast(`Connexion ${provider || "OAuth"} reussie.`, "OK");

  params.delete("accessToken");
  params.delete("refreshToken");
  params.delete("oauth");
  const next = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
  window.history.replaceState({}, "", next);
  setTimeout(() => (window.location.href = "/profil/profil.html"), 300);
}

consumeOauthParams();

async function consumeResetTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const resetToken = String(params.get("resetToken") || "").trim();
  if (!resetToken) return;

  const nextPassword = window.prompt("Nouveau mot de passe (8+ chars, maj/min/chiffre/special):", "");
  if (!nextPassword) return;
  try {
    await apiFetch("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ token: resetToken, newPassword: nextPassword }),
    });
    toast("Mot de passe reinitialise. Connecte-toi.", "OK");
    params.delete("resetToken");
    const next = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
    window.history.replaceState({}, "", next);
  } catch (err) {
    toast(err?.message || "Reinitialisation impossible", "Erreur");
  }
}

consumeResetTokenFromUrl();

rf?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(rf).entries());

  try {
    const r = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(payload) });
    afterAuth(r);
  } catch (err) {
    console.error(err);
    toast(err.message || "Erreur register", "Erreur");
  }
});

lf?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(lf).entries());

  try {
    const r = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(payload) });
    afterAuth(r);
  } catch (err) {
    console.error(err);
    toast(err.message || "Erreur login", "Erreur");
  }
});

logoutBtn?.addEventListener("click", async () => {
  await serverLogout();
  toast("Deconnecte.", "OK");
});

googleLoginBtn?.addEventListener("click", () => {
  const returnTo = window.location.origin;
  window.location.href = `${API_BASE}/auth/oauth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
});

forgotPasswordBtn?.addEventListener("click", async () => {
  const email = window.prompt("Entre ton email pour recevoir un lien de reinitialisation:", "");
  if (!email) return;
  try {
    const r = await apiFetch("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (r?.resetUrl) {
      toast("Lien de reset genere (dev). Ouverture...", "OK");
      window.location.href = r.resetUrl;
      return;
    }
    toast("Si l'email existe, un lien de reset a ete genere.", "OK");
  } catch (err) {
    toast(err?.message || "Impossible de lancer la reinitialisation", "Erreur");
  }
});

