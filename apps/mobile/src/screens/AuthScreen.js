import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function AuthScreen({ onLogin, onRegister, loading, errorText }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) return false;
    if (mode === "register" && !displayName.trim()) return false;
    return true;
  }, [displayName, email, mode, password]);

  async function submit() {
    if (!canSubmit || loading) return;
    if (mode === "login") {
      await onLogin({ email: email.trim(), password });
      return;
    }
    await onRegister({ email: email.trim(), password, displayName: displayName.trim() });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>SUPCONTENT Mobile</Text>
      <Text style={styles.subtitle}>Auth + Search + Media + Profile</Text>

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === "login" && styles.modeBtnActive]}
          onPress={() => setMode("login")}
        >
          <Text style={styles.modeText}>Login</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === "register" && styles.modeBtnActive]}
          onPress={() => setMode("register")}
        >
          <Text style={styles.modeText}>Register</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="email@example.com"
        placeholderTextColor="#6c7a96"
        value={email}
        onChangeText={setEmail}
      />
      {mode === "register" ? (
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor="#6c7a96"
          value={displayName}
          onChangeText={setDisplayName}
        />
      ) : null}
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#6c7a96"
        value={password}
        onChangeText={setPassword}
      />

      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      <Pressable
        style={[styles.submit, (!canSubmit || loading) && styles.submitDisabled]}
        onPress={submit}
      >
        <Text style={styles.submitText}>{loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 22,
    justifyContent: "center",
    backgroundColor: "#050914",
  },
  title: {
    color: "#f3f6ff",
    fontWeight: "900",
    fontSize: 28,
    marginBottom: 4,
  },
  subtitle: {
    color: "#98a6c5",
    marginBottom: 18,
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#2a3550",
    backgroundColor: "#0d1424",
  },
  modeBtnActive: {
    borderColor: "#77c3ff",
    backgroundColor: "#15223a",
  },
  modeText: {
    textAlign: "center",
    color: "#dde6ff",
    fontWeight: "700",
  },
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
  error: {
    color: "#ff9aa9",
    marginBottom: 10,
  },
  submit: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: "#3f83ff",
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "800",
  },
});
