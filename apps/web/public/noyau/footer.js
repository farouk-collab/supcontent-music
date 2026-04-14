import { getLanguage, t, LANGUAGE_EVENT } from "/noyau/i18n.js";
import { initGlobalPlayer } from "/noyau/globalPlayer.js";
import { initHeader } from "/noyau/header.js";
import { APP_PREFERENCES_EVENT } from "/noyau/app.js";
const PLAYER_DISMISS_KEY = "supcontent_global_player_dismissed_v1";

const tabs = [
  { href: "/accueil/accueil.html", icon: "home", labelKey: "home", key: "index" },
  { href: "/recherche/recherche.html", icon: "search", labelKey: "search", key: "search" },
  { href: "/swipe/swipe.html", icon: "flame", labelKey: "swipe", key: "swipe" },
  { href: "/radio-artiste/radio-artiste.html", icon: "live", labelKey: "live", key: "live" },
  { href: "/discussion/discussion.html", icon: "chat", labelKey: "chat", key: "chat" },
  { href: "/boutique/boutique.html", icon: "shop", labelKey: "shop", key: "shop" },
  { href: "/bibliotheque/bibliotheque.html", icon: "library", labelKey: "library", key: "library" },
  { href: "/profil/profil.html", icon: "user", labelKey: "profile", key: "profile" },
];

function iconSvg(name) {
  const common = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"`;
  switch (name) {
    case "home":
      return `<svg ${common}><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>`;
    case "search":
      return `<svg ${common}><circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.2-4.2"></path></svg>`;
    case "flame":
      return `<svg ${common}><path d="M12.5 3.5c.8 2.8-.8 4.6-2.5 6.2-1.7 1.6-2.8 3-2.8 5.1A4.8 4.8 0 0 0 12 20a4.8 4.8 0 0 0 4.8-5.2c0-3.4-2.3-5.4-4.3-7.1-.6-.6-1.2-1.2 0-4.2Z"></path></svg>`;
    case "chat":
      return `<svg ${common}><path d="M5 6.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"></path></svg>`;
    case "live":
      return `<svg ${common}><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.48"></path><path d="M7.76 16.24a6 6 0 0 1 0-8.48"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M4.93 19.07a10 10 0 0 1 0-14.14"></path></svg>`;
    case "library":
      return `<svg ${common}><path d="M4 5v14"></path><path d="M9 5v14"></path><path d="m14 6 2 13"></path><path d="m19 4 3 12"></path></svg>`;
    case "shop":
      return `<svg ${common}><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;
    case "user":
      return `<svg ${common}><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20a7 7 0 0 1 14 0"></path></svg>`;
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="8"></circle></svg>`;
  }
}

function ensureExtraStyles() {
  const files = ["/noyau/styles/player-core.css", "/noyau/styles/player-theme.css"];
  files.forEach((href) => {
    const existing = document.querySelector(`link[data-extra-style="${href}"]`);
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-extra-style", href);
    document.head.appendChild(link);
  });
}

function ensureThemeBridgeStyles() {
  if (document.querySelector("#supcontent-theme-bridge-style")) return;
  const style = document.createElement("style");
  style.id = "supcontent-theme-bridge-style";
  style.textContent = `
    :root[data-app-theme="light"] body.profile-preview-page,
    :root[data-app-theme="light"] body.shop-page,
    :root[data-app-theme="light"] body.live-page,
    :root[data-app-theme="light"] body.chat-redesign-page,
    :root[data-app-theme="light"] body.library-page,
    :root[data-app-theme="light"] body.search-page,
    :root[data-app-theme="light"] body.home-page,
    :root[data-app-theme="light"] body.swipe-page{
      background:
        radial-gradient(circle at top, color-mix(in srgb, var(--accent2) 16%, transparent), transparent 18%),
        radial-gradient(circle at right, color-mix(in srgb, var(--accent) 14%, transparent), transparent 22%),
        linear-gradient(180deg, #eef3fb, #dfe7f3) !important;
      color: var(--text) !important;
    }

    :root[data-app-theme="light"] .profile-card,
    :root[data-app-theme="light"] .shop-panel,
    :root[data-app-theme="light"] .live-panel,
    :root[data-app-theme="light"] .chat-panel,
    :root[data-app-theme="light"] .library-panel,
    :root[data-app-theme="light"] .search-panel,
    :root[data-app-theme="light"] .shop-header,
    :root[data-app-theme="light"] .live-header,
    :root[data-app-theme="light"] .chat-redesign-header,
    :root[data-app-theme="light"] .library-header,
    :root[data-app-theme="light"] .search-header,
    :root[data-app-theme="light"] .profile-header,
    :root[data-app-theme="light"] .home-topbar,
    :root[data-app-theme="light"] .home-stories-card,
    :root[data-app-theme="light"] .home-feed-card,
    :root[data-app-theme="light"] .home-carousel-card,
    :root[data-app-theme="light"] .home-hero-card,
    :root[data-app-theme="light"] .home-news-card,
    :root[data-app-theme="light"] .swipe-header,
    :root[data-app-theme="light"] .swipe-tabs,
    :root[data-app-theme="light"] .swipe-panel,
    :root[data-app-theme="light"] .swipe-stage,
    :root[data-app-theme="light"] .swipe-summary{
      background: rgba(255,255,255,.84) !important;
      border-color: rgba(15,23,42,.12) !important;
      box-shadow: 0 16px 40px rgba(15,23,42,.08) !important;
    }

    .pill-btn--primary,
    .shop-chip.is-active,
    .shop-btn.is-primary,
    .live-btn.is-emerald,
    .library-primary,
    .library-chip.is-active,
    .chat-action-btn,
    .chat-send-btn,
    .chat-context-play,
    .search-pill-btn.is-primary,
    .save-btn,
    .choice-pill.is-active,
    .toggle.is-on,
    .app-shell-header .app-header-pill.is-active,
    .app-shell-header .app-header-notif-count,
    .home-notif-btn,
    .swipe-notif-btn,
    .swipe-pill-btn.is-primary,
    .swipe-chip.is-active,
    .home-hero-actions .btn.primary{
      background: var(--accent2) !important;
      border-color: var(--accent2) !important;
      color: var(--accent-contrast, #04130d) !important;
    }

    .shop-progress > div,
    .library-progress > div{
      background: var(--accent2) !important;
    }

    .profile-kicker,
    .shop-kicker,
    .live-kicker,
    .chat-redesign-kicker,
    .library-kicker,
    .search-kicker,
    .app-shell-header .app-header-kicker{
      color: var(--accent) !important;
    }

    .shop-brand-icon,
    .live-brand-icon,
    .chat-brand-icon,
    .library-brand-icon,
    .search-brand-icon,
    .profile-avatar,
    .home-kicker,
    .swipe-kicker,
    .profile-cover{
      color: var(--accent) !important;
    }
  `;
  document.head.appendChild(style);
}

function ensureBrandFavicon() {
  const href = "/assets/logo-supconnect.svg";
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.setAttribute("rel", "icon");
    document.head.appendChild(icon);
  }
  icon.setAttribute("type", "image/svg+xml");
  icon.setAttribute("href", href);

  let apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement("link");
    apple.setAttribute("rel", "apple-touch-icon");
    document.head.appendChild(apple);
  }
  apple.setAttribute("href", href);
}

function isAuthed() {
  try {
    return Boolean(localStorage.getItem("supcontent_access"));
  } catch {
    return false;
  }
}

function syncHeaderAuthLinks() {
  const menu = document.querySelector(".menu");
  if (!menu) return;

  const loginLink = menu.querySelector('a[href="/connexion/connexion.html"]');
  const profileLink = menu.querySelector('a[href="/profil/profil.html"]');
  const authed = isAuthed();

  if (loginLink) loginLink.style.display = authed ? "none" : "";
  if (profileLink) profileLink.style.display = authed ? "" : "";
}

function currentKey(pathname) {
  const p = String(pathname || "").toLowerCase();
  if (p === "/" || p === "/index" || p.endsWith("/index.html") || p.endsWith("/feed") || p.endsWith("/accueil") || p.endsWith("/accueil/accueil.html")) {
    return "index";
  }
  if (p.endsWith("/radio-artiste/radio-artiste.html")) return "live";
  if (p.endsWith("/boutique/boutique.html")) return "shop";
  if (p.endsWith("/search") || p.endsWith("/recherche") || p.endsWith("/search.html") || p.endsWith("/recherche/recherche.html")) return "search";
  if (p.endsWith("/swipe") || p.endsWith("/swipe/swipe.html")) return "swipe";
  if (p.endsWith("/chat") || p.endsWith("/discussion") || p.endsWith("/chat.html") || p.endsWith("/discussion/discussion.html")) return "chat";
  if (p.endsWith("/library") || p.endsWith("/bibliotheque") || p.endsWith("/library.html") || p.endsWith("/bibliotheque/bibliotheque.html")) return "library";
  if (
    p.endsWith("/profile") ||
    p.endsWith("/profil") ||
    p.endsWith("/profile.html") ||
    p.endsWith("/profil/profil.html") ||
    p.endsWith("/profile-edit.html") ||
    p.endsWith("/profil/profil-modifier.html")
  ) {
    return "profile";
  }
  return "";
}

function injectFooter() {
  const active = currentKey(window.location.pathname);
  const existing = document.querySelector(".mobile-footer");
  if (existing) existing.remove();
  const el = document.createElement("footer");
  const lang = getLanguage();
  el.className = "mobile-footer";
  el.setAttribute("aria-label", lang === "en" ? "Quick navigation" : "Navigation rapide");
  el.innerHTML = `
    <nav class="mobile-footer-inner">
      ${tabs
        .map(
          (tab) => `
        <a class="mobile-tab ${active === tab.key ? "is-active" : ""}" href="${tab.href}" aria-label="${t(tab.labelKey)}" data-icon="${tab.icon}">
          <span class="ico-wrap" aria-hidden="true">
            <span class="ico">${iconSvg(tab.icon)}</span>
          </span>
          <span class="txt">${t(tab.labelKey)}</span>
        </a>
      `
        )
        .join("")}
    </nav>
  `;

  document.body.appendChild(el);
  document.body.classList.add("has-mobile-footer");
}

function isPlayerDismissed() {
  try {
    return localStorage.getItem(PLAYER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function forceHideGlobalPlayer() {
  try {
    document.body.classList.remove("has-global-player");
    const existing = document.querySelector("#globalMiniPlayer");
    if (existing) existing.remove();
  } catch {
    // ignore
  }
}

function refreshShellNavigation() {
  injectFooter();
  const existingHeader = document.querySelector(".app-shell-header");
  if (existingHeader) existingHeader.remove();
  initHeader();
  syncHeaderAuthLinks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    ensureExtraStyles();
    ensureThemeBridgeStyles();
    ensureBrandFavicon();
    initHeader();
    injectFooter();
    syncHeaderAuthLinks();
    if (isPlayerDismissed()) forceHideGlobalPlayer();
    initGlobalPlayer();
    if (isPlayerDismissed()) {
      forceHideGlobalPlayer();
      window.supcontentPlayer?.stop?.();
    }

    window.addEventListener(LANGUAGE_EVENT, refreshShellNavigation);
    window.addEventListener(APP_PREFERENCES_EVENT, refreshShellNavigation);
    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === "supcontent_language" || event.key === "supcontent-app-settings-v1") {
        refreshShellNavigation();
      }
    });
  });
} else {
  ensureExtraStyles();
  ensureThemeBridgeStyles();
  ensureBrandFavicon();
  initHeader();
  injectFooter();
  syncHeaderAuthLinks();
  if (isPlayerDismissed()) forceHideGlobalPlayer();
  initGlobalPlayer();
  if (isPlayerDismissed()) {
    forceHideGlobalPlayer();
    window.supcontentPlayer?.stop?.();
  }

  window.addEventListener(LANGUAGE_EVENT, refreshShellNavigation);
  window.addEventListener(APP_PREFERENCES_EVENT, refreshShellNavigation);
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === "supcontent_language" || event.key === "supcontent-app-settings-v1") {
      refreshShellNavigation();
    }
  });
}
