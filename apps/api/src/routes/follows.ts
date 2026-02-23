import { Router } from "express";
import { randomUUID } from "crypto";
import { pool } from "../connections";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { verifyAccessToken } from "../auth/jwt";
import { spotifyGet } from "../services";

const router = Router();

function optionalUserIdFromAuthHeader(authHeader: string | undefined) {
  const auth = String(authHeader || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    return String(verifyAccessToken(token).sub || "");
  } catch {
    return null;
  }
}

async function readUserBasic(userId: string) {
  const r = await pool.query(
    `
      SELECT id, display_name, username, avatar_url, bio
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  return r.rows[0] || null;
}

async function readUserAge(userId: string): Promise<number | null> {
  const r = await pool.query(
    `
      SELECT birth_date::text AS birth_date
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  return parseAgeFromBirthDate(r.rows[0]?.birth_date);
}

async function isMutualFollow(userA: string, userB: string) {
  const r = await pool.query(
    `
      SELECT
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) AS a_follows_b,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) AS b_follows_a
    `,
    [userA, userB]
  );
  const aFollowsB = Boolean(r.rows[0]?.a_follows_b);
  const bFollowsA = Boolean(r.rows[0]?.b_follows_a);
  return {
    a_follows_b: aFollowsB,
    b_follows_a: bFollowsA,
    mutual: aFollowsB && bFollowsA,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseAgeFromBirthDate(value: any): number | null {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  if (!Number.isFinite(age) || age < 0 || age > 130) return null;
  return age;
}

async function readUserSettings(userId: string) {
  const r = await pool.query(
    `
      SELECT
        user_id,
        account_private,
        hide_location,
        language,
        hidden_words,
        notifications_prefs,
        updated_at
      FROM user_settings
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );
  if (r.rows[0]) return r.rows[0];
  return {
    user_id: userId,
    account_private: false,
    hide_location: false,
    language: "fr",
    hidden_words: [],
    notifications_prefs: {},
    updated_at: null,
  };
}

router.get("/settings/me", requireAuth, async (req: AuthedRequest, res) => {
  const settings = await readUserSettings(req.user!.id);
  return res.json({ settings });
});

router.put("/settings/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const accountPrivate = Boolean(req.body?.account_private);
  const hideLocation = Boolean(req.body?.hide_location);
  const languageRaw = String(req.body?.language || "fr").trim().toLowerCase();
  const language = ["fr", "en"].includes(languageRaw) ? languageRaw : "fr";
  const hiddenWordsRaw = Array.isArray(req.body?.hidden_words) ? req.body.hidden_words : [];
  const hiddenWords = hiddenWordsRaw
    .map((x: any) => String(x || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 120);
  const notifRaw = req.body?.notifications_prefs;
  const notificationsPrefs =
    notifRaw && typeof notifRaw === "object" && !Array.isArray(notifRaw) ? notifRaw : {};

  const r = await pool.query(
    `
      INSERT INTO user_settings (user_id, account_private, hide_location, language, hidden_words, notifications_prefs, updated_at)
      VALUES ($1, $2, $3, $4, $5::text[], $6::jsonb, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        account_private = EXCLUDED.account_private,
        hide_location = EXCLUDED.hide_location,
        language = EXCLUDED.language,
        hidden_words = EXCLUDED.hidden_words,
        notifications_prefs = EXCLUDED.notifications_prefs,
        updated_at = NOW()
      RETURNING user_id, account_private, hide_location, language, hidden_words, notifications_prefs, updated_at
    `,
    [userId, accountPrivate, hideLocation, language, hiddenWords, JSON.stringify(notificationsPrefs)]
  );
  return res.json({ settings: r.rows[0] });
});

router.get("/settings/blocked", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const r = await pool.query(
    `
      SELECT u.id, u.display_name, u.username, u.avatar_url, b.created_at
      FROM blocked_users b
      JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC
      LIMIT 200
    `,
    [userId]
  );
  return res.json({ items: r.rows });
});

router.post("/settings/blocked/:targetUserId", requireAuth, async (req: AuthedRequest, res) => {
  const blockerId = req.user!.id;
  const blockedId = String(req.params.targetUserId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(blockedId)) return res.status(400).json({ erreur: "targetUserId invalide" });
  if (blockerId === blockedId) return res.status(400).json({ erreur: "Action impossible sur soi-meme" });
  const target = await readUserBasic(blockedId);
  if (!target) return res.status(404).json({ erreur: "Utilisateur introuvable" });
  await pool.query(
    `
      INSERT INTO blocked_users (blocker_id, blocked_id)
      VALUES ($1, $2)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `,
    [blockerId, blockedId]
  );
  return res.json({ ok: true });
});

router.delete("/settings/blocked/:targetUserId", requireAuth, async (req: AuthedRequest, res) => {
  const blockerId = req.user!.id;
  const blockedId = String(req.params.targetUserId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(blockedId)) return res.status(400).json({ erreur: "targetUserId invalide" });
  await pool.query(`DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]);
  return res.json({ ok: true });
});

async function readSwipePreferences(userId: string) {
  const r = await pool.query(
    `
      SELECT
        user_id,
        use_distance_filter,
        max_distance_km,
        min_age,
        max_age,
        preferred_genders,
        latitude,
        longitude,
        updated_at
      FROM swipe_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );
  if (r.rows[0]) return r.rows[0];
  return {
    user_id: userId,
    use_distance_filter: false,
    max_distance_km: 50,
    min_age: 18,
    max_age: 99,
    preferred_genders: [],
    latitude: null,
    longitude: null,
    updated_at: null,
  };
}

router.get("/swipe/preferences", requireAuth, async (req: AuthedRequest, res) => {
  const prefs = await readSwipePreferences(req.user!.id);
  return res.json({ preferences: prefs });
});

router.put("/swipe/preferences", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const useDistanceFilter = Boolean(req.body?.use_distance_filter);
  const maxDistanceRaw = Number.parseInt(String(req.body?.max_distance_km ?? "50"), 10);
  const maxDistance = Number.isFinite(maxDistanceRaw) ? Math.max(1, Math.min(500, maxDistanceRaw)) : 50;
  const minAgeRaw = Number.parseInt(String(req.body?.min_age ?? "18"), 10);
  const maxAgeRaw = Number.parseInt(String(req.body?.max_age ?? "99"), 10);
  const minAgeBase = Number.isFinite(minAgeRaw) ? Math.max(13, Math.min(99, minAgeRaw)) : 18;
  const maxAgeBase = Number.isFinite(maxAgeRaw) ? Math.max(13, Math.min(99, maxAgeRaw)) : 99;
  const userAge = await readUserAge(userId);
  const isMinor = userAge != null && userAge < 18;
  const cohortMin = isMinor ? 13 : 18;
  const cohortMax = isMinor ? 17 : 99;
  let minAge = Math.max(cohortMin, Math.min(minAgeBase, maxAgeBase));
  let maxAge = Math.min(cohortMax, Math.max(minAgeBase, maxAgeBase));
  if (minAge > maxAge) {
    minAge = cohortMin;
    maxAge = cohortMax;
  }
  const preferredGendersRaw = Array.isArray(req.body?.preferred_genders) ? req.body.preferred_genders : [];
  const preferredGenders = preferredGendersRaw
    .map((x: any) => String(x || "").trim().toLowerCase())
    .filter((x: string) => ["male", "female", "other", "prefer_not_to_say"].includes(x));
  const latitudeRaw = req.body?.latitude;
  const longitudeRaw = req.body?.longitude;
  const hasLat = latitudeRaw !== null && latitudeRaw !== undefined && String(latitudeRaw) !== "";
  const hasLon = longitudeRaw !== null && longitudeRaw !== undefined && String(longitudeRaw) !== "";
  const latitude = hasLat ? Number(latitudeRaw) : null;
  const longitude = hasLon ? Number(longitudeRaw) : null;
  if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    return res.status(400).json({ erreur: "latitude invalide" });
  }
  if (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    return res.status(400).json({ erreur: "longitude invalide" });
  }

  const r = await pool.query(
    `
      INSERT INTO swipe_preferences (user_id, use_distance_filter, max_distance_km, min_age, max_age, preferred_genders, latitude, longitude, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        use_distance_filter = EXCLUDED.use_distance_filter,
        max_distance_km = EXCLUDED.max_distance_km,
        min_age = EXCLUDED.min_age,
        max_age = EXCLUDED.max_age,
        preferred_genders = EXCLUDED.preferred_genders,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        updated_at = NOW()
      RETURNING user_id, use_distance_filter, max_distance_km, min_age, max_age, preferred_genders, latitude, longitude, updated_at
    `,
    [userId, useDistanceFilter, maxDistance, minAge, maxAge, preferredGenders, latitude, longitude]
  );
  return res.json({ preferences: r.rows[0] });
});

router.get("/swipe/profiles", requireAuth, async (req: AuthedRequest, res) => {
  const actorId = req.user!.id;
  const limitRaw = Number.parseInt(String(req.query.limit || "12"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 12;

  const prefs = await readSwipePreferences(actorId);

  const r = await pool.query(
    `
      WITH swiped AS (
        SELECT DISTINCT target_user_id
        FROM swipe_actions
        WHERE actor_id = $1
          AND target_user_id IS NOT NULL
      ),
      followers_counts AS (
        SELECT following_id AS user_id, COUNT(*)::int AS followers_count
        FROM follows
        GROUP BY following_id
      )
      SELECT
        u.id,
        u.display_name,
        u.username,
        u.avatar_url,
        u.bio,
        CASE WHEN COALESCE(us.hide_location, FALSE) THEN NULL ELSE u.location END AS location,
        u.gender,
        u.birth_date::text AS birth_date,
        COALESCE(fc.followers_count, 0)::int AS followers_count,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) AS is_following,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = $1) AS is_followed_by,
        sp.latitude AS target_latitude,
        sp.longitude AS target_longitude
      FROM users u
      LEFT JOIN followers_counts fc ON fc.user_id = u.id
      LEFT JOIN swipe_preferences sp ON sp.user_id = u.id
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE u.id <> $1
        AND u.id NOT IN (SELECT target_user_id FROM swiped)
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users b
          WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = $1)
        )
      ORDER BY COALESCE(fc.followers_count, 0) DESC, u.created_at DESC
      LIMIT 120
    `,
    [actorId]
  );

  const actorLat = prefs.latitude == null ? null : Number(prefs.latitude);
  const actorLon = prefs.longitude == null ? null : Number(prefs.longitude);
  const useDistance = Boolean(prefs.use_distance_filter && Number.isFinite(actorLat) && Number.isFinite(actorLon));
  const maxDistance = Number(prefs.max_distance_km || 50);
  const preferredGenders = Array.isArray(prefs.preferred_genders)
    ? prefs.preferred_genders.map((x: any) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const prefMinAgeRaw = Number(prefs.min_age ?? 18);
  const prefMaxAgeRaw = Number(prefs.max_age ?? 99);
  const prefMinAge = Number.isFinite(prefMinAgeRaw) ? Math.max(13, Math.min(99, prefMinAgeRaw)) : 18;
  const prefMaxAge = Number.isFinite(prefMaxAgeRaw) ? Math.max(13, Math.min(99, prefMaxAgeRaw)) : 99;
  const actorBirthRes = await pool.query(`SELECT birth_date::text AS birth_date FROM users WHERE id = $1 LIMIT 1`, [actorId]);
  const actorAge = parseAgeFromBirthDate(actorBirthRes.rows[0]?.birth_date);
  const actorIsMinor = actorAge != null && actorAge < 18;
  const cohortMin = actorIsMinor ? 13 : 18;
  const cohortMax = actorIsMinor ? 17 : 99;
  let ageMin = Math.max(cohortMin, Math.min(prefMinAge, prefMaxAge));
  let ageMax = Math.min(cohortMax, Math.max(prefMinAge, prefMaxAge));
  if (ageMin > ageMax) {
    ageMin = cohortMin;
    ageMax = cohortMax;
  }

  const filtered = r.rows
    .map((it: any) => {
      const lat = it.target_latitude == null ? null : Number(it.target_latitude);
      const lon = it.target_longitude == null ? null : Number(it.target_longitude);
      let distanceKm = null;
      if (Number.isFinite(actorLat) && Number.isFinite(actorLon) && Number.isFinite(lat) && Number.isFinite(lon)) {
        distanceKm = haversineKm(Number(actorLat), Number(actorLon), Number(lat), Number(lon));
      }
      return {
        ...it,
        age: parseAgeFromBirthDate(it.birth_date),
        distance_km: distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
      };
    })
    .filter((it: any) => {
      if (!Number.isFinite(Number(it.age))) return false;
      if (actorIsMinor) {
        if (Number(it.age) >= 18) return false;
      } else if (Number(it.age) < 18) {
        return false;
      }
      if (Number(it.age) < ageMin || Number(it.age) > ageMax) return false;
      if (preferredGenders.length) {
        const g = String(it.gender || "").trim().toLowerCase();
        if (!preferredGenders.includes(g)) return false;
      }
      if (useDistance) {
        if (it.distance_km == null) return false;
        if (Number(it.distance_km) > maxDistance) return false;
      }
      return true;
    })
    .slice(0, limit)
    .map((it: any) => ({
      id: it.id,
      display_name: it.display_name,
      username: it.username,
      avatar_url: it.avatar_url,
      bio: it.bio,
      location: it.location,
      gender: it.gender,
      age: it.age,
      followers_count: it.followers_count,
      is_following: it.is_following,
      is_followed_by: it.is_followed_by,
      distance_km: it.distance_km,
    }));

  return res.json({ items: filtered, preferences: prefs });
});

router.post("/swipe/profiles/:targetUserId", requireAuth, async (req: AuthedRequest, res) => {
  const actorId = req.user!.id;
  const targetUserId = String(req.params.targetUserId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(targetUserId)) return res.status(400).json({ erreur: "targetUserId invalide" });
  if (actorId === targetUserId) return res.status(400).json({ erreur: "Action impossible sur soi-meme" });

  const direction = String(req.body?.direction || "").trim().toLowerCase();
  if (!["like", "pass"].includes(direction)) return res.status(400).json({ erreur: "direction invalide" });
  const message = String(req.body?.message || "").trim();

  const target = await readUserBasic(targetUserId);
  if (!target) return res.status(404).json({ erreur: "Utilisateur introuvable" });

  const [actorAge, targetAge] = await Promise.all([readUserAge(actorId), readUserAge(targetUserId)]);
  const actorIsMinor = actorAge != null && actorAge < 18;
  const targetIsMinor = targetAge != null && targetAge < 18;
  if (actorIsMinor !== targetIsMinor) {
    return res.status(403).json({ erreur: "Swipe non autorise entre mineur et majeur" });
  }

  await pool.query(
    `
      INSERT INTO swipe_actions (id, actor_id, target_user_id, direction, message)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [randomUUID(), actorId, targetUserId, direction, message || null]
  );

  if (direction === "like") {
    await pool.query(
      `
        INSERT INTO follows (follower_id, following_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, following_id) DO NOTHING
      `,
      [actorId, targetUserId]
    );
  }

  let invitationCreated = false;
  if (message) {
    await pool.query(
      `
        INSERT INTO chat_invitations (id, sender_id, receiver_id, source_type, message, status)
        VALUES ($1, $2, $3, 'profile_swipe', $4, 'pending')
      `,
      [randomUUID(), actorId, targetUserId, message]
    );
    invitationCreated = true;
  }

  const relation = await isMutualFollow(actorId, targetUserId);
  return res.json({
    ok: true,
    direction,
    relation,
    can_chat_direct: relation.mutual,
    invitation_created: invitationCreated,
  });
});

router.get("/swipe/music", requireAuth, async (req: AuthedRequest, res) => {
  const actorId = req.user!.id;
  const limitRaw = Number.parseInt(String(req.query.limit || "16"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(4, Math.min(40, limitRaw)) : 16;

  const r = await pool.query(
    `
      WITH swiped_music AS (
        SELECT DISTINCT media_type, media_id
        FROM swipe_actions
        WHERE actor_id = $1
          AND media_id IS NOT NULL
          AND media_type IS NOT NULL
      ),
      score_reviews AS (
        SELECT
          media_type,
          media_id,
          COUNT(*)::int AS review_count,
          COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float8 AS avg_rating,
          MAX(created_at) AS last_review_at
        FROM reviews
        GROUP BY media_type, media_id
      )
      SELECT
        s.media_type,
        s.media_id,
        s.review_count,
        s.avg_rating,
        s.last_review_at
      FROM score_reviews s
      WHERE NOT EXISTS (
        SELECT 1
        FROM swiped_music sm
        WHERE sm.media_type = s.media_type
          AND sm.media_id = s.media_id
      )
      ORDER BY s.review_count DESC, s.avg_rating DESC, s.last_review_at DESC
      LIMIT $2
    `,
    [actorId, limit]
  );

  const enriched = await Promise.all(
    r.rows.map(async (it: any) => {
      try {
        const raw: any = await spotifyGet(it.media_type, it.media_id);
        const image = String(raw?.images?.[0]?.url || raw?.album?.images?.[0]?.url || "");
        const subtitle = Array.isArray(raw?.artists)
          ? raw.artists.map((a: any) => String(a?.name || "")).filter(Boolean).join(", ")
          : Array.isArray(raw?.genres)
            ? raw.genres.map((g: any) => String(g || "")).filter(Boolean).join(", ")
            : "";
        return {
          ...it,
          media: {
            name: String(raw?.name || ""),
            subtitle,
            image,
            spotify_url: String(raw?.external_urls?.spotify || ""),
          },
        };
      } catch {
        return {
          ...it,
          media: {
            name: "",
            subtitle: "",
            image: "",
            spotify_url: "",
          },
        };
      }
    })
  );

  return res.json({ items: enriched });
});

router.post("/swipe/music", requireAuth, async (req: AuthedRequest, res) => {
  const actorId = req.user!.id;
  const mediaType = String(req.body?.media_type || "").trim();
  const mediaId = String(req.body?.media_id || "").trim();
  const direction = String(req.body?.direction || "").trim().toLowerCase();

  if (!["track", "album", "artist"].includes(mediaType)) return res.status(400).json({ erreur: "media_type invalide" });
  if (!mediaId) return res.status(400).json({ erreur: "media_id manquant" });
  if (!["like", "pass"].includes(direction)) return res.status(400).json({ erreur: "direction invalide" });

  await pool.query(
    `
      INSERT INTO swipe_actions (id, actor_id, media_type, media_id, direction)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [randomUUID(), actorId, mediaType, mediaId, direction]
  );

  return res.json({ ok: true, direction });
});

router.get("/swipe/invitations/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const status = String(req.query.status || "pending").trim().toLowerCase();
  const wantedStatus = ["pending", "accepted", "rejected"].includes(status) ? status : "pending";

  const r = await pool.query(
    `
      SELECT
        ci.id,
        ci.message,
        ci.status,
        ci.created_at,
        ci.source_type,
        sender.id AS sender_id,
        sender.display_name,
        sender.username,
        sender.avatar_url,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ci.receiver_id AND following_id = ci.sender_id) AS receiver_follows_sender,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ci.sender_id AND following_id = ci.receiver_id) AS sender_follows_receiver
      FROM chat_invitations ci
      JOIN users sender ON sender.id = ci.sender_id
      WHERE ci.receiver_id = $1
        AND ci.status = $2
      ORDER BY ci.created_at DESC
      LIMIT 100
    `,
    [userId, wantedStatus]
  );

  const items = r.rows.map((x: any) => ({
    ...x,
    can_chat_direct: Boolean(x.receiver_follows_sender) && Boolean(x.sender_follows_receiver),
  }));
  return res.json({ items });
});

router.get("/can-chat/:targetUserId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const targetUserId = String(req.params.targetUserId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(targetUserId)) return res.status(400).json({ erreur: "targetUserId invalide" });
  const relation = await isMutualFollow(userId, targetUserId);
  return res.json({ can_chat_direct: relation.mutual, relation });
});

router.post("/:targetUserId", requireAuth, async (req: AuthedRequest, res) => {
  const followerId = req.user!.id;
  const targetUserId = String(req.params.targetUserId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(targetUserId)) return res.status(400).json({ erreur: "targetUserId invalide" });
  if (followerId === targetUserId) return res.status(400).json({ erreur: "Impossible de se suivre soi-meme" });

  const target = await readUserBasic(targetUserId);
  if (!target) return res.status(404).json({ erreur: "Utilisateur introuvable" });

  await pool.query(
    `
      INSERT INTO follows (follower_id, following_id)
      VALUES ($1, $2)
      ON CONFLICT (follower_id, following_id) DO NOTHING
    `,
    [followerId, targetUserId]
  );

  return res.json({ ok: true, following: true });
});

router.delete("/:targetUserId", requireAuth, async (req: AuthedRequest, res) => {
  const followerId = req.user!.id;
  const targetUserId = String(req.params.targetUserId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(targetUserId)) return res.status(400).json({ erreur: "targetUserId invalide" });

  await pool.query(
    `
      DELETE FROM follows
      WHERE follower_id = $1 AND following_id = $2
    `,
    [followerId, targetUserId]
  );

  return res.json({ ok: true, following: false });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const limitRaw = Number.parseInt(String(req.query.limit || "20"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20;

  const [followingRes, followersRes] = await Promise.all([
    pool.query(
      `
        SELECT u.id, u.display_name, u.username, u.avatar_url, f.created_at
        FROM follows f
        JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2
      `,
      [userId, limit]
    ),
    pool.query(
      `
        SELECT u.id, u.display_name, u.username, u.avatar_url, f.created_at
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2
      `,
      [userId, limit]
    ),
  ]);

  return res.json({
    following_count: followingRes.rowCount || 0,
    followers_count: followersRes.rowCount || 0,
    following: followingRes.rows,
    followers: followersRes.rows,
  });
});

router.get("/users/:userId", async (req, res) => {
  const userId = String(req.params.userId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(userId)) return res.status(400).json({ erreur: "userId invalide" });

  const viewerId = optionalUserIdFromAuthHeader(req.headers.authorization);
  const user = await readUserBasic(userId);
  if (!user) return res.status(404).json({ erreur: "Utilisateur introuvable" });

  const [countsRes, followingRes, followersRes] = await Promise.all([
    pool.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) AS following_count,
          (SELECT COUNT(*)::int FROM follows WHERE following_id = $1) AS followers_count
      `,
      [userId]
    ),
    pool.query(
      `
        SELECT u.id, u.display_name, u.username, u.avatar_url, f.created_at
        FROM follows f
        JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        LIMIT 20
      `,
      [userId]
    ),
    pool.query(
      `
        SELECT u.id, u.display_name, u.username, u.avatar_url, f.created_at
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        LIMIT 20
      `,
      [userId]
    ),
  ]);

  let relation = { is_following: false, is_followed_by: false };
  if (viewerId) {
    const relRes = await pool.query(
      `
        SELECT
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) AS is_following,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) AS is_followed_by
      `,
      [viewerId, userId]
    );
    relation = {
      is_following: Boolean(relRes.rows[0]?.is_following),
      is_followed_by: Boolean(relRes.rows[0]?.is_followed_by),
    };
  }

  return res.json({
    user,
    following_count: Number(countsRes.rows[0]?.following_count || 0),
    followers_count: Number(countsRes.rows[0]?.followers_count || 0),
    following: followingRes.rows,
    followers: followersRes.rows,
    ...relation,
  });
});

export default router;
