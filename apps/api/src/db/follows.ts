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
}
