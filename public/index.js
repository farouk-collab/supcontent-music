import { isLoggedIn, clearTokens, toast, getTokens } from "./app.js";

function updateHeader() {
  const loginBtn = document.querySelector('[data-auth="login"]');
  const profileBtn = document.querySelector('[data-auth="profile"]');
  const logoutBtn = document.querySelector('[data-auth="logout"]');

  const logged = isLoggedIn();
  if (loginBtn) loginBtn.style.display = logged ? "none" : "";
  if (profileBtn) profileBtn.style.display = logged ? "" : "none";
  if (logoutBtn) logoutBtn.style.display = logged ? "" : "none";

  // debug si tu veux voir
  const t = getTokens();
  console.log("TOKENS LEN", t.accessToken.length, t.refreshToken.length);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-auth]");
  if (!btn) return;

  if (btn.dataset.auth === "logout") {
    e.preventDefault();
    clearTokens();
    toast("Déconnecté ✅", "OK");
    updateHeader();
  }
});

updateHeader();
