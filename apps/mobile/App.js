import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View, Pressable } from "react-native";
import { AuthScreen } from "./src/screens/AuthScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { MediaDetailScreen } from "./src/screens/MediaDetailScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { createApiClient, ApiError } from "./src/api/client";
import { clearSession, loadSession, saveSession } from "./src/storage/session";
import { API_BASE_URL } from "./src/config";

export default function App() {
  const api = useMemo(() => createApiClient(), []);
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [route, setRoute] = useState({ name: "search", params: null });

  const persistSession = useCallback(async (next) => {
    setSession(next);
    await saveSession(next);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = session?.refreshToken;
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // ignore remote logout error
    }
    await clearSession();
    setSession(null);
    setRoute({ name: "search", params: null });
  }, [api, session?.refreshToken]);

  const callAuthed = useCallback(
    async (work) => {
      if (!session?.accessToken) throw new ApiError("Not authenticated", 401);
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
      if (!cancelled) {
        setSession(stored);
        setBooting(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const onLogin = useCallback(
    async ({ email, password }) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const data = await api.login({ email, password });
        await persistSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user || null,
        });
      } catch (e) {
        setAuthError(e?.message || "Login failed");
      } finally {
        setAuthLoading(false);
      }
    },
    [api, persistSession]
  );

  const onRegister = useCallback(
    async ({ email, password, displayName }) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const data = await api.register({ email, password, displayName });
        await persistSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user || null,
        });
      } catch (e) {
        setAuthError(e?.message || "Register failed");
      } finally {
        setAuthLoading(false);
      }
    },
    [api, persistSession]
  );

  const searchMedia = useCallback(
    async ({ q, type }) => {
      const data = await api.search({ q, type });
      return api.normalizeSearchItems(data);
    },
    [api]
  );

  const loadMedia = useCallback(
    async ({ type, id }) => {
      return api.media({ type, id });
    },
    [api]
  );

  const refreshMe = useCallback(async () => {
    const data = await callAuthed((token) => api.me(token));
    await persistSession({ ...session, user: data.user || null });
    return data.user;
  }, [api, callAuthed, persistSession, session]);

  const saveMe = useCallback(
    async (payload) => {
      const data = await callAuthed((token) => api.patchMe(token, payload));
      await persistSession({ ...session, user: data.user || null });
      return data.user;
    },
    [api, callAuthed, persistSession, session]
  );

  if (booting) {
    return (
      <SafeAreaView style={styles.boot}>
        <Text style={styles.bootText}>Loading mobile app...</Text>
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
          <Pressable style={styles.topBtn} onPress={() => setRoute({ name: "search", params: null })}>
            <Text style={styles.topBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.topBtnPlaceholder} />
        )}
        <Text style={styles.topTitle}>SUPCONTENT Mobile</Text>
        <Pressable style={styles.topBtn} onPress={logout}>
          <Text style={styles.topBtnText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {route.name === "search" ? (
          <SearchScreen
            onSearch={searchMedia}
            onOpenDetail={(type, id) => setRoute({ name: "detail", params: { type, id } })}
          />
        ) : null}

        {route.name === "detail" ? (
          <MediaDetailScreen
            mediaType={route.params?.type}
            mediaId={route.params?.id}
            onLoad={loadMedia}
          />
        ) : null}

        {route.name === "profile" ? (
          <ProfileScreen user={session.user} onRefresh={refreshMe} onSave={saveMe} onLogout={logout} />
        ) : null}
      </View>

      {route.name !== "detail" ? (
        <View style={styles.bottomTabs}>
          <TabButton
            label="Search"
            active={route.name === "search"}
            onPress={() => setRoute({ name: "search", params: null })}
          />
          <TabButton
            label="Profile"
            active={route.name === "profile"}
            onPress={() => setRoute({ name: "profile", params: null })}
          />
        </View>
      ) : null}

      <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={styles.tabText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#050914" },
  bootText: { color: "#e8f0ff", fontWeight: "700" },
  topBar: {
    height: 54,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#22324d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0a1223",
  },
  topTitle: { color: "#f3f6ff", fontWeight: "800", fontSize: 16 },
  topBtn: {
    minWidth: 64,
    borderWidth: 1,
    borderColor: "#334b72",
    backgroundColor: "#12203a",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  topBtnPlaceholder: { minWidth: 64 },
  topBtnText: { textAlign: "center", color: "#d9e8ff", fontWeight: "700", fontSize: 12 },
  content: { flex: 1 },
  bottomTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#22324d",
    backgroundColor: "#0a1223",
  },
  tabBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2f4264",
    borderRadius: 10,
    backgroundColor: "#121d33",
    paddingVertical: 10,
  },
  tabBtnActive: { borderColor: "#76c4ff", backgroundColor: "#1b2b47" },
  tabText: { textAlign: "center", color: "#e3edff", fontWeight: "700" },
  apiHint: {
    position: "absolute",
    right: 10,
    bottom: 84,
    color: "#7088b3",
    fontSize: 10,
  },
});
