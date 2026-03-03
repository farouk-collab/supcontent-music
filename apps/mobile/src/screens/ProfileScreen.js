import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export function ProfileScreen({ user, onRefresh, onSave, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    website: "",
    location: "",
    gender: "",
    birth_date: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      display_name: user.display_name || "",
      username: user.username || "",
      bio: user.bio || "",
      website: user.website || "",
      location: user.location || "",
      gender: user.gender || "",
      birth_date: user.birth_date || "",
    });
  }, [user]);

  async function refresh() {
    setLoading(true);
    setErrorText("");
    setSuccessText("");
    try {
      await onRefresh();
    } catch (e) {
      setErrorText(e?.message || "Failed to refresh profile");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setSaving(true);
    setErrorText("");
    setSuccessText("");
    try {
      await onSave(form);
      setSuccessText("Profile updated");
    } catch (e) {
      setErrorText(e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 130 }}>
      <Text style={styles.heading}>My Profile</Text>
      <Text style={styles.meta}>{user?.email || "-"}</Text>

      {loading ? <ActivityIndicator color="#77c3ff" /> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      {successText ? <Text style={styles.success}>{successText}</Text> : null}

      <Field label="Display name">
        <TextInput
          style={styles.input}
          value={form.display_name}
          onChangeText={(v) => setForm((prev) => ({ ...prev, display_name: v }))}
          placeholder="Display name"
          placeholderTextColor="#6c7a96"
        />
      </Field>
      <Field label="Username">
        <TextInput
          style={styles.input}
          value={form.username}
          onChangeText={(v) => setForm((prev) => ({ ...prev, username: v }))}
          placeholder="username"
          placeholderTextColor="#6c7a96"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Bio">
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          multiline
          value={form.bio}
          onChangeText={(v) => setForm((prev) => ({ ...prev, bio: v }))}
          placeholder="Your bio"
          placeholderTextColor="#6c7a96"
        />
      </Field>
      <Field label="Website">
        <TextInput
          style={styles.input}
          value={form.website}
          onChangeText={(v) => setForm((prev) => ({ ...prev, website: v }))}
          placeholder="https://..."
          placeholderTextColor="#6c7a96"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Location">
        <TextInput
          style={styles.input}
          value={form.location}
          onChangeText={(v) => setForm((prev) => ({ ...prev, location: v }))}
          placeholder="City, Country"
          placeholderTextColor="#6c7a96"
        />
      </Field>
      <Field label="Gender">
        <TextInput
          style={styles.input}
          value={form.gender}
          onChangeText={(v) => setForm((prev) => ({ ...prev, gender: v }))}
          placeholder="male / female / other / prefer_not_to_say"
          placeholderTextColor="#6c7a96"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Birth date (YYYY-MM-DD)">
        <TextInput
          style={styles.input}
          value={form.birth_date}
          onChangeText={(v) => setForm((prev) => ({ ...prev, birth_date: v }))}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#6c7a96"
          autoCapitalize="none"
        />
      </Field>

      <View style={styles.actions}>
        <Pressable style={styles.btnSecondary} onPress={refresh}>
          <Text style={styles.btnText}>Refresh</Text>
        </Pressable>
        <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={submit}>
          <Text style={styles.btnText}>{saving ? "Saving..." : "Save profile"}</Text>
        </Pressable>
        <Pressable style={styles.btnDanger} onPress={onLogout}>
          <Text style={styles.btnText}>Logout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#050914", padding: 16 },
  heading: { color: "#f3f6ff", fontWeight: "900", fontSize: 22 },
  meta: { color: "#8ea2ca", marginBottom: 8, marginTop: 4 },
  label: { color: "#9eb2db", marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#2a3550",
    borderRadius: 11,
    backgroundColor: "#0d1424",
    color: "#f0f5ff",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top" },
  error: { color: "#ff9aa9", marginTop: 8 },
  success: { color: "#9ff0c1", marginTop: 8 },
  actions: { marginTop: 14, gap: 9 },
  btnPrimary: { backgroundColor: "#3f83ff", borderRadius: 10, paddingVertical: 11 },
  btnSecondary: { backgroundColor: "#2b3f66", borderRadius: 10, paddingVertical: 11 },
  btnDanger: { backgroundColor: "#8c3040", borderRadius: 10, paddingVertical: 11 },
  btnText: { textAlign: "center", color: "#fff", fontWeight: "800" },
});
