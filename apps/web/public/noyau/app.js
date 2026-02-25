const DEFAULT_API_BASE = (() => {
  const h = String(window.location.hostname || "").toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return "http://localhost:1234";
  return "https://supcontent-api.onrender.com";
})();

export const API_BASE = String(
  window.__API_BASE_URL__ || window.localStorage?.getItem("SUPCONTENT_API_BASE") || DEFAULT_API_BASE
).replace(/\/+$/, "");
const LS = { access: "supcontent_access", refresh: "supcontent_refresh" };

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

export function toast(msg, title = "Info") {
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

  obs.observe(document.documentElement || document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
}

installImageSrcGuard();

export function qs(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}
