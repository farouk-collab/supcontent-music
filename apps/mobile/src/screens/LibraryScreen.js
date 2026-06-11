import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const STATUS_LABELS = {
  a_voir: "A ecouter",
  en_cours: "En cours",
  termine: "Termine",
  abandonne: "Abandonne",
};

export function LibraryScreen({
  onLoad,
  onCreate,
  onRename,
  onDelete,
  onRemoveItem,
  onOpenDetail,
}) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [collections, setCollections] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const selected = useMemo(
    () => collections.find((item) => item.id === selectedId) || collections[0] || null,
    [collections, selectedId]
  );

  async function refresh() {
    setLoading(true);
    setErrorText("");
    try {
      const data = await onLoad();
      const next = Array.isArray(data?.collections) ? data.collections : [];
      setCollections(next);
      if (!selectedId || !next.some((item) => item.id === selectedId)) {
        setSelectedId(next[0]?.id || "");
      }
    } catch (e) {
      setErrorText(e?.message || "Impossible de charger la bibliotheque");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    const clean = name.trim();
    if (!clean) return;
    setErrorText("");
    try {
      await onCreate({ name: clean, is_public: isPublic });
      setName("");
      setIsPublic(false);
      await refresh();
    } catch (e) {
      setErrorText(e?.message || "Creation impossible");
    }
  }

  async function renameSelected() {
    if (!selected || selected.status_code || !name.trim()) return;
    try {
      await onRename(selected.id, { name: name.trim(), is_public: isPublic });
      setName("");
      await refresh();
    } catch (e) {
      setErrorText(e?.message || "Modification impossible");
    }
  }

  async function deleteSelected() {
    if (!selected || selected.status_code) return;
    try {
      await onDelete(selected.id);
      setName("");
      await refresh();
    } catch (e) {
      setErrorText(e?.message || "Suppression impossible");
    }
  }

  async function removeItem(row) {
    if (!selected || !row) return;
    try {
      await onRemoveItem(selected.id, row.media_type, row.media_id);
      await refresh();
    } catch (e) {
      setErrorText(e?.message || "Retrait impossible");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 140 }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Bibliotheque</Text>
          <Text style={styles.sub}>Statuts, listes personnalisees et confidentialite.</Text>
        </View>
        <Pressable style={styles.smallBtn} onPress={refresh}>
          <Text style={styles.btnText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color="#77c3ff" style={{ marginVertical: 10 }} /> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      <View style={styles.formCard}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={selected?.status_code ? "Nom de nouvelle liste" : "Nom de liste ou nouveau nom"}
          placeholderTextColor="#6c7a96"
          style={styles.input}
        />
        <Pressable style={[styles.toggle, isPublic && styles.toggleActive]} onPress={() => setIsPublic((v) => !v)}>
          <Text style={styles.toggleText}>{isPublic ? "Liste publique" : "Liste privee"}</Text>
        </Pressable>
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryBtn} onPress={create}>
            <Text style={styles.btnText}>Creer</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, (!selected || selected.status_code) && styles.disabled]}
            onPress={renameSelected}
          >
            <Text style={styles.btnText}>Renommer</Text>
          </Pressable>
          <Pressable
            style={[styles.dangerBtn, (!selected || selected.status_code) && styles.disabled]}
            onPress={deleteSelected}
          >
            <Text style={styles.btnText}>Supprimer</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={collections}
        horizontal
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.collectionChip, selected?.id === item.id && styles.collectionChipActive]}
            onPress={() => {
              setSelectedId(item.id);
              setName(item.status_code ? "" : item.name || "");
              setIsPublic(Boolean(item.is_public));
            }}
          >
            <Text style={styles.chipTitle}>{STATUS_LABELS[item.status_code] || item.name}</Text>
            <Text style={styles.chipMeta}>{item.items?.length || 0} media(s)</Text>
          </Pressable>
        )}
      />

      {selected ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>{STATUS_LABELS[selected.status_code] || selected.name}</Text>
          <Text style={styles.meta}>
            {selected.status_code ? "Statut par defaut" : selected.is_public ? "Liste publique" : "Liste privee"}
          </Text>
          {(selected.items || []).length ? (
            selected.items.map((row) => (
              <View key={`${row.media_type}:${row.media_id}`} style={styles.mediaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mediaTitle}>{row.media?.name || row.media_id}</Text>
                  <Text style={styles.mediaMeta}>{row.media_type} - {row.media?.subtitle || "Spotify"}</Text>
                </View>
                <View style={styles.mediaActions}>
                  <Pressable style={styles.openBtn} onPress={() => onOpenDetail?.(row.media_type, row.media_id)}>
                    <Text style={styles.openText}>Ouvrir</Text>
                  </Pressable>
                  {!selected.status_code ? (
                    <Pressable style={styles.removeBtn} onPress={() => removeItem(row)}>
                      <Text style={styles.removeText}>Retirer</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Aucun media dans cette liste pour le moment.</Text>
          )}
        </View>
      ) : (
        <Text style={styles.empty}>Aucune collection disponible.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#050914", padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
  heading: { color: "#f3f6ff", fontWeight: "900", fontSize: 22 },
  sub: { color: "#8ea2ca", marginTop: 3 },
  error: { color: "#ff9aa9", marginBottom: 8 },
  formCard: { borderWidth: 1, borderColor: "#263550", backgroundColor: "#0b1322", borderRadius: 12, padding: 12, marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#2a3550", borderRadius: 10, backgroundColor: "#0d1424", color: "#f0f5ff", paddingHorizontal: 12, paddingVertical: 10 },
  toggle: { marginTop: 10, borderWidth: 1, borderColor: "#334665", borderRadius: 10, paddingVertical: 9, backgroundColor: "#121d33" },
  toggleActive: { borderColor: "#70e0a5", backgroundColor: "#143321" },
  toggleText: { color: "#dbe7ff", textAlign: "center", fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  primaryBtn: { flex: 1, backgroundColor: "#3f83ff", borderRadius: 10, paddingVertical: 10 },
  secondaryBtn: { flex: 1, backgroundColor: "#2b3f66", borderRadius: 10, paddingVertical: 10 },
  dangerBtn: { flex: 1, backgroundColor: "#8c3040", borderRadius: 10, paddingVertical: 10 },
  disabled: { opacity: 0.45 },
  smallBtn: { backgroundColor: "#2b3f66", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  btnText: { textAlign: "center", color: "#fff", fontWeight: "800", fontSize: 12 },
  collectionChip: { width: 150, borderWidth: 1, borderColor: "#263550", backgroundColor: "#0b1322", borderRadius: 12, padding: 12 },
  collectionChipActive: { borderColor: "#77c3ff", backgroundColor: "#15223a" },
  chipTitle: { color: "#eff4ff", fontWeight: "900" },
  chipMeta: { color: "#8ea2ca", marginTop: 4, fontSize: 12 },
  detailCard: { borderWidth: 1, borderColor: "#263550", backgroundColor: "#0b1322", borderRadius: 12, padding: 12 },
  sectionTitle: { color: "#eff4ff", fontSize: 18, fontWeight: "900" },
  meta: { color: "#8ea2ca", marginTop: 4 },
  mediaRow: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#1e2a42", paddingTop: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  mediaTitle: { color: "#eff4ff", fontWeight: "800" },
  mediaMeta: { color: "#8ea2ca", fontSize: 12, marginTop: 3 },
  mediaActions: { gap: 8, alignItems: "flex-end" },
  openBtn: { borderWidth: 1, borderColor: "#3f83ff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  openText: { color: "#d9e8ff", fontWeight: "800", fontSize: 12 },
  removeBtn: { borderWidth: 1, borderColor: "#8c3040", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  removeText: { color: "#ffbdc7", fontWeight: "800", fontSize: 12 },
  empty: { color: "#8ea2ca", marginTop: 18, textAlign: "center" },
});
