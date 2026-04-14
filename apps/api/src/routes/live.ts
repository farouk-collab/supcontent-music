import { randomUUID } from "crypto";
import { Router } from "express";
import { pool } from "../connections";
import { verifyAccessToken } from "../auth/jwt";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

const router = Router();

const ROOM_DECOR = {
  "afro-night-session": {
    queue: ["Ayo.wav", "Nina Beats", "DJ Nova"],
    moments: ["Drop a 12:40", "Guest annonce", "Nouveau son exclusif"],
  },
  "studio-talk-beatmaking": {
    queue: ["Nina Beats", "Farouk", "Luna Mix"],
    moments: ["Q&A ouvert", "Preview d'un nouveau beat", "Vote du public"],
  },
  "open-mic-late-show": {
    queue: ["DJ Nova", "Ayo.wav", "Tems Daily"],
    moments: ["Battle imminente", "Vote du public", "Guest entrant"],
  },
  "afro-mood-radio": {
    queue: ["Tems Daily"],
    moments: ["Warm-up annonce", "Selection afro exclusive", "Room ouverte a 22:30"],
  },
  "beat-critique-live": {
    queue: ["Nina Beats", "Audience picks"],
    moments: ["Feedback public", "Nouveau beat", "Vote de la room"],
  },
  "midnight-club-set": {
    queue: ["Ayo.wav", "DJ Nova"],
    moments: ["Club set", "Guest potentiel", "Midnight drop"],
  },
} as const;

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

function isUuid(value: string) {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

function formatRoom(row: any) {
  const decor = ROOM_DECOR[String(row.slug || "") as keyof typeof ROOM_DECOR] || {
    queue: [String(row.host_name || "Host")],
    moments: ["Live en cours", "Audience active", "Moment fort a venir"],
  };

  return {
    id: String(row.id || ""),
    slug: String(row.slug || ""),
    title: String(row.title || ""),
    host: String(row.host_name || ""),
    host_username: String(row.host_username || ""),
    host_user_id: row.host_user_id ? String(row.host_user_id) : null,
    host_verified: Boolean(row.host_verified),
    category: String(row.category || ""),
    type: String(row.live_type || "video"),
    track: String(row.track_title || ""),
    tags: Array.isArray(row.tags) ? row.tags : [],
    gradient_key: String(row.cover_gradient || ""),
    listeners: Number(row.listeners_count || 0),
    likes: Number(row.likes_count || 0),
    is_live: Boolean(row.is_live),
    scheduled_for: row.scheduled_for || null,
    captions_text: row.captions_text ? String(row.captions_text) : null,
    queue: decor.queue,
    moments: decor.moments,
    comments: [] as Array<{
      id: string;
      author: string;
      text: string;
      created_at: string | Date | null;
    }>,
    membership: {
      joined: Boolean(row.viewer_joined),
      liked: Boolean(row.viewer_liked),
      gift_sent: Boolean(row.viewer_gift_sent),
      muted: Boolean(row.viewer_muted),
      captions_enabled: row.viewer_captions_enabled !== false,
      camera_view: String(row.viewer_camera_view || "host"),
      is_following_host: Boolean(row.viewer_follows_host),
      reminder_set: Boolean(row.viewer_reminder_set),
    },
  };
}

async function readRooms(userId: string | null) {
  const result = await pool.query(
    `
      SELECT
        lr.*,
        lr.base_listeners_count + COALESCE(members.joined_count, 0) AS listeners_count,
        lr.base_likes_count + COALESCE(members.likes_count, 0) AS likes_count,
        mem.joined AS viewer_joined,
        mem.liked AS viewer_liked,
        mem.gift_sent AS viewer_gift_sent,
        mem.muted AS viewer_muted,
        mem.captions_enabled AS viewer_captions_enabled,
        mem.camera_view AS viewer_camera_view,
        EXISTS(
          SELECT 1
          FROM live_room_reminders reminders
          WHERE reminders.room_id = lr.id
            AND reminders.user_id = $1::uuid
        ) AS viewer_reminder_set,
        CASE
          WHEN $1::uuid IS NULL OR lr.host_user_id IS NULL THEN FALSE
          ELSE EXISTS(
            SELECT 1
            FROM follows f
            WHERE f.follower_id = $1::uuid
              AND f.following_id = lr.host_user_id
          )
        END AS viewer_follows_host
      FROM live_rooms lr
      LEFT JOIN (
        SELECT
          room_id,
          COUNT(*) FILTER (WHERE joined = TRUE) AS joined_count,
          COUNT(*) FILTER (WHERE liked = TRUE) AS likes_count
        FROM live_room_memberships
        GROUP BY room_id
      ) members ON members.room_id = lr.id
      LEFT JOIN live_room_memberships mem
        ON mem.room_id = lr.id
       AND mem.user_id = $1::uuid
      ORDER BY
        CASE WHEN lr.is_live THEN 0 ELSE 1 END,
        lr.scheduled_for ASC NULLS LAST,
        lr.updated_at DESC
    `,
    [userId]
  );

  const roomIds = result.rows.map((row) => String(row.id || ""));
  const messageMap = new Map<string, any[]>();
  if (roomIds.length) {
    const messagesRes = await pool.query(
      `
        SELECT room_id, id, author_name, body, created_at
        FROM (
          SELECT
            m.*,
            ROW_NUMBER() OVER (PARTITION BY m.room_id ORDER BY m.created_at DESC) AS rn
          FROM live_room_messages m
          WHERE m.room_id = ANY($1::uuid[])
        ) ranked
        WHERE rn <= 8
        ORDER BY room_id, created_at ASC
      `,
      [roomIds]
    );

    for (const row of messagesRes.rows) {
      const roomId = String(row.room_id || "");
      const current = messageMap.get(roomId) || [];
      current.push({
        id: String(row.id || ""),
        author: String(row.author_name || "Utilisateur"),
        text: String(row.body || ""),
        created_at: row.created_at,
      });
      messageMap.set(roomId, current);
    }
  }

  const formatted = result.rows.map((row) => {
    const room = formatRoom(row);
    room.comments = messageMap.get(room.id) || [];
    return room;
  });

  return {
    rooms: formatted.filter((room) => room.is_live),
    scheduled: formatted.filter((room) => !room.is_live),
  };
}

router.get("/rooms", async (req, res) => {
  const userId = optionalUserIdFromAuthHeader(req.headers.authorization);
  const data = await readRooms(userId);
  return res.json({
    generated_at: new Date().toISOString(),
    rooms: data.rooms,
    scheduled: data.scheduled,
  });
});

router.post("/rooms/:roomId/join", requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId || "");
  const userId = String(req.user?.id || "");
  if (!isUuid(roomId)) return res.status(400).json({ erreur: "room_id_invalide" });

  const roomRes = await pool.query(`SELECT id, title FROM live_rooms WHERE id = $1 LIMIT 1`, [roomId]);
  const room = roomRes.rows[0];
  if (!room) return res.status(404).json({ erreur: "room_introuvable" });

  await pool.query(
    `
      INSERT INTO live_room_memberships (room_id, user_id, joined, last_seen_at)
      VALUES ($1, $2, TRUE, NOW())
      ON CONFLICT (room_id, user_id)
      DO UPDATE SET joined = TRUE, last_seen_at = NOW()
    `,
    [roomId, userId]
  );

  return res.json({
    ok: true,
    room_id: roomId,
    room_title: String(room.title || ""),
    joined: true,
  });
});

router.post("/rooms/:roomId/like", requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId || "");
  const userId = String(req.user?.id || "");
  if (!isUuid(roomId)) return res.status(400).json({ erreur: "room_id_invalide" });

  const roomRes = await pool.query(`SELECT id, title FROM live_rooms WHERE id = $1 LIMIT 1`, [roomId]);
  const room = roomRes.rows[0];
  if (!room) return res.status(404).json({ erreur: "room_introuvable" });

  await pool.query(
    `
      INSERT INTO live_room_memberships (room_id, user_id, joined, liked, last_seen_at)
      VALUES ($1, $2, TRUE, TRUE, NOW())
      ON CONFLICT (room_id, user_id)
      DO UPDATE SET
        joined = TRUE,
        liked = NOT live_room_memberships.liked,
        last_seen_at = NOW()
    `,
    [roomId, userId]
  );

  const membershipRes = await pool.query(
    `SELECT liked FROM live_room_memberships WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
    [roomId, userId]
  );
  const liked = Boolean(membershipRes.rows[0]?.liked);

  const countsRes = await pool.query(
    `
      SELECT
        lr.base_likes_count + COUNT(*) FILTER (WHERE mem.liked = TRUE) AS likes_count
      FROM live_rooms lr
      LEFT JOIN live_room_memberships mem ON mem.room_id = lr.id
      WHERE lr.id = $1
      GROUP BY lr.id
    `,
    [roomId]
  );

  return res.json({
    ok: true,
    room_id: roomId,
    room_title: String(room.title || ""),
    liked,
    likes_count: Number(countsRes.rows[0]?.likes_count || 0),
  });
});

router.post("/rooms/:roomId/gift", requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId || "");
  const userId = String(req.user?.id || "");
  if (!isUuid(roomId)) return res.status(400).json({ erreur: "room_id_invalide" });

  const roomRes = await pool.query(`SELECT id, title, host_name FROM live_rooms WHERE id = $1 LIMIT 1`, [roomId]);
  const room = roomRes.rows[0];
  if (!room) return res.status(404).json({ erreur: "room_introuvable" });

  await pool.query(
    `
      INSERT INTO live_room_memberships (room_id, user_id, joined, gift_sent, last_seen_at)
      VALUES ($1, $2, TRUE, TRUE, NOW())
      ON CONFLICT (room_id, user_id)
      DO UPDATE SET joined = TRUE, gift_sent = TRUE, last_seen_at = NOW()
    `,
    [roomId, userId]
  );

  return res.json({
    ok: true,
    room_id: roomId,
    room_title: String(room.title || ""),
    host: String(room.host_name || ""),
    gift_sent: true,
  });
});

router.post("/rooms/:roomId/messages", requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId || "");
  const userId = String(req.user?.id || "");
  const body = String(req.body?.body || "").trim();
  if (!isUuid(roomId)) return res.status(400).json({ erreur: "room_id_invalide" });
  if (!body) return res.status(400).json({ erreur: "message_requis" });

  const roomRes = await pool.query(`SELECT id, title FROM live_rooms WHERE id = $1 LIMIT 1`, [roomId]);
  const room = roomRes.rows[0];
  if (!room) return res.status(404).json({ erreur: "room_introuvable" });

  const userRes = await pool.query(
    `SELECT display_name, username FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const user = userRes.rows[0];
  const authorName = String(user?.username || user?.display_name || "toi");

  await pool.query(
    `
      INSERT INTO live_room_memberships (room_id, user_id, joined, last_seen_at)
      VALUES ($1, $2, TRUE, NOW())
      ON CONFLICT (room_id, user_id)
      DO UPDATE SET joined = TRUE, last_seen_at = NOW()
    `,
    [roomId, userId]
  );

  const insertRes = await pool.query(
    `
      INSERT INTO live_room_messages (id, room_id, author_user_id, author_name, body, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, author_name, body, created_at
    `,
    [randomUUID(), roomId, userId, authorName, body]
  );

  const message = insertRes.rows[0];
  return res.status(201).json({
    ok: true,
    room_id: roomId,
    room_title: String(room.title || ""),
    message: {
      id: String(message.id || ""),
      author: String(message.author_name || authorName),
      text: String(message.body || ""),
      created_at: message.created_at,
    },
  });
});

router.post("/rooms/:roomId/preferences", requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId || "");
  const userId = String(req.user?.id || "");
  if (!isUuid(roomId)) return res.status(400).json({ erreur: "room_id_invalide" });

  const roomRes = await pool.query(`SELECT id FROM live_rooms WHERE id = $1 LIMIT 1`, [roomId]);
  if (!roomRes.rows[0]) return res.status(404).json({ erreur: "room_introuvable" });

  const muted = typeof req.body?.muted === "boolean" ? Boolean(req.body.muted) : false;
  const captionsEnabled = typeof req.body?.captions_enabled === "boolean" ? Boolean(req.body.captions_enabled) : true;
  const cameraView = ["host", "stage", "audience"].includes(String(req.body?.camera_view || ""))
    ? String(req.body.camera_view)
    : "host";

  await pool.query(
    `
      INSERT INTO live_room_memberships (room_id, user_id, joined, muted, captions_enabled, camera_view, last_seen_at)
      VALUES ($1, $2, TRUE, $3, $4, $5, NOW())
      ON CONFLICT (room_id, user_id)
      DO UPDATE SET
        joined = TRUE,
        muted = EXCLUDED.muted,
        captions_enabled = EXCLUDED.captions_enabled,
        camera_view = EXCLUDED.camera_view,
        last_seen_at = NOW()
    `,
    [roomId, userId, muted, captionsEnabled, cameraView]
  );

  return res.json({
    ok: true,
    room_id: roomId,
    membership: {
      muted,
      captions_enabled: captionsEnabled,
      camera_view: cameraView,
    },
  });
});

router.post("/rooms/:roomId/reminder", requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId || "");
  const userId = String(req.user?.id || "");
  if (!isUuid(roomId)) return res.status(400).json({ erreur: "room_id_invalide" });

  const roomRes = await pool.query(`SELECT id, title FROM live_rooms WHERE id = $1 LIMIT 1`, [roomId]);
  const room = roomRes.rows[0];
  if (!room) return res.status(404).json({ erreur: "room_introuvable" });

  const existing = await pool.query(
    `SELECT 1 FROM live_room_reminders WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
    [roomId, userId]
  );
  const alreadySet = Boolean(existing.rows[0]);

  if (alreadySet) {
    await pool.query(`DELETE FROM live_room_reminders WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
  } else {
    await pool.query(
      `INSERT INTO live_room_reminders (room_id, user_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (room_id, user_id) DO NOTHING`,
      [roomId, userId]
    );
  }

  return res.json({
    ok: true,
    room_id: roomId,
    room_title: String(room.title || ""),
    reminder_set: !alreadySet,
  });
});

export default router;
