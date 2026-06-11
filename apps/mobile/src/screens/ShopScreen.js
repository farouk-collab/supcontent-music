import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const FILTERS = ["Tout", "Beat", "Sample Pack", "Loop Kit", "Vocal Pack"];
const SORTS = [
  { key: "popularite", label: "Pop" },
  { key: "rating", label: "Notes" },
  { key: "prix-asc", label: "Prix +" },
  { key: "prix-desc", label: "Prix -" },
];
const TABS = [
  { key: "catalogue", label: "Catalogue" },
  { key: "preview", label: "Preview" },
  { key: "publier", label: "Publier" },
];

const EMPTY_FORM = {
  title: "",
  type: "Beat",
  genre: "",
  price: "",
  bpm: "",
  license: "Licence standard",
  description: "",
};

function euro(value) {
  return `${Number(value || 0)} EUR`;
}

function bySort(items, sortMode) {
  const copy = [...items];
  if (sortMode === "prix-asc") return copy.sort((a, b) => Number(a.price) - Number(b.price));
  if (sortMode === "prix-desc") return copy.sort((a, b) => Number(b.price) - Number(a.price));
  if (sortMode === "rating") return copy.sort((a, b) => Number(b.rating) - Number(a.rating));
  return copy.sort((a, b) => Number(b.sales) - Number(a.sales));
}

export function ShopScreen({
  currentUser,
  onLoadProducts,
  onLoadCreators,
  onLoadFavorites,
  onLoadCart,
  onAddToCart,
  onRemoveFromCart,
  onToggleFavorite,
  onCheckout,
  onPublish,
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [feedback, setFeedback] = useState("Charge la boutique mobile.");
  const [activeTab, setActiveTab] = useState("catalogue");
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("Tout");
  const [sortMode, setSortMode] = useState("popularite");
  const [products, setProducts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [cart, setCart] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const hydrate = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setRefreshing(true);
      setErrorText("");
      try {
        const [productsData, creatorsData, favoritesData, cartData] = await Promise.all([
          onLoadProducts(),
          onLoadCreators(),
          onLoadFavorites?.(),
          onLoadCart?.(),
        ]);
        const nextProducts = Array.isArray(productsData?.products) ? productsData.products : [];
        const nextCreators = Array.isArray(creatorsData?.creators) ? creatorsData.creators : [];
        const nextFavorites = Array.isArray(favoritesData?.product_ids) ? favoritesData.product_ids : [];
        const nextCart = Array.isArray(cartData?.items)
          ? cartData.items.map((item) => ({
              ...item.product,
              cart_item_id: item.cart_item_id,
            }))
          : [];
        setProducts(nextProducts);
        setCreators(nextCreators);
        setFavorites(nextFavorites);
        setCart(nextCart);
        setPreviewItem((prev) => prev || nextProducts[0] || null);
        setFeedback(nextProducts.length ? "Boutique mobile synchronisee avec l'API." : "Aucun produit disponible.");
      } catch (e) {
        setErrorText(e?.message || "Impossible de charger la boutique mobile");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onLoadCart, onLoadCreators, onLoadFavorites, onLoadProducts]
  );

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = products.filter((item) => {
      if (filterType !== "Tout" && item.type !== filterType) return false;
      if (!term) return true;
      return [item.title, item.creator, item.genre, item.description]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
    return bySort(base, sortMode);
  }, [filterType, products, query, sortMode]);

  const featuredProducts = useMemo(() => bySort(products, "popularite").slice(0, 3), [products]);
  const totalCart = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [cart]
  );
  const averagePrice = useMemo(() => {
    if (!products.length) return 0;
    return Math.round(products.reduce((sum, item) => sum + Number(item.price || 0), 0) / products.length);
  }, [products]);
  const bestSeller = useMemo(() => bySort(products, "popularite")[0] || null, [products]);

  async function handleAddToCart(item) {
    if (!onAddToCart) return;
    setBusyAction(`cart:${item.id}`);
    setErrorText("");
    try {
      const data = await onAddToCart(item.id);
      const nextCart = Array.isArray(data?.items)
        ? data.items.map((entry) => ({ ...entry.product, cart_item_id: entry.cart_item_id }))
        : [];
      setCart(nextCart);
      setFeedback(`${item.title} ajoute au panier.`);
    } catch (e) {
      setErrorText(e?.message || "Impossible d'ajouter au panier");
    } finally {
      setBusyAction("");
    }
  }

  async function handleRemoveFromCart(item) {
    if (!onRemoveFromCart || !item?.cart_item_id) return;
    setBusyAction(`remove:${item.cart_item_id}`);
    setErrorText("");
    try {
      const data = await onRemoveFromCart(item.cart_item_id);
      const nextCart = Array.isArray(data?.items)
        ? data.items.map((entry) => ({ ...entry.product, cart_item_id: entry.cart_item_id }))
        : [];
      setCart(nextCart);
      setFeedback(`${item.title} retire du panier.`);
    } catch (e) {
      setErrorText(e?.message || "Impossible de retirer du panier");
    } finally {
      setBusyAction("");
    }
  }

  async function handleToggleFavorite(item) {
    if (!onToggleFavorite) return;
    const isFav = favorites.includes(item.id);
    setBusyAction(`favorite:${item.id}`);
    setErrorText("");
    try {
      await onToggleFavorite(item.id, isFav);
      setFavorites((prev) => (isFav ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
      setFeedback(isFav ? `${item.title} retire des favoris.` : `${item.title} ajoute aux favoris.`);
    } catch (e) {
      setErrorText(e?.message || "Impossible de gerer les favoris");
    } finally {
      setBusyAction("");
    }
  }

  async function handleCheckout() {
    if (!cart.length || !onCheckout) return;
    setBusyAction("checkout");
    setErrorText("");
    try {
      const data = await onCheckout();
      setCart([]);
      setFeedback(`Commande payee: ${data?.order?.item_count || 0} article(s).`);
      await hydrate(true);
    } catch (e) {
      setErrorText(e?.message || "Impossible de finaliser le paiement");
    } finally {
      setBusyAction("");
    }
  }

  async function handlePublish() {
    if (!onPublish) return;
    const title = form.title.trim();
    const genre = form.genre.trim();
    const description = form.description.trim();
    const price = Number(form.price);
    const bpm = Number(form.bpm);
    if (!title || !genre || !description || !price || !bpm) {
      setErrorText("Remplis tous les champs produit.");
      return;
    }

    setBusyAction("publish");
    setErrorText("");
    try {
      const data = await onPublish({
        title,
        type: form.type,
        genre,
        description,
        price,
        bpm,
        license: form.license.trim() || "Licence standard",
      });
      const product = data?.product || null;
      if (product) {
        setProducts((prev) => [product, ...prev]);
        setPreviewItem(product);
      }
      setForm(EMPTY_FORM);
      setActiveTab("preview");
      setFeedback(`${title} publie dans la boutique.`);
    } catch (e) {
      setErrorText(e?.message || "Impossible de publier");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color="#31d0a4" size="large" />
        <Text style={styles.centerText}>Chargement de la boutique mobile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Boutique mobile</Text>
        <Text style={styles.title}>Version Android-ready pour SUPCONTENT Music.</Text>
        <Text style={styles.subtitle}>
          Catalogue, preview et publication vivent maintenant dans un flow mobile plus clair pour Android Studio.
        </Text>

        <View style={styles.pageTabs}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.pageTab, activeTab === tab.key && styles.pageTabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.pageTabText, activeTab === tab.key && styles.pageTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Catalogue" value={String(products.length)} helper="Produits en ligne" />
          <StatCard label="Prix moyen" value={euro(averagePrice)} helper="Repere rapide" />
          <StatCard label="Best seller" value={bestSeller?.title || "-"} helper="Le plus vendu" />
          <StatCard label="Panier" value={euro(totalCart)} helper={`${cart.length} article(s)`} />
        </View>
      </View>

      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      <Text style={styles.feedback}>{feedback}</Text>

      {activeTab === "catalogue" ? (
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Catalogue</Text>
            <Pressable style={styles.ghostBtn} onPress={() => hydrate(true)}>
              <Text style={styles.ghostBtnText}>{refreshing ? "Sync..." : "Rafraichir"}</Text>
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher un beat, un sample pack, un artiste..."
            placeholderTextColor="#6e7e96"
            style={styles.input}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map((type) => (
              <Pressable
                key={type}
                style={[styles.chip, filterType === type && styles.chipActive]}
                onPress={() => setFilterType(type)}
              >
                <Text style={[styles.chipText, filterType === type && styles.chipTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {SORTS.map((sort) => (
              <Pressable
                key={sort.key}
                style={[styles.chip, sortMode === sort.key && styles.chipActive]}
                onPress={() => setSortMode(sort.key)}
              >
                <Text style={[styles.chipText, sortMode === sort.key && styles.chipTextActive]}>{sort.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.sectionMeta}>{filteredProducts.length} produit(s) visible(s)</Text>

          {filteredProducts.map((item) => {
            const isFavorite = favorites.includes(item.id);
            return (
              <View key={item.id} style={styles.productCard}>
                <View style={styles.productTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productTitle}>{item.title}</Text>
                    <Text style={styles.productSub}>{item.creator} - {item.type}</Text>
                    <Text style={styles.productDesc}>{item.description}</Text>
                  </View>
                  <Pressable
                    style={[styles.favoriteBtn, isFavorite && styles.favoriteBtnActive]}
                    onPress={() => handleToggleFavorite(item)}
                  >
                    <Text style={styles.favoriteBtnText}>{isFavorite ? "Fav" : "+"}</Text>
                  </Pressable>
                </View>

                <View style={styles.tagRow}>
                  <Tag>{item.tag}</Tag>
                  <Tag>{item.genre}</Tag>
                  <Tag>{item.bpm} BPM</Tag>
                  <Tag>{item.license}</Tag>
                </View>

                <View style={styles.productBottom}>
                  <View>
                    <Text style={styles.price}>{euro(item.price)}</Text>
                    <Text style={styles.rating}>Note {item.rating} - {item.sales} ventes</Text>
                  </View>
                  <View style={styles.inlineActions}>
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={() => {
                        setPreviewItem(item);
                        setActiveTab("preview");
                        setFeedback(`Preview ouverte pour ${item.title}.`);
                      }}
                    >
                      <Text style={styles.secondaryBtnText}>Preview</Text>
                    </Pressable>
                    <Pressable
                      style={styles.primaryBtn}
                      onPress={() => handleAddToCart(item)}
                    >
                      <Text style={styles.primaryBtnText}>
                        {busyAction === `cart:${item.id}` ? "Ajout..." : "Ajouter"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {activeTab === "preview" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Preview</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
            {featuredProducts.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.featuredCard, previewItem?.id === item.id && styles.featuredCardActive]}
                onPress={() => {
                  setPreviewItem(item);
                  setFeedback(`Preview selectionnee: ${item.title}.`);
                }}
              >
                <Text style={styles.featuredTag}>{item.tag}</Text>
                <Text style={styles.featuredTitle}>{item.title}</Text>
                <Text style={styles.featuredSub}>{item.creator}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {previewItem ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewType}>{previewItem.type}</Text>
              <Text style={styles.previewTitle}>{previewItem.title}</Text>
              <Text style={styles.previewSub}>{previewItem.creator} - {previewItem.genre}</Text>
              <Text style={styles.previewDesc}>{previewItem.previewLabel || previewItem.description}</Text>

              <View style={styles.previewWave}>
                <View style={styles.previewWaveFill} />
              </View>

              <View style={styles.tagRow}>
                <Tag>{previewItem.bpm} BPM</Tag>
                <Tag>{previewItem.license}</Tag>
                <Tag>Note {previewItem.rating}</Tag>
              </View>

              <View style={styles.productBottom}>
                <View>
                  <Text style={styles.price}>{euro(previewItem.price)}</Text>
                  <Text style={styles.rating}>{previewItem.sales} ventes</Text>
                </View>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.secondaryBtn} onPress={() => setActiveTab("catalogue")}>
                    <Text style={styles.secondaryBtnText}>Retour catalogue</Text>
                  </Pressable>
                  <Pressable style={styles.primaryBtn} onPress={() => handleAddToCart(previewItem)}>
                    <Text style={styles.primaryBtnText}>
                      {busyAction === `cart:${previewItem.id}` ? "Ajout..." : "Ajouter"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>Aucun produit selectionne.</Text>
          )}

          <View style={styles.sidePanel}>
            <Text style={styles.sidePanelTitle}>Createurs a la une</Text>
            {creators.map((creator) => (
              <View key={creator.id} style={styles.creatorCard}>
                <Text style={styles.creatorName}>{creator.name}</Text>
                <Text style={styles.creatorMeta}>{creator.speciality}</Text>
                <Text style={styles.creatorSales}>{creator.followers}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sidePanel}>
            <Text style={styles.sidePanelTitle}>Panier</Text>
            {cart.length ? (
              <>
                {cart.map((item) => (
                  <View key={item.cart_item_id || `${item.id}-${item.title}`} style={styles.cartCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartTitle}>{item.title}</Text>
                      <Text style={styles.cartMeta}>{item.creator}</Text>
                    </View>
                    <View style={styles.cartActions}>
                      <Text style={styles.cartPrice}>{euro(item.price)}</Text>
                      <Pressable onPress={() => handleRemoveFromCart(item)}>
                        <Text style={styles.removeText}>
                          {busyAction === `remove:${item.cart_item_id}` ? "..." : "Retirer"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                <Pressable style={styles.checkoutBtn} onPress={handleCheckout}>
                  <Text style={styles.checkoutBtnText}>
                    {busyAction === "checkout" ? "Paiement..." : `Payer ${euro(totalCart)}`}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.emptyText}>Aucun article dans le panier.</Text>
            )}
          </View>
        </View>
      ) : null}

      {activeTab === "publier" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Publier un produit</Text>
          <Text style={styles.sectionMeta}>
            Connecte comme {currentUser?.display_name || currentUser?.username || currentUser?.email || "artiste"}
          </Text>

          <Field label="Titre">
            <TextInput
              value={form.title}
              onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
              placeholder="Titre du produit"
              placeholderTextColor="#6e7e96"
              style={styles.input}
            />
          </Field>

          <Field label="Type">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.filter((type) => type !== "Tout").map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, form.type === type && styles.chipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, type }))}
                >
                  <Text style={[styles.chipText, form.type === type && styles.chipTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Field>

          <Field label="Genre">
            <TextInput
              value={form.genre}
              onChangeText={(value) => setForm((prev) => ({ ...prev, genre: value }))}
              placeholder="Afro, House, Soul..."
              placeholderTextColor="#6e7e96"
              style={styles.input}
            />
          </Field>

          <View style={styles.duoFields}>
            <View style={{ flex: 1 }}>
              <Field label="Prix">
                <TextInput
                  value={form.price}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, price: value }))}
                  placeholder="35"
                  keyboardType="numeric"
                  placeholderTextColor="#6e7e96"
                  style={styles.input}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="BPM">
                <TextInput
                  value={form.bpm}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, bpm: value }))}
                  placeholder="102"
                  keyboardType="numeric"
                  placeholderTextColor="#6e7e96"
                  style={styles.input}
                />
              </Field>
            </View>
          </View>

          <Field label="Licence">
            <TextInput
              value={form.license}
              onChangeText={(value) => setForm((prev) => ({ ...prev, license: value }))}
              placeholder="Licence standard"
              placeholderTextColor="#6e7e96"
              style={styles.input}
            />
          </Field>

          <Field label="Description">
            <TextInput
              value={form.description}
              onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
              placeholder="Description du son, du pack ou du produit"
              placeholderTextColor="#6e7e96"
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
            />
          </Field>

          <Pressable style={styles.publishBtn} onPress={handlePublish}>
            <Text style={styles.publishBtnText}>
              {busyAction === "publish" ? "Publication..." : "Publier dans la boutique"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHelper}>{helper}</Text>
    </View>
  );
}

function Tag({ children }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#050914" },
  content: { padding: 16, paddingBottom: 140, gap: 16 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050914",
    padding: 24,
    gap: 14,
  },
  centerText: { color: "#dce8ff", fontWeight: "700" },
  hero: {
    borderWidth: 1,
    borderColor: "#20314a",
    borderRadius: 26,
    padding: 18,
    backgroundColor: "#09111f",
  },
  kicker: { color: "#6be7be", fontSize: 12, textTransform: "uppercase", letterSpacing: 2 },
  title: { color: "#f3f8ff", fontSize: 30, fontWeight: "900", marginTop: 10, lineHeight: 34 },
  subtitle: { color: "#9ab0d0", marginTop: 12, lineHeight: 20, fontSize: 14 },
  pageTabs: { flexDirection: "row", gap: 10, marginTop: 18, flexWrap: "wrap" },
  pageTab: {
    borderWidth: 1,
    borderColor: "#2a3d5e",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: "#101925",
  },
  pageTabActive: { backgroundColor: "#22c39a", borderColor: "#22c39a" },
  pageTabText: { color: "#dce6f7", fontWeight: "900", fontSize: 15 },
  pageTabTextActive: { color: "#04130d" },
  statsGrid: { marginTop: 18, gap: 10 },
  statCard: {
    borderWidth: 1,
    borderColor: "#20314a",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#111a29",
  },
  statLabel: { color: "#8ca3c5", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  statValue: { color: "#ffffff", fontWeight: "900", fontSize: 20, marginTop: 8 },
  statHelper: { color: "#9ab0d0", fontSize: 12, marginTop: 6 },
  panel: {
    borderWidth: 1,
    borderColor: "#20314a",
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#09111f",
    gap: 12,
  },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  panelTitle: { color: "#f4f8ff", fontSize: 22, fontWeight: "900" },
  ghostBtn: {
    borderWidth: 1,
    borderColor: "#294163",
    backgroundColor: "#101925",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  ghostBtnText: { color: "#dbe7fb", fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: "#2a3550",
    borderRadius: 16,
    backgroundColor: "#0d1424",
    color: "#f0f5ff",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  textarea: { minHeight: 110 },
  filterRow: { gap: 8, paddingRight: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#2f4262",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#0d1424",
  },
  chipActive: { borderColor: "#22c39a", backgroundColor: "#22c39a" },
  chipText: { color: "#d8e6fd", fontWeight: "700" },
  chipTextActive: { color: "#04130d" },
  sectionMeta: { color: "#8ea2ca", fontSize: 12 },
  productCard: {
    borderWidth: 1,
    borderColor: "#243750",
    borderRadius: 20,
    backgroundColor: "#0d1424",
    padding: 14,
    gap: 12,
  },
  productTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  productTitle: { color: "#f1f6ff", fontWeight: "900", fontSize: 17 },
  productSub: { color: "#86a0c4", marginTop: 4, fontSize: 13 },
  productDesc: { color: "#c2d3ef", marginTop: 8, lineHeight: 19, fontSize: 13 },
  favoriteBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#354865",
    backgroundColor: "#121d33",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteBtnActive: { borderColor: "#ef476f", backgroundColor: "#ef476f" },
  favoriteBtnText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    borderWidth: 1,
    borderColor: "#30435e",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#101925",
  },
  tagText: { color: "#d9e7fb", fontSize: 11, fontWeight: "700" },
  productBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  price: { color: "#ffffff", fontWeight: "900", fontSize: 22 },
  rating: { color: "#8ea2ca", marginTop: 4, fontSize: 12 },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#324b6f",
    backgroundColor: "#121d33",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryBtnText: { color: "#e1ebff", fontWeight: "800" },
  primaryBtn: {
    backgroundColor: "#22c39a",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryBtnText: { color: "#04130d", fontWeight: "900" },
  featuredRow: { gap: 10, paddingRight: 4 },
  featuredCard: {
    width: 210,
    borderWidth: 1,
    borderColor: "#243750",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#0d1424",
  },
  featuredCardActive: { borderColor: "#22c39a", backgroundColor: "#11261f" },
  featuredTag: { color: "#77f2ce", fontWeight: "800", fontSize: 11, textTransform: "uppercase" },
  featuredTitle: { color: "#f5f8ff", fontSize: 16, fontWeight: "900", marginTop: 10 },
  featuredSub: { color: "#9cb1cf", marginTop: 6, fontSize: 12 },
  previewCard: {
    borderWidth: 1,
    borderColor: "#23405a",
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#0d1424",
  },
  previewType: { color: "#77f2ce", fontWeight: "800", textTransform: "uppercase", fontSize: 11, letterSpacing: 1 },
  previewTitle: { color: "#f5f8ff", fontWeight: "900", fontSize: 28, marginTop: 10, lineHeight: 31 },
  previewSub: { color: "#98b0d2", marginTop: 8, fontSize: 14 },
  previewDesc: { color: "#d0ddf3", marginTop: 12, lineHeight: 21 },
  previewWave: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#16253c",
    overflow: "hidden",
    marginTop: 18,
  },
  previewWaveFill: { width: "48%", height: "100%", backgroundColor: "#22c39a" },
  sidePanel: {
    borderWidth: 1,
    borderColor: "#20314a",
    borderRadius: 20,
    backgroundColor: "#0d1424",
    padding: 14,
    gap: 10,
  },
  sidePanelTitle: { color: "#f1f6ff", fontWeight: "900", fontSize: 17 },
  creatorCard: {
    borderWidth: 1,
    borderColor: "#243750",
    borderRadius: 16,
    backgroundColor: "#101925",
    padding: 12,
  },
  creatorName: { color: "#f4f8ff", fontWeight: "800" },
  creatorMeta: { color: "#92a7c8", marginTop: 5, fontSize: 12 },
  creatorSales: { color: "#6fe9bf", marginTop: 8, fontSize: 12, fontWeight: "700" },
  cartCard: {
    borderWidth: 1,
    borderColor: "#243750",
    borderRadius: 16,
    backgroundColor: "#101925",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cartTitle: { color: "#f4f8ff", fontWeight: "800" },
  cartMeta: { color: "#8ea2ca", marginTop: 4, fontSize: 12 },
  cartActions: { alignItems: "flex-end", gap: 6 },
  cartPrice: { color: "#78efc8", fontWeight: "900" },
  removeText: { color: "#ff97a5", fontWeight: "800", fontSize: 12 },
  checkoutBtn: {
    marginTop: 6,
    backgroundColor: "#22c39a",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  checkoutBtnText: { color: "#04130d", fontWeight: "900", fontSize: 15 },
  emptyText: { color: "#8ea2ca", lineHeight: 19 },
  fieldLabel: { color: "#aac0df", marginBottom: 7, fontWeight: "700" },
  duoFields: { flexDirection: "row", gap: 12 },
  publishBtn: {
    marginTop: 8,
    backgroundColor: "#22c39a",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
  publishBtnText: { color: "#04130d", fontWeight: "900", fontSize: 15 },
  error: {
    color: "#ff9aa9",
    backgroundColor: "#341620",
    borderColor: "#5f2635",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  feedback: {
    color: "#9ff0c1",
    backgroundColor: "#11261f",
    borderColor: "#244f43",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
});
