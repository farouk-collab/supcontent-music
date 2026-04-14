import { apiFetch, setTokens, serverLogout, toast, getTokens, API_BASE } from "/noyau/app.js";

const INITIAL_AUTH_STATE = {
  isConnected: false,
  accessToken: "",
  refreshToken: "",
  diagnostic: "Aucune session active",
};

const FEATURE_CARDS = [
  { id: "f1", title: "Connexion email", text: "Connexion classique avec email et mot de passe.", icon: "@" },
  { id: "f2", title: "OAuth Google", text: "Connexion rapide avec ton compte Google.", icon: "G" },
  { id: "f3", title: "Reset password", text: "Mot de passe oublie avec lien de reinitialisation.", icon: "K" },
];

const state = {
  mode: "login",
  showPassword: false,
  email: "farouk@email.com",
  password: "password123",
  name: "Farouk Salami",
  forgotEmail: "farouk@email.com",
  feedback: "Connexion prete",
  authState: { ...INITIAL_AUTH_STATE },
};

const dom = {
  features: document.querySelector("#authFeatures"),
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
  diagnosticButton: document.querySelector("#authDiagnosticButton"),
  logoutButton: document.querySelector("#authLogoutButton"),
  statusHead: document.querySelector("#authStatusHead"),
  diagnosticText: document.querySelector("#authDiagnosticText"),
  accessToken: document.querySelector("#authAccessToken"),
  refreshToken: document.querySelector("#authRefreshToken"),
  feedbackText: document.querySelector("#authFeedbackText"),
  testsBox: document.querySelector("#authTestsBox"),
};

function runLoginTests() {
  const cases = [
    { check: () => FEATURE_CARDS.length === 3 },
    { check: () => INITIAL_AUTH_STATE.isConnected === false },
    { check: () => FEATURE_CARDS.some((item) => item.title.includes("Google")) },
    { check: () => FEATURE_CARDS[1].icon === "G" },
  ];
  return cases.map((test) => ({ passed: test.check() }));
}

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

function setFeedback(message) {
  state.feedback = String(message || "");
  renderSide();
}

function renderFeatures() {
  if (!dom.features) return;
  dom.features.innerHTML = FEATURE_CARDS.map((item) => `
    <article class="auth-feature">
      <div class="auth-feature-icon">${item.icon}</div>
      <h3>${item.title}</h3>
      <p>${item.text}</p>
    </article>
  `).join("");
}

function renderForm() {
  const isLogin = state.mode === "login";
  const isRegister = state.mode === "register";
  const isForgot = state.mode === "forgot";

  dom.tabs.forEach((button) => button.classList.toggle("is-active", button.getAttribute("data-mode") === state.mode));

  if (dom.registerNameRow) dom.registerNameRow.hidden = !isRegister;
  if (dom.passwordRow) dom.passwordRow.hidden = isForgot;
  if (dom.googleButton) dom.googleButton.hidden = !isLogin;

  if (dom.nameInput) dom.nameInput.value = state.name;
  if (dom.emailInput) {
    dom.emailInput.value = isForgot ? state.forgotEmail : state.email;
    dom.emailInput.placeholder = isForgot ? "Email de recuperation" : "Adresse email";
  }
  if (dom.passwordInput) {
    dom.passwordInput.value = state.password;
    dom.passwordInput.type = state.showPassword ? "text" : "password";
    dom.passwordInput.placeholder = isRegister ? "Creer un mot de passe" : "Mot de passe";
    dom.passwordInput.autocomplete = isRegister ? "new-password" : "current-password";
  }
  if (dom.passwordToggle) dom.passwordToggle.textContent = state.showPassword ? "🙈" : "👁";

  if (dom.helperText) {
    if (isLogin) dom.helperText.textContent = "Connexion classique avec email et mot de passe.";
    if (isRegister) dom.helperText.textContent = "Nom, email et mot de passe requis pour creer ton compte.";
    if (isForgot) dom.helperText.textContent = "Entre ton email pour recevoir un lien de reinitialisation.";
  }

  if (dom.submitButton) {
    if (isLogin) dom.submitButton.textContent = "Se connecter →";
    if (isRegister) dom.submitButton.textContent = "Creer un compte →";
    if (isForgot) dom.submitButton.textContent = "Envoyer le lien →";
  }
}

function renderSide() {
  if (dom.statusHead) {
    dom.statusHead.className = `auth-status-head ${state.authState.isConnected ? "is-ok" : "is-warn"}`;
    dom.statusHead.innerHTML = `<span>${state.authState.isConnected ? "✓" : "⚠"}</span><span>${state.authState.isConnected ? "Connecte" : "Non connecte"}</span>`;
  }
  if (dom.diagnosticText) dom.diagnosticText.textContent = state.authState.diagnostic;
  if (dom.accessToken) dom.accessToken.textContent = state.authState.accessToken || "Aucun";
  if (dom.refreshToken) dom.refreshToken.textContent = state.authState.refreshToken || "Aucun";
  if (dom.feedbackText) dom.feedbackText.textContent = state.feedback;

  const allTestsPassed = runLoginTests().every((test) => test.passed);
  if (dom.testsBox) {
    dom.testsBox.className = `auth-test ${allTestsPassed ? "is-ok" : "is-bad"}`;
    dom.testsBox.textContent = allTestsPassed ? "Tests connexion passes" : "Un test connexion a echoue";
  }
}

function renderAll() {
  renderFeatures();
  renderForm();
  renderSide();
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
  renderSide();
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
  state.feedback = "Connexion OAuth reussie";

  params.delete("accessToken");
  params.delete("refreshToken");
  params.delete("oauth");
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState({}, "", next);
  renderAll();
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
    setFeedback("Mot de passe reinitialise. Connecte-toi.");
    toast("Mot de passe reinitialise. Connecte-toi.", "OK");
    params.delete("resetToken");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  } catch (err) {
    setFeedback(err?.message || "Reinitialisation impossible");
    toast(err?.message || "Reinitialisation impossible", "Erreur");
  }
}

async function handleLogin() {
  if (!state.email.trim() || !state.password.trim()) {
    setFeedback("Email et mot de passe requis");
    return;
  }

  try {
    const response = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: state.email.trim(), password: state.password }),
    });
    setFeedback("Connexion reussie");
    afterAuth(response, "Session creee via /auth/login");
  } catch (err) {
    const message = String(err?.message || "");
    if (message.toLowerCase().includes("identifiants invalides") || message.includes("401")) {
      setFeedback("Email ou mot de passe incorrect");
      toast("Email ou mot de passe incorrect. Cree un compte ou reconnecte-toi avec les bons identifiants.", "Erreur");
      return;
    }
    setFeedback(message || "Erreur login");
    toast(message || "Erreur login", "Erreur");
  }
}

async function handleRegister() {
  if (!state.name.trim() || !state.email.trim() || !state.password.trim()) {
    setFeedback("Nom, email et mot de passe requis");
    return;
  }

  try {
    const response = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: state.email.trim(), displayName: state.name.trim(), password: state.password }),
    });
    setFeedback("Inscription reussie");
    afterAuth(response, "Compte cree via /auth/register");
  } catch (err) {
    setFeedback(err?.message || "Erreur register");
    toast(err?.message || "Erreur register", "Erreur");
  }
}

async function handleForgotPassword() {
  if (!state.forgotEmail.trim()) {
    setFeedback("Email requis pour la reinitialisation");
    return;
  }

  try {
    const response = await apiFetch("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email: state.forgotEmail.trim() }),
    });
    if (response?.resetUrl) {
      setFeedback("Lien de reinitialisation genere en mode dev");
      toast("Lien de reset genere (dev). Ouverture...", "OK");
      window.location.href = response.resetUrl;
      return;
    }
    setFeedback("Lien de reinitialisation envoye");
    toast("Si l'email existe, un lien de reset a ete genere.", "OK");
  } catch (err) {
    setFeedback(err?.message || "Impossible de lancer la reinitialisation");
    toast(err?.message || "Impossible de lancer la reinitialisation", "Erreur");
  }
}

function handleGoogleLogin() {
  const returnTo = window.location.origin + window.location.pathname;
  window.location.href = `${API_BASE}/auth/oauth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
}

function refreshDiagnostic() {
  updateAuthStateFromTokens();
  setFeedback(state.authState.isConnected ? "Diagnostic session OK" : "Aucune session a diagnostiquer");
}

async function handleLogout() {
  await serverLogout();
  updateAuthStateFromTokens();
  setFeedback("Deconnecte");
  renderAll();
  toast("Deconnecte.", "OK");
}

function bindEvents() {
  dom.tabs.forEach((button) => button.addEventListener("click", () => {
    state.mode = button.getAttribute("data-mode") || "login";
    renderForm();
  }));

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
    renderSide();
  });

  dom.googleButton?.addEventListener("click", handleGoogleLogin);
  dom.diagnosticButton?.addEventListener("click", refreshDiagnostic);
  dom.logoutButton?.addEventListener("click", () => {
    handleLogout().catch((err) => toast(err?.message || "Erreur logout", "Erreur"));
  });
}

async function init() {
  state.mode = getInitialModeFromUrl();
  updateAuthStateFromTokens();
  bindEvents();
  renderAll();
  consumeOauthParams();
  await consumeResetTokenFromUrl();
}

init().catch((err) => {
  setFeedback(err?.message || "Erreur chargement connexion");
  toast(err?.message || "Erreur chargement connexion", "Erreur");
});
