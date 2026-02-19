import { pool } from "../connections";

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
