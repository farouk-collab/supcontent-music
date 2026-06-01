import { apiFetch, setTokens, serverLogout, toast, getTokens, API_BASE } from "/noyau/app.js";

const INITIAL_AUTH_STATE = {
  isConnected: false,
  accessToken: "",
  refreshToken: "",
  diagnostic: "Aucune session active",
};

const state = {
  mode: "login",
  showPassword: false,
  email: "",
  password: "",
  name: "",
  forgotEmail: "",
  feedback: "Connexion prete",
  authState: { ...INITIAL_AUTH_STATE },
};

const dom = {
  tabs: Array.from(document.querySelectorAll("[data-mode]")),
  form: document.querySelector("#authForm"),
  registerNameRow: document.querySelector("#authRegisterNameRow"),
  nameInput: document.querySelector("#authNameInput"),
  emailInput: document.querySelector("#authEmailInput"),
  passwordRow: document.querySelector("#authPasswordRow"),
  passwordInput: document.querySelector("#authPasswordInput"),
  passwordToggle: document.querySelector("#authPasswordToggle"),
  helperText: document.querySelector("#authHelperText"),
  submitButton: document.querySelector("#authSubmitButton"),
  googleButton: document.querySelector("#authGoogleButton"),
  googleWrapper: document.querySelector("#authGoogleWrapper"),
};

function getInitialModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = String(params.get("mode") || "").trim().toLowerCase();
  if (mode === "register" || mode === "forgot") return mode;
  return "login";
}

function syncLocalInputs() {
  state.name = dom.nameInput?.value || "";
  state.email = dom.emailInput?.value || "";
  state.password = dom.passwordInput?.value || "";
  state.forgotEmail = dom.emailInput?.value || "";
}

function updateAuthStateFromTokens() {
  const tokens = getTokens();
  const isConnected = Boolean(tokens.accessToken);
  state.authState = {
    isConnected,
    accessToken: tokens.accessToken || "",
    refreshToken: tokens.refreshToken || "",
    diagnostic: isConnected ? "Session active detectee dans le navigateur" : "Aucune session active",
  };
}

function renderForm() {
  const isLogin = state.mode === "login";
  const isRegister = state.mode === "register";
  const isForgot = state.mode === "forgot";

  dom.tabs.forEach((button) =>
    button.classList.toggle("is-active", button.getAttribute("data-mode") === state.mode)
  );

  if (dom.registerNameRow) dom.registerNameRow.hidden = !isRegister;
  if (dom.passwordRow) dom.passwordRow.hidden = isForgot;
  if (dom.googleWrapper) dom.googleWrapper.hidden = !isLogin;

  if (dom.emailInput) {
    dom.emailInput.placeholder = isForgot ? "Email de recuperation" : "Adresse email";
  }

  if (dom.passwordInput) {
    dom.passwordInput.type = state.showPassword ? "text" : "password";
    dom.passwordInput.placeholder = isRegister ? "Creer un mot de passe" : "Mot de passe";
    dom.passwordInput.autocomplete = isRegister ? "new-password" : "current-password";
  }

  if (dom.passwordToggle) {
    dom.passwordToggle.innerHTML = state.showPassword ? "&#128584;" : "&#128065;";
  }

  if (dom.helperText) {
    if (isLogin) dom.helperText.textContent = "Connexion classique avec email et mot de passe.";
    if (isRegister) dom.helperText.textContent = "Nom, email et mot de passe requis pour creer ton compte.";
    if (isForgot) dom.helperText.textContent = "Entre ton email pour recevoir un lien de reinitialisation.";
  }

  if (dom.submitButton) {
    if (isLogin) dom.submitButton.innerHTML = "Se connecter &rarr;";
    if (isRegister) dom.submitButton.innerHTML = "Creer un compte &rarr;";
    if (isForgot) dom.submitButton.innerHTML = "Envoyer le lien &rarr;";
  }
}

function redirectAfterAuth() {
  const params = new URLSearchParams(window.location.search);
  const next = String(params.get("next") || "").trim();
  const target = next || "/profil/profil.html";
  window.setTimeout(() => {
    window.location.href = target;
  }, 350);
}

function afterAuth(payload, diagnostic) {
  setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
  state.authState = {
    isConnected: true,
    accessToken: payload.accessToken || "",
    refreshToken: payload.refreshToken || "",
    diagnostic,
  };
  toast("Connecte. Redirection...", "OK");
  redirectAfterAuth();
}

function consumeOauthParams() {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("accessToken");
  const refreshToken = params.get("refreshToken");
  const provider = params.get("oauth");
  if (!accessToken || !refreshToken) return;

  setTokens({ accessToken, refreshToken });
  state.authState = {
    isConnected: true,
    accessToken,
    refreshToken,
    diagnostic: `Connexion ${provider || "OAuth"} reussie`,
  };

  params.delete("accessToken");
  params.delete("refreshToken");
  params.delete("oauth");
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState({}, "", next);

  toast(`Connexion ${provider || "OAuth"} reussie.`, "OK");
  redirectAfterAuth();
}

async function consumeResetTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const resetToken = String(params.get("resetToken") || "").trim();
  if (!resetToken) return;

  state.mode = "forgot";
  renderForm();
  const nextPassword = window.prompt("Nouveau mot de passe (8+ caracteres, maj/min/chiffre/special):", "");
  if (!nextPassword) return;

  try {
    await apiFetch("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ token: resetToken, newPassword: nextPassword }),
    });
    toast("Mot de passe reinitialise. Connecte-toi.", "OK");
    params.delete("resetToken");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  } catch (err) {
    toast(err?.message || "Reinitialisation impossible", "Erreur");
  }
}

async function handleLogin() {
  if (!state.email.trim() || !state.password.trim()) {
    toast("Email et mot de passe requis", "Erreur");
    return;
  }
  try {
    const response = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: state.email.trim(), password: state.password }),
    });
    afterAuth(response, "Session creee via /auth/login");
  } catch (err) {
    const message = String(err?.message || "");
    if (message.toLowerCase().includes("identifiants invalides") || message.includes("401")) {
      toast("Email ou mot de passe incorrect.", "Erreur");
      return;
    }
    toast(message || "Erreur login", "Erreur");
  }
}

async function handleRegister() {
  if (!state.name.trim() || !state.email.trim() || !state.password.trim()) {
    toast("Nom, email et mot de passe requis", "Erreur");
    return;
  }
  try {
    const response = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: state.email.trim(), displayName: state.name.trim(), password: state.password }),
    });
    afterAuth(response, "Compte cree via /auth/register");
  } catch (err) {
    toast(err?.message || "Erreur register", "Erreur");
  }
}

async function handleForgotPassword() {
  if (!state.forgotEmail.trim()) {
    toast("Email requis pour la reinitialisation", "Erreur");
    return;
  }
  try {
    const response = await apiFetch("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email: state.forgotEmail.trim() }),
    });
    if (response?.resetUrl) {
      toast("Lien de reinitialisation genere en mode dev. Ouverture...", "OK");
      window.location.href = response.resetUrl;
      return;
    }
    toast("Si l'email existe, un lien de reset a ete envoye.", "OK");
  } catch (err) {
    toast(err?.message || "Impossible de lancer la reinitialisation", "Erreur");
  }
}

function handleGoogleLogin() {
  const returnTo = window.location.origin + window.location.pathname;
  window.location.href = `${API_BASE}/auth/oauth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
}

function bindEvents() {
  dom.tabs.forEach((button) =>
    button.addEventListener("click", () => {
      state.mode = button.getAttribute("data-mode") || "login";
      renderForm();
    })
  );

  dom.nameInput?.addEventListener("input", syncLocalInputs);
  dom.emailInput?.addEventListener("input", syncLocalInputs);
  dom.passwordInput?.addEventListener("input", syncLocalInputs);

  dom.passwordToggle?.addEventListener("click", () => {
    state.showPassword = !state.showPassword;
    renderForm();
  });

  dom.form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    syncLocalInputs();
    if (state.mode === "login") await handleLogin();
    if (state.mode === "register") await handleRegister();
    if (state.mode === "forgot") await handleForgotPassword();
  });

  dom.googleButton?.addEventListener("click", handleGoogleLogin);
}

async function init() {
  state.mode = getInitialModeFromUrl();
  updateAuthStateFromTokens();
  bindEvents();
  renderForm();
  consumeOauthParams();
  await consumeResetTokenFromUrl();
}

init().catch((err) => {
  toast(err?.message || "Erreur chargement connexion", "Erreur");
});