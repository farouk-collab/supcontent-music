import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function actorName(item) {
  return item?.display_name || item?.username || item?.actor?.display_name || "Utilisateur";
}

function eventLabel(item) {
  if (item.kind === "review") return `a note ${item.rating || "-"} / 5`;
  if (item.kind === "comment") return "a commente une critique";
  if (item.kind === "collection") return "a ajoute un media a une liste";
  return "a une nouvelle activite";
}

export function ActivityScreen({ onLoadFeed, onLoadNotifications }) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [feed, setFeed] = useState([]);
  const [notifications, setNotifications] = useState(null);

  async function refresh() {
    setLoading(true);
    setErrorText("");
    try {
      const [feedData, notifData] = await Promise.all([onLoadFeed(), onLoadNotifications()]);
      setFeed(Array.isArray(feedData?.items) ? feedData.items : []);
      setNotifications(notifData || {});
    } catch (e) {
      setErrorText(e?.message || "Chargement activite impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);

  const followerCount = notifications?.followers?.length || 0;
  const suggestionCount = notifications?.suggestions?.length || 0;
  const replyCount = notifications?.comment_replies?.length || 0;
  const chatCount = notifications?.chat_messages?.length || 0;
  const likeCount = notifications?.review_likes?.length || 0;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 140 }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Activite</Text>
          <Text style={styles.sub}>Feed chronologique et notifications.</Text>
        </View>
        <Pressable style={styles.refresh} onPress={refresh}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color="#77c3ff" style={{ marginVertical: 10 }} /> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      <View style={styles.statsGrid}>
        <Stat label="Nouveaux abonnes" value={followerCount} />
        <Stat label="Reponses" value={replyCount} />
        <Stat label="Likes critiques" value={likeCount} />
        <Stat label="Messages non lus" value={chatCount} />
        <Stat label="Suggestions" value={suggestionCount} />
      </View>

      <Text style={styles.sectionTitle}>Fil d'actualite</Text>
      {feed.length ? (
        feed.map((item, index) => (
          <View key={`${item.kind}:${item.created_at}:${index}`} style={styles.card}>
            <Text style={styles.cardTitle}>{actorName(item)} {eventLabel(item)}</Text>
            <Text style={styles.cardMeta}>{item.media?.name || item.media_id || "Media"} - {item.media_type}</Text>
            {item.text ? <Text style={styles.body}>{item.text}</Text> : null}
            <Text style={styles.date}>{String(item.created_at || "").slice(0, 16).replace("T", " ")}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Aucune activite pour le moment. Suis des utilisateurs pour alimenter le feed.</Text>
      )}

      <Text style={styles.sectionTitle}>Notifications</Text>
      {(notifications?.followers || []).map((item) => (
        <View key={`follower:${item.id}`} style={styles.card}>
          <Text style={styles.cardTitle}>{item.display_name || item.username} te suit</Text>
          <Text style={styles.cardMeta}>Nouvel abonne</Text>
        </View>
      ))}
      {(notifications?.comment_replies || []).map((item) => (
        <View key={`reply:${item.id}`} style={styles.card}>
          <Text style={styles.cardTitle}>{item.display_name || item.username} a repondu</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ))}
      {(notifications?.review_likes || []).map((item, index) => (
        <View key={`like:${item.review_id}:${index}`} style={styles.card}>
          <Text style={styles.cardTitle}>{item.display_name || item.username} aime ta critique</Text>
          <Text style={styles.cardMeta}>{item.media_type} - {item.media_id}</Text>
        </View>
      ))}
      {!followerCount && !replyCount && !chatCount && !likeCount ? <Text style={styles.empty}>Aucune notification non lue.</Text> : null}
    </ScrollView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#050914", padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  heading: { color: "#f3f6ff", fontWeight: "900", fontSize: 22 },
  sub: { color: "#8ea2ca", marginTop: 3 },
  refresh: { backgroundColor: "#2b3f66", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  refreshText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  error: { color: "#ff9aa9", marginBottom: 8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  stat: { width: "48%", borderWidth: 1, borderColor: "#263550", borderRadius: 12, backgroundColor: "#0b1322", padding: 12 },
  statValue: { color: "#eff4ff", fontWeight: "900", fontSize: 22 },
  statLabel: { color: "#8ea2ca", marginTop: 4, fontSize: 12 },
  sectionTitle: { color: "#eff4ff", fontWeight: "900", fontSize: 18, marginTop: 18, marginBottom: 4 },
  card: { marginTop: 10, borderWidth: 1, borderColor: "#263550", borderRadius: 12, backgroundColor: "#0b1322", padding: 12 },
  cardTitle: { color: "#eff4ff", fontWeight: "800" },
  cardMeta: { color: "#8ea2ca", marginTop: 4, fontSize: 12 },
  body: { color: "#d2def7", marginTop: 8, lineHeight: 19 },
  date: { color: "#647693", marginTop: 8, fontSize: 11 },
  empty: { color: "#8ea2ca", marginTop: 12, textAlign: "center" },
});
