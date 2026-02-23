import { pool } from "../connections";

export async function ensureFollowTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id),
      CONSTRAINT follows_not_self CHECK (follower_id <> following_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_follows_follower
    ON follows(follower_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_follows_following
    ON follows(following_id, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS swipe_actions (
      id UUID PRIMARY KEY,
      actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
      media_type TEXT NULL CHECK (media_type IN ('track', 'album', 'artist')),
      media_id TEXT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
      message TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_swipe_actions_actor_created
    ON swipe_actions(actor_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_swipe_actions_actor_target
    ON swipe_actions(actor_id, target_user_id, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_invitations (
      id UUID PRIMARY KEY,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL DEFAULT 'profile_swipe',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_invitations_receiver
    ON chat_invitations(receiver_id, status, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_invitations_sender
    ON chat_invitations(sender_id, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS swipe_preferences (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      use_distance_filter BOOLEAN NOT NULL DEFAULT FALSE,
      max_distance_km INTEGER NOT NULL DEFAULT 50,
      min_age INTEGER NOT NULL DEFAULT 18,
      max_age INTEGER NOT NULL DEFAULT 99,
      preferred_genders TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      latitude DOUBLE PRECISION NULL,
      longitude DOUBLE PRECISION NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE swipe_preferences ADD COLUMN IF NOT EXISTS min_age INTEGER NOT NULL DEFAULT 18`);
  await pool.query(`ALTER TABLE swipe_preferences ADD COLUMN IF NOT EXISTS max_age INTEGER NOT NULL DEFAULT 99`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      account_private BOOLEAN NOT NULL DEFAULT FALSE,
      hide_location BOOLEAN NOT NULL DEFAULT FALSE,
      language TEXT NOT NULL DEFAULT 'fr',
      hidden_words TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      notifications_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS account_private BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hide_location BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'fr'`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hidden_words TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notifications_prefs JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id),
      CONSTRAINT blocked_not_self CHECK (blocker_id <> blocked_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker
    ON blocked_users(blocker_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked
    ON blocked_users(blocked_id, created_at DESC)
  `);
}
