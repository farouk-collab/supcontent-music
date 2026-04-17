import { getLanguage, t } from "/noyau/i18n.js";

const PAGE_TITLES = {
  accueil: "home",
  recherche: "search",
  swipe: "swipe",
  chat: "chat",
  biblio: "library",
  profil: "profile",
  live: "live",
  boutique: "shop",
};

const PAGE_DESCRIPTIONS = {
  fr: {
    accueil: "Hub decouverte : stories, feed, tendances, news, CTA et acces rapides.",
    recherche: "Double entree claire : recherche musique d'un cote, recherche utilisateurs de l'autre.",
    swipe: "Decouverte profils / musique, matchs, compatibilite, filtres et acces chat.",
    chat: "Conversations, invitations, nouveaux messages et acces rapide aux profils.",
    biblio: "Collections, favoris, lecture, fusion et organisation des medias.",
    profil: "Vue publique du compte, publications, stories, edition et reglages.",
    live: "Lives musicaux, rooms sociales, chat immersif et moments chauds en direct.",
    boutique: "Marketplace musicale pour beats, sample packs, loops, previews et panier.",
  },
  en: {
    accueil: "Discovery hub: stories, feed, trends, news, quick actions and shortcuts.",
    recherche: "Two clear entry points: music search on one side, users on the other.",
    swipe: "Profile and music discovery, matches, compatibility, filters and chat access.",
    chat: "Conversations, invites, new messages and quick profile access.",
    biblio: "Collections, favorites, playback, merge and media organization.",
    profil: "Public account view, posts, stories, editing and settings.",
    live: "Music lives, social rooms, immersive chat and hottest moments in real time.",
    boutique: "Music marketplace for beats, sample packs, loops, previews and cart.",
  },
};

const HEADER_LINKS_BY_PAGE = {
  accueil: [
    { key: "discover", label: "Decouvrir", icon: "Discover", href: "/accueil/accueil.html#discover" },
    { key: "stories", label: "Stories", icon: "Stories", href: "/accueil/accueil.html#stories" },
    { key: "publier", label: "Publier", icon: "Publish", href: "/profil/profil.html#composer" },
  ],
  recherche: [
    { key: "search-music", label: "Recherche musique", icon: "Search", href: "/recherche/recherche.html#music" },
    { key: "search-users", label: "Recherche utilisateurs", icon: "Users", href: "/utilisateurs/utilisateurs.html" },
    { key: "filters", label: "Filtres", icon: "Filters", href: "/recherche/recherche.html#filters" },
  ],
  swipe: [
    { key: "discover-profiles", label: "Decouvrir profils", icon: "Flame", href: "/swipe/swipe.html#discover" },
    { key: "music-swipe", label: "Swipe musique", icon: "Radio", href: "/swipe/swipe.html#music" },
    { key: "matches", label: "Matchs & chat", icon: "Chat", href: "/discussion/discussion.html" },
  ],
  chat: [
    { key: "new-chat", label: "Nouveau chat", icon: "Chat", href: "/discussion/discussion.html#new" },
    { key: "search-users", label: "Trouver un profil", icon: "Profile", href: "/utilisateurs/utilisateurs.html" },
    { key: "invitations", label: "Invitations", icon: "Heart", href: "/discussion/discussion.html#invitations" },
  ],
  biblio: [
    { key: "collections", label: "Collections", icon: "Collection", href: "/bibliotheque/bibliotheque.html#collections" },
    { key: "favorites", label: "Favoris", icon: "Heart", href: "/bibliotheque/bibliotheque.html#favorites" },
    { key: "add-media", label: "Ajouter des sons", icon: "Search", href: "/recherche/recherche.html" },
  ],
  profil: [
    { key: "edit-profile", label: "Modifier profil", icon: "Edit", href: "/profil/profil-modifier.html" },
    { key: "edit-site", label: "Modifier site", icon: "Discover", href: "/profil/profil.html#site-settings" },
    { key: "profile-settings", label: "Reglages profil", icon: "Profile", href: "/parametres/parametres.html#profile-settings" },
    { key: "site-settings", label: "Reglages site", icon: "Settings", href: "/parametres/parametres.html#app-settings" },
    { key: "music-profile", label: "Profil musical", icon: "Radio", href: "/profil/profil.html#music-profile" },
  ],
  live: [
    { key: "rooms", label: "Rooms en direct", icon: "Radio", href: "/radio-artiste/radio-artiste.html#rooms" },
    { key: "planning", label: "Lives programmes", icon: "Stories", href: "/radio-artiste/radio-artiste.html#planning" },
    { key: "track", label: "Track jouee", icon: "Heart", href: "/radio-artiste/radio-artiste.html#track" },
  ],
  boutique: [
    { key: "catalogue", label: "Catalogue", icon: "Collection", href: "/boutique/boutique.html#catalogue" },
    { key: "preview", label: "Preview", icon: "Radio", href: "/boutique/boutique.html#preview" },
    { key: "publier", label: "Publier", icon: "Publish", href: "/boutique/boutique.html#publier" },
  ],
};

function headerIcon(name) {
  const common = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
  switch (name) {
    case "Search":
      return `<svg ${common}><circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.2-4.2"></path></svg>`;
    case "Users":
      return `<svg ${common}><path d="M16 21a4 4 0 0 0-8 0"></path><circle cx="12" cy="7" r="3"></circle><path d="M22 21a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path><path d="M2 21a4 4 0 0 1 3-3.87"></path><path d="M8 3.13a4 4 0 0 0 0 7.75"></path></svg>`;
    case "Flame":
      return `<svg ${common}><path d="M12.5 3.5c.8 2.8-.8 4.6-2.5 6.2-1.7 1.6-2.8 3-2.8 5.1A4.8 4.8 0 0 0 12 20a4.8 4.8 0 0 0 4.8-5.2c0-3.4-2.3-5.4-4.3-7.1-.6-.6-1.2-1.2 0-4.2Z"></path></svg>`;
    case "Chat":
      return `<svg ${common}><path d="M5 6.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"></path></svg>`;
    case "Collection":
      return `<svg ${common}><path d="M4 5v14"></path><path d="M9 5v14"></path><path d="m14 6 2 13"></path><path d="m19 4 3 12"></path></svg>`;
    case "Settings":
      return `<svg ${common}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.2.49.68.81 1.21.85H21a2 2 0 1 1 0 4h-.39c-.53.04-1.01.36-1.21.85Z"></path></svg>`;
    case "Edit":
      return `<svg ${common}><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"></path></svg>`;
    case "Discover":
      return `<svg ${common}><circle cx="12" cy="12" r="9"></circle><path d="m16 8-2.5 7-7 2.5 2.5-7L16 8Z"></path></svg>`;
    case "Stories":
      return `<svg ${common}><path d="M5 4h10"></path><path d="M9 20h10"></path><path d="M5 4v10"></path><path d="M19 10v10"></path><rect x="7" y="6" width="10" height="10" rx="3"></rect></svg>`;
    case "Radio":
      return `<svg ${common}><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.48"></path><path d="M7.76 16.24a6 6 0 0 1 0-8.48"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M4.93 19.07a10 10 0 0 1 0-14.14"></path></svg>`;
    case "Heart":
      return `<svg ${common}><path d="m12 20-1.45-1.32C5.4 14.03 2 10.95 2 7.5A4.5 4.5 0 0 1 6.5 3c1.74 0 3.41.81 4.5 2.09A6.03 6.03 0 0 1 15.5 3 4.5 4.5 0 0 1 20 7.5c0 3.45-3.4 6.53-8.55 11.18Z"></path></svg>`;
    case "Publish":
      return `<svg ${common}><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>`;
    case "Filters":
      return `<svg ${common}><path d="M3 5h18"></path><path d="M6 12h12"></path><path d="M10 19h4"></path></svg>`;
    case "Profile":
      return `<svg ${common}><circle cx="10" cy="8" r="3.5"></circle><path d="M4 20a6 6 0 0 1 12 0"></path><circle cx="18" cy="18" r="3"></circle><path d="m20.5 20.5 2 2"></path></svg>`;
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="8"></circle></svg>`;
  }
}

function currentKey(pathname) {
  const p = String(pathname || "").toLowerCase();
  if (p === "/" || p.endsWith("/index.html") || p.endsWith("/accueil/accueil.html")) return "accueil";
  if (p.endsWith("/recherche/recherche.html") || p.endsWith("/utilisateurs/utilisateurs.html")) return "recherche";
  if (p.endsWith("/swipe/swipe.html")) return "swipe";
  if (p.endsWith("/discussion/discussion.html")) return "chat";
  if (p.endsWith("/bibliotheque/bibliotheque.html")) return "biblio";
  if (p.endsWith("/radio-artiste/radio-artiste.html")) return "live";
  if (p.endsWith("/boutique/boutique.html")) return "boutique";
  if (
    p.endsWith("/profil/profil.html") ||
    p.endsWith("/profil/profil-modifier.html") ||
    p.endsWith("/parametres/parametres.html")
  ) {
    return "profil";
  }
  return "";
}

function ensureHeaderStyles() {
  if (document.querySelector("#supcontent-app-header-style")) return;
  const style = document.createElement("style");
  style.id = "supcontent-app-header-style";
  style.textContent = `
    .app-shell-header{
      width:min(1240px, calc(100vw - 24px));
      margin:18px auto 18px;
      border:1px solid rgba(255,255,255,.1);
      background:
        radial-gradient(circle at top left, rgba(var(--accent2-rgb),.14), transparent 34%),
        radial-gradient(circle at top right, rgba(var(--accent-rgb),.10), transparent 24%),
        rgba(255,255,255,.05);
      backdrop-filter:blur(20px);
      border-radius:32px;
      box-shadow:0 24px 48px rgba(0,0,0,.24);
      padding:22px;
    }
    .app-shell-header .app-header-row{
      display:flex;
      flex-wrap:wrap;
      align-items:flex-start;
      justify-content:space-between;
      gap:18px;
    }
    .app-shell-header .app-header-brand{
      display:flex;
      align-items:center;
      gap:14px;
    }
    .app-shell-header .app-header-logo{
      width:48px;
      height:48px;
      border-radius:18px;
      display:grid;
      place-items:center;
      background:rgba(var(--accent2-rgb),.15);
      color:var(--accent);
    }
    .app-shell-header .app-header-logo svg,
    .app-shell-header .app-header-pill svg,
    .app-shell-header .app-header-notif svg{
      width:20px;
      height:20px;
      display:block;
    }
    .app-shell-header .app-header-kicker{
      margin:0;
      color:var(--accent);
      font-size:12px;
      letter-spacing:.24em;
      text-transform:uppercase;
      font-weight:800;
    }
    .app-shell-header .app-header-title{
      margin:6px 0 0;
      color:#fff;
      font-size:34px;
      line-height:1.05;
      letter-spacing:-.04em;
    }
    .app-shell-header .app-header-subtitle{
      margin:14px 0 0;
      max-width:760px;
      color:#9ca3af;
      font-size:14px;
      line-height:1.55;
    }
    .app-shell-header .app-header-actions{
      display:flex;
      align-items:center;
      gap:12px;
    }
    .app-shell-header .app-header-notif{
      position:relative;
      width:46px;
      height:46px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.08);
      color:#fff;
      display:grid;
      place-items:center;
      text-decoration:none;
    }
    .app-shell-header .app-header-notif-count{
      position:absolute;
      top:-6px;
      right:-6px;
      min-width:22px;
      height:22px;
      padding:0 6px;
      border-radius:999px;
      background:var(--accent2);
      color:var(--accent-contrast, #04130d);
      font-size:11px;
      font-weight:900;
      display:grid;
      place-items:center;
    }
    .app-shell-header .app-header-pills{
      margin-top:18px;
      display:flex;
      flex-wrap:wrap;
      gap:10px;
    }
    .app-shell-header .app-header-pill{
      display:inline-flex;
      align-items:center;
      gap:10px;
      min-height:42px;
      padding:10px 16px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.1);
      background:rgba(255,255,255,.05);
      color:#d4d4d8;
      font-size:14px;
      font-weight:700;
      text-decoration:none;
    }
    .app-shell-header .app-header-pill.is-active{
      background:var(--accent2);
      border-color:var(--accent2);
      color:var(--accent-contrast, #04130d);
    }
    body.has-app-header .container:first-child,
    body.has-app-header .profile-shell:first-child,
    body.has-app-header .library-shell:first-child,
    body.has-app-header .search-shell:first-child,
    body.has-app-header .edit-shell:first-child,
    body.has-app-header .settings-shell:first-child{
      margin-top:0;
      padding-top:0;
    }
    @media (max-width: 980px){
      .app-shell-header{
        width:min(1240px, calc(100vw - 18px));
        margin:12px auto 14px;
        padding:18px;
        border-radius:24px;
      }
      .app-shell-header .app-header-title{font-size:28px;}
      .app-shell-header .app-header-pills{gap:8px;}
      .app-shell-header .app-header-pill{
        padding:9px 14px;
        font-size:13px;
      }
    }
  `;
  document.head.appendChild(style);
}

function logoSvg() {
  const common = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg ${common}><path d="M9 18V5l10-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
}

function buildNotificationHref(pageKey) {
  if (pageKey === "chat") return "/discussion/discussion.html";
  if (pageKey === "profil") return "/profil/profil.html";
  return window.location.pathname + "#notifications";
}

function syncNotifCount(headerRoot) {
  const countEl = headerRoot.querySelector("[data-app-header-notif-count]");
  if (!countEl) return;

  const pickCount = () => {
    const candidates = [
      "#homeNotifBadge",
      "#searchNotifBadge",
      "#swipeNotifBadge",
      "#chatNotifBadge",
      ".library-notif-count",
      ".notif-badge",
    ];
    for (const selector of candidates) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const hidden = el.hasAttribute("hidden");
      const text = String(el.textContent || "").trim();
      if (hidden || !text || text === "0") continue;
      return text;
    }
    return "3";
  };

  const apply = () => {
    const next = pickCount();
    if (countEl.textContent === next) return;
    countEl.textContent = next;
  };

  apply();
  const obs = new MutationObserver((mutations) => {
    const touchesHeader = mutations.some((mutation) => {
      const target = mutation.target;
      return target instanceof Node && headerRoot.contains(target);
    });
    if (touchesHeader) return;
    apply();
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
}

export function initHeader() {
  if (document.querySelector(".app-shell-header")) return;

  const pageKey = currentKey(window.location.pathname);
  if (!pageKey || !PAGE_TITLES[pageKey]) return;

  ensureHeaderStyles();

  const header = document.createElement("section");
  header.className = "app-shell-header";

  const pageLinks = HEADER_LINKS_BY_PAGE[pageKey] || [];
  const activeAction = String(window.location.hash || "").replace(/^#/, "");
  const activeLinkKey = pageLinks.some((item) => item.key === activeAction) ? activeAction : pageLinks[0]?.key || "";
  const lang = getLanguage();
  const notifLabel = lang === "en" ? "Notifications" : "Notifications";
  const descriptions = PAGE_DESCRIPTIONS[lang] || PAGE_DESCRIPTIONS.en || PAGE_DESCRIPTIONS.fr;

  header.innerHTML = `
    <div class="app-header-row">
      <div>
        <div class="app-header-brand">
          <div class="app-header-logo" aria-hidden="true">${logoSvg()}</div>
          <div>
            <p class="app-header-kicker">SupContent Music</p>
            <h1 class="app-header-title">${t(PAGE_TITLES[pageKey])}</h1>
          </div>
        </div>
        <p class="app-header-subtitle">${descriptions[pageKey] || PAGE_DESCRIPTIONS.fr[pageKey] || ""}</p>
      </div>

      <div class="app-header-actions">
        <a class="app-header-notif" href="${buildNotificationHref(pageKey)}" aria-label="${notifLabel}">
          ${headerIcon("Chat")}
          <span class="app-header-notif-count" data-app-header-notif-count>3</span>
        </a>
      </div>
    </div>
    <div class="app-header-pills">
      ${pageLinks
        .map(
          (item) => `
            <a class="app-header-pill ${item.key === activeLinkKey ? "is-active" : ""}" href="${item.href}">
              ${headerIcon(item.icon)}
              <span>${item.label}</span>
            </a>
          `
        )
        .join("")}
    </div>
  `;

  document.body.prepend(header);
  document.body.classList.add("has-app-header");
  syncNotifCount(header);
}
