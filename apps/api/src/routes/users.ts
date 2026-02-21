import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { updateUserById, findUserById } from "../db/users";
import { verifyAccessToken } from "../auth/jwt";
import { pool } from "../connections";

const router = Router();

/**
 * On accepte uniquement ces champs (tout est optionnel)
 * - birth_date: "YYYY-MM-DD"
 * - gender: petit enum simple (tu pourras élargir après)
 */
const UpdateMeSchema = z.object({
  display_name: z.string().min(2).max(60).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().max(200).optional().or(z.literal("")),
  location: z.string().max(80).optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  avatar_url: z
    .union([z.string().url().max(300), z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/), z.literal("")])
    .optional(),
  cover_url: z
    .union([z.string().url().max(300), z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/), z.literal("")])
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

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limitRaw = Number.parseInt(String(req.query.limit || "20"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;
  const viewerId = optionalUserIdFromAuthHeader(req.headers.authorization);

  if (!q) return res.json({ users: [] });

  const r = await pool.query(
    `
      SELECT
        u.id,
        u.display_name,
        u.username,
        u.avatar_url,
        u.bio,
        COALESCE(fc.followers_count, 0)::int AS followers_count,
        COALESCE(gc.following_count, 0)::int AS following_count,
        CASE
          WHEN $3::uuid IS NULL THEN false
          ELSE EXISTS (
            SELECT 1
            FROM follows f
            WHERE f.follower_id = $3::uuid
              AND f.following_id = u.id
          )
        END AS is_following
      FROM users u
      LEFT JOIN (
        SELECT following_id, COUNT(*)::int AS followers_count
        FROM follows
        GROUP BY following_id
      ) fc ON fc.following_id = u.id
      LEFT JOIN (
        SELECT follower_id, COUNT(*)::int AS following_count
        FROM follows
        GROUP BY follower_id
      ) gc ON gc.follower_id = u.id
      WHERE (
        u.username ILIKE $1
        OR u.display_name ILIKE $1
      )
      AND ($3::uuid IS NULL OR u.id <> $3::uuid)
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(u.username, '')) = LOWER($2) THEN 0
          WHEN LOWER(COALESCE(u.display_name, '')) = LOWER($2) THEN 1
          ELSE 2
        END,
        COALESCE(fc.followers_count, 0) DESC,
        u.created_at DESC
      LIMIT $4
    `,
    [`%${q}%`, q, viewerId || null, limit]
  );

  return res.json({ users: r.rows });
});

router.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = UpdateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erreur: "Données invalides", details: parsed.error.flatten() });
  }

  const userId = req.user!.id;

  // on normalise quelques champs
  const data = { ...parsed.data } as any;
  if (typeof data.website === "string" && data.website.trim() === "") data.website = null;
  if (typeof data.avatar_url === "string" && data.avatar_url.trim() === "") data.avatar_url = null;
  if (typeof data.cover_url === "string" && data.cover_url.trim() === "") data.cover_url = null;

  const updated = await updateUserById(userId, data);
  const fresh = await findUserById(updated.id);

  res.json({ user: fresh });
});

export default router;
