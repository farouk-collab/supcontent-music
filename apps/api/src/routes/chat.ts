import { randomUUID } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../connections";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

const router = Router();

const createMessageSchema = z.object({
  message_type: z.enum(["text", "music", "playlist", "file", "voice", "call"]).optional(),
  body: z.string().max(2000).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

const createThreadSchema = z.object({
  target_user_id: z.string().uuid().optional(),
  match_id: z.string().uuid().optional(),
  invitation_id: z.string().uuid().optional(),
});

function orderedPair(a: string, b: string) {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

async function ensureThreadsForUserMatches(userId: string) {
  const r = await pool.query(
    `
      SELECT
        sm.id AS match_id,
        sm.user_a_id,
        sm.user_b_id,
        sm.created_at,
        sm.updated_at
      FROM swipe_matches sm
      WHERE sm.user_a_id = $1 OR sm.user_b_id = $1
      ORDER BY sm.updated_at DESC
    `,
    [userId]
  );

  for (const row of r.rows) {
    const { userA, userB } = orderedPair(String(row.user_a_id || ""), String(row.user_b_id || ""));
    await pool.query(
      `
        INSERT INTO chat_threads (id, match_id, user_a_id, user_b_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_a_id, user_b_id)
        DO UPDATE SET
          match_id = COALESCE(chat_threads.match_id, EXCLUDED.match_id),
          updated_at = GREATEST(chat_threads.updated_at, EXCLUDED.updated_at)
      `,
      [
        randomUUID(),
        row.match_id,
        userA,
        userB,
        row.created_at || new Date().toISOString(),
        row.updated_at || row.created_at || new Date().toISOString(),
      ]
    );
  }
}

async function readThreadForUser(threadId: string, userId: string) {
  const r = await pool.query(
    `
      SELECT
        ct.id,
        ct.match_id,
        ct.user_a_id,
        ct.user_b_id,
        ct.created_at,
        ct.updated_at,
        other.id AS profile_id,
        other.display_name,
        other.username,
        other.avatar_url,
        other.bio,
        other.location,
        EXISTS(SELECT 1 FROM follows f1 WHERE f1.follower_id = $2 AND f1.following_id = other.id) AS i_follow_other,
        EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = other.id AND f2.following_id = $2) AS other_follows_me
      FROM chat_threads ct
      JOIN users other
        ON other.id = CASE WHEN ct.user_a_id = $2 THEN ct.user_b_id ELSE ct.user_a_id END
      WHERE ct.id = $1
        AND ($2 IN (ct.user_a_id, ct.user_b_id))
      LIMIT 1
    `,
    [threadId, userId]
  );
  return r.rows[0] || null;
}

async function findOrCreateThreadForUsers(input: { userId: string; targetUserId: string; matchId?: string | null }) {
  const { userA, userB } = orderedPair(input.userId, input.targetUserId);
  const existing = await pool.query(
    `
      SELECT id
      FROM chat_threads
      WHERE user_a_id = $1 AND user_b_id = $2
      LIMIT 1
    `,
    [userA, userB]
  );
  if (existing.rows[0]?.id) return String(existing.rows[0].id);

  const createdId = randomUUID();
  await pool.query(
    `
      INSERT INTO chat_threads (id, match_id, user_a_id, user_b_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (user_a_id, user_b_id)
      DO UPDATE SET
        match_id = COALESCE(chat_threads.match_id, EXCLUDED.match_id),
        updated_at = NOW()
    `,
    [createdId, input.matchId || null, userA, userB]
  );

  const finalRes = await pool.query(
    `
      SELECT id
      FROM chat_threads
      WHERE user_a_id = $1 AND user_b_id = $2
      LIMIT 1
    `,
    [userA, userB]
  );
  return String(finalRes.rows[0]?.id || createdId);
}

router.post("/threads", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const parsed = createThreadSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ erreur: "Donnees invalides", details: parsed.error.flatten() });

  let targetUserId = "";
  let matchId: string | null = null;

  if (parsed.data.match_id) {
    const matchRes = await pool.query(
      `
        SELECT id, user_a_id, user_b_id
        FROM swipe_matches
        WHERE id = $1
          AND ($2 IN (user_a_id, user_b_id))
        LIMIT 1
      `,
      [parsed.data.match_id, userId]
    );
    const row = matchRes.rows[0];
    if (!row) return res.status(404).json({ erreur: "Match introuvable" });
    matchId = String(row.id || "");
    targetUserId = String(row.user_a_id || "") === userId ? String(row.user_b_id || "") : String(row.user_a_id || "");
  } else if (parsed.data.invitation_id) {
    const inviteRes = await pool.query(
      `
        SELECT id, sender_id, receiver_id
        FROM chat_invitations
        WHERE id = $1
          AND ($2 IN (sender_id, receiver_id))
        LIMIT 1
      `,
      [parsed.data.invitation_id, userId]
    );
    const row = inviteRes.rows[0];
    if (!row) return res.status(404).json({ erreur: "Invitation introuvable" });
    targetUserId = String(row.sender_id || "") === userId ? String(row.receiver_id || "") : String(row.sender_id || "");
  } else if (parsed.data.target_user_id) {
    targetUserId = parsed.data.target_user_id;
  } else {
    return res.status(400).json({ erreur: "cible chat manquante" });
  }

  if (!targetUserId || targetUserId === userId) return res.status(400).json({ erreur: "target_user_id invalide" });

  const authRes = await pool.query(
    `
      SELECT
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) AS i_follow_target,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) AS target_follows_me,
        EXISTS(
          SELECT 1
          FROM chat_invitations ci
          WHERE (
            (ci.sender_id = $1 AND ci.receiver_id = $2)
            OR (ci.sender_id = $2 AND ci.receiver_id = $1)
          )
        ) AS has_invitation,
        EXISTS(
          SELECT 1
          FROM swipe_matches sm
          WHERE (
            (sm.user_a_id = LEAST($1::uuid, $2::uuid) AND sm.user_b_id = GREATEST($1::uuid, $2::uuid))
          )
        ) AS has_match
    `,
    [userId, targetUserId]
  );

  const auth = authRes.rows[0] || {};
  const canCreate = Boolean(auth.has_match) || Boolean(auth.has_invitation) || (Boolean(auth.i_follow_target) && Boolean(auth.target_follows_me));
  if (!canCreate) return res.status(403).json({ erreur: "Conversation non autorisee" });

  const threadId = await findOrCreateThreadForUsers({ userId, targetUserId, matchId });
  const thread = await readThreadForUser(threadId, userId);
  return res.status(201).json({
    thread: {
      id: String(thread?.id || threadId),
      match_id: thread?.match_id ? String(thread.match_id) : matchId,
      profile_id: String(thread?.profile_id || targetUserId),
      user: thread
        ? {
            id: String(thread.profile_id || targetUserId),
            display_name: String(thread.display_name || thread.username || "Utilisateur"),
            username: String(thread.username || ""),
            avatar_url: String(thread.avatar_url || ""),
            bio: String(thread.bio || ""),
            location: String(thread.location || ""),
          }
        : null,
    },
  });
});

router.get("/threads", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  await ensureThreadsForUserMatches(userId);

  const r = await pool.query(
    `
      SELECT
        ct.id,
        ct.match_id,
        ct.created_at,
        ct.updated_at,
        other.id AS profile_id,
        other.display_name,
        other.username,
        other.avatar_url,
        other.bio,
        other.location,
        last_message.id AS last_message_id,
        last_message.message_type AS last_message_type,
        last_message.body AS last_message_body,
        last_message.meta AS last_message_meta,
        last_message.created_at AS last_message_created_at,
        COALESCE(unread.unread_count, 0)::int AS unread_count
      FROM chat_threads ct
      JOIN users other
        ON other.id = CASE WHEN ct.user_a_id = $1 THEN ct.user_b_id ELSE ct.user_a_id END
      LEFT JOIN LATERAL (
        SELECT cm.id, cm.message_type, cm.body, cm.meta, cm.created_at
        FROM chat_messages cm
        WHERE cm.thread_id = ct.id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ) last_message ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM chat_messages cm
        WHERE cm.thread_id = ct.id
          AND cm.sender_id <> $1
          AND cm.read_at IS NULL
      ) unread ON TRUE
      WHERE $1 IN (ct.user_a_id, ct.user_b_id)
      ORDER BY COALESCE(last_message.created_at, ct.updated_at) DESC
    `,
    [userId]
  );

  const items = r.rows.map((row: any) => ({
    id: String(row.id || ""),
    match_id: row.match_id ? String(row.match_id) : null,
    profile_id: String(row.profile_id || ""),
    user: {
      id: String(row.profile_id || ""),
      display_name: String(row.display_name || row.username || "Utilisateur"),
      username: String(row.username || ""),
      avatar_url: String(row.avatar_url || ""),
      bio: String(row.bio || ""),
      location: String(row.location || ""),
    },
    unread_count: Number(row.unread_count || 0),
    last_message: row.last_message_id
      ? {
          id: String(row.last_message_id || ""),
          message_type: String(row.last_message_type || "text"),
          body: String(row.last_message_body || ""),
          meta: row.last_message_meta || {},
          created_at: row.last_message_created_at || null,
        }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return res.json({ items, count: items.length });
});

router.get("/threads/:threadId/messages", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const threadId = String(req.params.threadId || "");
  if (!threadId) return res.status(400).json({ erreur: "threadId manquant" });

  const thread = await readThreadForUser(threadId, userId);
  if (!thread) return res.status(404).json({ erreur: "Conversation introuvable" });

  await pool.query(
    `
      UPDATE chat_messages
      SET read_at = NOW()
      WHERE thread_id = $1
        AND sender_id <> $2
        AND read_at IS NULL
    `,
    [threadId, userId]
  );

  const r = await pool.query(
    `
      SELECT
        cm.id,
        cm.thread_id,
        cm.sender_id,
        cm.message_type,
        cm.body,
        cm.meta,
        cm.created_at,
        cm.read_at
      FROM chat_messages cm
      WHERE cm.thread_id = $1
      ORDER BY cm.created_at ASC
      LIMIT 500
    `,
    [threadId]
  );

  return res.json({
    thread: {
      id: String(thread.id || ""),
      profile_id: String(thread.profile_id || ""),
      user: {
        id: String(thread.profile_id || ""),
        display_name: String(thread.display_name || thread.username || "Utilisateur"),
        username: String(thread.username || ""),
        avatar_url: String(thread.avatar_url || ""),
        bio: String(thread.bio || ""),
        location: String(thread.location || ""),
      },
    },
    items: r.rows.map((row: any) => ({
      id: String(row.id || ""),
      thread_id: String(row.thread_id || ""),
      sender_id: String(row.sender_id || ""),
      sender: String(row.sender_id || "") === userId ? "me" : "other",
      message_type: String(row.message_type || "text"),
      body: String(row.body || ""),
      meta: row.meta || {},
      created_at: row.created_at || null,
      read_at: row.read_at || null,
    })),
  });
});

router.post("/threads/:threadId/messages", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const threadId = String(req.params.threadId || "");
  if (!threadId) return res.status(400).json({ erreur: "threadId manquant" });

  const thread = await readThreadForUser(threadId, userId);
  if (!thread) return res.status(404).json({ erreur: "Conversation introuvable" });

  const parsed = createMessageSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ erreur: "Donnees invalides", details: parsed.error.flatten() });

  const messageType = parsed.data.message_type || "text";
  const body = String(parsed.data.body || "").trim();
  const meta = parsed.data.meta && typeof parsed.data.meta === "object" ? parsed.data.meta : {};

  if (!body && !Object.keys(meta).length) {
    return res.status(400).json({ erreur: "message vide" });
  }

  const messageId = randomUUID();
  const r = await pool.query(
    `
      INSERT INTO chat_messages (id, thread_id, sender_id, message_type, body, meta, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
      RETURNING id, thread_id, sender_id, message_type, body, meta, created_at, read_at
    `,
    [messageId, threadId, userId, messageType, body, JSON.stringify(meta)]
  );

  await pool.query(`UPDATE chat_threads SET updated_at = NOW() WHERE id = $1`, [threadId]);

  return res.status(201).json({
    item: {
      id: String(r.rows[0]?.id || ""),
      thread_id: String(r.rows[0]?.thread_id || ""),
      sender_id: String(r.rows[0]?.sender_id || ""),
      sender: "me",
      message_type: String(r.rows[0]?.message_type || "text"),
      body: String(r.rows[0]?.body || ""),
      meta: r.rows[0]?.meta || {},
      created_at: r.rows[0]?.created_at || null,
      read_at: r.rows[0]?.read_at || null,
    },
  });
});

export default router;
