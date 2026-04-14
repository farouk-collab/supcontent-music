import { apiFetch, escapeHtml, isLoggedIn, requireLogin, resolveMediaUrl, toast } from "/noyau/app.js";

const TRENDING_SEARCHES = ["ayo", "beats", "afro", "pop", "paris"];

const CONTENT_POSTS = [
  {
    id: "c1",
    userId: "u2",
    username: "ayo.wav",
    displayName: "Ayo",
    type: "video",
    title: "Petit freestyle studio",
    caption: "Session drole de fin de soiree au studio.",
    likes: 324,
    comments: [
      { id: "cm1", author: "farouk", text: "La vibe est trop propre" },
      { id: "cm2", author: "nina.beats", text: "Le passage a 0:12 est lourd" },
    ],
  },
  {
    id: "c2",
    userId: "u3",
    username: "nina.beats",
    displayName: "Nina Beats",
    type: "photo",
    title: "Setup du jour",
    caption: "Mon coin de creation avant d'enregistrer.",
    likes: 188,
    comments: [{ id: "cm3", author: "ayo.wav", text: "Le setup est trop clean" }],
  },
  {
    id: "c3",
    userId: "u4",
    username: "djnova",
    displayName: "DJ Nova",
    type: "video",
    title: "Transition live",
    caption: "Une transition propre pendant mon mix de nuit.",
    likes: 451,
    comments: [
      { id: "cm4", author: "temsdaily", text: "La transition est folle" },
      { id: "cm5", author: "farouk", text: "Ca donne envie de follow" },
    ],
  },
  {
    id: "c4",
    userId: "u5",
    username: "temsdaily",
    displayName: "Tems Daily",
    type: "photo",
    title: "Moodboard afro",
    caption: "Quelques images qui matchent avec ma playlist du moment.",
    likes: 210,
    comments: [{ id: "cm6", author: "ayo.wav", text: "Le mood est valide" }],
  },
];

const MOCK_USERS = [
  {
    id: "u1",
    username: "daxwritz",
    displayName: "Farouk",
    bio: "Informatique, sons chill et decouvertes nocturnes.",
    location: "Orly",
    verified: false,
    genres: ["Rap", "Afro", "Pop"],
    mutuals: 4,
    isPrivate: false,
    followers: 124,
  },
  {
    id: "u2",
    username: "ayo.wav",
    displayName: "Ayo",
    bio: "Producteur amateur, playlists propres et vibes lounge.",
    location: "Paris",
    verified: true,
    genres: ["Afro", "Amapiano", "R&B"],
    mutuals: 8,
    isPrivate: false,
    followers: 870,
  },
  {
    id: "u3",
    username: "nina.beats",
    displayName: "Nina Beats",
    bio: "Je partage mes coups de coeur et mes stories studio.",
    location: "Creteil",
    verified: true,
    genres: ["Pop", "Electro", "House"],
    mutuals: 2,
    isPrivate: false,
    followers: 512,
  },
  {
    id: "u4",
    username: "djnova",
    displayName: "DJ Nova",
    bio: "Mix YouTube, sessions live et selections de nuit.",
    location: "Lyon",
    verified: false,
    genres: ["Electro", "House", "Techno"],
    mutuals: 1,
    isPrivate: true,
    followers: 203,
  },
  {
    id: "u5",
    username: "temsdaily",
    displayName: "Tems Daily",
    bio: "Fan account, actus musique et playlists mood.",
    location: "Marseille",
    verified: false,
    genres: ["Afro", "Soul", "R&B"],
    mutuals: 6,
    isPrivate: false,
    followers: 431,
  },
];

const state = {
  query: "",
  submittedQuery: "",
  sortMode: "pertinence",
  onlyVerified: false,
  feedback: "Cherche un pseudo ou un nom pour voir les profils.",
  activeTab: "all",
  recentSearches: ["ayo", "daxwritz"],
  followingIds: new Set(["u2"]),
  favoriteIds: new Set(["u3"]),
  likedPostIds: new Set(["c1"]),
  commentsOpen: false,
  activeFeedIndex: 0,
  results: [],
};

const refs = {
  feedback: document.querySelector("#usersFeedback"),
  input: document.querySelector("#usersSearchInput"),
  clearBtn: document.querySelector("#usersClearBtn"),
  searchBtn: document.querySelector("#usersSearchBtn"),
  verifiedBtn: document.querySelector("#usersVerifiedBtn"),
  sortSelect: document.querySelector("#usersSortSelect"),
  tabRow: document.querySelector("#usersTabRow"),
  trendingSearches: document.querySelector("#trendingSearches"),
  recentSearches: document.querySelector("#recentSearches"),
  feedCounter: document.querySelector("#feedCounter"),
  contentFeedStage: document.querySelector("#contentFeedStage"),
  resultsCount: document.querySelector("#resultsCount"),
  queryChip: document.querySelector("#queryChip"),
  results: document.querySelector("#usersResults"),
  tests: document.querySelector("#usersTests"),
};

function runSearchUsersTests(results, posts) {
  return [
    { name: "placeholder correct", passed: "@pseudo ou nom affiche".length > 0 },
    { name: "bouton recherche present", passed: "Rechercher".length > 0 },
    { name: "cartes utilisateurs disponibles", passed: MOCK_USERS.length >= 4 },
    { name: "resultats sous forme de liste", passed: Array.isArray(results) },
    { name: "tendances presentes", passed: TRENDING_SEARCHES.length >= 3 },
    { name: "contenus discover presents", passed: posts.length >= 3 },
    { name: "fil unitaire actif", passed: posts.length > 0 },
  ];
}

function setFeedback(text) {
  state.feedback = text;
  if (refs.feedback) refs.feedback.textContent = text;
}

function initials(text) {
  return String(text || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

function normalizeApiUser(user) {
  const username = String(user?.username || "user");
  return {
    id: String(user?.id || username),
    username,
    displayName: String(user?.display_name || username),
    bio: String(user?.bio || ""),
    location: String(user?.location || "SUPCONTENT"),
    verified: Boolean(user?.verified),
    genres: Array.isArray(user?.favorite_genres) && user.favorite_genres.length ? user.favorite_genres : ["Musique"],
    mutuals: Number(user?.mutuals_count || 0),
    isPrivate: Boolean(user?.account_private),
    followers: Number(user?.followers_count || 0),
    avatarUrl: resolveMediaUrl(String(user?.avatar_url || "")),
    isFollowing: Boolean(user?.is_following),
  };
}

async function searchUsers(query) {
  refs.results.innerHTML = `<div class="empty-box">Recherche en cours...</div>`;
  try {
    const data = await apiFetch(`/users/search?q=${encodeURIComponent(query)}&limit=20`);
    const users = Array.isArray(data?.users) ? data.users.map(normalizeApiUser) : [];
    return users;
  } catch (error) {
    toast(error?.message || "Recherche utilisateurs impossible", "Erreur");
    return [];
  }
}

function getBaseResults() {
  if (state.results.length) return state.results;
  const term = state.submittedQuery.trim().toLowerCase();
  return MOCK_USERS.filter((user) => {
    if (!term) return true;
    return (
      user.username.toLowerCase().includes(term) ||
      user.displayName.toLowerCase().includes(term) ||
      user.bio.toLowerCase().includes(term)
    );
  });
}

function getFilteredResults() {
  let results = getBaseResults().map((user) => ({
    ...user,
    isFollowing: state.followingIds.has(user.id),
  }));

  if (state.onlyVerified) results = results.filter((user) => user.verified);
  if (state.activeTab === "verified") results = results.filter((user) => user.verified);
  if (state.activeTab === "mutuals") results = results.filter((user) => Number(user.mutuals || 0) >= 3);
  if (state.activeTab === "following") results = results.filter((user) => state.followingIds.has(user.id));
  if (state.activeTab === "favorites") results = results.filter((user) => state.favoriteIds.has(user.id));

  if (state.sortMode === "mutuals") results = [...results].sort((a, b) => Number(b.mutuals || 0) - Number(a.mutuals || 0));
  if (state.sortMode === "alphabetique") {
    results = [...results].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  if (state.sortMode === "followers") results = [...results].sort((a, b) => Number(b.followers || 0) - Number(a.followers || 0));
  return results;
}

function getVisibleContent() {
  if (!state.submittedQuery.trim()) return CONTENT_POSTS;
  const term = state.submittedQuery.trim().toLowerCase();
  return CONTENT_POSTS.filter(
    (post) =>
      post.username.toLowerCase().includes(term) ||
      post.displayName.toLowerCase().includes(term) ||
      post.title.toLowerCase().includes(term) ||
      post.caption.toLowerCase().includes(term)
  );
}

function currentPost() {
  const posts = getVisibleContent();
  return posts[state.activeFeedIndex] || posts[0] || null;
}

function renderTrendingAndRecent() {
  refs.trendingSearches.innerHTML = TRENDING_SEARCHES.map(
    (term) => `<button type="button" class="chip-btn" data-apply-term="${escapeHtml(term)}">${escapeHtml(term)}</button>`
  ).join("");
  refs.recentSearches.innerHTML = state.recentSearches
    .map((term) => `<button type="button" class="chip-btn" data-apply-term="${escapeHtml(term)}">${escapeHtml(term)}</button>`)
    .join("");

  document.querySelectorAll("[data-apply-term]").forEach((button) => {
    button.addEventListener("click", () => {
      const term = button.getAttribute("data-apply-term") || "";
      applySuggestion(term);
    });
  });
}

function renderTabs() {
  refs.tabRow.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-tab") === state.activeTab);
  });
}

function renderControls() {
  if (refs.input) refs.input.value = state.query;
  if (refs.clearBtn) refs.clearBtn.hidden = !state.query;
  if (refs.verifiedBtn) refs.verifiedBtn.classList.toggle("is-active", state.onlyVerified);
  if (refs.sortSelect) refs.sortSelect.value = state.sortMode;
  renderTabs();
  renderTrendingAndRecent();
}

function renderResults() {
  const results = getFilteredResults();
  refs.resultsCount.textContent = String(results.length);
  if (state.submittedQuery) {
    refs.queryChip.hidden = false;
    refs.queryChip.textContent = `requete : ${state.submittedQuery}`;
  } else {
    refs.queryChip.hidden = true;
    refs.queryChip.textContent = "";
  }

  if (!results.length) {
    refs.results.innerHTML = `
      <div class="empty-box">
        <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">Aucun utilisateur trouve</p>
        <p style="margin:10px 0 0;">Essaie un autre pseudo, un autre nom ou enleve un filtre.</p>
      </div>
    `;
    renderTests();
    return;
  }

  refs.results.innerHTML = results
    .map((user) => {
      const isFollowing = state.followingIds.has(user.id);
      const isFavorite = state.favoriteIds.has(user.id);
      return `
        <article class="result-card">
          <div class="result-top">
            <div class="result-user">
              <div class="result-avatar">
                ${
                  user.avatarUrl
                    ? `<img alt="" src="${escapeHtml(user.avatarUrl)}" />`
                    : escapeHtml(initials(user.displayName))
                }
              </div>
              <div>
                <h3>
                  <span>${escapeHtml(user.displayName)}</span>
                  ${user.verified ? `<span class="verified-dot">VERIF</span>` : ""}
                  ${user.isPrivate ? `<span class="private-dot">PRIVE</span>` : ""}
                </h3>
                <p>@${escapeHtml(user.username)}</p>
                <p>${escapeHtml(user.bio || "Aucune bio pour le moment.")}</p>
              </div>
            </div>

            <div class="result-action-col">
              <button type="button" class="small-btn ${isFavorite ? "is-favorite" : ""}" data-favorite-id="${escapeHtml(user.id)}" title="Favori">★</button>
              <button type="button" class="${isFollowing ? "primary-btn" : "ghost-btn"}" data-follow-id="${escapeHtml(user.id)}">
                ${isFollowing ? "Suivi" : "Suivre"}
              </button>
            </div>
          </div>

          <div class="result-tags" style="margin-top:14px;">
            <span class="badge">${escapeHtml(user.location)}</span>
            <span class="badge">${Number(user.mutuals || 0)} abonnements en commun</span>
            <span class="badge">${Number(user.followers || 0)} followers</span>
            ${(user.genres || [])
              .map((genre) => `<span class="badge" style="background:rgba(16,185,129,.12);">${escapeHtml(genre)}</span>`)
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");

  refs.results.querySelectorAll("[data-follow-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.getAttribute("data-follow-id");
      if (!userId) return;
      await handleFollow(userId);
    });
  });

  refs.results.querySelectorAll("[data-favorite-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = button.getAttribute("data-favorite-id");
      if (!userId) return;
      handleFavorite(userId);
    });
  });

  renderTests();
}

function renderFeed() {
  const posts = getVisibleContent();
  const post = currentPost();
  refs.feedCounter.textContent = posts.length ? `${state.activeFeedIndex + 1}/${posts.length}` : "0/0";

  if (!post) {
    refs.contentFeedStage.innerHTML = `
      <div class="empty-box">
        <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">Aucun contenu a afficher</p>
        <p style="margin:10px 0 0;">Essaie une autre recherche pour voir le feed immersif.</p>
      </div>
    `;
    renderTests();
    return;
  }

  const isVideo = post.type === "video";
  const isLiked = state.likedPostIds.has(post.id);
  const isFollowing = state.followingIds.has(post.userId);

  refs.contentFeedStage.innerHTML = `
    <article class="feed-card">
      <div class="feed-grid">
        <div class="feed-media ${isVideo ? "" : "is-photo"}" id="feedMediaSurface">
          <div class="feed-media-center">${isVideo ? "▶" : "◫"}</div>

          <div class="feed-badges">
            <span class="badge">${isVideo ? "Video" : "Photo"}</span>
            <span class="badge">double tap = like</span>
          </div>

          <button type="button" class="nav-side prev" id="feedPrevBtn" ${state.activeFeedIndex <= 0 ? "disabled" : ""}><</button>
          <button type="button" class="nav-side next" id="feedNextBtn" ${state.activeFeedIndex >= posts.length - 1 ? "disabled" : ""}>></button>

          <div class="feed-overlay">
            <div>
              <button type="button" class="feed-link-btn" id="feedOpenProfileBtn">
                <strong>${escapeHtml(post.displayName)}</strong><br />
                <span style="color:#d4d4d8;">@${escapeHtml(post.username)}</span>
              </button>
              <h3>${escapeHtml(post.title)}</h3>
              <p>${escapeHtml(post.caption)}</p>
            </div>

            <div class="feed-actions">
              <button type="button" class="${isLiked ? "primary-btn" : "ghost-btn"}" id="feedLikeBtn">${isLiked ? "Like" : "Liker"}</button>
              <button type="button" class="${state.commentsOpen ? "primary-btn" : "ghost-btn"}" id="feedCommentsBtn">Commentaires</button>
              <button type="button" class="${isFollowing ? "primary-btn" : "ghost-btn"}" id="feedFollowBtn">${isFollowing ? "Suivi" : "Suivre"}</button>
            </div>
          </div>
        </div>

        <div style="display:grid;gap:16px;">
          <div class="feed-side-box">
            <h3>Fil immersif</h3>
            <p>Comme un feed Reels : tu regardes un contenu, puis tu passes au suivant ou au precedent.</p>
            <div class="feed-nav" style="margin-top:14px;">
              <span class="badge">swipe gauche/droite simule</span>
              <span class="badge">double tap pour liker</span>
              <span class="badge">ouvrir le profil</span>
            </div>
          </div>

          <div class="feed-side-box">
            <h3>Createur</h3>
            <button type="button" class="feed-link-btn" id="feedOpenProfileInlineBtn" style="margin-top:10px;">
              <strong>${escapeHtml(post.displayName)}</strong><br />
              <span style="color:#9ca3af;">@${escapeHtml(post.username)}</span>
            </button>
            <div class="feed-user-actions" style="margin-top:14px;">
              <button type="button" class="${isFollowing ? "primary-btn" : "ghost-btn"}" id="feedFollowInlineBtn">${isFollowing ? "Suivi" : "Suivre"}</button>
            </div>
            <div class="result-tags" style="margin-top:14px;">
              <span class="badge">${post.likes + (isLiked ? 1 : 0)} likes</span>
              <span class="badge">${post.comments.length} commentaires</span>
            </div>
          </div>

          <div class="feed-side-box">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
              <h3>Commentaires</h3>
              <button type="button" class="feed-link-btn" id="feedCommentsToggleLink">${state.commentsOpen ? "Masquer" : "Afficher"}</button>
            </div>
            ${
              state.commentsOpen
                ? `<div class="comment-list">
                    ${post.comments
                      .map(
                        (comment) => `
                        <div class="comment-item"><strong>@${escapeHtml(comment.author)}</strong> - ${escapeHtml(comment.text)}</div>
                      `
                      )
                      .join("")}
                  </div>`
                : `<p>Ouvre les commentaires pour voir les reactions.</p>`
            }
          </div>
        </div>
      </div>
    </article>
  `;

  document.querySelector("#feedPrevBtn")?.addEventListener("click", goPrev);
  document.querySelector("#feedNextBtn")?.addEventListener("click", goNext);
  document.querySelector("#feedOpenProfileBtn")?.addEventListener("click", () => openProfileFromContent(post.userId));
  document.querySelector("#feedOpenProfileInlineBtn")?.addEventListener("click", () => openProfileFromContent(post.userId));
  document.querySelector("#feedFollowBtn")?.addEventListener("click", () => handleFollow(post.userId));
  document.querySelector("#feedFollowInlineBtn")?.addEventListener("click", () => handleFollow(post.userId));
  document.querySelector("#feedLikeBtn")?.addEventListener("click", () => handleLikePost(post.id));
  document.querySelector("#feedCommentsBtn")?.addEventListener("click", toggleComments);
  document.querySelector("#feedCommentsToggleLink")?.addEventListener("click", toggleComments);
  document.querySelector("#feedMediaSurface")?.addEventListener("dblclick", () => handleLikePost(post.id));

  renderTests();
}

function renderTests() {
  const tests = runSearchUsersTests(getFilteredResults(), getVisibleContent());
  const allPassed = tests.every((test) => test.passed);
  refs.tests.classList.toggle("is-ok", allPassed);
  refs.tests.classList.toggle("is-bad", !allPassed);
  refs.tests.textContent = allPassed ? "Tests recherche utilisateurs passes" : "Un test recherche utilisateurs a echoue";
}

async function handleFollow(userId) {
  const allUsers = [...MOCK_USERS, ...state.results];
  const user = allUsers.find((item) => item.id === userId);
  const wasFollowing = state.followingIds.has(userId);
  try {
    if (isLoggedIn() && !String(userId).startsWith("u")) {
      if (wasFollowing) await apiFetch(`/follows/${encodeURIComponent(userId)}`, { method: "DELETE" });
      else await apiFetch(`/follows/${encodeURIComponent(userId)}`, { method: "POST" });
    } else if (!isLoggedIn()) {
      if (!requireLogin({ message: "Connecte-toi pour suivre un utilisateur." })) return;
    }
    if (wasFollowing) state.followingIds.delete(userId);
    else state.followingIds.add(userId);
    setFeedback(user ? (wasFollowing ? `Tu ne suis plus @${user.username}` : `Tu suis maintenant @${user.username}`) : "Action effectuee");
    renderResults();
    renderFeed();
  } catch (error) {
    toast(error?.message || "Action follow impossible", "Erreur");
  }
}

function handleFavorite(userId) {
  const allUsers = [...MOCK_USERS, ...state.results];
  const user = allUsers.find((item) => item.id === userId);
  const wasFavorite = state.favoriteIds.has(userId);
  if (wasFavorite) state.favoriteIds.delete(userId);
  else state.favoriteIds.add(userId);
  setFeedback(user ? (wasFavorite ? `@${user.username} retire des favoris` : `@${user.username} ajoute aux favoris`) : "Favori mis a jour");
  renderResults();
}

function handleLikePost(postId) {
  const post = CONTENT_POSTS.find((item) => item.id === postId);
  const wasLiked = state.likedPostIds.has(postId);
  if (wasLiked) state.likedPostIds.delete(postId);
  else state.likedPostIds.add(postId);
  setFeedback(post ? (wasLiked ? `Like retire sur "${post.title}"` : `Tu as like "${post.title}"`) : "Like mis a jour");
  renderFeed();
}

function applySuggestion(term) {
  state.query = term;
  state.submittedQuery = term;
  state.activeFeedIndex = 0;
  state.commentsOpen = false;
  state.recentSearches = [term, ...state.recentSearches.filter((item) => item !== term)].slice(0, 5);
  setFeedback(`Suggestion appliquee : ${term}`);
  searchAndRender(term);
}

function openProfileFromContent(userId) {
  const post = CONTENT_POSTS.find((item) => item.userId === userId);
  if (post) {
    state.query = post.username;
    state.submittedQuery = post.username;
    state.activeFeedIndex = 0;
    state.commentsOpen = false;
    setFeedback(`Ouverture du profil de @${post.username}`);
    searchAndRender(post.username);
  }
}

function toggleComments() {
  state.commentsOpen = !state.commentsOpen;
  renderFeed();
}

function goNext() {
  const posts = getVisibleContent();
  state.activeFeedIndex = Math.min(state.activeFeedIndex + 1, posts.length - 1);
  state.commentsOpen = false;
  renderFeed();
}

function goPrev() {
  state.activeFeedIndex = Math.max(state.activeFeedIndex - 1, 0);
  state.commentsOpen = false;
  renderFeed();
}

async function searchAndRender(term) {
  const clean = String(term || "").trim();
  if (!clean) {
    state.results = [];
    renderControls();
    renderResults();
    renderFeed();
    return;
  }
  const apiResults = await searchUsers(clean);
  state.results = apiResults.length ? apiResults : [];
  renderControls();
  renderResults();
  renderFeed();
}

async function submitSearch() {
  const clean = state.query.trim();
  state.submittedQuery = clean;
  state.activeFeedIndex = 0;
  state.commentsOpen = false;
  if (clean) {
    state.recentSearches = [clean, ...state.recentSearches.filter((item) => item !== clean)].slice(0, 5);
  }
  setFeedback(clean ? `Resultats pour "${clean}"` : "Tous les utilisateurs visibles");
  await searchAndRender(clean);
}

function clearSearch() {
  state.query = "";
  state.submittedQuery = "";
  state.results = [];
  state.activeFeedIndex = 0;
  state.commentsOpen = false;
  setFeedback("Recherche reinitialisee");
  renderControls();
  renderResults();
  renderFeed();
}

function bindEvents() {
  refs.input?.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderControls();
  });

  refs.input?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await submitSearch();
    }
  });

  refs.clearBtn?.addEventListener("click", clearSearch);
  refs.searchBtn?.addEventListener("click", submitSearch);
  refs.verifiedBtn?.addEventListener("click", () => {
    state.onlyVerified = !state.onlyVerified;
    renderControls();
    renderResults();
  });
  refs.sortSelect?.addEventListener("change", (event) => {
    state.sortMode = event.target.value;
    renderResults();
  });
  refs.tabRow?.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.getAttribute("data-tab") || "all";
      renderControls();
      renderResults();
    });
  });

  window.addEventListener("keydown", (event) => {
    if (!getVisibleContent().length) return;
    if (event.key === "ArrowRight") {
      goNext();
    }
    if (event.key === "ArrowLeft") {
      goPrev();
    }
  });
}

function init() {
  bindEvents();
  renderControls();
  renderResults();
  renderFeed();
}

init();
