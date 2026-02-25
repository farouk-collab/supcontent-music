import { pool } from "../connections";

export async function ensurePasswordResetTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_resets_user_id
    ON password_resets(user_id)
  `);
}

export async function createPasswordReset(params: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  await pool.query(
    `INSERT INTO password_resets (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [params.id, params.userId, params.tokenHash, params.expiresAt.toISOString()]
  );
}

export async function findValidPasswordResetByHash(tokenHash: string) {
  const r = await pool.query(
    `SELECT id, user_id, token_hash, expires_at, used_at
     FROM password_resets
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return r.rows[0] ?? null;
}

export async function markPasswordResetUsed(id: string) {
  await pool.query(
    `UPDATE password_resets
     SET used_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

