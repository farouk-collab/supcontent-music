import { Router } from "express";
import { pool } from "../connections";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { verifyAccessToken } from "../auth/jwt";

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
