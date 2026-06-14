import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const GENRES = [
  { key: "rap", label: "Rap", query: "rap hip hop 2024" },
  { key: "pop", label: "Pop", query: "pop hits 2024" },
  { key: "afro", label: "Afrobeat", query: "afrobeats 2024" },
  { key: "rnb", label: "R&B", query: "rnb soul 2024" },
  { key: "rock", label: "Rock", query: "rock music 2024" },
  { key: "electro", label: "Électro", query: "electronic dance 2024" },
  { key: "jazz", label: "Jazz", query: "jazz music" },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

function kindLabel(kind) {
  switch (kind) {
    case "review": return "a noté";
    case "comment": return "a commenté";
    case "collection": return "a ajouté à sa collection";
    default: return kind;
  }
}

function Stars({ rating }) {
  if (!rating) return null;
  return (
    <Text style={s.stars}>
      {"★".repeat(Math.max(0, Math.min(5, rating)))}
      {"☆".repeat(Math.max(0, 5 - Math.min(5, rating)))}
    </Text>
  );
}

function FeedItem({ item, onOpenDetail }) {
  const cover = item.media?.image || "";
  return (
    <View style={s.card}>
      <View style={s.actorRow}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarInitial}>{(item.display_name || "?")[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.actorName}>{item.display_name || item.username || "Utilisateur"}</Text>
          <Text style={s.actorAction}>{kindLabel(item.kind)}</Text>
        </View>
        <Text style={s.time}>{timeAgo(item.created_at)}</Text>
      </View>

      <Pressable
        style={s.mediaRow}
        onPress={() => item.media_type && item.media_id && onOpenDetail(item.media_type, item.media_id)}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={s.mediaCover} />
        ) : (
          <View style={s.mediaCoverFallback} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.mediaName} numberOfLines={1}>{item.media?.name || item.media_id || "—"}</Text>
          <Text style={s.mediaSub} numberOfLines={1}>{item.media?.subtitle || item.media_type || ""}</Text>
          {item.rating ? <Stars rating={item.rating} /> : null}
          {item.text ? <Text style={s.reviewText} numberOfLines={3}>{item.text}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

function DiscoverCard({ item, onOpenDetail }) {
  return (
    <Pressable style={s.discoverCard} onPress={() => onOpenDetail(item.type, item.id)}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={s.discoverImage} />
      ) : (
        <View style={s.discoverImageFallback} />
      )}
      <Text style={s.discoverName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.discoverSub} numberOfLines={1}>{item.subtitle || ""}</Text>
    </Pressable>
  );
}

export function FeedScreen({ onLoadFeed, onOpenDetail, onDiscover }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const [activeGenre, setActiveGenre] = useState("rap");
  const [genreItems, setGenreItems] = useState([]);
  const [genreLoading, setGenreLoading] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await onLoadFeed();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || "Impossible de charger le fil");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onLoadFeed]);

  const loadGenre = useCallback(async (genreKey) => {
    if (!onDiscover) return;
    const genre = GENRES.find((g) => g.key === genreKey);
    if (!genre) return;
    setGenreLoading(true);
    try {
      const results = await onDiscover({ q: genre.query, type: "track" });
      setGenreItems(Array.isArray(results) ? results : []);
    } catch {}
    setGenreLoading(false);
  }, [onDiscover]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadGenre(activeGenre); }, [activeGenre, loadGenre]);

  const ListHeader = useMemo(() => (
    <View>
      <Text style={s.title}>Découverte</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.genreTabs}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 2 }}
      >
        {GENRES.map((g) => (
          <Pressable
            key={g.key}
            style={[s.genreTab, activeGenre === g.key && s.genreTabActive]}
            onPress={() => setActiveGenre(g.key)}
          >
            <Text style={[s.genreTabText, activeGenre === g.key && s.genreTabTextActive]}>{g.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {genreLoading ? (
        <ActivityIndicator color="#77c3ff" style={{ marginVertical: 16 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}
        >
          {genreItems.slice(0, 8).map((item) => (
            <DiscoverCard key={`${item.type}:${item.id}`} item={item} onOpenDetail={onOpenDetail} />
          ))}
          {genreItems.length === 0 && !genreLoading && (
            <Text style={s.discoverEmpty}>Aucun résultat.</Text>
          )}
        </ScrollView>
      )}
      <Text style={[s.title, { marginTop: 8 }]}>Fil d'actualité</Text>
      {loading && !refreshing ? <ActivityIndicator color="#77c3ff" style={{ marginVertical: 8 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  ), [activeGenre, genreItems, genreLoading, loading, refreshing, error, onOpenDetail]);

  return (
    <View style={s.root}>
      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.kind}:${item.created_at}:${i}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#77c3ff" />
        }
        renderItem={({ item }) => <FeedItem item={item} onOpenDetail={onOpenDetail} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>Aucune activité</Text>
              <Text style={s.emptySub}>Suivez des utilisateurs pour voir leurs activités ici.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  title: {
    color: "#f3f6ff",
    fontWeight: "900",
    fontSize: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  error: { color: "#ff9aa9", marginHorizontal: 16, marginBottom: 8 },

  genreTabs: { marginBottom: 12 },
  genreTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a3550",
    backgroundColor: "#0d1424",
  },
  genreTabActive: { borderColor: "#77c3ff", backgroundColor: "#15223a" },
  genreTabText: { color: "#8fa8d8", fontWeight: "700", fontSize: 13 },
  genreTabTextActive: { color: "#e3f0ff" },

  discoverCard: {
    width: 120,
    backgroundColor: "#0b1322",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e3050",
  },
  discoverImage: { width: 120, height: 120, backgroundColor: "#11203a" },
  discoverImageFallback: { width: 120, height: 120, backgroundColor: "#11203a" },
  discoverName: { color: "#d8e8ff", fontWeight: "700", fontSize: 12, paddingHorizontal: 8, paddingTop: 6 },
  discoverSub: { color: "#6a86b5", fontSize: 11, paddingHorizontal: 8, paddingBottom: 8 },
  discoverEmpty: { color: "#546a8f", marginTop: 16, fontSize: 13 },

  card: {
    backgroundColor: "#0b1322",
    borderWidth: 1,
    borderColor: "#263550",
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  actorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#11203a" },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e3356",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#77c3ff", fontWeight: "900", fontSize: 16 },
  actorName: { color: "#e8f0ff", fontWeight: "800", fontSize: 14 },
  actorAction: { color: "#7a95c5", fontSize: 12, marginTop: 1 },
  time: { color: "#546a8f", fontSize: 11 },
  mediaRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  mediaCover: { width: 52, height: 52, borderRadius: 8, backgroundColor: "#11203a" },
  mediaCoverFallback: { width: 52, height: 52, borderRadius: 8, backgroundColor: "#11203a" },
  mediaName: { color: "#d8e8ff", fontWeight: "700", fontSize: 14 },
  mediaSub: { color: "#6a86b5", fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  stars: { color: "#f5c842", fontSize: 14, marginTop: 4, letterSpacing: 1 },
  reviewText: { color: "#a8c0e8", fontSize: 13, marginTop: 6, lineHeight: 18 },

  emptyBox: { alignItems: "center", marginTop: 24, paddingHorizontal: 24 },
  emptyTitle: { color: "#c0d4f5", fontWeight: "900", fontSize: 16, marginBottom: 6 },
  emptySub: { color: "#6a86b5", textAlign: "center", lineHeight: 20, fontSize: 13 },
});
