import axios from "axios";
import { redis } from "../connections";

const TOKEN_KEY = "spotify:token";

async function getSpotifyToken(): Promise<string> {
  const cached = await redis.get(TOKEN_KEY);
  if (cached) return cached;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing Spotify credentials");

  const body = new URLSearchParams({ grant_type: "client_credentials" });

  const resp = await axios.post("https://accounts.spotify.com/api/token", body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
  });

  const token = resp.data.access_token as string;
  const expires = (resp.data.expires_in as number) || 3600;

  // expire un peu avant la vraie expiration
  await redis.set(TOKEN_KEY, token, "EX", Math.max(60, expires - 60));

  return token;
}

export async function spotifySearch(params: {
  q: string;
  type: "track" | "album" | "artist";
  page: number;
  limit: number;
}) {
  const q = params.q.trim();
  const type = params.type;
  
  // Ensure page and limit are valid numbers
  let page = Math.max(1, Math.floor(Number(params.page) || 1));
  let limit = Math.floor(Number(params.limit) || 20);
  
  // Spotify API limits: limit must be 1-50
  if (limit < 1) limit = 1;
  if (limit > 50) limit = 50;
  
  const offset = (page - 1) * limit;

  const cacheKey = `spotify:search:${type}:${q}:${page}:${limit}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const token = await getSpotifyToken();

  try {
    const resp = await axios.get("https://api.spotify.com/v1/search", {
      headers: { Authorization: `Bearer ${token}` },
      params: { q, type, limit, offset },
    });

    // cache 5 minutes
    await redis.set(cacheKey, JSON.stringify(resp.data), "EX", 300);

    return resp.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Spotify API error:", error.response?.status, error.response?.data);
      throw new Error(`Spotify API returned ${error.response?.status}: ${JSON.stringify(error.response?.data)}`);
    }
    throw error;
  }
}

export async function spotifyGet(type: "track" | "album" | "artist", id: string) {
  const cacheKey = `spotify:${type}:${id}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const token = await getSpotifyToken();

  const url =
    type === "track"
      ? `https://api.spotify.com/v1/tracks/${id}`
      : type === "album"
      ? `https://api.spotify.com/v1/albums/${id}`
      : `https://api.spotify.com/v1/artists/${id}`;

  const resp = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // cache 6 heures
  await redis.set(cacheKey, JSON.stringify(resp.data), "EX", 21600);

  return resp.data;
}
