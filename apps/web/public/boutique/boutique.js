import { apiFetch, escapeHtml, isLoggedIn, requireLogin, toast } from "/noyau/app.js";

const FALLBACK_PRODUCTS = [
  { id: "p1", type: "Beat", title: "Afro Sunset Beat", creator: "Ayo.wav", verified: true, price: 35, license: "Licence standard", bpm: 102, genre: "Afro", rating: 4.9, sales: 128, description: "Beat afro chaleureux pour topline, freestyle ou single melodique.", tag: "Best seller", previewLabel: "Extrait Afro Sunset Beat" },
  { id: "p2", type: "Sample Pack", title: "Midnight Perc Pack", creator: "Nina Beats", verified: true, price: 22, license: "Royalty-free", bpm: 120, genre: "Percussions", rating: 4.8, sales: 94, description: "Pack de percussions, textures et loops pour prods afro et pop.", tag: "Nouveau", previewLabel: "Extrait Midnight Perc Pack" },
  { id: "p3", type: "Loop Kit", title: "Soul Keys Loops", creator: "Tems Daily", verified: false, price: 18, license: "Royalty-free", bpm: 96, genre: "Soul", rating: 4.6, sales: 61, description: "Loops de claviers et nappes soul prets a sampler ou arranger.", tag: "Createur suivi", previewLabel: "Extrait Soul Keys Loops" },
  { id: "p4", type: "Beat", title: "Club Runner", creator: "DJ Nova", verified: false, price: 40, license: "Exclusive possible", bpm: 128, genre: "House", rating: 4.7, sales: 73, description: "Beat club energique pour performance live, reel ou teaser artiste.", tag: "Live ready", previewLabel: "Extrait Club Runner" },
  { id: "p5", type: "Vocal Pack", title: "Ambient Vox Cuts", creator: "Luna Mix", verified: true, price: 27, license: "Royalty-free", bpm: 110, genre: "Ambient", rating: 4.5, sales: 45, description: "Textures vocales decoupees pour intros, drops et refrains aeriens.", tag: "Creatif", previewLabel: "Extrait Ambient Vox Cuts" },
  { id: "p6", type: "Sample Pack", title: "Rap Drill Essentials", creator: "Daxwritz", verified: false, price: 25, license: "Royalty-free", bpm: 142, genre: "Rap", rating: 4.4, sales: 39, description: "808, hats, snares et textures pretes pour prods drill et trap.", tag: "Rap pack", previewLabel: "Extrait Rap Drill Essentials" },
];

const FALLBACK_CREATORS = [
  { id: "c1", name: "Ayo.wav", speciality: "Beats afro & live edits", followers: "12.4k", verified: true, creator_user_id: "" },
  { id: "c2", name: "Nina Beats", speciality: "Sample packs & beatmaking", followers: "8.9k", verified: true, creator_user_id: "" },
  { id: "c3", name: "DJ Nova", speciality: "Club beats & edits", followers: "6.1k", verified: false, creator_user_id: "" },
];

const EMPTY_UPLOAD_FORM = {
  title: "",
  price: "",
  type: "Beat",
  genre: "",
  bpm: "",
  license: "Licence standard",
  description: "",
};

const state = {
  query: "",
  activeType: "Tout",
  sortMode: "popularite",
  favorites: ["p2"],
  followedCreators: [],
  cart: [],
  products: FALLBACK_PRODUCTS.slice(),
  creators: FALLBACK_CREATORS.slice(),
  previewItem: FALLBACK_PRODUCTS[0],
  isPreviewPlaying: false,
  previewProgress: 18,
  previewDuration: 45,
  feedback: "Chargement de la boutique...",
  usingFallback: true,
  currentUser: null,
};

const refs = {
  cartPill: document.querySelector("#shopCartPill"),
  query: document.querySelector("#shopQuery"),
  typeChips: document.querySelector("#shopTypeChips"),
  resultCount: document.querySelector("#shopResultCount"),
  sortMode: document.querySelector("#shopSortMode"),
  feedbackPill: document.querySelector("#shopFeedbackPill"),
  previewToggleBtn: document.querySelector("#shopPreviewToggleBtn"),
  previewTitle: document.querySelector("#shopPreviewTitle"),
  previewMeta: document.querySelector("#shopPreviewMeta"),
  previewLabel: document.querySelector("#shopPreviewLabel"),
  previewCurrent: document.querySelector("#shopPreviewCurrent"),
  previewDuration: document.querySelector("#shopPreviewDuration"),
  previewBar: document.querySelector("#shopPreviewBar"),
  previewRange: document.querySelector("#shopPreviewRange"),
  previewTags: document.querySelector("#shopPreviewTags"),
  publishBtn: document.querySelector("#shopPublishBtn"),
  catalogue: document.querySelector("#catalogue"),
  creatorsList: document.querySelector("#shopCreatorsList"),
  cartList: document.querySelector("#shopCartList"),
  cartTotal: document.querySelector("#shopCartTotal"),
  checkoutBtn: document.querySelector("#shopCheckoutBtn"),
  validation: document.querySelector("#shopValidation"),
  formTitle: document.querySelector("#shopFormTitle"),
  formCreator: document.querySelector("#shopFormCreator"),
  formPrice: document.querySelector("#shopFormPrice"),
  formType: document.querySelector("#shopFormType"),
  formGenre: document.querySelector("#shopFormGenre"),
  formBpm: document.querySelector("#shopFormBpm"),
  formLicense: document.querySelector("#shopFormLicense"),
  formDescription: document.querySelector("#shopFormDescription"),
  searchIcon: document.querySelector("#shopSearchIcon"),
  sortIcon: document.querySelector("#shopSortIcon"),
  equalizerIcon: document.querySelector("#shopEqualizerIcon"),
  euroIcon: document.querySelector("#shopEuroIcon"),
  fileIcon: document.querySelector("#shopFileIcon"),
};

const TYPES = ["Tout", "Beat", "Sample Pack", "Loop Kit", "Vocal Pack"];
let previewTimer = 0;

function iconSvg(name) {
  const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  switch (name) {
    case "search": return `<svg ${common}><circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.2-4.2"></path></svg>`;
    case "music": return `<svg ${common}><path d="M9 18V5l10-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    case "pack": return `<svg ${common}><path d="M21 8a2 2 0 0 0-1.1-1.79l-7-3.5a2 2 0 0 0-1.8 0l-7 3.5A2 2 0 0 0 3 8v8a2 2 0 0 0 1.1 1.79l7 3.5a2 2 0 0 0 1.8 0l7-3.5A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 4.5L20.7 7"></path><path d="M12 22V11.5"></path></svg>`;
    case "beat": return `<svg ${common}><circle cx="12" cy="12" r="8"></circle><path d="M9 15V9"></path><path d="M15 15V9"></path><path d="M8 12h8"></path></svg>`;
    case "heart": return `<svg ${common}><path d="m12 20-1.45-1.32C5.4 14.03 2 10.95 2 7.5A4.5 4.5 0 0 1 6.5 3c1.74 0 3.41.81 4.5 2.09A6.03 6.03 0 0 1 15.5 3 4.5 4.5 0 0 1 20 7.5c0 3.45-3.4 6.53-8.55 11.18Z"></path></svg>`;
    case "check": return `<svg ${common}><path d="m20 6-11 11-5-5"></path></svg>`;
    case "play": return `<svg ${common}><polygon points="8 5 19 12 8 19 8 5"></polygon></svg>`;
    case "pause": return `<svg ${common}><path d="M10 5H6v14h4z"></path><path d="M18 5h-4v14h4z"></path></svg>`;
    case "star": return `<svg ${common}><path d="m12 3 2.7 5.47L21 9.4l-4.5 4.38 1.06 6.22L12 17.2 6.44 20l1.06-6.22L3 9.4l6.3-.93Z"></path></svg>`;
    case "tag": return `<svg ${common}><path d="m20 10-8 8-8-8V4h6Z"></path><circle cx="7.5" cy="7.5" r=".5"></circle></svg>`;
    case "sort": return `<svg ${common}><path d="M4 7h10"></path><path d="M4 12h16"></path><path d="M4 17h7"></path><circle cx="17" cy="7" r="2"></circle><circle cx="14" cy="17" r="2"></circle></svg>`;
    case "follow": return `<svg ${common}><path d="M16 21a4 4 0 0 0-8 0"></path><circle cx="12" cy="7" r="3"></circle><path d="M19 8v6"></path><path d="M16 11h6"></path></svg>`;
    case "remove": return `<svg ${common}><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;
    case "upload": return `<svg ${common}><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M20 16.5a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5"></path></svg>`;
    case "euro": return `<svg ${common}><path d="M17 5a8 8 0 1 0 0 14"></path><path d="M6 10h8"></path><path d="M6 14h8"></path></svg>`;
    case "file": return `<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8Z"></path><path d="M14 2v6h6"></path></svg>`;
    case "equal": return `<svg ${common}><path d="M5 8h2"></path><path d="M5 16h2"></path><path d="M10 4v16"></path><path d="M14 8v8"></path><path d="M18 6v12"></path></svg>`;
    case "cart": return `<svg ${common}><circle cx="9" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle><path d="M3 4h2l2.4 10.5a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.76L21 7H7"></path></svg>`;
    default: return `<svg ${common}><circle cx="12" cy="12" r="8"></circle></svg>`;
  }
}

function formatPreviewTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
}

function filteredItems() {
  let items = state.products.filter((item) => {
    const term = state.query.trim().toLowerCase();
    if (!term) return true;
    return [item.title, item.creator, item.genre, item.description].some((value) => String(value || "").toLowerCase().includes(term));
  });

  if (state.activeType !== "Tout") items = items.filter((item) => item.type === state.activeType);
  if (state.sortMode === "prix-asc") items = [...items].sort((a, b) => Number(a.price) - Number(b.price));
  if (state.sortMode === "prix-desc") items = [...items].sort((a, b) => Number(b.price) - Number(a.price));
  if (state.sortMode === "rating") items = [...items].sort((a, b) => Number(b.rating) - Number(a.rating));
  if (state.sortMode === "popularite") items = [...items].sort((a, b) => Number(b.sales) - Number(a.sales));
  return items;
}

function runShopTests(items, cart) {
  return [
    { name: "au moins 5 produits", passed: items.length >= 5 },
    { name: "panier disponible", passed: Array.isArray(cart) },
    { name: "createurs spotlight presents", passed: state.creators.length >= 2 },
    { name: "prix valides", passed: items.every((item) => Number(item.price) > 0) },
    { name: "preview activable", passed: items.every((item) => typeof item.previewLabel === "string") },
  ];
}

function setFeedback(message) {
  state.feedback = message;
  refs.feedbackPill.innerHTML = `${iconSvg("tag")} ${escapeHtml(message)}`;
}

function renderTypeChips() {
  refs.typeChips.innerHTML = TYPES.map((type) => `<button class="shop-chip ${state.activeType === type ? "is-active" : ""}" type="button" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`).join("");
}

function renderIcons() {
  refs.searchIcon.innerHTML = iconSvg("search");
  refs.sortIcon.innerHTML = iconSvg("sort");
  refs.equalizerIcon.innerHTML = iconSvg("equal");
  refs.euroIcon.innerHTML = iconSvg("euro");
  refs.fileIcon.innerHTML = iconSvg("file");
}

function renderPreview() {
  const item = state.previewItem || state.products[0] || FALLBACK_PRODUCTS[0];
  refs.previewTitle.textContent = item.title;
  refs.previewMeta.textContent = `${item.creator} - ${item.type}`;
  refs.previewLabel.textContent = item.previewLabel;
  refs.previewCurrent.textContent = formatPreviewTime(state.previewProgress);
  refs.previewDuration.textContent = formatPreviewTime(state.previewDuration);
  refs.previewBar.style.width = `${(state.previewProgress / state.previewDuration) * 100}%`;
  refs.previewRange.max = String(state.previewDuration);
  refs.previewRange.value = String(state.previewProgress);
  refs.previewTags.innerHTML = `
    <span class="shop-tag">${escapeHtml(item.genre)}</span>
    <span class="shop-tag">${escapeHtml(String(item.bpm))} BPM</span>
    <span class="shop-tag">${escapeHtml(item.license)}</span>
  `;
  refs.previewToggleBtn.innerHTML = `${iconSvg(state.isPreviewPlaying ? "pause" : "play")} ${state.isPreviewPlaying ? "Pause" : state.previewProgress >= state.previewDuration ? "Relire" : "Lire"}`;
  refs.previewToggleBtn.classList.toggle("is-primary", state.isPreviewPlaying);
}

function typeIcon(type) {
  if (type === "Beat") return iconSvg("music");
  if (type === "Sample Pack") return iconSvg("pack");
  return iconSvg("beat");
}

function renderCatalogue() {
  const items = filteredItems();
  refs.resultCount.innerHTML = `${iconSvg("tag")} ${items.length} produit(s)`;
  refs.catalogue.innerHTML = items.map((item) => `
    <article class="shop-product-card">
      <div class="shop-product-head">
        <div class="shop-product-main">
          <div class="shop-product-icon">${typeIcon(item.type)}</div>
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <div style="font-size:18px;font-weight:800;color:#fff;">${escapeHtml(item.title)}</div>
              ${item.verified ? `<span class="shop-tag is-green">${iconSvg("check")} Verifie</span>` : ""}
            </div>
            <div style="margin-top:6px;color:#9ca3af;font-size:14px;">${escapeHtml(item.creator)}</div>
            <div style="margin-top:10px;color:#d4d4d8;font-size:14px;line-height:1.5;">${escapeHtml(item.description)}</div>
          </div>
        </div>
        <button class="shop-fav-btn ${state.favorites.includes(item.id) ? "is-active" : ""}" type="button" data-favorite-id="${escapeHtml(item.id)}">${iconSvg("heart")}</button>
      </div>
      <div class="shop-tag-row">
        <span class="shop-tag is-green">${escapeHtml(item.tag)}</span>
        <span class="shop-tag">${escapeHtml(item.type)}</span>
        <span class="shop-tag">${escapeHtml(item.genre)}</span>
        <span class="shop-tag">${escapeHtml(String(item.bpm))} BPM</span>
        <span class="shop-tag">${escapeHtml(item.license)}</span>
      </div>
      <div class="shop-price-row">
        <div>
          <div class="shop-price">${escapeHtml(String(item.price))} EUR</div>
          <div class="shop-rating">${iconSvg("star")} ${escapeHtml(String(item.rating))} - ${escapeHtml(String(item.sales))} ventes</div>
        </div>
        <div class="shop-actions">
          <button class="shop-btn" type="button" data-preview-id="${escapeHtml(item.id)}">${iconSvg("play")} Preview</button>
          <button class="shop-btn is-primary" type="button" data-cart-id="${escapeHtml(item.id)}">${iconSvg("cart")} Ajouter</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderCreators() {
  refs.creatorsList.innerHTML = state.creators.map((creator) => {
    const creatorUserId = String(creator.creator_user_id || "");
    const isFollowed = creatorUserId ? state.followedCreators.includes(creatorUserId) : false;
    return `
      <div class="shop-creator-card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="font-size:16px;font-weight:800;color:#fff;">${escapeHtml(creator.name)}</div>
            <div style="margin-top:6px;color:#9ca3af;font-size:14px;">${escapeHtml(creator.speciality)}</div>
            <div style="margin-top:10px;color:#71717a;font-size:12px;">${escapeHtml(creator.followers)}</div>
          </div>
          <button class="shop-btn ${isFollowed ? "is-primary" : ""}" type="button" data-follow-name="${escapeHtml(creator.name)}" data-follow-user-id="${escapeHtml(creatorUserId)}">${iconSvg("follow")} ${isFollowed ? "Suivi" : "Suivre"}</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderCart() {
  refs.cartPill.innerHTML = `${iconSvg("cart")} ${state.cart.length} article(s) - ${getCartTotal()} EUR`;
  refs.cartTotal.textContent = `${getCartTotal()} EUR`;

  if (!state.cart.length) {
    refs.cartList.innerHTML = `<div class="shop-empty" style="padding:18px;text-align:center;color:#71717a;font-size:14px;">Aucun article pour le moment.</div>`;
    return;
  }

  refs.cartList.innerHTML = state.cart.map((item, index) => `
    <div class="shop-cart-item">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <div style="font-size:16px;font-weight:800;color:#fff;">${escapeHtml(item.title)}</div>
          <div style="margin-top:6px;color:#9ca3af;font-size:14px;">${escapeHtml(item.creator)}</div>
          <div style="margin-top:10px;color:#6ee7b7;font-size:14px;">${escapeHtml(String(item.price))} EUR</div>
        </div>
        <button class="shop-remove-btn" type="button" data-remove-index="${index}">${iconSvg("remove")}</button>
      </div>
    </div>
  `).join("");
}

function renderValidation() {
  const allPassed = runShopTests(state.products, state.cart).every((test) => test.passed);
  refs.validation.classList.toggle("is-ko", !allPassed);
  refs.validation.innerHTML = allPassed ? `${iconSvg("check")} Tests boutique passes` : "Un test boutique a echoue";
}

function render() {
  renderIcons();
  renderTypeChips();
  renderPreview();
  renderCatalogue();
  renderCreators();
  renderCart();
  renderValidation();
  setFeedback(state.feedback);
}

function stopPreviewTimer() {
  if (!previewTimer) return;
  clearInterval(previewTimer);
  previewTimer = 0;
}

function startPreviewTimer() {
  stopPreviewTimer();
  if (!state.isPreviewPlaying) return;
  previewTimer = window.setInterval(() => {
    if (state.previewProgress >= state.previewDuration) {
      state.isPreviewPlaying = false;
      stopPreviewTimer();
      renderPreview();
      return;
    }
    state.previewProgress += 1;
    renderPreview();
  }, 1000);
}

function openPreview(item) {
  state.previewItem = item;
  state.previewProgress = 0;
  state.isPreviewPlaying = true;
  setFeedback(`Preview lancee : ${item.title}`);
  renderPreview();
  startPreviewTimer();
}

async function loadProducts() {
  try {
    const [productsData, creatorsData] = await Promise.all([apiFetch("/shop/products"), apiFetch("/shop/spotlight")]);
    const products = Array.isArray(productsData?.products) ? productsData.products : [];
    const creators = Array.isArray(creatorsData?.creators) ? creatorsData.creators : [];
    if (!products.length) throw new Error("Aucun produit boutique disponible");
    state.products = products;
    state.creators = creators.length ? creators : FALLBACK_CREATORS.slice();
    state.previewItem = products[0];
    state.usingFallback = false;
    setFeedback("Boutique chargee depuis l'API");
  } catch (error) {
    state.products = FALLBACK_PRODUCTS.slice();
    state.creators = FALLBACK_CREATORS.slice();
    state.previewItem = state.products[0];
    state.usingFallback = true;
    setFeedback("API boutique indisponible, mode demo active");
    toast(error?.message || "Mode demo active", "Boutique");
  }
  render();
}

async function loadCurrentUser() {
  if (!isLoggedIn()) {
    state.currentUser = null;
    refs.formCreator.value = "";
    refs.formCreator.placeholder = "Connecte-toi pour publier";
    refs.formCreator.readOnly = true;
    return;
  }

  try {
    const me = await apiFetch("/auth/me");
    state.currentUser = me || null;
    refs.formCreator.value = String(me?.display_name || me?.username || "");
    refs.formCreator.readOnly = true;
  } catch {
    state.currentUser = null;
    refs.formCreator.value = "";
    refs.formCreator.placeholder = "Connexion requise pour publier";
    refs.formCreator.readOnly = true;
  }
}

async function loadFavorites() {
  if (!isLoggedIn()) return;
  try {
    const data = await apiFetch("/shop/favorites");
    state.favorites = Array.isArray(data?.product_ids) ? data.product_ids : state.favorites;
    renderCatalogue();
  } catch {
    // keep local state
  }
}

async function loadCart() {
  if (!isLoggedIn()) {
    state.cart = [];
    renderCart();
    renderValidation();
    return;
  }
  try {
    const data = await apiFetch("/shop/cart");
    state.cart = (Array.isArray(data?.items) ? data.items : []).map((item) => ({
      ...item.product,
      cart_item_id: item.cart_item_id,
    }));
  } catch {
    state.cart = [];
  }
  renderCart();
  renderValidation();
}

async function addToCart(item) {
  if (state.usingFallback) {
    setFeedback("Panier indisponible tant que l'API boutique est en fallback");
    toast("Panier backend indisponible", "Boutique");
    return;
  }
  if (!requireLogin({ redirect: false, message: "Connecte-toi pour enregistrer ton panier." })) return;

  try {
    const data = await apiFetch("/shop/cart/items", {
      method: "POST",
      body: JSON.stringify({ productId: item.id }),
    });
    state.cart = (Array.isArray(data?.items) ? data.items : []).map((entry) => ({
      ...entry.product,
      cart_item_id: entry.cart_item_id,
    }));
    setFeedback(`${item.title} ajoute au panier`);
    renderCart();
    renderValidation();
  } catch (error) {
    setFeedback(error?.message || "Impossible d'ajouter au panier");
  }
}

async function removeFromCart(index) {
  const item = state.cart[index];
  if (!item) return;
  if (state.usingFallback || !item.cart_item_id) {
    setFeedback("Suppression panier indisponible en mode fallback");
    return;
  }
  try {
    const data = await apiFetch(`/shop/cart/items/${encodeURIComponent(item.cart_item_id)}`, { method: "DELETE" });
    state.cart = (Array.isArray(data?.items) ? data.items : []).map((entry) => ({
      ...entry.product,
      cart_item_id: entry.cart_item_id,
    }));
    setFeedback(`${item.title} retire du panier`);
    renderCart();
    renderValidation();
  } catch (error) {
    setFeedback(error?.message || "Impossible de retirer du panier");
  }
}

async function toggleFavorite(id) {
  const item = state.products.find((product) => product.id === id);
  const isFav = state.favorites.includes(id);
  if (state.usingFallback) {
    setFeedback("Favoris indisponibles tant que l'API boutique est en fallback");
    return;
  }
  if (!requireLogin({ redirect: false, message: "Connecte-toi pour gerer tes favoris." })) return;
  try {
    await apiFetch(`/shop/favorites/${encodeURIComponent(id)}`, { method: isFav ? "DELETE" : "POST" });
    state.favorites = isFav ? state.favorites.filter((itemId) => itemId !== id) : [...state.favorites, id];
    if (item) setFeedback(isFav ? `${item.title} retire des favoris` : `${item.title} ajoute aux favoris`);
    renderCatalogue();
  } catch (error) {
    setFeedback(error?.message || "Impossible de mettre a jour les favoris");
  }
}

async function submitNewItem() {
  const title = refs.formTitle.value.trim();
  const genre = refs.formGenre.value.trim();
  const description = refs.formDescription.value.trim();
  const price = Number(refs.formPrice.value);
  const bpm = Number(refs.formBpm.value);

  if (!title || !genre || !description || !price || !bpm) {
    setFeedback("Remplis tous les champs du formulaire d'ajout.");
    return;
  }
  if (state.usingFallback) {
    setFeedback("Publication indisponible tant que l'API boutique est en fallback");
    toast("Publication backend indisponible", "Boutique");
    return;
  }
  if (!requireLogin({ redirect: false, message: "Connecte-toi pour publier dans la boutique." })) return;

  try {
    const data = await apiFetch("/shop/products", {
      method: "POST",
      body: JSON.stringify({
        title,
        type: refs.formType.value,
        genre,
        description,
        price,
        bpm,
        license: refs.formLicense.value.trim() || "Licence standard",
      }),
    });

    if (!data?.product) throw new Error("Produit non cree");

    state.products = [data.product, ...state.products];
    state.previewItem = data.product;
    refs.formTitle.value = "";
    refs.formCreator.value = String(state.currentUser?.display_name || state.currentUser?.username || "");
    refs.formPrice.value = EMPTY_UPLOAD_FORM.price;
    refs.formType.value = EMPTY_UPLOAD_FORM.type;
    refs.formGenre.value = EMPTY_UPLOAD_FORM.genre;
    refs.formBpm.value = EMPTY_UPLOAD_FORM.bpm;
    refs.formLicense.value = EMPTY_UPLOAD_FORM.license;
    refs.formDescription.value = EMPTY_UPLOAD_FORM.description;
    setFeedback(`${title} ajoute a la boutique`);
    render();
  } catch (error) {
    setFeedback(error?.message || "Impossible de publier dans la boutique");
  }
}

async function toggleCreatorFollow(button) {
  const creatorId = button.getAttribute("data-follow-user-id") || "";
  const creatorName = button.getAttribute("data-follow-name") || "ce createur";
  if (!creatorId) {
    setFeedback(`Profil createur indisponible pour ${creatorName}`);
    return;
  }
  if (!requireLogin({ redirect: false, message: "Connecte-toi pour suivre un createur." })) return;

  const alreadyFollowing = state.followedCreators.includes(creatorId);
  try {
    await apiFetch(`/follows/${encodeURIComponent(creatorId)}`, {
      method: alreadyFollowing ? "DELETE" : "POST",
    });
    state.followedCreators = alreadyFollowing
      ? state.followedCreators.filter((item) => item !== creatorId)
      : [...state.followedCreators, creatorId];
    setFeedback(alreadyFollowing ? `Tu ne suis plus ${creatorName}` : `Tu suis maintenant ${creatorName}`);
    renderCreators();
  } catch (error) {
    setFeedback(error?.message || "Impossible de suivre ce createur");
  }
}

async function checkout() {
  if (!state.cart.length) {
    toast("Le panier est vide.", "Boutique");
    return;
  }
  if (state.usingFallback) {
    setFeedback("Checkout indisponible tant que l'API boutique est en fallback");
    toast("Checkout backend indisponible", "Boutique");
    return;
  }
  if (!requireLogin({ redirect: false, message: "Connecte-toi pour finaliser le paiement." })) return;

  try {
    const data = await apiFetch("/shop/checkout", { method: "POST" });
    state.cart = [];
    setFeedback(`Commande payee - ${data?.order?.item_count || 0} article(s) - ${data?.order?.total_amount || 0} EUR`);
    toast("Paiement valide", "Boutique");
    renderCart();
    renderValidation();
    loadProducts().catch(() => {});
  } catch (error) {
    setFeedback(error?.message || "Impossible de finaliser le paiement");
  }
}

function bindEvents() {
  refs.query.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCatalogue();
  });

  refs.sortMode.addEventListener("change", (event) => {
    state.sortMode = event.target.value;
    renderCatalogue();
  });

  refs.typeChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-type]");
    if (!chip) return;
    state.activeType = chip.getAttribute("data-type");
    renderTypeChips();
    renderCatalogue();
  });

  refs.catalogue.addEventListener("click", (event) => {
    const previewBtn = event.target.closest("[data-preview-id]");
    if (previewBtn) {
      const item = state.products.find((product) => product.id === previewBtn.getAttribute("data-preview-id"));
      if (item) openPreview(item);
      return;
    }

    const cartBtn = event.target.closest("[data-cart-id]");
    if (cartBtn) {
      const item = state.products.find((product) => product.id === cartBtn.getAttribute("data-cart-id"));
      if (item) addToCart(item);
      return;
    }

    const favBtn = event.target.closest("[data-favorite-id]");
    if (favBtn) toggleFavorite(favBtn.getAttribute("data-favorite-id"));
  });

  refs.previewToggleBtn.addEventListener("click", () => {
    if (state.previewProgress >= state.previewDuration) state.previewProgress = 0;
    state.isPreviewPlaying = !state.isPreviewPlaying;
    renderPreview();
    startPreviewTimer();
  });

  refs.previewRange.addEventListener("input", (event) => {
    state.previewProgress = Number(event.target.value);
    setFeedback(`Preview deplacee a ${formatPreviewTime(state.previewProgress)}`);
    renderPreview();
  });

  refs.publishBtn.addEventListener("click", submitNewItem);
  refs.creatorsList.addEventListener("click", (event) => {
    const followBtn = event.target.closest("[data-follow-name]");
    if (followBtn) toggleCreatorFollow(followBtn);
  });
  refs.cartList.addEventListener("click", (event) => {
    const removeBtn = event.target.closest("[data-remove-index]");
    if (removeBtn) removeFromCart(Number(removeBtn.getAttribute("data-remove-index")));
  });
  refs.checkoutBtn.addEventListener("click", checkout);
}

async function init() {
  bindEvents();
  render();
  await Promise.all([loadProducts(), loadCart(), loadCurrentUser(), loadFavorites()]);
}

init();
