import { Platform } from "react-native";
import Constants from "expo-constants";

function detectDefaultApiBaseUrl() {
  if (Platform.OS === "android") return "http://10.0.2.2:1234";
  // In Expo Go, use the same host IP as the Metro bundler
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const host = debuggerHost.split(":")[0];
    return `http://${host}:1234`;
  }
  return "http://localhost:1234";
}

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || detectDefaultApiBaseUrl()
).replace(/\/+$/, "");

export const SEARCH_LIMIT = 10;
