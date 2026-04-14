const API_URL = process.env.API_URL || "http://127.0.0.1:1234";
const PASSWORD = "TempPass!123A";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await response.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${path}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }

  return json;
}

function makeTempIdentity(label) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `swipe-live-${label}-${stamp}@example.com`,
    displayName: `Swipe ${label} ${stamp.slice(-4)}`,
  };
}

async function registerTempUser(label) {
  const identity = makeTempIdentity(label);
  const data = await requestJson("/auth/register", {
    method: "POST",
    body: {
      email: identity.email,
      password: PASSWORD,
      displayName: identity.displayName,
    },
  });

  assert(data?.user?.id, `Missing user id for ${label}`);
  assert(data?.accessToken, `Missing access token for ${label}`);

  return {
    id: String(data.user.id),
    email: identity.email,
    displayName: identity.displayName,
    accessToken: String(data.accessToken),
  };
}

async function cleanupUser(user) {
  if (!user?.accessToken) return;
  try {
    await requestJson("/auth/me", {
      method: "DELETE",
      token: user.accessToken,
    });
  } catch {
    // Best-effort cleanup only.
  }
}

function validateCategoryPayload(data) {
  assert(data && typeof data === "object", "music/categories should return an object");
  assert(typeof data.generated_at === "string", "music/categories.generated_at missing");
  assert(typeof data.limit === "number", "music/categories.limit missing");
  assert(data.categories && typeof data.categories === "object", "music/categories.categories missing");

  const sections = Object.values(data.categories);
  assert(sections.length >= 3, "music/categories should expose several sections");

  for (const section of sections) {
    assert(typeof section.key === "string" && section.key.length > 0, "category section.key missing");
    assert(typeof section.title === "string" && section.title.length > 0, "category section.title missing");
    assert(Array.isArray(section.items) && section.items.length > 0, `category ${section.key} has no items`);
    for (const item of section.items) {
      assert(typeof item.id === "string" && item.id.length > 0, `category ${section.key} item.id missing`);
      assert(typeof item.type === "string" && item.type.length > 0, `category ${section.key} item.type missing`);
      assert(typeof item.name === "string" && item.name.length > 0, `category ${section.key} item.name missing`);
      assert(Array.isArray(item.artists), `category ${section.key} item.artists missing`);
      assert(item.external_urls?.spotify, `category ${section.key} item.spotify url missing`);
    }
  }
}

function validateNewsPayload(data) {
  assert(data && typeof data === "object", "music/news should return an object");
  assert(typeof data.generated_at === "string", "music/news.generated_at missing");
  assert(Array.isArray(data.releases) && data.releases.length > 0, "music/news.releases missing");
  assert(Array.isArray(data.community), "music/news.community missing");

  for (const release of data.releases) {
    assert(typeof release.id === "string" && release.id.length > 0, "news release.id missing");
    assert(typeof release.name === "string" && release.name.length > 0, "news release.name missing");
    assert(typeof release.media_type === "string" && release.media_type.length > 0, "news release.media_type missing");
    assert(Array.isArray(release.artists), "news release.artists missing");
    assert(typeof release.image === "string", "news release.image missing");
    assert(typeof release.spotify_url === "string" && release.spotify_url.length > 0, "news release.spotify_url missing");
  }

  for (const item of data.community) {
    assert(typeof item.kind === "string" && item.kind.length > 0, "news community.kind missing");
    assert(typeof item.media_type === "string" && item.media_type.length > 0, "news community.media_type missing");
    assert(typeof item.media_id === "string" && item.media_id.length > 0, "news community.media_id missing");
    assert(item.media && typeof item.media === "object", "news community.media missing");
    assert(typeof item.media.name === "string" && item.media.name.length > 0, "news community.media.name missing");
    assert(typeof item.display_name === "string" && item.display_name.length > 0, "news community.display_name missing");
    assert(typeof item.created_at === "string" && item.created_at.length > 0, "news community.created_at missing");
  }
}

async function main() {
  const createdUsers = [];
  try {
    const health = await requestJson("/health");
    assert(health?.ok === true, "health endpoint is not ready");

    const userA = await registerTempUser("a");
    const userB = await registerTempUser("b");
    createdUsers.push(userA, userB);

    const superlike = await requestJson(`/follows/swipe/profiles/${userB.id}`, {
      method: "POST",
      token: userA.accessToken,
      body: {
        direction: "superlike",
        message: "Super like de verification",
      },
    });
    assert(superlike?.ok === true, "superlike request failed");
    assert(superlike?.direction === "superlike", "superlike direction not preserved");
    assert(superlike?.is_superlike === true, "superlike flag missing");

    const likesYou = await requestJson("/follows/swipe/likes-you?limit=20", {
      token: userB.accessToken,
    });
    assert(Array.isArray(likesYou?.items), "likes-you should expose items[]");
    const incomingLike = likesYou.items.find((item) => item?.user?.id === userA.id);
    assert(incomingLike, "likes-you missing superlike sender");
    assert(incomingLike.is_superlike === true, "likes-you item should mark superlike");
    assert(incomingLike.direction === "superlike", "likes-you item should expose superlike direction");

    const mutual = await requestJson(`/follows/swipe/profiles/${userA.id}`, {
      method: "POST",
      token: userB.accessToken,
      body: {
        direction: "like",
      },
    });
    assert(mutual?.ok === true, "reciprocal like failed");
    assert(mutual?.can_chat_direct === true, "reciprocal like should unlock chat");
    assert(mutual?.match?.id, "reciprocal like should create a persistent match");

    const matchesA = await requestJson("/follows/swipe/matches/me?limit=20", {
      token: userA.accessToken,
    });
    const matchesB = await requestJson("/follows/swipe/matches/me?limit=20", {
      token: userB.accessToken,
    });
    assert(Array.isArray(matchesA?.items), "matches/me for user A should expose items[]");
    assert(Array.isArray(matchesB?.items), "matches/me for user B should expose items[]");

    const matchA = matchesA.items.find((item) => item?.user?.id === userB.id);
    const matchB = matchesB.items.find((item) => item?.user?.id === userA.id);
    assert(matchA, "matches/me missing match for user A");
    assert(matchB, "matches/me missing match for user B");
    assert(matchA.match_id === mutual.match.id, "match id should persist for user A");
    assert(matchB.match_id === mutual.match.id, "match id should persist for user B");
    assert(matchA.is_superlike === true || matchB.is_superlike === true, "match should preserve superlike context");

    const categories = await requestJson("/music/categories?limit=8");
    const news = await requestJson("/music/news?limit=6");
    validateCategoryPayload(categories);
    validateNewsPayload(news);

    const summary = {
      ok: true,
      verified: {
        superlike: {
          sender: userA.id,
          receiver: userB.id,
          likes_you_detected: true,
        },
        matches: {
          match_id: mutual.match.id,
          user_a_seen: true,
          user_b_seen: true,
        },
        music: {
          category_sections: Object.keys(categories.categories),
          releases: news.releases.length,
          community_items: news.community.length,
        },
      },
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    for (const user of createdUsers.reverse()) {
      await cleanupUser(user);
    }
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
