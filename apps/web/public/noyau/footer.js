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
    :root:not([data-app-theme="light"]) body.profile-preview-page,
    :root:not([data-app-theme="light"]) body.settings-preview-page,
    :root:not([data-app-theme="light"]) body.shop-page,
    :root:not([data-app-theme="light"]) body.live-page,
    :root:not([data-app-theme="light"]) body.chat-redesign-page,
    :root:not([data-app-theme="light"]) body.library-page,
    :root:not([data-app-theme="light"]) body.search-page,
    :root:not([data-app-theme="light"]) body.home-page,
    :root:not([data-app-theme="light"]) body.swipe-page{
      background:
        radial-gradient(circle at top, rgba(var(--accent2-rgb),.16), transparent 20%),
        radial-gradient(circle at right, rgba(var(--accent-rgb),.14), transparent 22%),
        linear-gradient(180deg, #050505, #0d0d0d) !important;
      color: var(--text) !important;
    }

    :root[data-app-theme="light"] body.profile-preview-page,
    :root[data-app-theme="light"] body.shop-page,
    :root[data-app-theme="light"] body.live-page,
    :root[data-app-theme="light"] body.chat-redesign-page,
    :root[data-app-theme="light"] body.library-page,
    :root[data-app-theme="light"] body.search-page,
    :root[data-app-theme="light"] body.home-page,
    :root[data-app-theme="light"] body.swipe-page{
      background:
        radial-gradient(circle at top, color-mix(in srgb, var(--accent2) 12%, transparent), transparent 24%),
        radial-gradient(circle at right, color-mix(in srgb, var(--accent) 10%, transparent), transparent 28%),
        linear-gradient(180deg, #f6f1eb, #ede6de) !important;
      color: #171c2b !important;
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
      background: rgba(252,248,242,.9) !important;
      border-color: rgba(23,28,43,.10) !important;
      box-shadow: 0 18px 44px rgba(23,28,43,.07) !important;
    }

    :root[data-app-theme="light"] .stat-card,
    :root[data-app-theme="light"] .soft-card,
    :root[data-app-theme="light"] .content-card,
    :root[data-app-theme="light"] .empty-block,
    :root[data-app-theme="light"] .person-pill,
    :root[data-app-theme="light"] .highlight-pill,
    :root[data-app-theme="light"] .meta-chip,
    :root[data-app-theme="light"] .social-chip,
    :root[data-app-theme="light"] .swipe-list-card,
    :root[data-app-theme="light"] .swipe-box,
    :root[data-app-theme="light"] .swipe-card-shell,
    :root[data-app-theme="light"] .swipe-empty,
    :root[data-app-theme="light"] .home-feed-item,
    :root[data-app-theme="light"] .home-news-item,
    :root[data-app-theme="light"] .home-news-text-item{
      background: rgba(248,242,234,.92) !important;
      border-color: rgba(23,28,43,.09) !important;
      color: #171c2b !important;
      box-shadow: none !important;
    }

    :root[data-app-theme="light"] .profile-muted,
    :root[data-app-theme="light"] .home-subtitle,
    :root[data-app-theme="light"] .home-section-head p,
    :root[data-app-theme="light"] .swipe-subtitle,
    :root[data-app-theme="light"] .swipe-box,
    :root[data-app-theme="light"] .news-sub,
    :root[data-app-theme="light"] .news-text,
    :root[data-app-theme="light"] .home-feed-action,
    :root[data-app-theme="light"] .home-feed-meta,
    :root[data-app-theme="light"] .feedback-line,
    :root[data-app-theme="light"] .meta-row,
    :root[data-app-theme="light"] .small-badge,
    :root[data-app-theme="light"] .person-pill,
    :root[data-app-theme="light"] .swipe-tag,
    :root[data-app-theme="light"] .swipe-card-sub,
    :root[data-app-theme="light"] .swipe-card-bio,
    :root[data-app-theme="light"] .swipe-stat-card .label{
      color: #6B7280 !important;
    }

    :root[data-app-theme="light"] .section-title,
    :root[data-app-theme="light"] .profile-title,
    :root[data-app-theme="light"] .profile-name-row h2,
    :root[data-app-theme="light"] .stat-card strong,
    :root[data-app-theme="light"] .swipe-title,
    :root[data-app-theme="light"] .swipe-panel-title,
    :root[data-app-theme="light"] .swipe-card-title,
    :root[data-app-theme="light"] .home-title,
    :root[data-app-theme="light"] .news-title,
    :root[data-app-theme="light"] .home-feed-user{
      color: #111827 !important;
    }

    :root[data-app-theme="light"] .hero-mini,
    :root[data-app-theme="light"] .profile-cover,
    :root[data-app-theme="light"] .swipe-card-hero{
      background:
        linear-gradient(135deg, rgba(var(--accent-rgb),.10), rgba(var(--accent2-rgb),.10), rgba(var(--accent-rgb),.08)) !important;
      border-color: rgba(17,24,39,.10) !important;
    }

    :root[data-app-theme="light"] .profile-avatar{
      border-color: #FFFFFF !important;
      background: #EEF2FF !important;
    }

    :root[data-app-theme="light"] .profile-kicker,
    :root[data-app-theme="light"] .home-kicker,
    :root[data-app-theme="light"] .swipe-kicker,
    :root[data-app-theme="light"] .app-shell-header .app-header-kicker{
      color: var(--accent) !important;
      opacity: 1 !important;
    }

    :root[data-app-theme="light"] .profile-header,
    :root[data-app-theme="light"] .profile-header *{
      color: #111827 !important;
    }

    :root[data-app-theme="light"] .profile-header .profile-kicker{
      color: var(--accent) !important;
      letter-spacing: .24em !important;
    }

    :root[data-app-theme="light"] .profile-header .profile-title,
    :root[data-app-theme="light"] .profile-header h1,
    :root[data-app-theme="light"] .profile-header h2{
      color: #111827 !important;
      text-shadow: none !important;
    }

    :root[data-app-theme="light"] .profile-header p,
    :root[data-app-theme="light"] .profile-header .profile-muted{
      color: #6B7280 !important;
    }

    :root[data-app-theme="light"] .profile-header .pill-btn:not(.pill-btn--primary),
    :root[data-app-theme="light"] .profile-header .icon-circle{
      background: rgba(255,255,255,.5) !important;
      border-color: rgba(23,28,43,.10) !important;
      color: #6B7280 !important;
    }

    :root[data-app-theme="light"] .profile-header .pill-btn--primary{
      background: var(--accent2) !important;
      border-color: var(--accent2) !important;
      color: #FFFFFF !important;
      box-shadow: 0 12px 28px color-mix(in srgb, var(--accent2) 28%, transparent) !important;
    }

    :root[data-app-theme="light"] .profile-header .pill-btn--primary:hover,
    :root[data-app-theme="light"] .profile-header .pill-btn--primary:focus-visible{
      background: color-mix(in srgb, var(--accent2) 88%, black 12%) !important;
      border-color: color-mix(in srgb, var(--accent2) 88%, black 12%) !important;
    }

    :root[data-app-theme="light"] .pill-btn,
    :root[data-app-theme="light"] .icon-circle,
    :root[data-app-theme="light"] .home-soft-btn,
    :root[data-app-theme="light"] .swipe-pill-btn,
    :root[data-app-theme="light"] .swipe-chip,
    :root[data-app-theme="light"] .mobile-tab{
      background: rgba(255,255,255,.55) !important;
      border-color: rgba(23,28,43,.08) !important;
      color: #171c2b !important;
    }

    :root[data-app-theme="light"] .notif-panel,
    :root[data-app-theme="light"] .swipe-notif-panel,
    :root[data-app-theme="light"] .home-notif-panel{
      background: rgba(252,248,242,.98) !important;
      border-color: rgba(23,28,43,.10) !important;
      color: #171c2b !important;
    }

    :root[data-app-theme="light"] .home-shell{
      max-width: 1360px !important;
      padding-top: 26px !important;
      padding-bottom: 132px !important;
    }

    :root[data-app-theme="light"] .home-topbar{
      position: relative !important;
      padding: 28px 28px 26px !important;
      border-radius: 40px !important;
      border: 1px solid rgba(23,28,43,.08) !important;
      background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--accent2) 16%, transparent), transparent 26%),
        radial-gradient(circle at 78% 22%, rgba(var(--accent-rgb),.10), transparent 24%),
        linear-gradient(135deg, rgba(252,248,242,.96), rgba(244,238,230,.96)) !important;
      box-shadow: 0 28px 70px rgba(23,28,43,.10) !important;
      overflow: hidden !important;
    }

    :root[data-app-theme="light"] .home-topbar::before{
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(120deg, color-mix(in srgb, var(--accent2) 9%, transparent), transparent 36%, transparent 64%, color-mix(in srgb, var(--accent) 8%, transparent));
      pointer-events: none;
    }

    :root[data-app-theme="light"] .home-topbar > *{
      position: relative;
      z-index: 1;
    }

    :root[data-app-theme="light"] .home-topbar .home-kicker{
      color: var(--accent2) !important;
      font-weight: 900 !important;
      letter-spacing: .34em !important;
    }

    :root[data-app-theme="light"] .home-topbar .home-title{
      color: #171c2b !important;
      font-size: clamp(48px, 6vw, 78px) !important;
      line-height: .95 !important;
      letter-spacing: -.05em !important;
      margin-top: 10px !important;
      text-shadow: none !important;
    }

    :root[data-app-theme="light"] .home-topbar .home-subtitle{
      max-width: 760px !important;
      margin-top: 14px !important;
      color: #6d7285 !important;
      font-size: 19px !important;
      line-height: 1.55 !important;
    }

    :root[data-app-theme="light"] .home-actions{
      gap: 14px !important;
      align-items: center !important;
    }

    :root[data-app-theme="light"] .home-soft-btn,
    :root[data-app-theme="light"] .home-topbar .btn:not(.primary):not(.home-notif-btn){
      background: rgba(255,255,255,.5) !important;
      border: 1px solid rgba(23,28,43,.08) !important;
      color: #171c2b !important;
      box-shadow: 0 10px 24px rgba(23,28,43,.05) !important;
    }

    :root[data-app-theme="light"] .home-soft-btn:hover,
    :root[data-app-theme="light"] .home-topbar .btn:not(.primary):not(.home-notif-btn):hover{
      background: rgba(255,255,255,.72) !important;
      border-color: color-mix(in srgb, var(--accent2) 24%, transparent) !important;
      transform: translateY(-1px);
    }

    :root[data-app-theme="light"] .home-notif-btn{
      background: #FFFFFF !important;
      color: #111827 !important;
      border: 1px solid color-mix(in srgb, var(--accent2) 18%, transparent) !important;
      box-shadow: 0 16px 32px color-mix(in srgb, var(--accent2) 14%, transparent) !important;
    }

    :root[data-app-theme="light"] .home-notif-badge{
      background: color-mix(in srgb, var(--accent) 86%, white 14%) !important;
      box-shadow: 0 12px 26px rgba(var(--accent-rgb),.30) !important;
    }

    :root[data-app-theme="light"] .home-live-pill{
      background: color-mix(in srgb, var(--accent2) 10%, transparent) !important;
      border: 1px solid color-mix(in srgb, var(--accent2) 18%, transparent) !important;
      color: var(--accent2) !important;
      box-shadow: none !important;
    }

    :root[data-app-theme="light"] .home-live-pill.is-live,
    :root[data-app-theme="light"] .home-live-pill.is-test-ok{
      background: rgba(var(--accent2-rgb),.10) !important;
      border-color: rgba(var(--accent2-rgb),.18) !important;
      color: color-mix(in srgb, var(--accent2) 76%, black 24%) !important;
    }

    :root[data-app-theme="light"] .home-stories-card,
    :root[data-app-theme="light"] .home-feed-card,
    :root[data-app-theme="light"] .home-carousel-card,
    :root[data-app-theme="light"] .home-hero-card,
    :root[data-app-theme="light"] .home-news-card{
      border-radius: 34px !important;
      background: rgba(252,248,242,.9) !important;
      border: 1px solid rgba(23,28,43,.08) !important;
      box-shadow: 0 20px 52px rgba(23,28,43,.07) !important;
    }

    :root[data-app-theme="light"] .home-section-head h2,
    :root[data-app-theme="light"] .home-hero-card h2{
      color: #111827 !important;
      letter-spacing: -.03em !important;
    }

    :root[data-app-theme="light"] .home-section-head p,
    :root[data-app-theme="light"] .story-sub,
    :root[data-app-theme="light"] .news-sub,
    :root[data-app-theme="light"] .news-meta,
    :root[data-app-theme="light"] .news-text{
      color: #6B7280 !important;
    }

    :root[data-app-theme="light"] .story-ring,
    :root[data-app-theme="light"] .story-avatar,
    :root[data-app-theme="light"] .news-cover{
      border-color: color-mix(in srgb, var(--accent2) 20%, transparent) !important;
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent2) 10%, white), color-mix(in srgb, var(--accent) 8%, white)) !important;
    }

    :root[data-app-theme="light"] .story-title,
    :root[data-app-theme="light"] .news-title{
      color: #111827 !important;
    }

    :root[data-app-theme="light"] .home-feed-item,
    :root[data-app-theme="light"] .home-news-item,
    :root[data-app-theme="light"] .home-news-text-item{
      background: rgba(255,255,255,.54) !important;
      border: 1px solid rgba(23,28,43,.08) !important;
      box-shadow: 0 8px 24px rgba(23,28,43,.04) !important;
    }

    :root[data-app-theme="light"] .home-hero-card{
      background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--accent2) 12%, transparent), transparent 24%),
        linear-gradient(135deg, rgba(252,248,242,.96), rgba(246,240,233,.96)) !important;
    }

    :root[data-app-theme="light"] .home-news-card{
      background:
        radial-gradient(circle at top right, rgba(var(--accent-rgb),.08), transparent 20%),
        linear-gradient(135deg, rgba(252,248,242,.96), rgba(246,240,233,.96)) !important;
    }

    :root[data-app-theme="light"] .home-hero-actions .btn.primary{
      background: linear-gradient(135deg, var(--accent), var(--accent2)) !important;
      border-color: transparent !important;
      color: #FFFFFF !important;
      box-shadow: 0 18px 34px color-mix(in srgb, var(--accent2) 28%, transparent) !important;
    }

    :root[data-app-theme="light"] .home-hero-actions .btn.primary:hover{
      transform: translateY(-1px);
      box-shadow: 0 22px 40px color-mix(in srgb, var(--accent2) 34%, transparent) !important;
    }

    :root[data-app-theme="light"] .mobile-footer{
      left: 26px !important;
      right: 26px !important;
      bottom: 18px !important;
      border-radius: 34px !important;
      border: 1px solid rgba(23,28,43,.08) !important;
      background: rgba(250,245,238,.82) !important;
      backdrop-filter: blur(28px) saturate(1.2) !important;
      box-shadow: 0 24px 64px rgba(23,28,43,.14) !important;
    }

    :root[data-app-theme="light"] .mobile-footer-inner{
      max-width: 920px !important;
      padding: 14px 18px 16px 18px !important;
      gap: 12px !important;
    }

    :root[data-app-theme="light"] .mobile-tab{
      min-height: 72px !important;
      border-radius: 22px !important;
      color: #6B7280 !important;
      background: transparent !important;
      border: 1px solid transparent !important;
    }

    :root[data-app-theme="light"] .mobile-tab .ico-wrap{
      width: 42px !important;
      height: 42px !important;
      border-radius: 16px !important;
      background: rgba(17,24,39,.04) !important;
    }

    :root[data-app-theme="light"] .mobile-tab:hover{
      color: #111827 !important;
      background: color-mix(in srgb, var(--accent2) 6%, transparent) !important;
      border-color: color-mix(in srgb, var(--accent2) 14%, transparent) !important;
    }

    :root[data-app-theme="light"] .mobile-tab.is-active{
      background: rgba(255,255,255,.7) !important;
      border-color: color-mix(in srgb, var(--accent2) 16%, transparent) !important;
      color: #171c2b !important;
      box-shadow: 0 12px 24px color-mix(in srgb, var(--accent2) 16%, transparent) !important;
    }

    :root[data-app-theme="light"] .mobile-tab.is-active .ico-wrap{
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent2) 18%, white), color-mix(in srgb, var(--accent) 12%, white)) !important;
      color: var(--accent2) !important;
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

    .shop-stat-pill.is-green,
    .shop-tag.is-green,
    .live-tag.is-green,
    .live-validation,
    .swipe-notif-note.is-green,
    .swipe-overlay-tag.is-like,
    .swipe-badge.is-green,
    .swipe-status,
    .search-playlist-tag.is-green,
    .chat-tag.is-green,
    .chat-attachment-btn.is-green{
      border-color: rgba(var(--accent2-rgb), .22) !important;
      background: rgba(var(--accent2-rgb), .12) !important;
      color: color-mix(in srgb, var(--accent2) 70%, white) !important;
    }

    .library-notif-btn,
    .search-chip.is-active-source,
    .search-chip.is-active-type,
    .search-pill-btn.is-primary,
    .chat-bubble-row.is-me .chat-bubble-card,
    .live-btn.is-emerald{
      background: var(--accent2) !important;
      border-color: var(--accent2) !important;
      color: var(--accent-contrast, #04130d) !important;
    }

    .library-icon-btn.is-favorite,
    .chat-context-score,
    #swipeScoreStatus{
      color: var(--accent) !important;
    }

    .search-live-pill::before,
    .search-notif-dot{
      background: var(--accent2) !important;
      box-shadow: 0 0 0 4px rgba(var(--accent2-rgb), .12) !important;
    }

    .shop-brand-icon,
    .library-brand-icon,
    .chat-brand-icon,
    .search-brand-icon{
      background: rgba(var(--accent2-rgb), .15) !important;
      color: var(--accent) !important;
    }

    .shop-kicker,
    .library-kicker,
    .chat-redesign-kicker,
    .search-kicker,
    .eyebrow{
      color: var(--accent) !important;
    }

    .shop-progress > div,
    .library-progress > div{
      background: var(--accent2) !important;
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
