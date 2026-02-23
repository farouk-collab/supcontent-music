import { getLanguage, t } from "/noyau/i18n.js";

const tabs = [
  { href: "/accueil", icon: "&#127968;", labelKey: "home", key: "index" },
  { href: "/recherche", icon: "&#128269;", labelKey: "search", key: "search" },
  { href: "/swipe/swipe.html", icon: "&#127183;", labelKey: "swipe", key: "swipe" },
  { href: "/discussion", icon: "&#128172;", labelKey: "chat", key: "chat" },
  { href: "/bibliotheque", icon: "&#128218;", labelKey: "library", key: "library" },
  { href: "/profil", icon: "&#128100;", labelKey: "profile", key: "profile" },
];

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
  if (document.querySelector(".mobile-footer")) return;

  const active = currentKey(window.location.pathname);
  const el = document.createElement("footer");
  const lang = getLanguage();
  el.className = "mobile-footer";
  el.setAttribute("aria-label", lang === "en" ? "Quick navigation" : "Navigation rapide");
  el.innerHTML = `
    <nav class="mobile-footer-inner">
      ${tabs
        .map(
          (tab) => `
        <a class="mobile-tab ${active === tab.key ? "is-active" : ""}" href="${tab.href}" aria-label="${t(tab.labelKey)}">
          <span class="ico" aria-hidden="true">${tab.icon}</span>
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injectFooter();
    syncHeaderAuthLinks();
  });
} else {
  injectFooter();
  syncHeaderAuthLinks();
}

