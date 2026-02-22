import { apiFetch, setTokens, serverLogout, toast, getTokens } from "/noyau/app.js";

const API = "http://localhost:1234";

const rf = document.querySelector("#registerForm");
const lf = document.querySelector("#loginForm");
const logoutBtn = document.querySelector("#logoutBtn");
const githubLoginBtn = document.querySelector("#githubLoginBtn");

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
  if (!accessToken || !refreshToken) return;

  setTokens({ accessToken, refreshToken });
  toast("Connexion GitHub reussie.", "OK");

  params.delete("accessToken");
  params.delete("refreshToken");
  params.delete("oauth");
  const next = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
  window.history.replaceState({}, "", next);
  setTimeout(() => (window.location.href = "/profil/profil.html"), 300);
}

consumeOauthParams();

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

githubLoginBtn?.addEventListener("click", () => {
  const returnTo = window.location.origin;
  window.location.href = `${API}/auth/oauth/github/start?returnTo=${encodeURIComponent(returnTo)}`;
});

