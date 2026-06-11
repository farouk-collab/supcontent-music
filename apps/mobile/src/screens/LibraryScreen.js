import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const STATUSES = [
  { key: "a_voir", label: "À écouter" },
  { key: "en_cours", label: "En cours" },
  { key: "termine", label: "Terminé" },
  { key: "abandonne", label: "Abandonné" },
];

export function LibraryScreen({ onLoadCollections, onCreateCollection, onDeleteCollection, onUpdateCollection }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [collections, setCollections] = useState([]);
  const [activeTab, setActiveTab] = useState("status");

  // Modal état
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await onLoadCollections();
      setCollections(Array.isArray(data?.collections) ? data.collections : []);
    } catch (e) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [onLoadCollections]);

  useEffect(() => { load(); }, [load]);

  const statusCollections = collections.filter((c) => c.is_default);
  const customCollections = collections.filter((c) => !c.is_default);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreateCollection({ name: newName.trim(), is_public: newPublic });
      setNewName("");
      setNewPublic(false);
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e?.message || "Erreur de création");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    try {
      await onDeleteCollection(id);
      await load();
    } catch (e) {
      setError(e?.message || "Erreur de suppression");
    }
  }

  async function handleTogglePublic(col) {
    try {
      await onUpdateCollection(col.id, { is_public: !col.is_public });
      await load();
    } catch (e) {
      setError(e?.message || "Erreur de mise à jour");
    }
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Ma Bibliothèque</Text>
        <Pressable style={s.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={s.addBtnText}>+ Liste</Text>
        </Pressable>
      </View>

      <View style={s.tabs}>
        <Pressable style={[s.tab, activeTab === "status" && s.tabActive]} onPress={() => setActiveTab("status")}>
          <Text style={s.tabText}>Statuts</Text>
        </Pressable>
        <Pressable style={[s.tab, activeTab === "custom" && s.tabActive]} onPress={() => setActiveTab("custom")}>
          <Text style={s.tabText}>Mes listes</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color="#77c3ff" style={{ marginTop: 20 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {activeTab === "status" ? (
        <FlatList
          data={statusCollections.length > 0 ? statusCollections : STATUSES.map((st) => ({ id: st.key, name: st.label, item_count: 0, is_default: true }))}
          keyExtractor={(item) => item.id || item.key}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardLeft}>
                <Text style={s.cardName}>{item.name}</Text>
                <Text style={s.cardMeta}>{item.item_count ?? 0} œuvre(s)</Text>
              </View>
              <View style={s.badge}>
                <Text style={s.badgeText}>défaut</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={!loading ? <Text style={s.empty}>Aucune collection trouvée.</Text> : null}
        />
      ) : (
        <FlatList
          data={customCollections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardLeft}>
                <Text style={s.cardName}>{item.name}</Text>
                <Text style={s.cardMeta}>{item.item_count ?? 0} œuvre(s)</Text>
              </View>
              <View style={s.cardActions}>
                <Pressable style={s.actionBtn} onPress={() => handleTogglePublic(item)}>
                  <Text style={s.actionText}>{item.is_public ? "Public" : "Privé"}</Text>
                </Pressable>
                <Pressable style={[s.actionBtn, s.actionDanger]} onPress={() => handleDelete(item.id)}>
                  <Text style={s.actionText}>Suppr.</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={!loading ? <Text style={s.empty}>Aucune liste personnalisée. Créez-en une !</Text> : null}
        />
      )}

      <Modal visible={showCreate} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Nouvelle liste</Text>
            <TextInput
              style={s.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nom de la liste"
              placeholderTextColor="#6c7a96"
            />
            <Pressable style={s.toggleRow} onPress={() => setNewPublic((v) => !v)}>
              <View style={[s.checkbox, newPublic && s.checkboxActive]} />
              <Text style={s.toggleLabel}>Rendre publique</Text>
            </Pressable>
            <View style={s.modalActions}>
              <Pressable style={s.modalCancel} onPress={() => setShowCreate(false)}>
                <Text style={s.modalBtnText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[s.modalConfirm, (creating || !newName.trim()) && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={creating || !newName.trim()}
              >
                <Text style={s.modalBtnText}>{creating ? "Création..." : "Créer"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050914" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { color: "#f3f6ff", fontWeight: "900", fontSize: 22 },
  addBtn: { backgroundColor: "#3f83ff", borderRadius: 9, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: "#2a3550", backgroundColor: "#0d1424" },
  tabActive: { borderColor: "#77c3ff", backgroundColor: "#15223a" },
  tabText: { textAlign: "center", color: "#dbe7ff", fontWeight: "700" },
  error: { color: "#ff9aa9", marginHorizontal: 16, marginBottom: 8 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#0b1322", borderWidth: 1, borderColor: "#263550", borderRadius: 12, padding: 14, marginTop: 10 },
  cardLeft: { flex: 1 },
  cardName: { color: "#eff4ff", fontWeight: "800", fontSize: 15 },
  cardMeta: { color: "#7a95c5", marginTop: 3, fontSize: 12 },
  badge: { borderWidth: 1, borderColor: "#334665", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: "#8fa3cc", fontSize: 11, fontWeight: "700" },
  cardActions: { flexDirection: "row", gap: 6 },
  actionBtn: { borderWidth: 1, borderColor: "#334665", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#112034" },
  actionDanger: { borderColor: "#6b2a35", backgroundColor: "#2a0e13" },
  actionText: { color: "#d0e2ff", fontSize: 12, fontWeight: "700" },
  empty: { color: "#8ea2ca", marginTop: 24, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#0e1b30", borderRadius: 16, padding: 20, width: "85%", borderWidth: 1, borderColor: "#2a3f60" },
  modalTitle: { color: "#f0f6ff", fontWeight: "900", fontSize: 18, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: "#2a3550", borderRadius: 10, backgroundColor: "#0d1424", color: "#f0f5ff", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: "#3a5080" },
  checkboxActive: { backgroundColor: "#3f83ff", borderColor: "#3f83ff" },
  toggleLabel: { color: "#c0d4f5", fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancel: { flex: 1, backgroundColor: "#1e2f4a", borderRadius: 10, paddingVertical: 11 },
  modalConfirm: { flex: 1, backgroundColor: "#3f83ff", borderRadius: 10, paddingVertical: 11 },
  modalBtnText: { textAlign: "center", color: "#fff", fontWeight: "800" },
});
