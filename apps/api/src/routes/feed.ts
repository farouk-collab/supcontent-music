import { Router } from "express";
import { pool } from "../connections";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { spotifyGet } from "../services";

const router = Router();

function mediaKey(mediaType: string, mediaId: string) {
  return `${mediaType}:${mediaId}`;
}

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const limitRaw = Number.parseInt(String(req.query.limit || "20"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20;

  const feedRes = await pool.query(
    `
      WITH followed AS (
        SELECT following_id
        FROM follows
        WHERE follower_id = $1
      ),
      review_events AS (
        SELECT
          'review'::text AS kind,
          r.created_at,
          r.media_type,
          r.media_id,
          r.rating,
          r.body AS text,
          u.id AS actor_id,
          u.display_name,
          u.username,
          u.avatar_url
        FROM reviews r
        JOIN followed f ON f.following_id = r.user_id
        JOIN users u ON u.id = r.user_id
      ),
      comment_events AS (
        SELECT
          'comment'::text AS kind,
          rc.created_at,
          r.media_type,
          r.media_id,
          NULL::int AS rating,
          rc.body AS text,
          u.id AS actor_id,
          u.display_name,
          u.username,
          u.avatar_url
        FROM review_comments rc
        JOIN reviews r ON r.id = rc.review_id
        JOIN followed f ON f.following_id = rc.user_id
        JOIN users u ON u.id = rc.user_id
      ),
      collection_events AS (
        SELECT
          'collection'::text AS kind,
          ci.added_at AS created_at,
          ci.media_type,
          ci.media_id,
          NULL::int AS rating,
          c.name AS text,
          u.id AS actor_id,
          u.display_name,
          u.username,
          u.avatar_url
        FROM collection_items ci
        JOIN collections c ON c.id = ci.collection_id
        JOIN followed f ON f.following_id = c.user_id
        JOIN users u ON u.id = c.user_id
      )
      SELECT *
      FROM (
        SELECT * FROM review_events
        UNION ALL
        SELECT * FROM comment_events
        UNION ALL
        SELECT * FROM collection_events
      ) x
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  const rows = feedRes.rows || [];
  const uniqMedia = new Map<string, { media_type: "track" | "album" | "artist"; media_id: string }>();
  for (const r of rows) {
    const mt = String(r.media_type || "");
    const mid = String(r.media_id || "");
    if (!mt || !mid) continue;
    uniqMedia.set(mediaKey(mt, mid), { media_type: mt as any, media_id: mid });
  }

  const mediaMap = new Map<string, { name: string; subtitle: string; image: string; spotify_url: string }>();
  await Promise.all(
    Array.from(uniqMedia.values()).map(async (m) => {
      try {
        const raw: any = await spotifyGet(m.media_type, m.media_id);
        const subtitle = Array.isArray(raw?.artists)
          ? raw.artists.map((a: any) => String(a?.name || "")).filter(Boolean).join(", ")
          : Array.isArray(raw?.genres)
            ? raw.genres.map((g: any) => String(g || "")).filter(Boolean).join(", ")
            : "";
        const image = String(raw?.images?.[0]?.url || raw?.album?.images?.[0]?.url || "");
        mediaMap.set(mediaKey(m.media_type, m.media_id), {
          name: String(raw?.name || ""),
          subtitle,
          image,
          spotify_url: String(raw?.external_urls?.spotify || ""),
        });
      } catch {
        mediaMap.set(mediaKey(m.media_type, m.media_id), { name: "", subtitle: "", image: "", spotify_url: "" });
      }
    })
  );

  const items = rows.map((r) => ({
    ...r,
    media: mediaMap.get(mediaKey(String(r.media_type || ""), String(r.media_id || ""))) || {
      name: "",
      subtitle: "",
      image: "",
      spotify_url: "",
    },
  }));

  return res.json({ items });
});

export default router;
