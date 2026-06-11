import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function UsersScreen({ onSearchUsers, onToggleFollow, onLoadFollows }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [users, setUsers] = useState([]);
  const [follows, setFollows] = useState({ followers: [], following: [] });

  async function refreshFollows() {
    try {
      const data = await onLoadFollows();
      setFollows(data || { followers: [], following: [] });
    } catch {
      setFollows({ followers: [], following: [] });
    }
  }

  async function search() {
    setLoading(true);
    setErrorText("");
    try {
      const data = await onSearchUsers(q.trim());
      setUsers(Array.isArray(data?.users) ? data.users : []);
      await refreshFollows();
    } catch (e) {
      setErrorText(e?.message || "Recherche utilisateur impossible");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(user) {
    try {
      await onToggleFollow(user.id, Boolean(user.is_following));
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, is_following: !user.is_following } : item
        )
      );
      await refreshFollows();
    } catch (e) {
      setErrorText(e?.message || "Action follow impossible");
    }
  }

  useEffect(() => {
    refreshFollows();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Utilisateurs</Text>
      <Text style={styles.sub}>Recherche, follow, abonnes et abonnements.</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Pseudo ou nom"
          placeholderTextColor="#6c7a96"
          style={styles.input}
        />
        <Pressable style={styles.searchBtn} onPress={search}>
          <Text style={styles.btnText}>Go</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color="#77c3ff" style={{ marginTop: 10 }} /> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      <View style={styles.countRow}>
        <Counter label="Abonnes" value={follows.followers_count || follows.followers?.length || 0} />
        <Counter label="Abonnements" value={follows.following_count || follows.following?.length || 0} />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListEmptyComponent={<Text style={styles.empty}>Cherche un utilisateur pour le suivre.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.display_name || item.username}</Text>
              <Text style={styles.meta}>@{item.username || "user"} - {item.followers_count || 0} abonnes</Text>
              {item.bio ? <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text> : null}
            </View>
            <Pressable
              style={[styles.followBtn, item.is_following && styles.followBtnActive]}
              onPress={() => toggle(item)}
            >
              <Text style={styles.btnText}>{item.is_following ? "Suivi" : "Suivre"}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

function Counter({ label, value }) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterValue}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#050914", padding: 16 },
  heading: { color: "#f3f6ff", fontWeight: "900", fontSize: 22 },
  sub: { color: "#8ea2ca", marginTop: 3 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: "#2a3550", borderRadius: 10, backgroundColor: "#0d1424", color: "#f0f5ff", paddingHorizontal: 12, paddingVertical: 10 },
  searchBtn: { width: 58, borderRadius: 10, backgroundColor: "#3f83ff", justifyContent: "center" },
  btnText: { textAlign: "center", color: "#fff", fontWeight: "800", fontSize: 12 },
  error: { color: "#ff9aa9", marginTop: 8 },
  countRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  counter: { flex: 1, borderWidth: 1, borderColor: "#263550", borderRadius: 12, backgroundColor: "#0b1322", padding: 12 },
  counterValue: { color: "#eff4ff", fontSize: 22, fontWeight: "900" },
  counterLabel: { color: "#8ea2ca", fontSize: 12, marginTop: 3 },
  card: { marginTop: 10, borderWidth: 1, borderColor: "#263550", borderRadius: 12, backgroundColor: "#0b1322", padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  name: { color: "#eff4ff", fontWeight: "900" },
  meta: { color: "#8ea2ca", marginTop: 3, fontSize: 12 },
  bio: { color: "#d2def7", marginTop: 7, fontSize: 12 },
  followBtn: { minWidth: 74, borderRadius: 999, backgroundColor: "#3f83ff", paddingVertical: 9, paddingHorizontal: 10 },
  followBtnActive: { backgroundColor: "#2b3f66" },
  empty: { color: "#8ea2ca", marginTop: 24, textAlign: "center" },
});
