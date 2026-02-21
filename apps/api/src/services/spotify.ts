import axios from "axios";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let searchRateLimitedUntil = 0;
let getRateLimitedUntil = 0;
let recommendationsRateLimitedUntil = 0;

function parseRetryAfterSeconds(raw: unknown): number {
  const MIN_SEC = 5;
  const MAX_SEC = 120;
  const clamp = (n: number) => Math.max(MIN_SEC, Math.min(MAX_SEC, n));
  if (raw == null) return 20;
  const fromArray = Array.isArray(raw) ? raw[0] : raw;
  const text = String(fromArray).trim();
  const asInt = Number.parseInt(text, 10);
  if (Number.isFinite(asInt) && asInt > 0) return clamp(asInt);
  const asDateMs = Date.parse(text);
  if (Number.isFinite(asDateMs)) {
    const deltaSeconds = Math.ceil((asDateMs - Date.now()) / 1000);
    if (deltaSeconds > 0) return clamp(deltaSeconds);
  }
  return clamp(20);
}

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
  } catch {
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

  const data = res.data as { access_token?: string; expires_in?: number };
  const token = String(data?.access_token || "");
  const expiresIn = Number(data?.expires_in ?? 3600);
  if (!token) throw new Error("Spotify token missing in response");

  cachedToken = token;
  tokenExpiresAt = Date.now() + Math.max(30, expiresIn - 30) * 1000;

  console.log("Spotify token refreshed");
  return token;
}

export type SpotifyType = "track" | "album" | "artist";

export async function spotifyRecommendations(params: {
  limit: number;
  market?: string;
  seedGenres?: string[];
  seedArtists?: string[];
  seedTracks?: string[];
}) {
  if (Date.now() < recommendationsRateLimitedUntil) {
    const retryAfterMs = Math.max(0, recommendationsRateLimitedUntil - Date.now());
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    const e = new Error(`Spotify API returned 429: recommendations cooldown active for ${retryAfterSec}s`);
    (e as any).status = 429;
    (e as any).data = { error: { message: "Rate limited (recommendations cooldown active)" } };
    (e as any).headers = { "retry-after": String(retryAfterSec) };
    throw e;
  }

  const token = await getAccessToken();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(params.limit) || 20)));
  const market = String(params.market || "FR").trim() || "FR";
  const seedGenres = Array.isArray(params.seedGenres) ? params.seedGenres.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const seedArtists = Array.isArray(params.seedArtists) ? params.seedArtists.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const seedTracks = Array.isArray(params.seedTracks) ? params.seedTracks.map((x) => String(x || "").trim()).filter(Boolean) : [];

  const totalSeeds = seedGenres.length + seedArtists.length + seedTracks.length;
  if (totalSeeds < 1 || totalSeeds > 5) {
    const e = new Error("Recommendations requires 1 to 5 seeds");
    (e as any).status = 400;
    throw e;
  }

  const query = new URLSearchParams({ market, limit: String(safeLimit) });
  if (seedGenres.length) query.set("seed_genres", seedGenres.join(","));
  if (seedArtists.length) query.set("seed_artists", seedArtists.join(","));
  if (seedTracks.length) query.set("seed_tracks", seedTracks.join(","));

  try {
    const res = await axios.get(`${SPOTIFY_API_BASE}/recommendations?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status ?? null;
    const data = err?.response?.data ?? null;
    const headers = err?.response?.headers ?? null;
    if (status === 429) {
      const retryAfter = parseRetryAfterSeconds(headers?.["retry-after"]);
      recommendationsRateLimitedUntil = Date.now() + retryAfter * 1000;
    }

    const e = new Error(`Spotify API returned ${status}: ${JSON.stringify(data)}`);
    (e as any).status = status;
    (e as any).data = data;
    (e as any).headers = headers;
    throw e;
  }
}

export async function spotifySearch(params: {
  q: string;
  type: SpotifyType;
  limit: number;
  offset: number;
}) {
  const SPOTIFY_SEARCH_MAX_LIMIT = 10;

  if (Date.now() < searchRateLimitedUntil) {
    const retryAfterMs = Math.max(0, searchRateLimitedUntil - Date.now());
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    const e = new Error(`Spotify API returned 429: cooldown active for ${retryAfterSec}s`);
    (e as any).status = 429;
    (e as any).data = { error: { message: "Rate limited (cooldown active)" } };
    (e as any).headers = { "retry-after": String(retryAfterSec) };
    throw e;
  }

  const token = await getAccessToken();
  const q = String(params.q ?? "").trim();
  const type = String(params.type ?? "track").trim() as SpotifyType;
  const limitNum = Math.max(
    1,
    Math.min(SPOTIFY_SEARCH_MAX_LIMIT, Math.trunc(Number(params.limit) || SPOTIFY_SEARCH_MAX_LIMIT))
  );
  const offsetNum = Math.max(0, Math.trunc(Number(params.offset) || 0));

  console.log("Spotify SEARCH params:", {
    q,
    type,
    limit: limitNum,
    offset: offsetNum,
    limitType: typeof params.limit,
  });

  try {
    const query = new URLSearchParams({
      q,
      type,
      limit: String(limitNum),
      offset: String(offsetNum),
      market: "FR",
    }).toString();
    const url = `${SPOTIFY_API_BASE}/search?${query}`;
    console.log("Spotify request URL:", url);

    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    return res.data;
  } catch (err: any) {
    const status = err?.response?.status ?? null;
    const data = err?.response?.data ?? null;
    const headers = err?.response?.headers ?? null;

    if (status === 429) {
      const retryAfter = parseRetryAfterSeconds(headers?.["retry-after"]);
      searchRateLimitedUntil = Date.now() + retryAfter * 1000;
      console.warn(`Spotify SEARCH rate limited, cooling down for ${retryAfter}s`);
    }

    console.error("Spotify SEARCH error:", status, data);

    const e = new Error(`Spotify API returned ${status}: ${JSON.stringify(data)}`);
    (e as any).status = status;
    (e as any).data = data;
    (e as any).headers = headers;
    throw e;
  }
}

export async function spotifyGet(type: SpotifyType, id: string) {
  if (Date.now() < getRateLimitedUntil) {
    const retryAfterMs = Math.max(0, getRateLimitedUntil - Date.now());
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    const e = new Error(`Spotify API returned 429: GET cooldown active for ${retryAfterSec}s`);
    (e as any).status = 429;
    (e as any).data = { error: { message: "Rate limited (GET cooldown active)" } };
    (e as any).headers = { "retry-after": String(retryAfterSec) };
    throw e;
  }

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
    const headers = err?.response?.headers ?? null;
    if (status === 429) {
      const retryAfter = parseRetryAfterSeconds(headers?.["retry-after"]);
      getRateLimitedUntil = Date.now() + retryAfter * 1000;
    }
    if (status !== 404 && status !== 429) {
      console.error("Spotify GET error:", status, data);
    }

    const e = new Error(`Spotify API returned ${status}: ${JSON.stringify(data)}`);
    (e as any).status = status;
    (e as any).data = data;
    (e as any).headers = headers;
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
