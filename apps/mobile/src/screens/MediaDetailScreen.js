import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function pickImage(item) {
  const fromItem = Array.isArray(item?.images) ? item.images : [];
  const fromAlbum = Array.isArray(item?.album?.images) ? item.album.images : [];
  const first = [...fromItem, ...fromAlbum][0];
  return first?.url || "";
}

export function MediaDetailScreen({ mediaType, mediaId, onLoad }) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErrorText("");
      try {
        const next = await onLoad({ type: mediaType, id: mediaId });
        if (!cancelled) setData(next);
      } catch (e) {
        if (!cancelled) setErrorText(e?.message || "Failed to load media");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [mediaId, mediaType, onLoad]);

  const image = pickImage(data);
  const artists = Array.isArray(data?.artists)
    ? data.artists.map((a) => a?.name).filter(Boolean).join(", ")
    : "";
  const genres = Array.isArray(data?.genres) ? data.genres.filter(Boolean).join(", ") : "";

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.heading}>Media Detail</Text>
      <Text style={styles.meta}>
        {mediaType} • {mediaId}
      </Text>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color="#77c3ff" /> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      {data ? (
        <View style={styles.card}>
          {image ? <Image source={{ uri: image }} style={styles.cover} /> : <View style={styles.coverFallback} />}
          <Text style={styles.name}>{data?.name || "Untitled"}</Text>
          {artists ? <Text style={styles.sub}>{artists}</Text> : null}

          <View style={styles.row}>
            <Badge label={String(data?.type || mediaType)} />
            {typeof data?.popularity === "number" ? <Badge label={`pop ${data.popularity}`} /> : null}
            {data?.album?.release_date ? <Badge label={data.album.release_date} /> : null}
          </View>

          {genres ? <Text style={styles.paragraph}>Genres: {genres}</Text> : null}
          {data?.album?.name ? <Text style={styles.paragraph}>Album: {data.album.name}</Text> : null}
          {data?.degraded ? <Text style={styles.warn}>Limited data mode (rate limit fallback).</Text> : null}
        </View>
      ) : null}

      <Pressable style={styles.refresh} onPress={() => onLoad({ type: mediaType, id: mediaId }).then(setData).catch((e) => setErrorText(e?.message || "Refresh failed"))}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

function Badge({ label }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#050914", padding: 16 },
  heading: { color: "#f3f6ff", fontSize: 22, fontWeight: "900" },
  meta: { color: "#8ea2ca", marginTop: 4, marginBottom: 12 },
  error: { color: "#ff9aa9", marginTop: 10 },
  card: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#25344f",
    borderRadius: 12,
    backgroundColor: "#0b1322",
    padding: 12,
  },
  cover: { width: "100%", height: 220, borderRadius: 10, backgroundColor: "#11203a" },
  coverFallback: { width: "100%", height: 220, borderRadius: 10, backgroundColor: "#11203a" },
  name: { color: "#eef4ff", fontWeight: "900", fontSize: 19, marginTop: 10 },
  sub: { color: "#97abd2", marginTop: 4 },
  row: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  badge: {
    borderWidth: 1,
    borderColor: "#334666",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: "#a3b8e0", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  paragraph: { color: "#d2def7", marginTop: 10, lineHeight: 20 },
  warn: { color: "#ffd49d", marginTop: 10 },
  refresh: { marginTop: 14, backgroundColor: "#2d5eb8", borderRadius: 10, paddingVertical: 10 },
  refreshText: { textAlign: "center", color: "#fff", fontWeight: "800" },
});
