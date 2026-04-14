import { randomUUID } from "crypto";
import { pool } from "../connections";

const SEEDED_ROOMS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "afro-night-session",
    title: "Afro Night Session",
    hostName: "Ayo.wav",
    hostUsername: "ayo.wav",
    hostVerified: true,
    category: "Live DJ Set",
    liveType: "video",
    track: "Afro Sunset - Live Edit",
    tags: ["Afro", "Live", "Dance"],
    coverGradient: "emerald-fuchsia",
    baseListeners: 1842,
    baseLikes: 12300,
    isLive: true,
    scheduledFor: null,
    captionsText: "Bienvenue dans la room, on monte en energie dans 20 secondes.",
    comments: [
      ["nina.beats", "Le live est incroyable"],
      ["daxwritz", "La transition est trop propre"],
      ["temsdaily", "On veut la playlist apres"],
      ["ayo.wav", "Le drop arrive dans 20 secondes"],
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "studio-talk-beatmaking",
    title: "Studio Talk & Beatmaking",
    hostName: "Nina Beats",
    hostUsername: "nina.beats",
    hostVerified: true,
    category: "Studio Room",
    liveType: "audio",
    track: "Work in progress beat",
    tags: ["Studio", "Beatmaking", "Q&A"],
    coverGradient: "blue-emerald",
    baseListeners: 731,
    baseLikes: 4800,
    isLive: true,
    scheduledFor: null,
    captionsText: "Bienvenue dans la room, on monte en energie dans 20 secondes.",
    comments: [
      ["ayo.wav", "Montre la basse encore une fois"],
      ["farouk", "Le kick est super propre"],
      ["luna.mix", "On veut entendre la version finale"],
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "open-mic-late-show",
    title: "Open Mic Late Show",
    hostName: "DJ Nova",
    hostUsername: "djnova",
    hostVerified: false,
    category: "Open Mic",
    liveType: "video",
    track: "Freestyle session",
    tags: ["Open mic", "Rap", "Freestyle"],
    coverGradient: "amber-rose",
    baseListeners: 409,
    baseLikes: 2190,
    isLive: true,
    scheduledFor: null,
    captionsText: "Bienvenue dans la room, on monte en energie dans 20 secondes.",
    comments: [
      ["ayo.wav", "Le prochain passage va etre lourd"],
      ["nina.beats", "J'attends la partie refrains"],
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "afro-mood-radio",
    title: "Afro Mood Radio",
    hostName: "Tems Daily",
    hostUsername: "temsdaily",
    hostVerified: false,
    category: "Programmation",
    liveType: "audio",
    track: "Warm-up selection",
    tags: ["Afro", "Radio"],
    coverGradient: "emerald-blue",
    baseListeners: 0,
    baseLikes: 0,
    isLive: false,
    scheduledFor: "2026-04-12T22:30:00.000Z",
    captionsText: null,
    comments: [],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    slug: "beat-critique-live",
    title: "Beat Critique Live",
    hostName: "Nina Beats",
    hostUsername: "nina.beats",
    hostVerified: true,
    category: "Programmation",
    liveType: "audio",
    track: "Feedback session",
    tags: ["Studio", "Feedback"],
    coverGradient: "blue-emerald",
    baseListeners: 0,
    baseLikes: 0,
    isLive: false,
    scheduledFor: "2026-04-12T23:15:00.000Z",
    captionsText: null,
    comments: [],
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    slug: "midnight-club-set",
    title: "Midnight Club Set",
    hostName: "Ayo.wav",
    hostUsername: "ayo.wav",
    hostVerified: true,
    category: "Programmation",
    liveType: "video",
    track: "Club warm-up",
    tags: ["Club", "Set"],
    coverGradient: "emerald-fuchsia",
    baseListeners: 0,
    baseLikes: 0,
    isLive: false,
    scheduledFor: "2026-04-13T00:00:00.000Z",
    captionsText: null,
    comments: [],
  },
];

export async function ensureLiveTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_rooms (
      id UUID PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      host_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      host_name TEXT NOT NULL,
      host_username TEXT NOT NULL,
      host_verified BOOLEAN NOT NULL DEFAULT FALSE,
      category TEXT NOT NULL DEFAULT '',
      live_type TEXT NOT NULL DEFAULT 'video' CHECK (live_type IN ('audio', 'video')),
      track_title TEXT NOT NULL DEFAULT '',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      cover_gradient TEXT NOT NULL DEFAULT '',
      base_listeners_count INT NOT NULL DEFAULT 0,
      base_likes_count INT NOT NULL DEFAULT 0,
      is_live BOOLEAN NOT NULL DEFAULT TRUE,
      scheduled_for TIMESTAMPTZ NULL,
      captions_text TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_room_memberships (
      room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined BOOLEAN NOT NULL DEFAULT FALSE,
      liked BOOLEAN NOT NULL DEFAULT FALSE,
      gift_sent BOOLEAN NOT NULL DEFAULT FALSE,
      muted BOOLEAN NOT NULL DEFAULT FALSE,
      captions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      camera_view TEXT NOT NULL DEFAULT 'host' CHECK (camera_view IN ('host', 'stage', 'audience')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, user_id)
    )
  `);

  await pool.query(`ALTER TABLE live_room_memberships ADD COLUMN IF NOT EXISTS captions_enabled BOOLEAN NOT NULL DEFAULT TRUE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_room_messages (
      id UUID PRIMARY KEY,
      room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
      author_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_room_reminders (
      room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, user_id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_rooms_live ON live_rooms(is_live, updated_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_rooms_scheduled ON live_rooms(scheduled_for ASC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_memberships_room ON live_room_memberships(room_id, last_seen_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_messages_room_created ON live_room_messages(room_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_reminders_user ON live_room_reminders(user_id, created_at DESC)`);

  const usernames = Array.from(new Set(SEEDED_ROOMS.map((room) => room.hostUsername.toLowerCase())));
  const hostLookup = new Map<string, string>();
  const usersRes = await pool.query(
    `SELECT id, username FROM users WHERE LOWER(username) = ANY($1::text[])`,
    [usernames]
  );
  usersRes.rows.forEach((row) => {
    hostLookup.set(String(row.username || "").toLowerCase(), String(row.id || ""));
  });

  for (const room of SEEDED_ROOMS) {
    const hostUserId = hostLookup.get(room.hostUsername.toLowerCase()) || null;
    await pool.query(
      `
        INSERT INTO live_rooms (
          id, slug, title, host_user_id, host_name, host_username, host_verified,
          category, live_type, track_title, tags, cover_gradient, base_listeners_count,
          base_likes_count, is_live, scheduled_for, captions_text, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11::jsonb, $12, $13,
          $14, $15, $16, $17, NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          host_user_id = COALESCE(EXCLUDED.host_user_id, live_rooms.host_user_id),
          host_name = EXCLUDED.host_name,
          host_username = EXCLUDED.host_username,
          host_verified = EXCLUDED.host_verified,
          category = EXCLUDED.category,
          live_type = EXCLUDED.live_type,
          track_title = EXCLUDED.track_title,
          tags = EXCLUDED.tags,
          cover_gradient = EXCLUDED.cover_gradient,
          base_listeners_count = EXCLUDED.base_listeners_count,
          base_likes_count = EXCLUDED.base_likes_count,
          is_live = EXCLUDED.is_live,
          scheduled_for = EXCLUDED.scheduled_for,
          captions_text = EXCLUDED.captions_text,
          updated_at = NOW()
      `,
      [
        room.id,
        room.slug,
        room.title,
        hostUserId,
        room.hostName,
        room.hostUsername,
        room.hostVerified,
        room.category,
        room.liveType,
        room.track,
        JSON.stringify(room.tags),
        room.coverGradient,
        room.baseListeners,
        room.baseLikes,
        room.isLive,
        room.scheduledFor,
        room.captionsText,
      ]
    );

    const existingMessages = await pool.query(
      `SELECT COUNT(*)::int AS count FROM live_room_messages WHERE room_id = $1`,
      [room.id]
    );
    if (Number(existingMessages.rows[0]?.count || 0) > 0) continue;

    for (let index = 0; index < room.comments.length; index += 1) {
      const [authorName, body] = room.comments[index];
      await pool.query(
        `
          INSERT INTO live_room_messages (id, room_id, author_user_id, author_name, body, created_at)
          VALUES ($1, $2, NULL, $3, $4, NOW() - ($5 * INTERVAL '2 minutes'))
        `,
        [randomUUID(), room.id, authorName, body, room.comments.length - index]
      );
    }
  }
}
