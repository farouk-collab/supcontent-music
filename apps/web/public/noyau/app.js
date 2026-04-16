const DEFAULT_API_BASE = (() => {
  const h = String(window.location.hostname || "").toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return "http://localhost:1234";
  return "https://supcontent-api.onrender.com";
})();

export const API_BASE = String(
  window.__API_BASE_URL__ || window.localStorage?.getItem("SUPCONTENT_API_BASE") || DEFAULT_API_BASE
).replace(/\/+$/, "");
const LS = { access: "supcontent_access", refresh: "supcontent_refresh" };
export const APP_SETTINGS_STORAGE_KEY = "supcontent-app-settings-v1";
export const APP_PREFERENCES_EVENT = "supcontent:preferences-changed";

const APP_THEME_PRESETS = {
  Sombre: {
    theme: "dark",
    bg: "#0b1020",
    card: "#111a33",
    muted: "#9fb0d0",
    text: "#eaf0ff",
    border: "rgba(255,255,255,.08)",
  },
  Clair: {
    theme: "light",
    bg: "#FFFFFF",
    card: "#F5F5F5",
    muted: "#6B7280",
    text: "#111827",
    border: "rgba(17,24,39,.12)",
  },
};

const APP_ACCENT_PRESETS = {
  "Vert emeraude": { accent: "#10B981", accent2: "#059669", contrast: "#FFFFFF" },
  Violet: { accent: "#8B5CF6", accent2: "#7C3AED", contrast: "#FFFFFF" },
  Bleu: { accent: "#2563EB", accent2: "#1D4ED8", contrast: "#FFFFFF" },
  Rose: { accent: "#EC4899", accent2: "#DB2777", contrast: "#FFFFFF" },
  Rouge: { accent: "#EF4444", accent2: "#DC2626", contrast: "#FFFFFF" },
};

export function readAppPreferences() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      theme: String(parsed.theme || "Sombre"),
      accentColor: String(parsed.accentColor || "Vert emeraude"),
    };
  } catch {
    return { theme: "Sombre", accentColor: "Vert emeraude" };
  }
}

export function saveAppPreferences(preferences = {}) {
  let stored = {};
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : {};
  } catch {
    stored = {};
  }
  const next = {
    ...stored,
    ...readAppPreferences(),
    ...preferences,
  };
  try {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  applyAppPreferences(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(APP_PREFERENCES_EVENT, {
        detail: next,
      })
    );
  }
  return next;
}

export function applyAppPreferences(preferences = {}) {
  if (typeof document === "undefined") return;
  const themeLabel = String(preferences.theme || "Sombre");
  const accentLabel = String(preferences.accentColor || "Vert emeraude");
  const theme = APP_THEME_PRESETS[themeLabel] || APP_THEME_PRESETS.Sombre;
  const accent = APP_ACCENT_PRESETS[accentLabel] || APP_ACCENT_PRESETS["Vert emeraude"];
  const root = document.documentElement;

  root.dataset.appTheme = theme.theme;
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--card", theme.card);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--accent", accent.accent);
  root.style.setProperty("--accent2", accent.accent2);
  root.style.setProperty("--accent-contrast", accent.contrast);
}

function installPreferenceSync() {
  if (typeof window === "undefined") return;
  if (window.__supcontentPreferenceSyncInstalled) return;
  window.__supcontentPreferenceSyncInstalled = true;

  window.addEventListener(APP_PREFERENCES_EVENT, (event) => {
    applyAppPreferences(event?.detail || readAppPreferences());
  });

  window.addEventListener("storage", (event) => {
    if (event.key && event.key !== APP_SETTINGS_STORAGE_KEY) return;
    applyAppPreferences(readAppPreferences());
  });
}

export function getTokens() {
  return {
    accessToken: localStorage.getItem(LS.access) || "",
    refreshToken: localStorage.getItem(LS.refresh) || "",
  };
}

export function setTokens({ accessToken, refreshToken }) {
  if (typeof accessToken === "string" && accessToken.length) localStorage.setItem(LS.access, accessToken);
  if (typeof refreshToken === "string" && refreshToken.length) localStorage.setItem(LS.refresh, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(LS.access);
  localStorage.removeItem(LS.refresh);
}

export async function serverLogout() {
  const { refreshToken } = getTokens();
  try {
    if (refreshToken) {
      await fetch(API_BASE + "/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // best effort: on supprime quand même les tokens locaux
  } finally {
    clearTokens();
  }
}

export function isLoggedIn() {
  return getTokens().accessToken.length > 0;
}

export function requireLogin({
  title = "Connexion requise",
  message = "Connecte-toi d'abord pour utiliser cette fonctionnalite.",
  redirect = true,
  next = `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`,
} = {}) {
  if (isLoggedIn()) return true;
  toast(message, title);
  if (redirect) {
    const target = `/connexion/connexion.html?next=${encodeURIComponent(next)}`;
    window.setTimeout(() => {
      window.location.href = target;
    }, 220);
  }
  return false;
}

export function toast(msg, title = "Info") {
  const level = String(title || "Info").trim().toLowerCase();
  // Keep UI quiet: skip non-essential informational toasts.
  if (level === "info") return;
  const el = document.querySelector("#toast");
  if (!el) return;
  el.innerHTML = `<strong>${title}</strong><div style="color:var(--muted);margin-top:4px">${escapeHtml(msg)}</div>`;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

export async function apiFetch(path, opts = {}) {
  const doFetch = async (accessToken) => {
    const headers = new Headers(opts.headers || {});
    const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
    if (!headers.has("Content-Type") && opts.body && !isFormData) headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(API_BASE + path, { ...opts, headers });
  };

  const { accessToken, refreshToken } = getTokens();

  // 1er essai avec access token
  let res = await doFetch(accessToken);
  let text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  // Si 401 -> on tente un refresh (si refreshToken existe)
  if (res.status === 401 && refreshToken) {
    const refreshed = await fetch(API_BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const rText = await refreshed.text();
    let rData;
    try { rData = rText ? JSON.parse(rText) : null; } catch { rData = rText; }

    if (refreshed.ok && rData?.accessToken) {
      setTokens({ accessToken: rData.accessToken, refreshToken });
      // retry avec nouveau access token
      res = await doFetch(rData.accessToken);
      text = await res.text();
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    } else {
      // refresh KO => on wipe les tokens
      clearTokens();
    }
  }

  if (!res.ok) {
    const msg = data?.erreur || data?.error || (typeof data === "string" ? data : "Erreur API");
    const e = new Error(msg);
    e.status = res.status;
    e.data = data;
    throw e;
  }

  return data;
}

export function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function resolveMediaUrl(url = "") {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const u = new URL(s);
      // Migrate old local absolute media URLs to current API host in production.
      if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.pathname.startsWith("/uploads/")) {
        return `${API_BASE}${u.pathname}`;
      }
      if (u.pathname === "/media" || u.pathname === "/media/media") return "";
    } catch {
      return "";
    }
    return s;
  }
  if (s.startsWith("blob:") || s.startsWith("data:")) {
    return s;
  }
  if (s.startsWith("/")) {
    if (s === "/media" || s === "/media/media") return "";
    if (s.startsWith("/uploads/")) return API_BASE + s;
    return s;
  }
  if (s.startsWith("./") || s.startsWith("../")) {
    const cleaned = s.replace(/^(\.\/|\.\.\/)+/, "");
    if (!cleaned) return "";
    if (cleaned.startsWith("uploads/")) return `${API_BASE}/${cleaned}`;
    if (cleaned.startsWith("stk/")) return `/${cleaned}`;
    if (cleaned === "media" || cleaned.startsWith("media/")) return "";
    return "";
  }
  const normalized = s.replace(/^\/+/, "");
  if (normalized === "media" || normalized.startsWith("media/")) return "";
  if (normalized.startsWith("uploads/")) return `${API_BASE}/${normalized}`;
  if (normalized.startsWith("stk/")) return `/${normalized}`;
  return "";
}

function guardImageSrc(img) {
  if (!img || typeof img.getAttribute !== "function") return;
  const raw = String(img.getAttribute("src") || "").trim();
  if (!raw) return;
  const safe = resolveMediaUrl(raw);
  if (!safe) {
    img.removeAttribute("src");
    return;
  }
  if (safe !== raw) img.setAttribute("src", safe);
}

function installImageSrcGuard() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__supcontentImageGuardInstalled) return;
  window.__supcontentImageGuardInstalled = true;

  document.querySelectorAll("img[src]").forEach((img) => guardImageSrc(img));

  const root = document.body || document.documentElement;
  if (!root) return;

  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.target instanceof HTMLImageElement) {
        guardImageSrc(m.target);
        continue;
      }
      if (m.type === "childList") {
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLImageElement) guardImageSrc(n);
          if (n instanceof HTMLElement) n.querySelectorAll("img[src]").forEach((img) => guardImageSrc(img));
        });
      }
    }
  });

  obs.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
}

installImageSrcGuard();
installPreferenceSync();
applyAppPreferences(readAppPreferences());

function installDevIssueOverlay() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__supcontentDevOverlayInstalled) return;

  const forceOn = window.location.search.includes("debugOverlay=1") || localStorage.getItem("SUPCONTENT_DEV_OVERLAY") === "1";
  if (!forceOn) return;

  window.__supcontentDevOverlayInstalled = true;

  const issues = [];
  let open = false;

  const wrap = document.createElement("div");
  wrap.id = "sc-dev-overlay";
  wrap.innerHTML = `
    <button id="scDevBadge" type="button" title="Issues dev">Issue 0</button>
    <section id="scDevPanel" hidden>
      <header>
        <strong>Dev Issues</strong>
        <button id="scDevClear" type="button">Clear</button>
      </header>
      <div id="scDevList"></div>
    </section>
  `;
  document.body.appendChild(wrap);

  const style = document.createElement("style");
  style.textContent = `
    #sc-dev-overlay{position:fixed;right:14px;bottom:14px;z-index:99999;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    #scDevBadge{background:#b91c1c;color:#fff;border:1px solid #fecaca;border-radius:999px;padding:8px 12px;font-weight:800;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.35)}
    #scDevPanel{position:absolute;right:0;bottom:46px;width:min(92vw,720px);max-height:min(70vh,560px);overflow:auto;background:#0b1220;color:#e2e8f0;border:1px solid rgba(248,113,113,.5);border-radius:12px;padding:10px;box-shadow:0 16px 38px rgba(0,0,0,.45)}
    #scDevPanel header{display:flex;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:0;background:#0b1220;padding-bottom:8px}
    #scDevPanel button{background:#1f2937;color:#fff;border:1px solid #475569;border-radius:8px;padding:4px 8px;cursor:pointer}
    #scDevList{display:grid;gap:8px}
    .sc-dev-item{border:1px solid rgba(148,163,184,.35);border-radius:10px;padding:8px;background:#111827}
    .sc-dev-item code{display:block;white-space:pre-wrap;word-break:break-word;color:#fca5a5}
    .sc-dev-meta{font-size:12px;color:#93c5fd;margin-bottom:4px}
  `;
  document.head.appendChild(style);

  const badge = wrap.querySelector("#scDevBadge");
  const panel = wrap.querySelector("#scDevPanel");
  const list = wrap.querySelector("#scDevList");
  const clearBtn = wrap.querySelector("#scDevClear");

  const render = () => {
    badge.textContent = `Issue ${issues.length}`;
    panel.hidden = !open;
    if (!issues.length) {
      list.innerHTML = `<div class="sc-dev-item"><div class="sc-dev-meta">No issue</div><code>Everything looks good.</code></div>`;
      return;
    }
    list.innerHTML = issues
      .slice()
      .reverse()
      .map((it) => {
        return `<article class="sc-dev-item">
          <div class="sc-dev-meta">${escapeHtml(it.type)} | ${escapeHtml(it.time)}</div>
          <code>${escapeHtml(it.message)}</code>
        </article>`;
      })
      .join("");
  };

  const pushIssue = (type, message) => {
    issues.push({
      type: String(type || "issue"),
      message: String(message || "Unknown error"),
      time: new Date().toLocaleTimeString(),
    });
    if (issues.length > 60) issues.shift();
    render();
  };

  badge.addEventListener("click", () => {
    open = !open;
    render();
  });
  clearBtn.addEventListener("click", () => {
    issues.length = 0;
    render();
  });

  window.addEventListener("error", (ev) => {
    const msg = ev?.error?.stack || ev?.message || "Runtime error";
    pushIssue("runtime", msg);
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev?.reason;
    const msg = reason?.stack || reason?.message || String(reason || "Unhandled promise rejection");
    pushIssue("promise", msg);
  });

  const nativeFetch = window.fetch?.bind(window);
  if (nativeFetch) {
    window.fetch = async (...args) => {
      try {
        const res = await nativeFetch(...args);
        if (!res.ok) {
          const url = String(args?.[0] || "");
          pushIssue("fetch", `${res.status} ${res.statusText} | ${url}`);
        }
        return res;
      } catch (err) {
        const url = String(args?.[0] || "");
        pushIssue("fetch", `${err?.message || "Failed to fetch"} | ${url}`);
        throw err;
      }
    };
  }

  render();
}

installDevIssueOverlay();

export function qs(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}
