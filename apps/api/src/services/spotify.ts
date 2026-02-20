import axios from "axios";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  let clientId: string;
  let clientSecret: string;
  try {
    clientId = mustEnv("SPOTIFY_CLIENT_ID");
    clientSecret = mustEnv("SPOTIFY_CLIENT_SECRET");
  } catch (err: any) {
    const e = new Error(
      "Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your environment or .env file."
    );
    (e as any).status = 503;
    throw e;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await axios.post(
    SPOTIFY_TOKEN_URL,
    new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    {
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 15000,
    }
  );

  // ⛔️ VS Code souligne parfois car res.data est "unknown" => on cast proprement
  const data = res.data as { access_token?: string; expires_in?: number };

  const token = String(data?.access_token || "");
  const expiresIn = Number(data?.expires_in ?? 3600);
  if (!token) throw new Error("Spotify token missing in response");

  cachedToken = token;
  tokenExpiresAt = Date.now() + Math.max(30, expiresIn - 30) * 1000;

  console.log("🎧 Spotify token refreshed");
  return token;
}

export type SpotifyType = "track" | "album" | "artist";

export async function spotifySearch(params: {
  q: string;
  type: SpotifyType;
  limit: number;
  offset: number;
}) {
  const SPOTIFY_SEARCH_MAX_LIMIT = 10;
  const token = await getAccessToken();

  const q = String(params.q ?? "").trim();
  const type = String(params.type ?? "track").trim() as SpotifyType;

  const limitNum = Math.max(
    1,
    Math.min(SPOTIFY_SEARCH_MAX_LIMIT, Math.trunc(Number(params.limit) || SPOTIFY_SEARCH_MAX_LIMIT))
  );
  const offsetNum = Math.max(0, Math.trunc(Number(params.offset) || 0));

  console.log("🎵 Spotify SEARCH params:", { q, type, limit: limitNum, offset: offsetNum, limitType: typeof params.limit });

  try {
    const query = new URLSearchParams({
      q,
      type,
      limit: String(limitNum),
      offset: String(offsetNum),
      market: "FR",
    }).toString();
    const url = `${SPOTIFY_API_BASE}/search?${query}`;
    console.log("🎧 Spotify request URL:", url);
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    return res.data;
  } catch (err: any) {
    const status = err?.response?.status ?? null;
    const data = err?.response?.data ?? null;
    console.error("❌ Spotify SEARCH error:", status, data);

    const e = new Error(`Spotify API returned ${status}: ${JSON.stringify(data)}`);
    (e as any).status = status;
    (e as any).data = data;
    throw e;
  }
}

export async function spotifyGet(type: SpotifyType, id: string) {
  const token = await getAccessToken();

  const safeType: SpotifyType =
    type === "track" || type === "album" || type === "artist" ? type : "track";

  try {
    const res = await axios.get(`${SPOTIFY_API_BASE}/${safeType}s/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { market: "FR" },
      timeout: 15000,
    });
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status ?? null;
    const data = err?.response?.data ?? null;
    console.error("❌ Spotify GET error:", status, data);

    const e = new Error(`Spotify API returned ${status}: ${JSON.stringify(data)}`);
    (e as any).status = status;
    (e as any).data = data;
    throw e;
  }
}

export async function spotifyNewReleases(limit = 10) {
  const token = await getAccessToken();
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(Number(limit) || 10)));

  try {
    const res = await axios.get(`${SPOTIFY_API_BASE}/browse/new-releases`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { country: "FR", limit: safeLimit },
      timeout: 15000,
    });
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status ?? null;
    const data = err?.response?.data ?? null;
    console.error("Spotify NEW RELEASES error:", status, data);

    const e = new Error(`Spotify API returned ${status}: ${JSON.stringify(data)}`);
    (e as any).status = status;
    (e as any).data = data;
    throw e;
  }
}
