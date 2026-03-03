import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { pool } from "../connections";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { verifyAccessToken } from "../auth/jwt";

const router = Router();

const entryTypeSchema = z.enum(["publication", "story"]);
const mediaKindSchema = z.enum(["image", "video"]);

const createPostSchema = z.object({
  entry_type: entryTypeSchema,
  media_kind: mediaKindSchema,
  media_data: z.string().min(1),
  caption: z.string().max(600).optional().nullable(),
  likes_count: z.number().int().min(0).max(999999).optional(),
  comments_count: z.number().int().min(0).max(999999).optional(),
  comments: z.array(z.any()).optional(),
  meta: z
    .object({
      location: z.string().max(80).optional(),
      tags: z.array(z.string().max(30)).max(8).optional(),
      visibility: z.enum(["public", "followers"]).optional(),
      allow_likes: z.boolean().optional(),
      allow_comments: z.boolean().optional(),
      saved_to_profile: z.boolean().optional(),
    })
    .partial()
    .optional(),
  created_at: z.string().optional(),
});

const patchPostSchema = z.object({
  caption: z.string().max(600).optional(),
  likes_count: z.number().int().min(0).max(999999).optional(),
  comments_count: z.number().int().min(0).max(999999).optional(),
  comments: z.array(z.any()).optional(),
  meta: z
    .object({
      location: z.string().max(80).optional(),
      tags: z.array(z.string().max(30)).max(8).optional(),
      visibility: z.enum(["public", "followers"]).optional(),
      allow_likes: z.boolean().optional(),
      allow_comments: z.boolean().optional(),
      saved_to_profile: z.boolean().optional(),
    })
    .partial()
    .optional(),
});

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

function normalizeMeta(raw: unknown) {
  const meta = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    location: String(meta.location || "").trim().slice(0, 80),
    tags,
    visibility: String(meta.visibility || "public") === "followers" ? "followers" : "public",
    allow_likes: meta.allow_likes !== false,
    allow_comments: meta.allow_comments !== false,
    saved_to_profile: meta.saved_to_profile === true,
  };
}

router.get("/popular", async (req, res) => {
  const limitRaw = Number.parseInt(String(req.query.limit || "24"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(60, limitRaw)) : 24;

  const r = await pool.query(
    `
      SELECT
        p.id,
        p.user_id,
        p.entry_type,
        p.media_kind,
        p.media_data,
        p.caption,
        p.likes_count,
        p.comments_count,
        p.comments,
        p.meta,
        p.created_at,
        p.updated_at,
        u.username,
        u.display_name,
        u.avatar_url,
        COALESCE(fc.followers_count, 0)::int AS followers_count
      FROM profile_posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN (
        SELECT following_id, COUNT(*)::int AS followers_count
        FROM follows
        GROUP BY following_id
      ) fc ON fc.following_id = p.user_id
      WHERE
        (
          p.entry_type = 'publication'
          OR (
            p.entry_type = 'story'
            AND (
              p.created_at >= (NOW() - INTERVAL '24 hours')
              OR COALESCE((p.meta->>'saved_to_profile')::boolean, false) = true
            )
          )
        )
        AND COALESCE(p.meta->>'visibility', 'public') = 'public'
      ORDER BY
        COALESCE(p.likes_count, 0) DESC,
        COALESCE(p.comments_count, 0) DESC,
        p.created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return res.json({ items: r.rows });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const r = await pool.query(
    `
      SELECT
        id,
        user_id,
        entry_type,
        media_kind,
        media_data,
        caption,
        likes_count,
        comments_count,
        comments,
        meta,
        created_at,
        updated_at
      FROM profile_posts
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );
  return res.json({ items: r.rows });
});

router.get("/users/:userId", async (req, res) => {
  const userId = String(req.params.userId || "").trim();
  if (!userId) return res.status(400).json({ erreur: "userId manquant" });

  const viewerId = optionalUserIdFromAuthHeader(req.headers.authorization);
  const sameUser = viewerId === userId;

  const r = await pool.query(
    `
      SELECT
        p.id,
        p.user_id,
        p.entry_type,
        p.media_kind,
        p.media_data,
        p.caption,
        p.likes_count,
        p.comments_count,
        p.comments,
        p.meta,
        p.created_at,
        p.updated_at
      FROM profile_posts p
      WHERE p.user_id = $1
        AND (
          $2::boolean = true
          OR (
            (
              p.entry_type = 'publication'
              OR (p.entry_type = 'story' AND (
                p.created_at >= (NOW() - INTERVAL '24 hours')
                OR COALESCE((p.meta->>'saved_to_profile')::boolean, false) = true
              ))
            )
            AND (
              COALESCE(p.meta->>'visibility', 'public') = 'public'
              OR (
                COALESCE(p.meta->>'visibility', 'public') = 'followers'
                AND $3::uuid IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM follows f
                  WHERE f.follower_id = $3::uuid
                    AND f.following_id = $1
                )
              )
            )
          )
        )
      ORDER BY p.created_at DESC
    `,
    [userId, sameUser, viewerId || null]
  );

  return res.json({ items: r.rows });
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Donnees invalides", details: parsed.error.flatten() });

  const userId = req.user!.id;
  const body = parsed.data;
  const createdAt = body.created_at ? new Date(body.created_at) : new Date();
  const safeCreatedAt = Number.isFinite(createdAt.getTime()) ? createdAt : new Date();
  const meta = normalizeMeta(body.meta || {});

  const r = await pool.query(
    `
      INSERT INTO profile_posts (
        id,
        user_id,
        entry_type,
        media_kind,
        media_data,
        caption,
        likes_count,
        comments_count,
        comments,
        meta,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,NOW())
      RETURNING id, user_id, entry_type, media_kind, media_data, caption, likes_count, comments_count, comments, meta, created_at, updated_at
    `,
    [
      randomUUID(),
      userId,
      body.entry_type,
      body.media_kind,
      body.media_data,
      body.caption || null,
      body.likes_count || 0,
      body.comments_count || 0,
      JSON.stringify(Array.isArray(body.comments) ? body.comments : []),
      JSON.stringify(meta),
      safeCreatedAt.toISOString(),
    ]
  );

  return res.status(201).json({ item: r.rows[0] });
});

router.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id || "").trim();
  if (!postId) return res.status(400).json({ erreur: "id manquant" });

  const parsed = patchPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Donnees invalides", details: parsed.error.flatten() });

  const ownerCheck = await pool.query(
    `SELECT id, user_id, meta FROM profile_posts WHERE id = $1 LIMIT 1`,
    [postId]
  );
  const row = ownerCheck.rows[0];
  if (!row) return res.status(404).json({ erreur: "Post introuvable" });
  if (String(row.user_id) !== req.user!.id) return res.status(403).json({ erreur: "Interdit" });

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (typeof parsed.data.caption !== "undefined") {
    sets.push(`caption = $${i++}`);
    values.push(String(parsed.data.caption || "").trim());
  }
  if (typeof parsed.data.likes_count !== "undefined") {
    sets.push(`likes_count = $${i++}`);
    values.push(parsed.data.likes_count);
  }
  if (typeof parsed.data.comments_count !== "undefined") {
    sets.push(`comments_count = $${i++}`);
    values.push(parsed.data.comments_count);
  }
  if (typeof parsed.data.comments !== "undefined") {
    sets.push(`comments = $${i++}::jsonb`);
    values.push(JSON.stringify(Array.isArray(parsed.data.comments) ? parsed.data.comments : []));
  }
  if (typeof parsed.data.meta !== "undefined") {
    sets.push(`meta = $${i++}::jsonb`);
    values.push(JSON.stringify(normalizeMeta(parsed.data.meta || {})));
  }

  if (!sets.length) {
    const current = await pool.query(
      `SELECT id, user_id, entry_type, media_kind, media_data, caption, likes_count, comments_count, comments, meta, created_at, updated_at FROM profile_posts WHERE id = $1`,
      [postId]
    );
    return res.json({ item: current.rows[0] });
  }

  sets.push(`updated_at = NOW()`);
  values.push(postId);
  const updated = await pool.query(
    `
      UPDATE profile_posts
      SET ${sets.join(", ")}
      WHERE id = $${i}
      RETURNING id, user_id, entry_type, media_kind, media_data, caption, likes_count, comments_count, comments, meta, created_at, updated_at
    `,
    values
  );
  return res.json({ item: updated.rows[0] });
});

router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id || "").trim();
  if (!postId) return res.status(400).json({ erreur: "id manquant" });

  const deleted = await pool.query(
    `
      DELETE FROM profile_posts
      WHERE id = $1
        AND user_id = $2
      RETURNING id
    `,
    [postId, req.user!.id]
  );
  if (!deleted.rowCount) return res.status(404).json({ erreur: "Post introuvable" });
  return res.json({ ok: true });
});

export default router;
