import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { pool } from "../connections";

const router = Router();

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const limitRaw = Number.parseInt(String(req.query.limit || "12"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(40, limitRaw)) : 12;

  const [followersRes, suggestionsRes, repliesRes, chatMessagesRes] = await Promise.all([
    pool.query(
      `
        SELECT
          u.id,
          u.display_name,
          u.username,
          u.avatar_url,
          f.created_at
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2
      `,
      [userId, limit]
    ),
    pool.query(
      `
        WITH following AS (
          SELECT following_id
          FROM follows
          WHERE follower_id = $1
        ),
        counts AS (
          SELECT following_id AS user_id, COUNT(*)::int AS followers_count
          FROM follows
          GROUP BY following_id
        )
        SELECT
          u.id,
          u.display_name,
          u.username,
          u.avatar_url,
          COALESCE(c.followers_count, 0)::int AS followers_count
        FROM users u
        LEFT JOIN counts c ON c.user_id = u.id
        WHERE u.id <> $1
          AND u.id NOT IN (SELECT following_id FROM following)
        ORDER BY COALESCE(c.followers_count, 0) DESC, u.created_at DESC
        LIMIT $2
      `,
      [userId, limit]
    ),
    pool.query(
      `
        SELECT
          rc.id,
          rc.review_id,
          rc.parent_comment_id,
          rc.body,
          rc.created_at,
          r.media_type,
          r.media_id,
          u.id AS actor_id,
          u.display_name,
          u.username,
          u.avatar_url
        FROM review_comments rc
        JOIN review_comments mine ON mine.id = rc.parent_comment_id
        JOIN reviews r ON r.id = rc.review_id
        JOIN users u ON u.id = rc.user_id
        WHERE mine.user_id = $1
          AND rc.user_id <> $1
        ORDER BY rc.created_at DESC
        LIMIT $2
      `,
      [userId, limit]
    ),
    pool.query(
      `
        SELECT
          ct.id AS thread_id,
          cm.id AS message_id,
          cm.body,
          cm.message_type,
          cm.created_at,
          other.id AS actor_id,
          other.display_name,
          other.username,
          other.avatar_url
        FROM chat_threads ct
        JOIN chat_messages cm ON cm.thread_id = ct.id
        JOIN users other
          ON other.id = CASE WHEN ct.user_a_id = $1 THEN ct.user_b_id ELSE ct.user_a_id END
        WHERE $1 IN (ct.user_a_id, ct.user_b_id)
          AND cm.sender_id <> $1
          AND cm.read_at IS NULL
        ORDER BY cm.created_at DESC
        LIMIT $2
      `,
      [userId, limit]
    ),
  ]);

  return res.json({
    followers: followersRes.rows,
    suggestions: suggestionsRes.rows,
    comment_replies: repliesRes.rows,
    chat_messages: chatMessagesRes.rows,
  });
});

export default router;
