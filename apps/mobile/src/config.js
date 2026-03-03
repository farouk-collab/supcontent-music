import { Platform } from "react-native";

function detectDefaultApiBaseUrl() {
  if (Platform.OS === "android") return "http://10.0.2.2:1234";
  return "http://localhost:1234";
}

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || detectDefaultApiBaseUrl()
).replace(/\/+$/, "");

export const SEARCH_LIMIT = 10;
