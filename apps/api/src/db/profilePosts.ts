import { pool } from "../connections";

export async function ensureProfilePostsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_posts (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('publication', 'story')),
      media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
      media_data TEXT NOT NULL,
      caption TEXT NULL,
      likes_count INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      comments JSONB NOT NULL DEFAULT '[]'::jsonb,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE profile_posts ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE profile_posts ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE profile_posts ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE profile_posts ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE profile_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_profile_posts_user_created
    ON profile_posts(user_id, created_at DESC)
  `);
}

