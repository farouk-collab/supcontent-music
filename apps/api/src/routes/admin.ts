import { Router } from "express";
import { pool } from "../connections";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

const router = Router();

async function requireAdmin(req: AuthedRequest, res: any, next: any) {
  if (!req.user) return res.status(403).json({ erreur: "Non authentifié" });
  const r = await pool.query("SELECT role FROM users WHERE id = $1 LIMIT 1", [req.user.id]);
  if (r.rows[0]?.role !== "admin") {
    return res.status(403).json({ erreur: "Accès réservé aux administrateurs" });
  }
  next();
}

async function ensureReportsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
      reason TEXT NOT NULL DEFAULT 'inappropriate',
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

setTimeout(() => {
  ensureReportsTables().catch((e) => console.error("Reports table init failed:", e?.message));
}, 3000);

// Any user can report a review
router.post("/reviews/:reviewId/report", requireAuth, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "").trim();
  const reason = String(req.body?.reason || "inappropriate").trim();
  const details = String(req.body?.details || "").trim();
  const userId = req.user!.id;

  const exists = await pool.query(`SELECT id FROM reviews WHERE id = $1 LIMIT 1`, [reviewId]);
  if (!exists.rows.length) return res.status(404).json({ erreur: "Critique introuvable" });

  const already = await pool.query(
    `SELECT id FROM content_reports WHERE reporter_id = $1 AND review_id = $2 LIMIT 1`,
    [userId, reviewId]
  );
  if (already.rows.length) return res.status(409).json({ erreur: "Déjà signalé" });

  await pool.query(
    `INSERT INTO content_reports (reporter_id, review_id, reason, details) VALUES ($1, $2, $3, $4)`,
    [userId, reviewId, reason, details || null]
  );
  return res.status(201).json({ ok: true });
});

// Admin: list pending reports
router.get("/reports", requireAuth, requireAdmin, async (_req, res) => {
  const r = await pool.query(`
    SELECT
      cr.id,
      cr.reason,
      cr.details,
      cr.status,
      cr.created_at,
      rev.id AS review_id,
      rev.body AS review_body,
      rev.rating,
      rev.media_type,
      rev.media_id,
      author.id AS author_id,
      author.display_name AS author_name,
      author.username AS author_username,
      reporter.display_name AS reporter_name
    FROM content_reports cr
    JOIN reviews rev ON rev.id = cr.review_id
    JOIN users author ON author.id = rev.user_id
    JOIN users reporter ON reporter.id = cr.reporter_id
    WHERE cr.status = 'pending'
    ORDER BY cr.created_at DESC
    LIMIT 50
  `);
  return res.json({ reports: r.rows });
});

// Admin: dismiss report
router.patch("/reports/:reportId/dismiss", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const reportId = String(req.params.reportId || "").trim();
  await pool.query(`UPDATE content_reports SET status = 'dismissed' WHERE id = $1`, [reportId]);
  return res.json({ ok: true });
});

// Admin: delete a review
router.delete("/reviews/:reviewId", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "").trim();
  await pool.query(`DELETE FROM reviews WHERE id = $1`, [reviewId]);
  await pool.query(`UPDATE content_reports SET status = 'resolved' WHERE review_id = $1`, [reviewId]);
  return res.json({ ok: true });
});

// Admin: feature/unfeature a review ("Coup de cœur")
router.patch("/reviews/:reviewId/featured", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const reviewId = String(req.params.reviewId || "").trim();
  const featured = Boolean(req.body?.featured);
  // Add featured column if not exists
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`UPDATE reviews SET featured = $1 WHERE id = $2`, [featured, reviewId]);
  return res.json({ ok: true, featured });
});

// Admin: ban a user
router.post("/users/:userId/ban", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const userId = String(req.params.userId || "").trim();
  if (userId === req.user!.id) return res.status(400).json({ erreur: "Impossible de se bannir soi-même" });
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`UPDATE users SET banned = TRUE WHERE id = $1`, [userId]);
  // Invalidate all tokens
  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
  return res.json({ ok: true });
});

// Admin: unban a user
router.post("/users/:userId/unban", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const userId = String(req.params.userId || "").trim();
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`UPDATE users SET banned = FALSE WHERE id = $1`, [userId]);
  return res.json({ ok: true });
});

// Admin: list all users
router.get("/users", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const q = String(req.query.q || "").trim();
  const limit = 30;
  let rows;
  if (q) {
    const r = await pool.query(
      `SELECT id, email, display_name, username, role, created_at,
              COALESCE(banned, FALSE) AS banned
       FROM users
       WHERE display_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1
       ORDER BY created_at DESC LIMIT $2`,
      [`%${q}%`, limit]
    );
    rows = r.rows;
  } else {
    const r = await pool.query(
      `SELECT id, email, display_name, username, role, created_at,
              COALESCE(banned, FALSE) AS banned
       FROM users ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    rows = r.rows;
  }
  return res.json({ users: rows });
});

// Admin: promote user to admin
router.patch("/users/:userId/role", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const userId = String(req.params.userId || "").trim();
  const role = String(req.body?.role || "user").trim();
  if (!["user", "admin", "moderator"].includes(role)) return res.status(400).json({ erreur: "Rôle invalide" });
  await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userId]);
  return res.json({ ok: true });
});

export default router;
