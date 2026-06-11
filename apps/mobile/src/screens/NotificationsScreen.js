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
  return `il y a ${Math.floor(h / 24)}j`;
}

function Avatar({ url, name }) {
  if (url) return <Image source={{ uri: url }} style={s.avatar} />;
  return (
    <View style={s.avatarFallback}>
      <Text style={s.avatarInitial}>{(name || "?")[0].toUpperCase()}</Text>
    </View>
  );
}

function Section({ title, data, renderItem, emptyText }) {
  if (!data || data.length === 0) return null;
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {data.map((item, i) => (
        <View key={i}>{renderItem(item)}</View>
      ))}
    </View>
  );
}

export function NotificationsScreen({ onLoadNotifications, onFollowUser, onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [followedIds, setFollowedIds] = useState(new Set());

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await onLoadNotifications();
      setData(result);
    } catch (e) {
      setError(e?.message || "Impossible de charger les notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onLoadNotifications]);

  useEffect(() => { load(); }, [load]);

  async function handleFollow(userId) {
    try {
      await onFollowUser(userId);
      setFollowedIds((prev) => new Set([...prev, userId]));
    } catch (e) {
      setError(e?.message || "Erreur");
    }
  }

  const followers = data?.followers || [];
  const suggestions = data?.suggestions || [];
  const replies = data?.comment_replies || [];
  const messages = data?.chat_messages || [];
  const total = followers.length + replies.length + messages.length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
        {total > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{total}</Text>
          </View>
        )}
      </View>

      {loading ? <ActivityIndicator color="#77c3ff" style={{ marginTop: 20 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <FlatList
        data={[1]}
        keyExtractor={() => "main"}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#77c3ff" />}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={() => (
          <View>
            <Section
              title="Nouveaux abonnés"
              data={followers}
              renderItem={(f) => (
                <View style={s.card}>
                  <Avatar url={f.avatar_url} name={f.display_name} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{f.display_name || f.username}</Text>
                    <Text style={s.sub}>vous suit maintenant</Text>
                  </View>
                  <Text style={s.time}>{timeAgo(f.created_at)}</Text>
                </View>
              )}
              emptyText=""
            />

            <Section
              title="Réponses à vos commentaires"
              data={replies}
              renderItem={(r) => (
                <View style={s.card}>
                  <Avatar url={r.avatar_url} name={r.display_name} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{r.display_name || r.username}</Text>
                    <Text style={s.reviewText} numberOfLines={2}>{r.body || "a répondu à votre commentaire"}</Text>
                  </View>
                  <Text style={s.time}>{timeAgo(r.created_at)}</Text>
                </View>
              )}
              emptyText=""
            />

            <Section
              title="Messages non lus"
              data={messages}
              renderItem={(m) => (
                <View style={s.card}>
                  <Avatar url={m.avatar_url} name={m.display_name} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{m.display_name || m.username}</Text>
                    <Text style={s.reviewText} numberOfLines={2}>{m.body || "vous a envoyé un message"}</Text>
                  </View>
                  <Text style={s.time}>{timeAgo(m.created_at)}</Text>
                </View>
              )}
              emptyText=""
            />

            {suggestions.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Suggestions d'abonnement</Text>
                {suggestions.map((u) => (
                  <View key={u.id} style={s.card}>
                    <Avatar url={u.avatar_url} name={u.display_name} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{u.display_name || u.username}</Text>
                      <Text style={s.sub}>{u.followers_count} abonné(s)</Text>
                    </View>
                    {!followedIds.has(u.id) ? (
                      <Pressable style={s.followBtn} onPress={() => handleFollow(u.id)}>
                        <Text style={s.followBtnText}>Suivre</Text>
                      </Pressable>
                    ) : (
                      <View style={s.followedBadge}>
                        <Text style={s.followedText}>Suivi ✓</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {total === 0 && !loading && (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>Tout est à jour</Text>
                <Text style={s.emptySub}>Aucune nouvelle notification pour l'instant.</Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  title: { color: "#f3f6ff", fontWeight: "900", fontSize: 22 },
  badge: { backgroundColor: "#3f83ff", borderRadius: 999, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  error: { color: "#ff9aa9", marginHorizontal: 16, marginBottom: 8 },
  section: { marginTop: 4, paddingHorizontal: 16 },
  sectionTitle: { color: "#7a95c5", fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#0b1322", borderWidth: 1, borderColor: "#263550", borderRadius: 12, padding: 12, marginTop: 6 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#11203a" },
  avatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#1e3356", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#77c3ff", fontWeight: "900", fontSize: 16 },
  name: { color: "#e8f0ff", fontWeight: "800", fontSize: 14 },
  sub: { color: "#7a95c5", fontSize: 12, marginTop: 2 },
  reviewText: { color: "#a0b8e0", fontSize: 13, marginTop: 2 },
  time: { color: "#546a8f", fontSize: 11 },
  followBtn: { backgroundColor: "#3f83ff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  followBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  followedBadge: { borderWidth: 1, borderColor: "#2a5040", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  followedText: { color: "#5db88a", fontWeight: "700", fontSize: 12 },
  emptyBox: { alignItems: "center", marginTop: 60, paddingHorizontal: 24 },
  emptyTitle: { color: "#c0d4f5", fontWeight: "900", fontSize: 18, marginBottom: 8 },
  emptySub: { color: "#6a86b5", textAlign: "center", lineHeight: 20 },
});
