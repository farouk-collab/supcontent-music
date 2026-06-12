export function decodeOauthReturnTo(encodedPayload: string | undefined, fallback: string) {
  if (!encodedPayload) return fallback;
  try {
    const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      returnTo?: unknown;
    };
    const returnTo = typeof decoded?.returnTo === "string" ? decoded.returnTo.trim() : "";
    return returnTo || fallback;
  } catch {
    return fallback;
  }
}

export function buildOauthSuccessRedirect(
  returnTo: string,
  fallbackWebOrigin: string,
  params: Record<string, string>
) {
  const fallback = `${fallbackWebOrigin.replace(/\/+$/, "")}/connexion/connexion.html`;
  const candidate = String(returnTo || "").trim() || fallback;

  try {
    const url = new URL(candidate);
    const isWebTarget = url.protocol === "http:" || url.protocol === "https:";
    const redirect = isWebTarget ? new URL("/connexion/connexion.html", url) : new URL(candidate);

    for (const [key, value] of Object.entries(params)) {
      redirect.searchParams.set(key, value);
    }

    return redirect.toString();
  } catch {
    const redirect = new URL(fallback);
    for (const [key, value] of Object.entries(params)) {
      redirect.searchParams.set(key, value);
    }
    return redirect.toString();
  }
}
