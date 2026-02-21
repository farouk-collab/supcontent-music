import axios from "axios";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSpotifyAppCredentials() {
  const clientId = mustEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = mustEnv("SPOTIFY_CLIENT_SECRET");
  return { clientId, clientSecret };
}

export async function exchangeSpotifyAuthCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getSpotifyAppCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  }).toString();
  const res = await axios.post(SPOTIFY_TOKEN_URL, body, {
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 15000,
  });
  return res.data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type?: string;
    scope?: string;
  };
}

export async function refreshSpotifyUserAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getSpotifyAppCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }).toString();
  const res = await axios.post(SPOTIFY_TOKEN_URL, body, {
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 15000,
  });
  return res.data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type?: string;
    scope?: string;
  };
}

export async function spotifyUserGet(path: string, accessToken: string, params?: Record<string, any>) {
  const cleanPath = String(path || "").startsWith("/") ? path : `/${String(path || "")}`;
  const res = await axios.get(`${SPOTIFY_API_BASE}${cleanPath}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: params || {},
    timeout: 15000,
  });
  return res.data;
}
