import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
    case "collection_add": return "a ajouté à sa collection";
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
  const cover = item.image || "";
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

      <Pressable style={s.mediaRow} onPress={() => item.media_type && item.media_id && onOpenDetail(item.media_type, item.media_id)}>
        {cover ? (
          <Image source={{ uri: cover }} style={s.mediaCover} />
        ) : (
          <View style={s.mediaCoverFallback} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.mediaName} numberOfLines={1}>{item.media_name || item.media_id || "—"}</Text>
          <Text style={s.mediaSub} numberOfLines={1}>{item.media_type || ""}</Text>
          {item.rating ? <Stars rating={item.rating} /> : null}
          {item.text ? <Text style={s.reviewText} numberOfLines={3}>{item.text}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

export function FeedScreen({ onLoadFeed, onOpenDetail }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await onLoadFeed();
      const events = Array.isArray(data?.events) ? data.events : [];
      setItems(events);
    } catch (e) {
      setError(e?.message || "Impossible de charger le fil");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onLoadFeed]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={s.root}>
      <Text style={s.title}>Fil d'actualité</Text>

      {loading ? <ActivityIndicator color="#77c3ff" style={{ marginTop: 20 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.kind}:${item.created_at}:${i}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#77c3ff" />}
        renderItem={({ item }) => <FeedItem item={item} onOpenDetail={onOpenDetail} />}
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>Rien à afficher</Text>
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
  title: { color: "#f3f6ff", fontWeight: "900", fontSize: 22, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  error: { color: "#ff9aa9", marginHorizontal: 16, marginBottom: 8 },
  card: { backgroundColor: "#0b1322", borderWidth: 1, borderColor: "#263550", borderRadius: 14, padding: 14, marginTop: 10 },
  actorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#11203a" },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1e3356", alignItems: "center", justifyContent: "center" },
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
  emptyBox: { alignItems: "center", marginTop: 60, paddingHorizontal: 24 },
  emptyTitle: { color: "#c0d4f5", fontWeight: "900", fontSize: 18, marginBottom: 8 },
  emptySub: { color: "#6a86b5", textAlign: "center", lineHeight: 20 },
});
