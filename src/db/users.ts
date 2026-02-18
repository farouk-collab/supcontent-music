import { pool } from "../connections";

export type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const r = await pool.query<DbUser>(
    "SELECT * FROM users WHERE email = $1 LIMIT 1",
    [email.toLowerCase()]
  );
  return r.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<Omit<DbUser, "password_hash"> | null> {
  const r = await pool.query(
    "SELECT id, email, display_name, avatar_url, bio, created_at FROM users WHERE id = $1 LIMIT 1",
    [id]
  );
  return r.rows[0] ?? null;
}

export async function createUser(params: {
  email: string;
  password_hash: string;
  display_name: string;
}) {
  const r = await pool.query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, avatar_url, bio, created_at`,
    [params.email.toLowerCase(), params.password_hash, params.display_name]
  );
  return r.rows[0];
}
