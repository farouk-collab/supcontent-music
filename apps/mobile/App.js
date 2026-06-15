import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View, Pressable, Linking } from "react-native";
import { AuthScreen } from "./src/screens/AuthScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { MediaDetailScreen } from "./src/screens/MediaDetailScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { ShopScreen } from "./src/screens/ShopScreen";
import { UsersScreen } from "./src/screens/UsersScreen";
import { createApiClient, ApiError } from "./src/api/client";
import { clearSession, loadSession, saveSession } from "./src/storage/session";
import { API_BASE_URL } from "./src/config";
import { extractGoogleOAuthTokens } from "./src/oauth.mjs";

const GOOGLE_MOBILE_REDIRECT_URI = "supcontentmusic://auth/callback";

const TABS = [
  { key: "feed", label: "Fil" },
  { key: "search", label: "Recherche" },
  { key: "library", label: "Biblio." },
  { key: "users", label: "Membres" },
  { key: "shop", label: "Boutique" },
  { key: "notifs", label: "Notifs" },
  { key: "profile", label: "Profil" },
];

const ROUTE_TITLES = {
  feed: "Fil d'actualité",
  search: "Recherche musicale",
  library: "Ma bibliothèque",
  users: "Communauté",
  shop: "Boutique",
  notifs: "Notifications",
  profile: "Mon profil",
  detail: "Détail",
};

export default function App() {
  const api = useMemo(() => createApiClient(), []);
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [route, setRoute] = useState({ name: "feed", params: null });

  const persistSession = useCallback(async (next) => {
    setSession(next);
    await saveSession(next);
  }, []);

  const hydrateOauthSession = useCallback(
    async (url) => {
      if (!url) return false;
      try {
        const tokens = extractGoogleOAuthTokens(url);
        if (!tokens) return false;

        const data = await api.me(tokens.accessToken);
        await persistSession({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: data.user || null,
        });
        setAuthError("");
        return true;
      } catch (e) {
        setAuthError(e?.message || "Google sign-in failed");
        return false;
      } finally {
        setAuthLoading(false);
      }
    },
    [api, persistSession]
  );

  const navigate = useCallback((name, params = null) => {
    setRoute((current) => ({ name, params, previous: current.name }));
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = session?.refreshToken;
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {}
    await clearSession();
    setSession(null);
    setRoute({ name: "feed", params: null });
  }, [api, session?.refreshToken]);

  const callAuthed = useCallback(
    async (work) => {
      if (!session?.accessToken) throw new ApiError("Non authentifié", 401);
      try {
        return await work(session.accessToken);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401 || !session?.refreshToken) throw e;
      }
      const refreshed = await api.refresh(session.refreshToken);
      const nextSession = { ...session, accessToken: refreshed.accessToken };
      await persistSession(nextSession);
      return work(nextSession.accessToken);
    },
    [api, persistSession, session]
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const stored = await loadSession();
      const initialUrl = await Linking.getInitialURL();
      const oauthSessionLoaded = await hydrateOauthSession(initialUrl);
      if (!cancelled) {
        setSession(oauthSessionLoaded ? await loadSession() : stored);
        setBooting(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [hydrateOauthSession]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      hydrateOauthSession(url);
    });
    return () => subscription.remove();
  }, [hydrateOauthSession]);

  // Auth
  const onLogin = useCallback(async ({ email, password }) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await api.login({ email, password });
      await persistSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user || null });
    } catch (e) {
      setAuthError(e?.message || "Échec de la connexion");
    } finally {
      setAuthLoading(false);
    }
  }, [api, persistSession]);

  const onRegister = useCallback(async ({ email, password, displayName }) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await api.register({ email, password, displayName });
      await persistSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user || null });
    } catch (e) {
      setAuthError(e?.message || "Échec de l'inscription");
    } finally {
      setAuthLoading(false);
    }
  }, [api, persistSession]);

  const onGoogleLogin = useCallback(async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const target = `${API_BASE_URL}/auth/oauth/google/start?returnTo=${encodeURIComponent(
        GOOGLE_MOBILE_REDIRECT_URI
      )}`;
      await Linking.openURL(target);
    } catch (e) {
      setAuthError(e?.message || "Unable to start Google sign-in");
      setAuthLoading(false);
    }
  }, []);

  // Search & Media
  const searchMedia = useCallback(async ({ q, type }) => {
    const data = await api.search({ q, type });
    return api.normalizeSearchItems(data);
  }, [api]);

  const loadMedia = useCallback(async ({ type, id }) => api.media({ type, id }), [api]);

  // Feed
  const loadFeed = useCallback(async () => callAuthed((token) => api.feed(token)), [api, callAuthed]);

  // Notifications
  const loadNotifications = useCallback(async () => callAuthed((token) => api.notifications(token)), [api, callAuthed]);

  // Collections / Library
  const loadCollections = useCallback(async () => callAuthed((token) => api.collectionsMe(token)), [api, callAuthed]);

  const createCollection = useCallback(async (payload) =>
    callAuthed((token) => api.createCollection(token, payload)), [api, callAuthed]);

  const deleteCollection = useCallback(async (id) =>
    callAuthed((token) => api.deleteCollection(token, id)), [api, callAuthed]);

  const updateCollection = useCallback(async (id, payload) =>
    callAuthed((token) => api.updateCollection(token, id, payload)), [api, callAuthed]);

  // Reviews
  const loadReviews = useCallback(async (mediaType, mediaId) =>
    api.mediaReviews(mediaType, mediaId, session?.accessToken || null), [api, session?.accessToken]);

  const createReview = useCallback(async (mediaType, mediaId, rating, body) =>
    callAuthed((token) => api.createReview(token, mediaType, mediaId, rating, body)), [api, callAuthed]);

  const deleteReview = useCallback(async (reviewId) =>
    callAuthed((token) => api.deleteReview(token, reviewId)), [api, callAuthed]);

  const voteReview = useCallback(async (reviewId, vote) =>
    callAuthed((token) => api.voteReview(token, reviewId, vote)), [api, callAuthed]);

  const createReviewComment = useCallback(async (reviewId, body) =>
    callAuthed((token) => api.createReviewComment(token, reviewId, body)), [api, callAuthed]);

  const deleteComment = useCallback(async (commentId) =>
    callAuthed((token) => api.deleteComment(token, commentId)), [api, callAuthed]);

  const voteComment = useCallback(async (commentId, vote) =>
    callAuthed((token) => api.voteComment(token, commentId, vote)), [api, callAuthed]);

  // Add to status collection
  const addToStatus = useCallback(async (status, mediaType, mediaId) =>
    callAuthed((token) => api.addToStatus(token, status, mediaType, mediaId)), [api, callAuthed]);

  // Follows
  const followUser = useCallback(async (userId) =>
    callAuthed((token) => api.followUser(token, userId)), [api, callAuthed]);

  const searchUsers = useCallback(async (query) =>
    callAuthed((token) => api.searchUsers(token, query)), [api, callAuthed]);

  const toggleFollow = useCallback(async (userId, following) =>
    callAuthed((token) => following
      ? api.unfollowUser(token, userId)
      : api.followUser(token, userId)), [api, callAuthed]);

  const loadFollows = useCallback(async () =>
    callAuthed((token) => api.followsMe(token)), [api, callAuthed]);

  // Shop
  const loadShopProducts = useCallback(async () => api.shopProducts(), [api]);
  const loadShopCreators = useCallback(async () => api.shopSpotlight(), [api]);
  const loadShopFavorites = useCallback(async () =>
    callAuthed((token) => api.shopFavorites(token)), [api, callAuthed]);
  const loadShopCart = useCallback(async () =>
    callAuthed((token) => api.shopCart(token)), [api, callAuthed]);
  const addShopCartItem = useCallback(async (productId) =>
    callAuthed((token) => api.shopAddToCart(token, productId)), [api, callAuthed]);
  const removeShopCartItem = useCallback(async (cartItemId) =>
    callAuthed((token) => api.shopRemoveFromCart(token, cartItemId)), [api, callAuthed]);
  const toggleShopFavorite = useCallback(async (productId, isFavorite) =>
    callAuthed((token) => isFavorite
      ? api.shopRemoveFavorite(token, productId)
      : api.shopAddFavorite(token, productId)), [api, callAuthed]);
  const checkoutShop = useCallback(async () =>
    callAuthed((token) => api.shopCheckout(token)), [api, callAuthed]);
  const publishShopProduct = useCallback(async (payload) =>
    callAuthed((token) => api.shopPublishProduct(token, payload)), [api, callAuthed]);

  // Profile
  const refreshMe = useCallback(async () => {
    const data = await callAuthed((token) => api.me(token));
    await persistSession({ ...session, user: data.user || null });
    return data.user;
  }, [api, callAuthed, persistSession, session]);

  const saveMe = useCallback(async (payload) => {
    const data = await callAuthed((token) => api.patchMe(token, payload));
    await persistSession({ ...session, user: data.user || null });
    return data.user;
  }, [api, callAuthed, persistSession, session]);

  if (booting) {
    return (
      <SafeAreaView style={styles.boot}>
        <Text style={styles.bootText}>SUPCONTENT Music</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <AuthScreen
          onLogin={onLogin}
          onRegister={onRegister}
          onGoogleLogin={onGoogleLogin}
          loading={authLoading}
          errorText={authError}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topBar}>
        {route.name === "detail" ? (
          <Pressable style={styles.topBtn} onPress={() => navigate(route.previous || "search")}>
            <Text style={styles.topBtnText}>← Retour</Text>
          </Pressable>
        ) : (
          <View style={styles.topBtnPlaceholder} />
        )}
        <Text style={styles.topTitle}>{ROUTE_TITLES[route.name] || "SUPCONTENT"}</Text>
        <Pressable style={styles.topBtn} onPress={logout}>
          <Text style={styles.topBtnText}>Déco.</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {route.name === "feed" ? (
          <FeedScreen
            onLoadFeed={loadFeed}
            onOpenDetail={(type, id) => navigate("detail", { type, id })}
            onDiscover={searchMedia}
          />
        ) : null}

        {route.name === "search" ? (
          <SearchScreen onSearch={searchMedia} onOpenDetail={(type, id) => navigate("detail", { type, id })} />
        ) : null}

        {route.name === "library" ? (
          <LibraryScreen
            onLoadCollections={loadCollections}
            onCreateCollection={createCollection}
            onDeleteCollection={deleteCollection}
            onUpdateCollection={updateCollection}
          />
        ) : null}

        {route.name === "notifs" ? (
          <NotificationsScreen
            onLoadNotifications={loadNotifications}
            onFollowUser={followUser}
            onNavigate={navigate}
          />
        ) : null}

        {route.name === "users" ? (
          <UsersScreen
            onSearchUsers={searchUsers}
            onToggleFollow={toggleFollow}
            onLoadFollows={loadFollows}
          />
        ) : null}

        {route.name === "shop" ? (
          <ShopScreen
            currentUser={session.user}
            onLoadProducts={loadShopProducts}
            onLoadCreators={loadShopCreators}
            onLoadFavorites={loadShopFavorites}
            onLoadCart={loadShopCart}
            onAddToCart={addShopCartItem}
            onRemoveFromCart={removeShopCartItem}
            onToggleFavorite={toggleShopFavorite}
            onCheckout={checkoutShop}
            onPublish={publishShopProduct}
          />
        ) : null}

        {route.name === "detail" ? (
          <MediaDetailScreen
            mediaType={route.params?.type}
            mediaId={route.params?.id}
            onLoad={loadMedia}
            onLoadReviews={loadReviews}
            onCreateReview={createReview}
            onDeleteReview={deleteReview}
            onVoteReview={voteReview}
            onCreateReviewComment={createReviewComment}
            onDeleteComment={deleteComment}
            onVoteComment={voteComment}
            onAddToStatus={addToStatus}
            session={session}
          />
        ) : null}

        {route.name === "profile" ? (
          <ProfileScreen user={session.user} onRefresh={refreshMe} onSave={saveMe} onLogout={logout} />
        ) : null}
      </View>

      {route.name !== "detail" ? (
        <View style={styles.bottomTabs}>
          {TABS.map((tab) => (
            <TabButton key={tab.key} label={tab.label} active={route.name === tab.key} onPress={() => navigate(tab.key)} />
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#050914" },
  bootText: { color: "#77c3ff", fontWeight: "900", fontSize: 22, letterSpacing: 2 },
  topBar: {
    height: 54,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#22324d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0a1223",
  },
  topTitle: { color: "#f3f6ff", fontWeight: "900", fontSize: 15 },
  topBtn: {
    minWidth: 60,
    borderWidth: 1,
    borderColor: "#334b72",
    backgroundColor: "#12203a",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  topBtnPlaceholder: { minWidth: 60 },
  topBtnText: { textAlign: "center", color: "#d9e8ff", fontWeight: "700", fontSize: 12 },
  content: { flex: 1 },
  bottomTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#22324d",
    backgroundColor: "#0a1223",
  },
  tabBtn: {
    flexGrow: 1,
    flexBasis: "28%",
    borderWidth: 1,
    borderColor: "#2f4264",
    borderRadius: 9,
    backgroundColor: "#121d33",
    paddingVertical: 9,
  },
  tabBtnActive: { borderColor: "#76c4ff", backgroundColor: "#1b2b47" },
  tabText: { textAlign: "center", color: "#8fa8d8", fontWeight: "700", fontSize: 11 },
  tabTextActive: { color: "#e3edff" },
});
