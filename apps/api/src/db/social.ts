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
      image_url TEXT NULL,
      sticker TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS body TEXT NULL`);
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS image_url TEXT NULL`);
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS sticker TEXT NULL`);
  await pool.query(`ALTER TABLE reviews DROP CONSTRAINT IF EXISTS uq_reviews_user_media`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS review_likes (
      review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (review_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS review_votes (
      review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (review_id, user_id)
    )
  `);

  // Backfill old likes table into new vote model (idempotent).
  await pool.query(`
    INSERT INTO review_votes (review_id, user_id, vote_type)
    SELECT rl.review_id, rl.user_id, 'up'
    FROM review_likes rl
    ON CONFLICT (review_id, user_id) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS review_comments (
      id UUID PRIMARY KEY,
      review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_comment_id UUID NULL REFERENCES review_comments(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      content TEXT NULL,
      image_url TEXT NULL,
      sticker TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS body TEXT`);
  await pool.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS content TEXT`);
  await pool.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID NULL`);
  await pool.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS image_url TEXT NULL`);
  await pool.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS sticker TEXT NULL`);
  await pool.query(`UPDATE review_comments SET body = COALESCE(body, content, '') WHERE body IS NULL`);
  await pool.query(`UPDATE review_comments SET content = COALESCE(content, body, '') WHERE content IS NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comment_votes (
      comment_id UUID NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (comment_id, user_id)
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

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_review_comments_parent
    ON review_comments(parent_comment_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id
    ON comment_votes(comment_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_review_votes_review_id
    ON review_votes(review_id)
  `);
}
