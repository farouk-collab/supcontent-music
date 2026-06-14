export function extractGoogleOAuthTokens(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const accessToken = parsed.searchParams.get("accessToken");
    const refreshToken = parsed.searchParams.get("refreshToken");
    const provider = parsed.searchParams.get("oauth");

    if (!accessToken || !refreshToken || provider !== "google") return null;

    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}
