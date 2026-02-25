import { randomUUID } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../connections";
import { verifyAccessToken } from "../auth/jwt";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

const router = Router();

const MediaTypeSchema = z.enum(["track", "album", "artist"]);

const ReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1500).optional(),
  image_url: z.string().max(300).optional().nullable(),
  sticker: z.string().max(300).optional().nullable(),
});

const CommentBodySchema = z.object({
  body: z.string().max(1500).optional(),
  parent_comment_id: z.string().uuid().optional().nullable(),
  image_url: z.string().max(300).optional().nullable(),
  sticker: z.string().max(300).optional().nullable(),
});

const CommentVoteSchema = z.object({
  vote: z.enum(["up", "down"]),
});

const ReviewVoteSchema = z.object({
  vote: z.enum(["up", "down"]),
});

const CommentUpdateSchema = z.object({
  body: z.string().trim().min(1).max(1500),
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

router.get("/media/:mediaType/:mediaId", async (req, res) => {
  try {
    const parsedType = MediaTypeSchema.safeParse(String(req.params.mediaType || ""));
    if (!parsedType.success) return res.status(400).json({ erreur: "mediaType invalide" });

    const mediaType = parsedType.data;
    const mediaId = String(req.params.mediaId || "").trim();
    if (!mediaId) return res.status(400).json({ erreur: "mediaId manquant" });

    const currentUserId = optionalUserIdFromAuthHeader(req.headers.authorization);

    const summaryRes = await pool.query(
      `
        WITH base_reviews AS (
          SELECT id, rating
          FROM reviews
          WHERE media_type = $1 AND media_id = $2
        ),
        likes_cte AS (
          SELECT COUNT(*) FILTER (WHERE rv.vote_type = 'up')::int AS like_count
          FROM review_votes rv
          JOIN base_reviews br ON br.id = rv.review_id
        ),
        comments_cte AS (
          SELECT COUNT(*)::int AS comment_count
          FROM review_comments rc
          JOIN base_reviews br ON br.id = rc.review_id
        )
        SELECT
          (SELECT COUNT(*)::int FROM base_reviews) AS review_count,
          (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float8 FROM base_reviews) AS avg_rating,
          (SELECT like_count FROM likes_cte) AS like_count,
          (SELECT comment_count FROM comments_cte) AS comment_count
      `,
      [mediaType, mediaId]
    );

    const reviewsRes = await pool.query(
      `
        SELECT
          r.id,
          r.user_id,
          u.display_name,
          r.rating,
          r.body,
          r.image_url,
          r.sticker,
          r.created_at,
          r.updated_at,
          COALESCE(vc.votes_up, 0)::int AS likes_count,
          COALESCE(vc.votes_down, 0)::int AS dislikes_count,
          COALESCE(cc.comments_count, 0)::int AS comments_count,
          CASE
            WHEN $3::uuid IS NULL THEN NULL
            ELSE (
              SELECT vote_type
              FROM review_votes rv
              WHERE rv.review_id = r.id AND rv.user_id = $3::uuid
              LIMIT 1
            )
          END AS my_vote
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN (
          SELECT
            review_id,
            COUNT(*) FILTER (WHERE vote_type = 'up')::int AS votes_up,
            COUNT(*) FILTER (WHERE vote_type = 'down')::int AS votes_down
          FROM review_votes
          GROUP BY review_id
        ) vc ON vc.review_id = r.id
        LEFT JOIN (
          SELECT review_id, COUNT(*)::int AS comments_count
          FROM review_comments
          GROUP BY review_id
        ) cc ON cc.review_id = r.id
        WHERE r.media_type = $1 AND r.media_id = $2
        ORDER BY r.created_at DESC
      `,
      [mediaType, mediaId, currentUserId || null]
    );

    const reviewIds = reviewsRes.rows.map((r: any) => r.id);
    let commentsByReview = new Map<string, any[]>();
    if (reviewIds.length > 0) {
      const commentsRes = await pool.query(
        `
          SELECT
            rc.id,
            rc.review_id,
            r.user_id AS review_user_id,
            rc.parent_comment_id,
            rc.user_id,
            u.display_name,
            COALESCE(rc.body, rc.content, '') AS body,
            rc.image_url,
            rc.sticker,
            rc.created_at,
            COALESCE(cv.votes_up, 0)::int AS votes_up,
            COALESCE(cv.votes_down, 0)::int AS votes_down,
            CASE
              WHEN $2::uuid IS NULL THEN NULL
              ELSE (
                SELECT vote_type
                FROM comment_votes cvi
                WHERE cvi.comment_id = rc.id AND cvi.user_id = $2::uuid
                LIMIT 1
              )
            END AS my_vote
          FROM review_comments rc
          JOIN reviews r ON r.id = rc.review_id
          JOIN users u ON u.id = rc.user_id
          LEFT JOIN (
            SELECT
              comment_id,
              COUNT(*) FILTER (WHERE vote_type = 'up')::int AS votes_up,
              COUNT(*) FILTER (WHERE vote_type = 'down')::int AS votes_down
            FROM comment_votes
            GROUP BY comment_id
          ) cv ON cv.comment_id = rc.id
          WHERE rc.review_id = ANY($1::uuid[])
          ORDER BY rc.created_at ASC
        `,
        [reviewIds, currentUserId || null]
      );

      commentsByReview = new Map<string, any[]>();
      for (const c of commentsRes.rows) {
        const arr = commentsByReview.get(c.review_id) || [];
        arr.push(c);
        commentsByReview.set(c.review_id, arr);
      }
    }

    const reviews = reviewsRes.rows.map((r: any) => ({
      ...r,
      comments: commentsByReview.get(r.id) || [],
    }));

    return res.json({
      current_user_id: currentUserId,
      summary: summaryRes.rows[0] || {
        review_count: 0,
        avg_rating: 0,
        like_count: 0,
        comment_count: 0,
      },
      reviews,
    });
  } catch (e: any) {
    console.error("Social media feed error:", e?.message || e);
    return res.status(500).json({ erreur: "impossible de charger les commentaires" });
  }
});

router.post("/media/:mediaType/:mediaId/reviews", requireAuth, async (req: AuthedRequest, res) => {
  const parsedType = MediaTypeSchema.safeParse(String(req.params.mediaType || ""));
  if (!parsedType.success) return res.status(400).json({ erreur: "mediaType invalide" });
  const mediaType = parsedType.data;
  const mediaId = String(req.params.mediaId || "").trim();
  if (!mediaId) return res.status(400).json({ erreur: "mediaId manquant" });

  const parsedBody = ReviewBodySchema.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ erreur: "Donnees invalides" });

  const userId = req.user!.id;
  const { rating } = parsedBody.data;
  const body = String(parsedBody.data.body || "").trim();
  const imageUrl = String(parsedBody.data.image_url || "").trim();
  const sticker = String(parsedBody.data.sticker || "").trim();

  const inserted = await pool.query(
    `
      INSERT INTO reviews (id, user_id, media_type, media_id, rating, body, image_url, sticker)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, media_type, media_id, rating, body, image_url, sticker, created_at, updated_at
    `,
    [randomUUID(), userId, mediaType, mediaId, rating, body || null, imageUrl || null, sticker || null]
  );
  return res.status(201).json({ review: inserted.rows[0] });
});

router.post("/reviews/:reviewId/like", requireAuth, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(reviewId)) return res.status(400).json({ erreur: "reviewId invalide" });

  const userId = req.user!.id;
  await pool.query(
    `
      INSERT INTO review_votes (review_id, user_id, vote_type)
      VALUES ($1, $2, 'up')
      ON CONFLICT (review_id, user_id)
      DO UPDATE SET vote_type = EXCLUDED.vote_type, created_at = NOW()
    `,
    [reviewId, userId]
  );
  return res.json({ liked: true });
});

router.delete("/reviews/:reviewId/like", requireAuth, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(reviewId)) return res.status(400).json({ erreur: "reviewId invalide" });

  const userId = req.user!.id;
  await pool.query(
    `
      DELETE FROM review_votes
      WHERE review_id = $1 AND user_id = $2
    `,
    [reviewId, userId]
  );
  return res.json({ liked: false });
});

router.post("/reviews/:reviewId/vote", requireAuth, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(reviewId)) return res.status(400).json({ erreur: "reviewId invalide" });

  const parsed = ReviewVoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Vote invalide" });

  const userId = req.user!.id;
  const vote = parsed.data.vote;
  await pool.query(
    `
      INSERT INTO review_votes (review_id, user_id, vote_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (review_id, user_id)
      DO UPDATE SET vote_type = EXCLUDED.vote_type, created_at = NOW()
    `,
    [reviewId, userId, vote]
  );
  return res.json({ ok: true, vote });
});

router.delete("/reviews/:reviewId/vote", requireAuth, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(reviewId)) return res.status(400).json({ erreur: "reviewId invalide" });

  const userId = req.user!.id;
  await pool.query(
    `
      DELETE FROM review_votes
      WHERE review_id = $1 AND user_id = $2
    `,
    [reviewId, userId]
  );
  return res.json({ ok: true });
});

router.post("/reviews/:reviewId/comments", requireAuth, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(reviewId)) return res.status(400).json({ erreur: "reviewId invalide" });

  const parsed = CommentBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Donnees invalides" });

  const userId = req.user!.id;
  const body = String(parsed.data.body || "").trim();
  const parentCommentId = parsed.data.parent_comment_id || null;
  const imageUrl = String(parsed.data.image_url || "").trim();
  const sticker = String(parsed.data.sticker || "").trim();

  if (!body && !imageUrl && !sticker) {
    return res.status(400).json({ erreur: "Commentaire vide" });
  }

  if (parentCommentId) {
    const parentRes = await pool.query(
      `
        SELECT id
        FROM review_comments
        WHERE id = $1 AND review_id = $2
        LIMIT 1
      `,
      [parentCommentId, reviewId]
    );
    if (!parentRes.rows[0]) return res.status(400).json({ erreur: "Commentaire parent invalide" });
  }

  const r = await pool.query(
    `
      INSERT INTO review_comments (id, review_id, user_id, parent_comment_id, body, content, image_url, sticker)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, review_id, user_id, parent_comment_id, body, image_url, sticker, created_at
    `,
    [randomUUID(), reviewId, userId, parentCommentId, body || "", body || "", imageUrl || null, sticker || null]
  );
  return res.status(201).json({ comment: r.rows[0] });
});

router.patch("/reviews/:reviewId", requireAuth, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(reviewId)) return res.status(400).json({ erreur: "reviewId invalide" });

  const parsedBody = ReviewBodySchema.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ erreur: "Donnees invalides" });

  const userId = req.user!.id;
  const { rating } = parsedBody.data;
  const body = String(parsedBody.data.body || "").trim();
  const imageUrl = String(parsedBody.data.image_url || "").trim();
  const sticker = String(parsedBody.data.sticker || "").trim();

  const updated = await pool.query(
    `
      UPDATE reviews
      SET rating = $1, body = $2, image_url = $3, sticker = $4, updated_at = NOW()
      WHERE id = $5 AND user_id = $6
      RETURNING id, user_id, media_type, media_id, rating, body, image_url, sticker, created_at, updated_at
    `,
    [rating, body || null, imageUrl || null, sticker || null, reviewId, userId]
  );

  if (!updated.rows[0]) return res.status(403).json({ erreur: "Modification non autorisee" });
  return res.json({ review: updated.rows[0] });
});

router.delete("/reviews/:reviewId", requireAuth, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(reviewId)) return res.status(400).json({ erreur: "reviewId invalide" });

  const userId = req.user!.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ownRes = await client.query(
      `
        SELECT id
        FROM reviews
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
      [reviewId, userId]
    );
    if (!ownRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(403).json({ erreur: "Suppression non autorisee" });
    }

    await client.query(
      `
        DELETE FROM comment_votes
        WHERE comment_id IN (
          SELECT id FROM review_comments WHERE review_id = $1
        )
      `,
      [reviewId]
    );
    await client.query(
      `
        DELETE FROM review_comments
        WHERE review_id = $1
      `,
      [reviewId]
    );
    await client.query(
      `
        DELETE FROM review_votes
        WHERE review_id = $1
      `,
      [reviewId]
    );
    await client.query(
      `
        DELETE FROM reviews
        WHERE id = $1
      `,
      [reviewId]
    );

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

router.patch("/comments/:commentId", requireAuth, async (req: AuthedRequest, res) => {
  const commentId = String(req.params.commentId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(commentId)) return res.status(400).json({ erreur: "commentId invalide" });

  const parsed = CommentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Donnees invalides" });

  const userId = req.user!.id;
  const body = parsed.data.body;

  const updated = await pool.query(
    `
      UPDATE review_comments
      SET body = $1, content = $1
      WHERE id = $2 AND user_id = $3
      RETURNING id, review_id, user_id, parent_comment_id, body, image_url, sticker, created_at
    `,
    [body, commentId, userId]
  );
  if (updated.rows[0]) return res.json({ comment: updated.rows[0] });

  const exists = await pool.query(
    `
      SELECT id
      FROM review_comments
      WHERE id = $1
      LIMIT 1
    `,
    [commentId]
  );
  if (!exists.rows[0]) return res.status(404).json({ erreur: "Commentaire introuvable" });
  return res.status(403).json({ erreur: "Modification non autorisee" });
});

router.post("/comments/:commentId/vote", requireAuth, async (req: AuthedRequest, res) => {
  const commentId = String(req.params.commentId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(commentId)) return res.status(400).json({ erreur: "commentId invalide" });

  const parsed = CommentVoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erreur: "Vote invalide" });

  const userId = req.user!.id;
  const vote = parsed.data.vote;
  await pool.query(
    `
      INSERT INTO comment_votes (comment_id, user_id, vote_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (comment_id, user_id)
      DO UPDATE SET vote_type = EXCLUDED.vote_type, created_at = NOW()
    `,
    [commentId, userId, vote]
  );

  return res.json({ ok: true, vote });
});

router.delete("/comments/:commentId/vote", requireAuth, async (req: AuthedRequest, res) => {
  const commentId = String(req.params.commentId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(commentId)) return res.status(400).json({ erreur: "commentId invalide" });

  const userId = req.user!.id;
  await pool.query(
    `
      DELETE FROM comment_votes
      WHERE comment_id = $1 AND user_id = $2
    `,
    [commentId, userId]
  );
  return res.json({ ok: true });
});

router.delete("/comments/:commentId", requireAuth, async (req: AuthedRequest, res) => {
  const commentId = String(req.params.commentId || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(commentId)) return res.status(400).json({ erreur: "commentId invalide" });

  const userId = req.user!.id;

  const ownership = await pool.query(
    `
      SELECT rc.id, rc.user_id AS comment_user_id, r.user_id AS review_user_id
      FROM review_comments rc
      JOIN reviews r ON r.id = rc.review_id
      WHERE rc.id = $1
      LIMIT 1
    `,
    [commentId]
  );
  const row = ownership.rows[0];
  if (!row) return res.status(404).json({ erreur: "Commentaire introuvable" });

  const canDelete = row.comment_user_id === userId || row.review_user_id === userId;
  if (!canDelete) return res.status(403).json({ erreur: "Suppression non autorisee" });

  await pool.query(
    `
      DELETE FROM review_comments
      WHERE id = $1
    `,
    [commentId]
  );

  return res.json({ ok: true });
});

export default router;
