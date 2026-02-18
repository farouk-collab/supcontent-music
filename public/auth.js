import { apiFetch, setTokens, clearTokens, toast, getTokens } from "/app.js";

const rf = document.querySelector("#registerForm");
const lf = document.querySelector("#loginForm");
const logoutBtn = document.querySelector("#logoutBtn");

function afterAuth(r) {
  setTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });

  // ✅ preuve visible
  const t = getTokens();
  console.log("TOKENS SAVED:", {
    accessLen: t.accessToken.length,
    refreshLen: t.refreshToken.length,
  });

  toast("Connecté ✅ Redirection…", "OK");
  setTimeout(() => (window.location.href = "/profile.html"), 400);
}

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

logoutBtn?.addEventListener("click", () => {
  clearTokens();
  toast("Déconnecté (tokens supprimés).", "OK");
});
