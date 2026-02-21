import { pool } from "../connections";

export type SpotifyLink = {
  user_id: string;
  spotify_user_id: string;
  access_token: string;
  refresh_token: string;
  token_type: string | null;
  scope: string | null;
  expires_at: string;
  updated_at: string;
};

export async function ensureSpotifyLinksTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spotify_links (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      spotify_user_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_type TEXT NULL,
      scope TEXT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_spotify_links_spotify_user
    ON spotify_links(spotify_user_id)
  `);
}

export async function getSpotifyLinkByUserId(userId: string): Promise<SpotifyLink | null> {
  const r = await pool.query<SpotifyLink>(
    `
      SELECT user_id, spotify_user_id, access_token, refresh_token, token_type, scope, expires_at, updated_at
      FROM spotify_links
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );
  return r.rows[0] || null;
}

export async function upsertSpotifyLink(input: {
  userId: string;
  spotifyUserId: string;
  accessToken: string;
  refreshToken: string;
  tokenType?: string | null;
  scope?: string | null;
  expiresAt: Date;
}) {
  await pool.query(
    `
      INSERT INTO spotify_links (
        user_id, spotify_user_id, access_token, refresh_token, token_type, scope, expires_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        spotify_user_id = EXCLUDED.spotify_user_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `,
    [
      input.userId,
      input.spotifyUserId,
      input.accessToken,
      input.refreshToken,
      input.tokenType || null,
      input.scope || null,
      input.expiresAt.toISOString(),
    ]
  );
}
