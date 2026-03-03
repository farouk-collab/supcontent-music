import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const TYPES = ["track", "album", "artist"];

export function SearchScreen({ onSearch, onOpenDetail }) {
  const [q, setQ] = useState("daft punk");
  const [type, setType] = useState("artist");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [items, setItems] = useState([]);

  const canSearch = useMemo(() => q.trim().length > 0, [q]);

  async function submit() {
    if (!canSearch || loading) return;
    setLoading(true);
    setErrorText("");
    try {
      const next = await onSearch({ q: q.trim(), type });
      setItems(Array.isArray(next) ? next : []);
    } catch (e) {
      setErrorText(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Search</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search artists, tracks, albums"
        placeholderTextColor="#6c7a96"
        style={styles.input}
      />

      <View style={styles.typesRow}>
        {TYPES.map((it) => (
          <Pressable
            key={it}
            onPress={() => setType(it)}
            style={[styles.typeBtn, type === it && styles.typeBtnActive]}
          >
            <Text style={styles.typeText}>{it}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={submit}
        style={[styles.searchBtn, (!canSearch || loading) && styles.searchBtnDisabled]}
      >
        <Text style={styles.searchBtnText}>Run Search</Text>
      </Pressable>

      {loading ? <ActivityIndicator style={{ marginTop: 10 }} color="#77c3ff" /> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpenDetail(item.type, item.id)}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.cover} /> : <View style={styles.coverFallback} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {item.subtitle || "-"}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.type}</Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No results yet. Start a search.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#050914" },
  heading: { color: "#f3f6ff", fontWeight: "900", fontSize: 22, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#2a3550",
    borderRadius: 11,
    backgroundColor: "#0d1424",
    color: "#f0f5ff",
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  typesRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a3550",
    backgroundColor: "#0d1424",
  },
  typeBtnActive: { borderColor: "#77c3ff", backgroundColor: "#15223a" },
  typeText: { textAlign: "center", color: "#dbe7ff", fontWeight: "700", textTransform: "capitalize" },
  searchBtn: { backgroundColor: "#3f83ff", borderRadius: 10, paddingVertical: 11, marginBottom: 8 },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { textAlign: "center", color: "#fff", fontWeight: "800" },
  error: { color: "#ff9aa9", marginBottom: 8 },
  card: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#263550",
    backgroundColor: "#0b1322",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  cover: { width: 62, height: 62, borderRadius: 8, backgroundColor: "#11203a" },
  coverFallback: { width: 62, height: 62, borderRadius: 8, backgroundColor: "#11203a" },
  name: { color: "#eff4ff", fontWeight: "800" },
  sub: { color: "#8fa2c9", marginTop: 2, fontSize: 12 },
  badge: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#334665",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: "#9fb3db", fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  empty: { color: "#8ea2ca", marginTop: 24, textAlign: "center" },
});
