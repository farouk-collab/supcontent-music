import { Router } from "express";
import { z } from "zod";
import { pool } from "../connections";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { spotifyGet } from "../services";
import {
  DEFAULT_STATUS,
  ensureDefaultCollectionsForUser,
  ensureCollectionsTables,
  newCollectionId,
  type DefaultStatusCode,
} from "../db/collections";

const router = Router();

const MediaTypeSchema = z.enum(["track", "album", "artist"]);
const StatusSchema = z.enum(["a_voir", "en_cours", "termine", "abandonne"]);

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(80),
  is_public: z.boolean().optional(),
});

const PatchCollectionSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  is_public: z.boolean().optional(),
});

const AddItemSchema = z.object({
  media_type: MediaTypeSchema,
  media_id: z.string().min(1).max(120),
});

type CollectionItemRow = {
  collection_id: string;
  media_type: "track" | "album" | "artist";
  media_id: string;
  added_at: string;
};

type SocialStatsRow = {
  media_type: "track" | "album" | "artist";
  media_id: string;
  review_count: number;
  like_count: number;
  comment_count: number;
  avg_rating: number | null;
};

function mediaKey(mediaType: string, mediaId: string) {
  return `${mediaType}:${mediaId}`;
}

function pickSpotifyImage(item: any): string {
  const candidates = [
    ...(Array.isArray(item?.images) ? item.images : []),
    ...(Array.isArray(item?.album?.images) ? item.album.images : []),
  ];
  if (!candidates.length) return "";
  const first = candidates[0];
  return typeof first === "string" ? first : String(first?.url || "");
}

function spotifySummary(item: any) {
  const artists = Array.isArray(item?.artists)
    ? item.artists.map((a: any) => String(a?.name || "").trim()).filter(Boolean).join(", ")
    : "";
  const genres = Array.isArray(item?.genres)
    ? item.genres.map((g: any) => String(g || "").trim()).filter(Boolean).join(", ")
    : "";
  return {
    name: String(item?.name || ""),
    subtitle: artists || genres || "",
    image: pickSpotifyImage(item),
    spotify_url: String(item?.external_urls?.spotify || ""),
  };
}

async function getCollectionOwnedByUser(userId: string, collectionId: string) {
  const r = await pool.query(
    `
      SELECT id, user_id, name, is_public, status_code, created_at, updated_at
      FROM collections
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [collectionId, userId]
  );
  return r.rows[0] ?? null;
}

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  await ensureDefaultCollectionsForUser(userId);

  const includeItems = String(req.query.include_items || "0") === "1";
  const c = await pool.query(
    `
      SELECT id, user_id, name, is_public, status_code, created_at, updated_at
      FROM collections
      WHERE user_id = $1
      ORDER BY
        CASE status_code
          WHEN 'a_voir' THEN 1
          WHEN 'en_cours' THEN 2
          WHEN 'termine' THEN 3
          WHEN 'abandonne' THEN 4
          ELSE 5
        END,
        created_at DESC
    `,
    [userId]
  );
  const collections = c.rows;

  if (!includeItems || collections.length === 0) {
    return res.json({ collections });
  }

  const ids = collections.map((x) => x.id);
  const itemsRes = await pool.query<CollectionItemRow>(
    `
      SELECT collection_id, media_type, media_id, added_at
      FROM collection_items
      WHERE collection_id = ANY($1::uuid[])
      ORDER BY added_at DESC
    `,
    [ids]
  );

  const rawItems = itemsRes.rows;
  const map = new Map<string, any[]>();

  const uniqByMedia = new Map<string, { media_type: "track" | "album" | "artist"; media_id: string }>();
  for (const it of rawItems) {
    uniqByMedia.set(mediaKey(it.media_type, it.media_id), {
      media_type: it.media_type,
      media_id: it.media_id,
    });
  }
  const uniqItems = Array.from(uniqByMedia.values());
  const mediaTypes = uniqItems.map((x) => x.media_type);
  const mediaIds = uniqItems.map((x) => x.media_id);

  const socialMap = new Map<string, Omit<SocialStatsRow, "media_type" | "media_id">>();
  if (uniqItems.length > 0) {
    const socialRes = await pool.query<SocialStatsRow>(
      `
        WITH target(media_type, media_id) AS (
          SELECT * FROM unnest($1::text[], $2::text[])
        ),
        review_stats AS (
          SELECT r.media_type, r.media_id, COUNT(*)::int AS review_count, AVG(r.rating)::float8 AS avg_rating
          FROM reviews r
          GROUP BY r.media_type, r.media_id
        ),
        like_stats AS (
          SELECT r.media_type, r.media_id, COUNT(*)::int AS like_count
          FROM review_likes rl
          JOIN reviews r ON r.id = rl.review_id
          GROUP BY r.media_type, r.media_id
        ),
        comment_stats AS (
          SELECT r.media_type, r.media_id, COUNT(*)::int AS comment_count
          FROM review_comments rc
          JOIN reviews r ON r.id = rc.review_id
          GROUP BY r.media_type, r.media_id
        )
        SELECT
          t.media_type::text AS media_type,
          t.media_id::text AS media_id,
          COALESCE(rs.review_count, 0)::int AS review_count,
          COALESCE(ls.like_count, 0)::int AS like_count,
          COALESCE(cs.comment_count, 0)::int AS comment_count,
          CASE
            WHEN rs.avg_rating IS NULL THEN NULL
            ELSE ROUND(rs.avg_rating::numeric, 2)::float8
          END AS avg_rating
        FROM target t
        LEFT JOIN review_stats rs ON rs.media_type = t.media_type AND rs.media_id = t.media_id
        LEFT JOIN like_stats ls ON ls.media_type = t.media_type AND ls.media_id = t.media_id
        LEFT JOIN comment_stats cs ON cs.media_type = t.media_type AND cs.media_id = t.media_id
      `,
      [mediaTypes, mediaIds]
    );

    for (const s of socialRes.rows) {
      socialMap.set(mediaKey(s.media_type, s.media_id), {
        review_count: Number(s.review_count || 0),
        like_count: Number(s.like_count || 0),
        comment_count: Number(s.comment_count || 0),
        avg_rating: s.avg_rating == null ? null : Number(s.avg_rating),
      });
    }
  }

  const spotifyMap = new Map<string, ReturnType<typeof spotifySummary>>();
  await Promise.all(
    uniqItems.map(async (it) => {
      try {
        const raw = await spotifyGet(it.media_type, it.media_id);
        spotifyMap.set(mediaKey(it.media_type, it.media_id), spotifySummary(raw));
      } catch {
        spotifyMap.set(mediaKey(it.media_type, it.media_id), {
          name: "",
          subtitle: "",
          image: "",
          spotify_url: "",
        });
      }
    })
  );

  for (const it of rawItems) {
    const k = mediaKey(it.media_type, it.media_id);
    const social = socialMap.get(k) || {
      review_count: 0,
      like_count: 0,
      comment_count: 0,
      avg_rating: null,
    };
    const media = spotifyMap.get(k) || { name: "", subtitle: "", image: "", spotify_url: "" };
    const enriched = { ...it, social, media };
    const arr = map.get(it.collection_id) || [];
    arr.push(enriched);
    map.set(it.collection_id, arr);
  }

  const out = collections.map((col) => ({
    ...col,
    items: map.get(col.id) || [],
  }));
  return res.json({ collections: out });
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = CreateCollectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erreur: "Données invalides", details: parsed.error.flatten() });
  }
  const userId = req.user!.id;
  const { name, is_public } = parsed.data;
  const id = newCollectionId();

  const r = await pool.query(
    `
      INSERT INTO collections (id, user_id, name, is_public, status_code)
      VALUES ($1, $2, $3, $4, NULL)
      RETURNING id, user_id, name, is_public, status_code, created_at, updated_at
    `,
    [id, userId, name.trim(), Boolean(is_public)]
  );
  return res.status(201).json({ collection: r.rows[0] });
});

router.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = PatchCollectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erreur: "Données invalides", details: parsed.error.flatten() });
  }
  const userId = req.user!.id;
  const id = String(req.params.id || "");
  const col = await getCollectionOwnedByUser(userId, id);
  if (!col) return res.status(404).json({ erreur: "Liste introuvable" });
  if (col.status_code) {
    return res.status(400).json({ erreur: "Les listes de statut par défaut ne sont pas éditables" });
  }

  const patch: string[] = [];
  const values: any[] = [];
  let i = 1;
  if (typeof parsed.data.name === "string") {
    patch.push(`name = $${i++}`);
    values.push(parsed.data.name.trim());
  }
  if (typeof parsed.data.is_public === "boolean") {
    patch.push(`is_public = $${i++}`);
    values.push(parsed.data.is_public);
  }

  if (patch.length === 0) return res.json({ collection: col });
  patch.push(`updated_at = NOW()`);
  values.push(id, userId);

  const r = await pool.query(
    `
      UPDATE collections
      SET ${patch.join(", ")}
      WHERE id = $${i++} AND user_id = $${i}
      RETURNING id, user_id, name, is_public, status_code, created_at, updated_at
    `,
    values
  );
  return res.json({ collection: r.rows[0] });
});

router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id || "");
  const col = await getCollectionOwnedByUser(userId, id);
  if (!col) return res.status(404).json({ erreur: "Liste introuvable" });
  if (col.status_code) {
    return res.status(400).json({ erreur: "Les listes de statut par défaut ne peuvent pas être supprimées" });
  }

  await pool.query("DELETE FROM collections WHERE id = $1 AND user_id = $2", [id, userId]);
  return res.json({ ok: true });
});

router.post("/:id/items", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = AddItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erreur: "Données invalides", details: parsed.error.flatten() });
  }
  const userId = req.user!.id;
  const id = String(req.params.id || "");
  const col = await getCollectionOwnedByUser(userId, id);
  if (!col) return res.status(404).json({ erreur: "Liste introuvable" });

  const { media_type, media_id } = parsed.data;
  await pool.query(
    `
      INSERT INTO collection_items (collection_id, media_type, media_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (collection_id, media_type, media_id) DO NOTHING
    `,
    [id, media_type, media_id]
  );

  const r = await pool.query(
    `
      SELECT collection_id, media_type, media_id, added_at
      FROM collection_items
      WHERE collection_id = $1 AND media_type = $2 AND media_id = $3
      LIMIT 1
    `,
    [id, media_type, media_id]
  );
  return res.status(201).json({ item: r.rows[0] });
});

router.delete("/:id/items/:mediaType/:mediaId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id || "");
  const mediaType = String(req.params.mediaType || "");
  const mediaId = String(req.params.mediaId || "");
  const parsedType = MediaTypeSchema.safeParse(mediaType);
  if (!parsedType.success) return res.status(400).json({ erreur: "mediaType invalide" });

  const col = await getCollectionOwnedByUser(userId, id);
  if (!col) return res.status(404).json({ erreur: "Liste introuvable" });

  await pool.query(
    `
      DELETE FROM collection_items
      WHERE collection_id = $1 AND media_type = $2 AND media_id = $3
    `,
    [id, parsedType.data, mediaId]
  );
  return res.json({ ok: true });
});

router.post("/status/:status/items", requireAuth, async (req: AuthedRequest, res) => {
  const pStatus = StatusSchema.safeParse(String(req.params.status || ""));
  const parsedBody = AddItemSchema.safeParse(req.body);
  if (!pStatus.success || !parsedBody.success) {
    return res.status(400).json({ erreur: "Données invalides" });
  }

  const userId = req.user!.id;
  const statusCode = pStatus.data as DefaultStatusCode;
  const { media_type, media_id } = parsedBody.data;

  await ensureDefaultCollectionsForUser(userId);
  const colRes = await pool.query(
    `
      SELECT id
      FROM collections
      WHERE user_id = $1 AND status_code = $2
      LIMIT 1
    `,
    [userId, statusCode]
  );
  const targetCollectionId = colRes.rows[0]?.id;
  if (!targetCollectionId) return res.status(500).json({ erreur: "Collection statut introuvable" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        DELETE FROM collection_items ci
        USING collections c
        WHERE ci.collection_id = c.id
          AND c.user_id = $1
          AND c.status_code IS NOT NULL
          AND ci.media_type = $2
          AND ci.media_id = $3
      `,
      [userId, media_type, media_id]
    );
    await client.query(
      `
        INSERT INTO collection_items (collection_id, media_type, media_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (collection_id, media_type, media_id) DO NOTHING
      `,
      [targetCollectionId, media_type, media_id]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return res.json({ ok: true, targetCollectionId });
});

// DB bootstrap endpoint (dev only helper)
router.post("/init", async (_req, res) => {
  await ensureCollectionsTables();
  return res.json({ ok: true });
});

export default router;
