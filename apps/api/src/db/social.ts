import { pool } from "../connections";

export async function ensureSocialTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_type TEXT NOT NULL CHECK (media_type IN ('track', 'album', 'artist')),
      media_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      body TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_reviews_user_media UNIQUE (user_id, media_type, media_id)
    )
  `);

  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS review_likes (
      review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (review_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS review_comments (
      id UUID PRIMARY KEY,
      review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reviews_media
    ON reviews(media_type, media_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_review_comments_review_id
    ON review_comments(review_id)
  `);
}
