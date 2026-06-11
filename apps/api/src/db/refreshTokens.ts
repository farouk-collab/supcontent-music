import { pool } from "../connections";

export async function ensureRefreshTokensTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_tokens_user_hash
    ON refresh_tokens(user_id, token_hash)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON refresh_tokens(expires_at)
  `);
}

export async function storeRefreshToken(params: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [params.userId, params.tokenHash, params.expiresAt.toISOString()]
  );
}

export async function findRefreshToken(params: { userId: string; tokenHash: string }) {
  const r = await pool.query(
    `SELECT id, user_id, token_hash, expires_at
     FROM refresh_tokens
     WHERE user_id = $1 AND token_hash = $2
     LIMIT 1`,
    [params.userId, params.tokenHash]
  );
  return r.rows[0] ?? null;
}

export async function deleteRefreshTokensForUser(userId: string) {
  await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
}
