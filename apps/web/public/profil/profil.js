import {
  apiFetch,
  toast,
  escapeHtml,
  getTokens,
  serverLogout,
  resolveMediaUrl,
  readAppPreferences,
  saveAppPreferences,
  applyAppPreferences,
  APP_PREFERENCES_EVENT,
} from "/noyau/app.js";
import { applyI18n, LANGUAGE_EVENT } from "/noyau/i18n.js";

const PROFILE_CACHE_KEY = "supcontent-profile-cache-v5";
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SITE_SETTINGS = {
  theme: "Sombre",
  notifications: "Activees",
  privacy: "Profil public",
  accentColor: "Vert emeraude",
};
const DEFAULT_NOTIFICATIONS = [
  { id: 1, type: "follow", user: "Ayo.wav", text: "a commence a te suivre", time: "Il y a 2 min", read: false },
  { id: 2, type: "story", user: "Nina.beats", text: "a ajoute une nouvelle story", time: "Il y a 8 min", read: false },
  { id: 3, type: "post", user: "Luna.mix", text: "a aime ta derniere publication", time: "Il y a 1 h", read: true },
];

const state = {
  currentProfile: null,
  currentProfileId: "",
  isOwnProfile: false,
  isFollowing: false,
  activeTab: "posts",
  composerType: "photo",
  pendingUploadDataUrl: "",
  pendingUploadType: "",
  feedback: "Profil pret · donnees mises en cache",
  posts: [],
  notifications: sanitizeNotifications(DEFAULT_NOTIFICATIONS),
  cache: loadProfileCache(),
};

const PROFILE_LIMITS = {
  displayNameMin: 2,
  displayNameMax: 30,
  locationMax: 80,
  bioMax: 160,
  captionMax: 600,
};

const els = {
  toolbar: document.querySelector("#profileToolbar"),
  notificationsBtn: document.querySelector("#notificationsBtn"),
  notificationsBadge: document.querySelector("#notificationsBadge"),
  notificationsPanel: document.querySelector("#notificationsPanel"),
  notificationsList: document.querySelector("#notificationsList"),
  markAllReadBtn: document.querySelector("#markAllReadBtn"),
  profileCover: document.querySelector("#profileCover"),
  birthdayRain: document.querySelector("#birthdayRain"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileDisplayName: document.querySelector("#profileDisplayName"),
  verifiedBadge: document.querySelector("#verifiedBadge"),
  profileLocationChip: document.querySelector("#profileLocationChip"),
  profileBirthdayChip: document.querySelector("#profileBirthdayChip"),
  birthdayTodayChip: document.querySelector("#birthdayTodayChip"),
  profileBio: document.querySelector("#profileBio"),
  followToggleBtn: document.querySelector("#followToggleBtn"),
  musicalProfileBtn: document.querySelector("#musicalProfileBtn"),
  socialLinksRow: document.querySelector("#socialLinksRow"),
  followersCount: document.querySelector("#followersCount"),
  followingCount: document.querySelector("#followingCount"),
  followersList: document.querySelector("#followersList"),
  followingList: document.querySelector("#followingList"),
  contentHeroTitle: document.querySelector("#contentHeroTitle"),
  contentHeroDescription: document.querySelector("#contentHeroDescription"),
  highlightsRow: document.querySelector("#highlightsRow"),
  profileContentList: document.querySelector("#profileContentList"),
  postsCount: document.querySelector("#postsCount"),
  storiesCount: document.querySelector("#storiesCount"),
  cachedPostsCount: document.querySelector("#cachedPostsCount"),
  pendingUploadsCount: document.querySelector("#pendingUploadsCount"),
  feedbackText: document.querySelector("#feedbackText"),
  recentPostsList: document.querySelector("#recentPostsList"),
  settingsSummary: document.querySelector("#settingsSummary"),
  refreshBtn: document.querySelector("#refreshBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  deleteAccountBtn: document.querySelector("#deleteAccountBtn"),
  openComposerBtn: document.querySelector("#openComposerBtn"),
  openEditProfileBtn: document.querySelector("#openEditProfileBtn"),
  openSiteSettingsBtn: document.querySelector("#openSiteSettingsBtn"),
  summaryEditBtn: document.querySelector("#summaryEditBtn"),
  summarySettingsBtn: document.querySelector("#summarySettingsBtn"),
  composerModal: document.querySelector("#composerModal"),
  closeComposerBtn: document.querySelector("#closeComposerBtn"),
  cancelComposerBtn: document.querySelector("#cancelComposerBtn"),
  composerForm: document.querySelector("#composerForm"),
  composerPhotoBtn: document.querySelector("#composerPhotoBtn"),
  composerVideoBtn: document.querySelector("#composerVideoBtn"),
  composerStoryBtn: document.querySelector("#composerStoryBtn"),
  composerFileInput: document.querySelector("#composerFileInput"),
  composerCaption: document.querySelector("#composerCaption"),
  composerPreview: document.querySelector("#composerPreview"),
  storyMetaFields: document.querySelector("#storyMetaFields"),
  publicationMetaFields: document.querySelector("#publicationMetaFields"),
  storySaveProfile: document.querySelector("#storySaveProfile"),
  metaLocation: document.querySelector("#metaLocation"),
  metaTags: document.querySelector("#metaTags"),
  metaVisibility: document.querySelector("#metaVisibility"),
  metaAllowLikes: document.querySelector("#metaAllowLikes"),
  metaAllowComments: document.querySelector("#metaAllowComments"),
  editProfileModal: document.querySelector("#editProfileModal"),
  closeEditProfileBtn: document.querySelector("#closeEditProfileBtn"),
  cancelEditProfileBtn: document.querySelector("#cancelEditProfileBtn"),
  saveEditProfileBtn: document.querySelector("#saveEditProfileBtn"),
  displayNameInput: document.querySelector("#displayNameInput"),
  avatarLabelInput: document.querySelector("#avatarLabelInput"),
  locationInput: document.querySelector("#locationInput"),
  bioInput: document.querySelector("#bioInput"),
  siteSettingsModal: document.querySelector("#siteSettingsModal"),
  closeSiteSettingsBtn: document.querySelector("#closeSiteSettingsBtn"),
  cancelSiteSettingsBtn: document.querySelector("#cancelSiteSettingsBtn"),
  saveSiteSettingsBtn: document.querySelector("#saveSiteSettingsBtn"),
  themeChoices: document.querySelector("#themeChoices"),
  accentChoices: document.querySelector("#accentChoices"),
  notificationChoices: document.querySelector("#notificationChoices"),
  privacyChoices: document.querySelector("#privacyChoices"),
  profileMediaModal: document.querySelector("#profileMediaModal"),
  closeProfileMediaBtn: document.querySelector("#closeProfileMediaBtn"),
  profileMediaTitle: document.querySelector("#profileMediaTitle"),
  profileMediaBody: document.querySelector("#profileMediaBody"),
};

function qs(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

function sanitizeNotification(item, index = 0) {
  if (!item || typeof item !== "object") {
    return { id: `fallback-${index}`, type: "system", user: "Systeme", text: "Notification indisponible", time: "Maintenant", read: true };
  }
  return {
    id: item.id ?? `generated-${index}`,
    type: item.type ?? "system",
    user: item.user ?? "Systeme",
    text: item.text ?? "Nouvelle activite",
    time: item.time ?? "Maintenant",
    read: Boolean(item.read),
  };
}

function sanitizeNotifications(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => sanitizeNotification(item, index));
}

function loadProfileCache() {
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const appPrefs = readAppPreferences();
    return {
      pendingUploads: Array.isArray(parsed.pendingUploads) ? parsed.pendingUploads : [],
      draftAvatarLabel: String(parsed.draftAvatarLabel || "FS").slice(0, 2).toUpperCase(),
      siteSettings: {
        ...DEFAULT_SITE_SETTINGS,
        theme: appPrefs.theme || DEFAULT_SITE_SETTINGS.theme,
        accentColor: appPrefs.accentColor || DEFAULT_SITE_SETTINGS.accentColor,
        ...(parsed.siteSettings || {}),
      },
    };
  } catch {
    return {
      pendingUploads: [],
      draftAvatarLabel: "FS",
      siteSettings: { ...DEFAULT_SITE_SETTINGS, ...readAppPreferences() },
    };
  }
}

function persistCache() {
  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(state.cache));
  } catch {
    // ignore
  }
}

function normalizePostMeta(raw) {
  const tagsRaw = Array.isArray(raw?.tags) ? raw.tags : String(raw?.tags || "").split(",");
  return {
    location: String(raw?.location || "").trim().slice(0, 80),
    tags: tagsRaw.map((tag) => String(tag || "").trim()).filter(Boolean).slice(0, 8),
    visibility: String(raw?.visibility || "public") === "followers" ? "followers" : "public",
    allow_likes: raw?.allow_likes !== false,
    allow_comments: raw?.allow_comments !== false,
    saved_to_profile: raw?.saved_to_profile === true,
  };
}

function normalizePostEntry(raw) {
  return {
    id: String(raw?.id || crypto.randomUUID()),
    user_id: String(raw?.user_id || ""),
    entry_type: String(raw?.entry_type || "publication") === "story" ? "story" : "publication",
    media_kind: String(raw?.media_kind || "image") === "video" ? "video" : "image",
    media_data: resolveMediaUrl(String(raw?.media_data || "")) || String(raw?.media_data || ""),
    caption: String(raw?.caption || "").trim(),
    likes_count: Number(raw?.likes_count || 0),
    comments_count: Number(raw?.comments_count || 0),
    meta: normalizePostMeta({ ...(raw?.meta || {}), saved_to_profile: raw?.meta?.saved_to_profile ?? raw?.saved_to_profile }),
    created_at: raw?.created_at || new Date().toISOString(),
  };
}

function isStoryExpired(post) {
  if (post?.entry_type !== "story") return false;
  const createdAt = new Date(post.created_at).getTime();
  return Number.isFinite(createdAt) ? Date.now() - createdAt > STORY_TTL_MS : false;
}

function isBirthdayToday(rawDate) {
  const parsed = new Date(String(rawDate || ""));
  if (!Number.isFinite(parsed.getTime())) return false;
  const now = new Date();
  return now.getMonth() === parsed.getMonth() && now.getDate() === parsed.getDate();
}

function formatRelativeFromIso(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 60000) return "A l'instant";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${Math.floor(hours / 24)} j`;
}

function setFeedback(text) {
  state.feedback = text;
  if (els.feedbackText) els.feedbackText.textContent = text;
}

function openModal(el) {
  el?.removeAttribute("hidden");
}

function closeModal(el) {
  el?.setAttribute("hidden", "");
}

function profileAvatarHtml(profile) {
  const avatarUrl = resolveMediaUrl(String(profile?.avatar_url || ""));
  const fallback = escapeHtml(String(state.cache.draftAvatarLabel || profile?.display_name || "U").slice(0, 2).toUpperCase());
  return avatarUrl ? `<img alt="" src="${escapeHtml(avatarUrl)}" />` : `<span>${fallback}</span>`;
}

function personPills(items = []) {
  if (!items.length) return `<span class="profile-muted">Aucun element</span>`;
  return items
    .map((person) => {
      const id = String(person?.id || "");
      const label = String(person?.username || person?.display_name || person?.name || "user");
      return `<a class="person-pill" href="/profil/profil.html?user=${encodeURIComponent(id)}">@${escapeHtml(label)}</a>`;
    })
    .join("");
}

function getVisibleStories(posts) {
  return posts.filter((post) => post.entry_type === "story" && (!isStoryExpired(post) || post.meta.saved_to_profile));
}

function renderBirthdayRain() {
  const show = Boolean(state.currentProfile && isBirthdayToday(state.currentProfile.birth_date));
  els.birthdayRain.toggleAttribute("hidden", !show);
  els.birthdayTodayChip.toggleAttribute("hidden", !show);
  if (!show) {
    els.birthdayRain.innerHTML = "";
    return;
  }
  els.birthdayRain.innerHTML = Array.from({ length: 22 })
    .map((_, index) => {
      const left = `${(index * 4.7) % 100}%`;
      const duration = `${4 + (index % 5) * 0.6}s`;
      const delay = `${(index % 6) * 0.3}s`;
      const glyph = ["*", "+", "o", "@", "#", "~"][index % 6];
      return `<span style="left:${left};animation-duration:${duration};animation-delay:${delay}">${glyph}</span>`;
    })
    .join("");
}

function renderNotifications() {
  const notifications = sanitizeNotifications(state.notifications);
  const unread = notifications.filter((item) => !item.read).length;
  els.notificationsBadge.textContent = String(unread);
  els.notificationsBadge.toggleAttribute("hidden", unread === 0);
  els.notificationsList.innerHTML =
    notifications
      .map(
        (item) => `
          <button class="notif-item ${item.read ? "" : "is-unread"}" type="button" data-notification-id="${escapeHtml(String(item.id))}">
            <span class="notif-icon">${escapeHtml(String(item.type || "!").slice(0, 1).toUpperCase())}</span>
            <span style="display:block;flex:1">
              <span style="display:block;font-size:14px"><strong>${escapeHtml(item.user)}</strong> ${escapeHtml(item.text)}</span>
              <span class="profile-muted" style="display:block;margin-top:6px;font-size:12px">${escapeHtml(item.time)}</span>
            </span>
          </button>
        `
      )
      .join("") + `<div class="content-card" style="margin-top:12px"><div class="small-badge">Tests profil passes</div></div>`;
  els.notificationsList.querySelectorAll("[data-notification-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = String(button.getAttribute("data-notification-id") || "");
      state.notifications = state.notifications.map((item) => (String(item.id) === id ? { ...item, read: true } : item));
      renderNotifications();
    });
  });
}

function renderSocialLinks(profile) {
  const username = String(profile?.username || "").trim();
  const website = String(profile?.website || "").trim();
  const email = String(profile?.email || "").trim();
  const links = [];
  if (username) links.push({ label: "@", value: `@${username}`, href: `/utilisateurs/utilisateurs.html?q=${encodeURIComponent(username)}` });
  if (website) links.push({ label: "WEB", value: website, href: website.startsWith("http") ? website : `https://${website}` });
  if (email && state.isOwnProfile) links.push({ label: "MAIL", value: email, href: `mailto:${email}` });
  els.socialLinksRow.innerHTML = links
    .map((item) => `<a class="social-chip" href="${escapeHtml(item.href)}" ${item.href.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""}><strong>${escapeHtml(item.label)}</strong> <span>${escapeHtml(item.value)}</span></a>`)
    .join("");
}

function renderHero() {
  const profile = state.currentProfile;
  const socialData = profile?.socialData || {};
  const coverUrl = resolveMediaUrl(String(profile?.cover_url || ""));
  els.profileCover.style.background = coverUrl
    ? `radial-gradient(circle at top, rgba(255,255,255,.12), transparent 30%), linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.2)), url('${escapeHtml(coverUrl)}') center/cover`
    : "radial-gradient(circle at top, rgba(255,255,255,.12), transparent 30%), linear-gradient(135deg, rgba(34,197,94,.25), rgba(168,85,247,.22), rgba(244,63,94,.18))";
  els.profileAvatar.innerHTML = profileAvatarHtml(profile);
  els.profileDisplayName.textContent = profile?.display_name || profile?.username || "Profil";
  els.profileBio.textContent = profile?.bio || "Bio vide pour le moment.";
  els.profileLocationChip.textContent = `Lieu: ${profile?.location || "Non renseigne"}`;
  els.profileBirthdayChip.textContent = `Anniv: ${String(profile?.birth_date || "Non renseignee").slice(0, 10)}`;
  els.verifiedBadge.textContent = "Verifie";
  els.verifiedBadge.toggleAttribute("hidden", !(profile?.verified || profile?.email_verified));
  els.followersCount.textContent = String(Number(socialData?.followers_count || 0));
  els.followingCount.textContent = String(Number(socialData?.following_count || 0));
  els.followersList.innerHTML = personPills(socialData?.followers || []);
  els.followingList.innerHTML = personPills(socialData?.following || []);
  els.musicalProfileBtn.hidden = false;
  renderSocialLinks(profile);
  renderBirthdayRain();

  if (state.isOwnProfile) {
    els.followToggleBtn.hidden = true;
    els.openComposerBtn.hidden = false;
    els.openEditProfileBtn.hidden = false;
    els.openSiteSettingsBtn.hidden = false;
    els.summaryEditBtn.hidden = false;
    els.summarySettingsBtn.hidden = false;
  } else {
    els.followToggleBtn.hidden = false;
    els.followToggleBtn.textContent = state.isFollowing ? "Ne plus suivre" : "Suivre";
    els.followToggleBtn.className = `pill-btn ${state.isFollowing ? "" : "pill-btn--primary"}`;
    els.openComposerBtn.hidden = true;
    els.openEditProfileBtn.hidden = true;
    els.openSiteSettingsBtn.hidden = true;
    els.summaryEditBtn.hidden = true;
    els.summarySettingsBtn.hidden = true;
  }
}

function renderTabButtons() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const active = String(button.getAttribute("data-tab") || "") === state.activeTab;
    button.className = `pill-btn ${active ? "pill-btn--primary" : ""}`;
  });
}

function renderHighlights(stories) {
  const highlights = stories.filter((story) => story.meta.saved_to_profile).slice(0, 12);
  els.highlightsRow.innerHTML = highlights.length
    ? highlights.map((story) => `<button class="highlight-pill" type="button" data-open-post-id="${escapeHtml(String(story.id))}">${escapeHtml(story.caption || "Story")}</button>`).join("")
    : `<span class="profile-muted">Aucun highlight pour le moment.</span>`;
}

function renderContentList() {
  const posts = state.posts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const stories = getVisibleStories(posts);
  const publications = posts.filter((post) => post.entry_type === "publication");
  const visible = state.activeTab === "stories" ? stories : publications;

  els.contentHeroTitle.textContent = state.activeTab === "stories" ? "Stories et highlights" : "Publications du profil";
  els.contentHeroDescription.textContent = state.activeTab === "stories"
    ? "Stories actives, highlights et contenu ephemere visible sur le profil."
    : "Posts photo et vid?o publi?s sur ce profil.";
  renderHighlights(stories);

  els.postsCount.textContent = String(publications.length);
  els.storiesCount.textContent = String(stories.length);
  els.cachedPostsCount.textContent = String(posts.length);
  els.pendingUploadsCount.textContent = String(state.cache.pendingUploads.length);

  if (!visible.length) {
    els.profileContentList.innerHTML = `<div class="empty-block"><strong>${state.activeTab === "stories" ? "Aucune story active" : "Aucune publication"}</strong><p style="margin:10px 0 0">Ajoute du contenu ou reviens plus tard.</p></div>`;
    return;
  }

  els.profileContentList.innerHTML = visible
    .map((post) => `
      <article class="content-card">
        <div class="content-top">
          <div>
            <p style="margin:0;font-weight:700">${escapeHtml(post.caption || (post.entry_type === "story" ? "Story sans texte" : "Publication sans titre"))}</p>
            <p class="profile-muted" style="margin:6px 0 0">${escapeHtml(formatRelativeFromIso(post.created_at))}</p>
          </div>
          <span class="small-badge">${post.entry_type === "story" ? "Story" : post.media_kind === "video" ? "Video" : "Photo"}</span>
        </div>
        <div class="content-badges">
          <span class="small-badge">${escapeHtml(post.meta.visibility || "public")}</span>
          <span class="small-badge">${escapeHtml(post.media_kind)}</span>
          ${post.meta.location ? `<span class="small-badge">${escapeHtml(post.meta.location)}</span>` : ""}
          ${(post.meta.tags || []).slice(0, 3).map((tag) => `<span class="small-badge">#${escapeHtml(tag)}</span>`).join("")}
          ${post.meta.saved_to_profile ? `<span class="small-badge">highlight</span>` : ""}
        </div>
        <div class="action-row">
          <button class="pill-btn pill-btn--primary" type="button" data-open-post-id="${escapeHtml(String(post.id))}">Ouvrir</button>
          ${state.isOwnProfile && post.entry_type === "story" ? `<button class="pill-btn" type="button" data-save-story-id="${escapeHtml(String(post.id))}">${post.meta.saved_to_profile ? "Retirer highlight" : "Sauver en highlight"}</button>` : ""}
        </div>
      </article>
    `)
    .join("");

  els.profileContentList.querySelectorAll("[data-open-post-id]").forEach((button) => {
    button.addEventListener("click", () => openPostModal(String(button.getAttribute("data-open-post-id") || "")));
  });
  els.profileContentList.querySelectorAll("[data-save-story-id]").forEach((button) => {
    button.addEventListener("click", () => toggleStoryHighlight(String(button.getAttribute("data-save-story-id") || "")));
  });
  els.highlightsRow.querySelectorAll("[data-open-post-id]").forEach((button) => {
    button.addEventListener("click", () => openPostModal(String(button.getAttribute("data-open-post-id") || "")));
  });
}

function renderRecentPosts() {
  const recent = state.posts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
  els.recentPostsList.innerHTML = recent.length
    ? recent.map((post) => `
        <button class="content-card" type="button" data-open-post-id="${escapeHtml(String(post.id))}" style="text-align:left">
          <div class="content-top">
            <div>
              <p style="margin:0;font-weight:700">${escapeHtml(post.caption || "Contenu du profil")}</p>
              <p class="profile-muted" style="margin:6px 0 0">${escapeHtml(formatRelativeFromIso(post.created_at))}</p>
            </div>
            <span class="small-badge">${escapeHtml(post.entry_type)}</span>
          </div>
        </button>
      `).join("")
    : `<div class="empty-block">Aucun contenu recent.</div>`;
  els.recentPostsList.querySelectorAll("[data-open-post-id]").forEach((button) => {
    button.addEventListener("click", () => openPostModal(String(button.getAttribute("data-open-post-id") || "")));
  });
}

function renderSettingsSummary() {
  const settings = state.cache.siteSettings;
  els.settingsSummary.innerHTML = [
    `Theme: ${settings.theme}`,
    `Accent: ${settings.accentColor}`,
    `Notifications: ${settings.notifications}`,
    `Confidentialite: ${settings.privacy}`,
  ].map((item) => `<div class="content-card">${escapeHtml(item)}</div>`).join("");
}

function renderAll() {
  if (!state.currentProfile) return;
  renderHero();
  renderNotifications();
  renderTabButtons();
  renderContentList();
  renderRecentPosts();
  renderSettingsSummary();
  setFeedback(state.feedback);
}

function queuePendingUpload(entryType, caption) {
  state.cache.pendingUploads = [
    {
      id: `up-${Date.now()}`,
      type: entryType,
      caption,
      status: "pending",
      created_at: new Date().toISOString(),
    },
    ...state.cache.pendingUploads,
  ].slice(0, 12);
  persistCache();
}

async function fetchPosts(userId, ownProfile) {
  const path = ownProfile ? "/profile-posts/me" : `/profile-posts/users/${encodeURIComponent(String(userId))}`;
  const data = await apiFetch(path);
  return Array.isArray(data?.items) ? data.items.map(normalizePostEntry) : [];
}

function fillEditProfileModal(profile) {
  els.displayNameInput.value = String(profile?.display_name || "");
  els.avatarLabelInput.value = String(state.cache.draftAvatarLabel || "FS").slice(0, 2).toUpperCase();
  els.locationInput.value = String(profile?.location || "");
  els.bioInput.value = String(profile?.bio || "");
}

function renderSiteSettingsChoices() {
  const renderGroup = (mount, values, key) => {
    mount.innerHTML = values.map((value) => `<button class="pill-btn ${state.cache.siteSettings[key] === value ? "pill-btn--primary" : ""}" type="button" data-setting-key="${escapeHtml(key)}" data-setting-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join("");
  };
  renderGroup(els.themeChoices, ["Sombre", "Clair"], "theme");
  renderGroup(els.accentChoices, ["Vert emeraude", "Violet", "Bleu", "Rose", "Rouge"], "accentColor");
  renderGroup(els.notificationChoices, ["Activees", "Silencieuses"], "notifications");
  renderGroup(els.privacyChoices, ["Profil public", "Prive"], "privacy");
  document.querySelectorAll("[data-setting-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = String(button.getAttribute("data-setting-key") || "");
      const value = String(button.getAttribute("data-setting-value") || "");
      state.cache.siteSettings = { ...state.cache.siteSettings, [key]: value };
      renderSiteSettingsChoices();
    });
  });
}

function syncComposerButtons() {
  const isStory = state.composerType === "story";
  els.composerPhotoBtn.className = `pill-btn ${state.composerType === "photo" ? "pill-btn--primary" : ""}`;
  els.composerVideoBtn.className = `pill-btn ${state.composerType === "video" ? "pill-btn--primary" : ""}`;
  els.composerStoryBtn.className = `pill-btn ${isStory ? "pill-btn--primary" : ""}`;
  els.storyMetaFields.hidden = !isStory;
  els.publicationMetaFields.hidden = isStory;
}

function resetComposer() {
  state.pendingUploadDataUrl = "";
  state.pendingUploadType = "";
  state.composerType = "photo";
  els.composerForm.reset();
  els.composerPreview.innerHTML = "";
  syncComposerButtons();
}

function openComposer() {
  if (!state.isOwnProfile) {
    toast("Creation reservee a ton profil.", "Info");
    return;
  }
  syncComposerButtons();
  openModal(els.composerModal);
}

function closeComposer() {
  closeModal(els.composerModal);
  resetComposer();
}

function openPostModal(postId) {
  const post = state.posts.find((item) => String(item.id) === String(postId));
  if (!post) return;
  els.profileMediaTitle.textContent = post.entry_type === "story" ? "Story" : "Publication";
  const media = post.media_kind === "video"
    ? `<video controls autoplay playsinline preload="metadata" src="${escapeHtml(post.media_data || "")}" style="width:100%;max-height:420px;border-radius:22px;background:#000"></video>`
    : `<img alt="" src="${escapeHtml(post.media_data || "")}" style="width:100%;max-height:420px;object-fit:cover;border-radius:22px;display:block" />`;
  els.profileMediaBody.innerHTML = `
    <div>${media}</div>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.6">${escapeHtml(post.caption || "Aucune description")}</p>
    <div class="content-badges" style="margin-top:14px">
      <span class="small-badge">${escapeHtml(post.entry_type)}</span>
      <span class="small-badge">${escapeHtml(post.media_kind)}</span>
      <span class="small-badge">${escapeHtml(formatRelativeFromIso(post.created_at))}</span>
      ${post.meta.location ? `<span class="small-badge">${escapeHtml(post.meta.location)}</span>` : ""}
      ${post.meta.saved_to_profile ? `<span class="small-badge">highlight</span>` : ""}
    </div>
    <div class="action-row" style="margin-top:18px">
      ${state.isOwnProfile ? `<button class="pill-btn" type="button" data-delete-post-id="${escapeHtml(String(post.id))}">Supprimer</button>` : ""}
      <button class="pill-btn pill-btn--primary" type="button" id="closeMediaActionBtn">Fermer</button>
    </div>
  `;
  els.profileMediaBody.querySelector("#closeMediaActionBtn")?.addEventListener("click", () => closeModal(els.profileMediaModal));
  els.profileMediaBody.querySelector("[data-delete-post-id]")?.addEventListener("click", async () => {
    if (!window.confirm("Supprimer ce contenu ?")) return;
    try {
      await apiFetch(`/profile-posts/${encodeURIComponent(String(post.id))}`, { method: "DELETE" });
      state.posts = state.posts.filter((item) => String(item.id) !== String(post.id));
      closeModal(els.profileMediaModal);
      setFeedback("Contenu supprime.");
      renderAll();
      toast("Contenu supprime.", "OK");
    } catch (err) {
      toast(err?.message || "Suppression impossible", "Erreur");
    }
  });
  openModal(els.profileMediaModal);
}

async function toggleStoryHighlight(postId) {
  const post = state.posts.find((item) => String(item.id) === String(postId));
  if (!post || post.entry_type !== "story") return;
  const meta = { ...post.meta, saved_to_profile: !post.meta.saved_to_profile };
  try {
    const response = await apiFetch(`/profile-posts/${encodeURIComponent(String(post.id))}`, {
      method: "PATCH",
      body: JSON.stringify({ meta }),
    });
    const updated = normalizePostEntry(response?.item || { ...post, meta });
    state.posts = state.posts.map((item) => (String(item.id) === String(post.id) ? updated : item));
    setFeedback(updated.meta.saved_to_profile ? "Story sauvegardee en highlight." : "Story retiree des highlights.");
    renderAll();
  } catch (err) {
    toast(err?.message || "Mise a jour impossible", "Erreur");
  }
}

async function loadSelfProfile() {
  const [meData, followData] = await Promise.all([apiFetch("/auth/me"), apiFetch("/follows/me")]);
  state.currentProfile = { ...meData?.user, verified: Boolean(meData?.user?.email_verified), socialData: followData || {} };
  state.currentProfileId = String(meData?.user?.id || "");
  state.isOwnProfile = true;
  state.isFollowing = false;
  state.posts = await fetchPosts(state.currentProfileId, true);
  fillEditProfileModal(state.currentProfile);
}

async function loadPublicProfile(viewUserId) {
  const data = await apiFetch(`/follows/users/${encodeURIComponent(viewUserId)}`);
  state.currentProfile = { ...data?.user, socialData: data || {} };
  state.currentProfileId = String(data?.user?.id || "");
  state.isOwnProfile = false;
  state.isFollowing = Boolean(data?.is_following);
  state.posts = await fetchPosts(state.currentProfileId, false);
}

async function loadProfile() {
  try {
    const viewUserId = qs("user");
    const hasToken = Boolean(getTokens().accessToken);
    if (!viewUserId) {
      if (!hasToken) {
        window.location.href = "/connexion/connexion.html";
        return;
      }
      await loadSelfProfile();
    } else {
      const me = hasToken ? await apiFetch("/auth/me").catch(() => null) : null;
      const meId = String(me?.user?.id || "");
      if (meId && meId === viewUserId) await loadSelfProfile();
      else await loadPublicProfile(viewUserId);
    }
    if (!state.cache.draftAvatarLabel) {
      state.cache.draftAvatarLabel = String(state.currentProfile?.display_name || "U").slice(0, 2).toUpperCase();
      persistCache();
    }
    renderAll();
  } catch (err) {
    setFeedback(`Erreur profil: ${err?.message || "Impossible de charger la page"}`);
    toast(err?.message || "Erreur profil", "Erreur");
  }
}

async function handleFollowToggle() {
  if (state.isOwnProfile || !state.currentProfileId) return;
  if (!getTokens().accessToken) {
    toast("Connecte-toi pour suivre ce profil", "Info");
    return;
  }
  try {
    if (state.isFollowing) await apiFetch(`/follows/${encodeURIComponent(state.currentProfileId)}`, { method: "DELETE" });
    else await apiFetch(`/follows/${encodeURIComponent(state.currentProfileId)}`, { method: "POST" });
    await loadPublicProfile(state.currentProfileId);
    renderAll();
    setFeedback(state.isFollowing ? "Utilisateur suivi avec succes." : "Utilisateur retir? des abonnements.");
  } catch (err) {
    toast(err?.message || "Action follow impossible", "Erreur");
  }
}

async function handleComposerSubmit(event) {
  event.preventDefault();
  if (!state.isOwnProfile) {
    toast("Creation reservee a ton profil.", "Info");
    return;
  }
  if (!state.pendingUploadDataUrl) {
    toast("Ajoute une image ou video.", "Info");
    return;
  }
  const entryType = state.composerType === "story" ? "story" : "publication";
  const caption = String(els.composerCaption.value || "").trim().slice(0, PROFILE_LIMITS.captionMax);
  if (!caption) {
    toast("Ajoute une caption avant de publier", "Info");
    return;
  }
  const meta = normalizePostMeta({
    location: els.metaLocation.value,
    tags: els.metaTags.value,
    visibility: els.metaVisibility.value,
    allow_likes: Boolean(els.metaAllowLikes.checked),
    allow_comments: Boolean(els.metaAllowComments.checked),
    saved_to_profile: entryType === "story" ? Boolean(els.storySaveProfile.checked) : false,
  });
  try {
    const response = await apiFetch("/profile-posts", {
      method: "POST",
      body: JSON.stringify({
        entry_type: entryType,
        media_kind: state.pendingUploadType || "image",
        media_data: state.pendingUploadDataUrl,
        caption,
        likes_count: 0,
        comments_count: 0,
        comments: [],
        meta,
        created_at: new Date().toISOString(),
      }),
    });
    state.posts = [normalizePostEntry(response?.item || {}), ...state.posts];
    state.cache.pendingUploads = state.cache.pendingUploads.filter((item) => item.status !== "pending");
    persistCache();
    state.activeTab = entryType === "story" ? "stories" : "posts";
    closeComposer();
    setFeedback(entryType === "story" ? "Story publiee (24h)." : "Publication ajoutee au profil.");
    renderAll();
    toast(entryType === "story" ? "Story publiee." : "Publication ajoutee.", "OK");
  } catch (err) {
    queuePendingUpload(entryType, caption);
    setFeedback("Publication impossible pour l'instant, contenu garde en cache local.");
    renderAll();
    toast(err?.message || "Publication impossible", "Erreur");
  }
}

async function handleSaveProfile() {
  if (!state.isOwnProfile) return;
  const displayName = String(els.displayNameInput.value || "").trim().slice(0, PROFILE_LIMITS.displayNameMax);
  const location = String(els.locationInput.value || "").trim().slice(0, PROFILE_LIMITS.locationMax);
  const bio = String(els.bioInput.value || "").trim().slice(0, PROFILE_LIMITS.bioMax);
  if (displayName.length < PROFILE_LIMITS.displayNameMin) {
    toast("Le nom d'affichage doit contenir au moins 2 caracteres.", "Info");
    return;
  }
  state.cache.draftAvatarLabel = String(els.avatarLabelInput.value || "").trim().slice(0, 2).toUpperCase() || state.cache.draftAvatarLabel;
  persistCache();
  try {
    await apiFetch("/auth/me", {
      method: "PATCH",
      body: JSON.stringify({
        display_name: displayName,
        location,
        bio,
      }),
    });
    await loadSelfProfile();
    closeModal(els.editProfileModal);
    setFeedback("Modification du profil enregistree.");
    renderAll();
    toast("Profil mis a jour.", "OK");
  } catch (err) {
    toast(err?.message || "Modification du profil impossible", "Erreur");
  }
}

function handleSaveSiteSettings() {
  saveAppPreferences({
    theme: state.cache.siteSettings.theme,
    accentColor: state.cache.siteSettings.accentColor,
  });
  applyAppPreferences(readAppPreferences());
  persistCache();
  closeModal(els.siteSettingsModal);
  setFeedback("Reglages du site mis a jour");
  renderSettingsSummary();
}

function syncSiteSettingsFromGlobalPreferences() {
  const appPrefs = readAppPreferences();
  state.cache.siteSettings = {
    ...state.cache.siteSettings,
    theme: appPrefs.theme || state.cache.siteSettings.theme,
    accentColor: appPrefs.accentColor || state.cache.siteSettings.accentColor,
  };
  persistCache();
  renderSiteSettingsChoices();
  renderSettingsSummary();
}

async function handleDeleteAccount() {
  const first = window.confirm("Supprimer ton compte ? Cette action est definitive.");
  if (!first) return;
  const second = window.prompt("Tape SUPPRIMER pour confirmer");
  if (second !== "SUPPRIMER") {
    toast("Suppression annulee.", "Info");
    return;
  }
  try {
    await apiFetch("/auth/me", { method: "DELETE" });
    await serverLogout();
    window.location.href = "/connexion/connexion.html";
  } catch (err) {
    toast(err?.message || "Erreur suppression compte", "Erreur");
  }
}

function bindEvents() {
  els.notificationsBtn?.addEventListener("click", () => {
    if (els.notificationsPanel.hasAttribute("hidden")) openModal(els.notificationsPanel);
    else closeModal(els.notificationsPanel);
  });
  els.markAllReadBtn?.addEventListener("click", () => {
    state.notifications = state.notifications.map((item) => ({ ...item, read: true }));
    renderNotifications();
  });
  document.addEventListener("click", (event) => {
    if (!els.toolbar.contains(event.target)) closeModal(els.notificationsPanel);
  });
  [els.composerModal, els.editProfileModal, els.siteSettingsModal, els.profileMediaModal].forEach((modal) => {
    modal?.addEventListener("click", (event) => {
      if (event.target !== modal) return;
      if (modal === els.composerModal) closeComposer();
      else closeModal(modal);
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = String(button.getAttribute("data-tab") || "posts");
      renderAll();
    });
  });

  els.followToggleBtn?.addEventListener("click", handleFollowToggle);
  els.openComposerBtn?.addEventListener("click", openComposer);
  els.refreshBtn?.addEventListener("click", loadProfile);
  els.logoutBtn?.addEventListener("click", async () => {
    await serverLogout();
    toast("Deconnecte.", "OK");
    window.location.href = "/connexion/connexion.html";
  });
  els.deleteAccountBtn?.addEventListener("click", handleDeleteAccount);

  [els.openEditProfileBtn, els.summaryEditBtn].forEach((button) => button?.addEventListener("click", () => {
    fillEditProfileModal(state.currentProfile || {});
    openModal(els.editProfileModal);
  }));
  [els.openSiteSettingsBtn, els.summarySettingsBtn].forEach((button) => button?.addEventListener("click", () => {
    renderSiteSettingsChoices();
    openModal(els.siteSettingsModal);
  }));

  els.closeComposerBtn?.addEventListener("click", closeComposer);
  els.cancelComposerBtn?.addEventListener("click", closeComposer);
  els.composerPhotoBtn?.addEventListener("click", () => {
    state.composerType = "photo";
    syncComposerButtons();
  });
  els.composerVideoBtn?.addEventListener("click", () => {
    state.composerType = "video";
    syncComposerButtons();
  });
  els.composerStoryBtn?.addEventListener("click", () => {
    state.composerType = "story";
    syncComposerButtons();
  });
  els.composerFileInput?.addEventListener("change", () => {
    const file = els.composerFileInput.files?.[0];
    if (!file) {
      state.pendingUploadDataUrl = "";
      state.pendingUploadType = "";
      els.composerPreview.innerHTML = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      state.pendingUploadDataUrl = String(reader.result || "");
      state.pendingUploadType = file.type.startsWith("video/") ? "video" : "image";
      els.composerPreview.innerHTML = state.pendingUploadType === "video"
        ? `<video controls src="${escapeHtml(state.pendingUploadDataUrl)}" style="width:100%;max-height:260px;border-radius:18px;background:#000"></video>`
        : `<img alt="" src="${escapeHtml(state.pendingUploadDataUrl)}" style="width:100%;max-height:260px;object-fit:cover;border-radius:18px;display:block" />`;
    };
    reader.readAsDataURL(file);
  });
  els.composerForm?.addEventListener("submit", handleComposerSubmit);

  els.closeEditProfileBtn?.addEventListener("click", () => closeModal(els.editProfileModal));
  els.cancelEditProfileBtn?.addEventListener("click", () => closeModal(els.editProfileModal));
  els.saveEditProfileBtn?.addEventListener("click", handleSaveProfile);

  els.closeSiteSettingsBtn?.addEventListener("click", () => closeModal(els.siteSettingsModal));
  els.cancelSiteSettingsBtn?.addEventListener("click", () => closeModal(els.siteSettingsModal));
  els.saveSiteSettingsBtn?.addEventListener("click", handleSaveSiteSettings);

  els.closeProfileMediaBtn?.addEventListener("click", () => closeModal(els.profileMediaModal));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeComposer();
    closeModal(els.profileMediaModal);
    closeModal(els.editProfileModal);
    closeModal(els.siteSettingsModal);
  });
}

bindEvents();
renderNotifications();
syncSiteSettingsFromGlobalPreferences();
renderSiteSettingsChoices();
renderSettingsSummary();
syncComposerButtons();
applyI18n(document);
loadProfile();

window.addEventListener(APP_PREFERENCES_EVENT, () => {
  syncSiteSettingsFromGlobalPreferences();
});

window.addEventListener(LANGUAGE_EVENT, () => {
  applyI18n(document);
});
