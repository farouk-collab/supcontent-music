import { API_BASE_URL, SEARCH_LIMIT } from "../config";

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function parseResponse(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data?.erreur || data?.error || data?.message || `HTTP ${res.status}`;
    throw new ApiError(message, res.status, data);
  }
  return data;
}

function pickImage(item) {
  const fromItem = Array.isArray(item?.images) ? item.images : [];
  const fromAlbum = Array.isArray(item?.album?.images) ? item.album.images : [];
  const first = [...fromItem, ...fromAlbum][0];
  return first?.url || "";
}

function pickSearchItems(payload) {
  return (
    payload?.items ||
    payload?.tracks?.items ||
    payload?.albums?.items ||
    payload?.artists?.items ||
    []
  );
}

export function createApiClient() {
  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    return parseResponse(response);
  }

  return {
    register: ({ email, password, displayName }) =>
      request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      }),

    login: ({ email, password }) =>
      request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),

    refresh: (refreshToken) =>
      request("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }),

    logout: (refreshToken) =>
      request("/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }),

    me: (accessToken) =>
      request("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),

    patchMe: (accessToken, payload) =>
      request("/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }),

    search: ({ q, type = "track", limit = SEARCH_LIMIT }) =>
      request(
        `/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(
          type
        )}&limit=${encodeURIComponent(limit)}`
      ),

    media: ({ type, id }) =>
      request(`/media/${encodeURIComponent(type)}/${encodeURIComponent(id)}`),

    normalizeSearchItems: (payload) =>
      pickSearchItems(payload).map((item) => {
        const artists = Array.isArray(item?.artists)
          ? item.artists.map((a) => a?.name).filter(Boolean)
          : [];
        const genres = Array.isArray(item?.genres)
          ? item.genres.filter(Boolean)
          : [];
        return {
          id: String(item?.id || ""),
          type: String(item?.type || ""),
          name: String(item?.name || "Unknown"),
          subtitle: artists.join(", ") || genres.join(", "),
          image: pickImage(item),
        };
      }),
  };
}
