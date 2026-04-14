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
      direction TEXT NOT NULL CHECK (direction IN ('like', 'pass', 'superlike')),
      is_superlike BOOLEAN NOT NULL DEFAULT FALSE,
      message TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE swipe_actions ADD COLUMN IF NOT EXISTS is_superlike BOOLEAN NOT NULL DEFAULT FALSE`);

  await pool.query(`
    DO $$
    DECLARE constraint_name text;
    BEGIN
      SELECT con.conname
      INTO constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'swipe_actions'
        AND nsp.nspname = current_schema()
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%direction%'
        AND pg_get_constraintdef(con.oid) LIKE '%like%'
        AND pg_get_constraintdef(con.oid) LIKE '%pass%'
        AND pg_get_constraintdef(con.oid) NOT LIKE '%superlike%'
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE swipe_actions DROP CONSTRAINT %I', constraint_name);
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE swipe_actions
    DROP CONSTRAINT IF EXISTS swipe_actions_direction_check
  `);

  await pool.query(`
    ALTER TABLE swipe_actions
    ADD CONSTRAINT swipe_actions_direction_check
    CHECK (direction IN ('like', 'pass', 'superlike'))
  `).catch(async (err: any) => {
    if (!String(err?.message || "").includes("already exists")) throw err;
  });

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_swipe_actions_actor_created
    ON swipe_actions(actor_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_swipe_actions_actor_target
    ON swipe_actions(actor_id, target_user_id, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS swipe_matches (
      id UUID PRIMARY KEY,
      user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      matched_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by_action_id UUID NULL REFERENCES swipe_actions(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT swipe_matches_not_self CHECK (user_a_id <> user_b_id),
      CONSTRAINT swipe_matches_ordered_pair CHECK (user_a_id < user_b_id),
      CONSTRAINT swipe_matches_unique_pair UNIQUE (user_a_id, user_b_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_swipe_matches_user_a
    ON swipe_matches(user_a_id, updated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_swipe_matches_user_b
    ON swipe_matches(user_b_id, updated_at DESC)
  `);

  await pool.query(`
    WITH latest_positive_swipes AS (
      SELECT DISTINCT ON (actor_id, target_user_id)
        id,
        actor_id,
        target_user_id,
        created_at
      FROM swipe_actions
      WHERE target_user_id IS NOT NULL
        AND (direction IN ('like', 'superlike') OR (direction = 'like' AND is_superlike = TRUE))
      ORDER BY actor_id, target_user_id, created_at DESC
    ),
    reciprocal_pairs AS (
      SELECT
        LEAST(a.actor_id, a.target_user_id) AS user_a_id,
        GREATEST(a.actor_id, a.target_user_id) AS user_b_id,
        CASE WHEN a.created_at >= b.created_at THEN a.actor_id ELSE b.actor_id END AS matched_by_user_id,
        CASE WHEN a.created_at >= b.created_at THEN a.id ELSE b.id END AS created_by_action_id,
        GREATEST(a.created_at, b.created_at) AS matched_at
      FROM latest_positive_swipes a
      JOIN latest_positive_swipes b
        ON b.actor_id = a.target_user_id
       AND b.target_user_id = a.actor_id
      WHERE a.actor_id < a.target_user_id
    )
    INSERT INTO swipe_matches (id, user_a_id, user_b_id, matched_by_user_id, created_by_action_id, created_at, updated_at)
    SELECT rp.created_by_action_id, rp.user_a_id, rp.user_b_id, rp.matched_by_user_id, rp.created_by_action_id, rp.matched_at, rp.matched_at
    FROM reciprocal_pairs rp
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING
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
