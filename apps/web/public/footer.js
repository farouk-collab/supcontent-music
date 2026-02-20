const tabs = [
  { href: "/index.html", icon: "⌂", label: "Accueil", key: "index" },
  { href: "/search.html", icon: "⌕", label: "Recherche", key: "search" },
  { href: "/chat.html", icon: "✉", label: "Chat", key: "chat" },
  { href: "/library.html", icon: "☰", label: "Biblio", key: "library" },
  { href: "/profile.html", icon: "☺", label: "Profil", key: "profile" },
];

function currentKey(pathname) {
  const p = String(pathname || "").toLowerCase();
  if (p.endsWith("/index.html") || p === "/" || p === "/index") return "index";
  if (p.endsWith("/search.html") || p.endsWith("/search")) return "search";
  if (p.endsWith("/chat.html") || p.endsWith("/chat")) return "chat";
  if (p.endsWith("/library.html") || p.endsWith("/library")) return "library";
  if (p.endsWith("/profile.html") || p.endsWith("/profile") || p.endsWith("/profile-edit.html")) return "profile";
  return "";
}

function injectFooter() {
  if (document.querySelector(".mobile-footer")) return;

  const active = currentKey(window.location.pathname);
  const el = document.createElement("footer");
  el.className = "mobile-footer";
  el.setAttribute("aria-label", "Navigation rapide");
  el.innerHTML = `
    <nav class="mobile-footer-inner">
      ${tabs
        .map(
          (t) => `
        <a class="mobile-tab ${active === t.key ? "is-active" : ""}" href="${t.href}" aria-label="${t.label}">
          <span class="ico" aria-hidden="true">${t.icon}</span>
          <span class="txt">${t.label}</span>
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
  document.addEventListener("DOMContentLoaded", injectFooter);
} else {
  injectFooter();
}
