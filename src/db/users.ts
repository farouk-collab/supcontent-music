import { pool } from "../connections";

export type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
  birth_date: string | null; // YYYY-MM-DD
  role: string | null;
  created_at: string;
};

export type PublicUser = Omit<DbUser, "password_hash">;

// Liste des colonnes "public" qu’on renvoie au front
const PUBLIC_COLS = `
  id, email, display_name, username,
  avatar_url, cover_url, bio, website,
  location, gender, birth_date::text AS birth_date, role, created_at
`;

/** Utilisé pour login (on a besoin de password_hash) */
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const r = await pool.query<DbUser>(
    `SELECT
      id, email, password_hash, display_name, username,
      avatar_url, cover_url, bio, website,
      location, gender, birth_date::text AS birth_date, role, created_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email.toLowerCase()]
  );
  return r.rows[0] ?? null;
}

/** Utilisé partout côté front (sans password_hash) */
export async function findUserById(id: string): Promise<PublicUser | null> {
  const r = await pool.query<PublicUser>(
    `SELECT ${PUBLIC_COLS}
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function createUser(params: {
  email: string;
  password_hash: string;
  display_name: string;
}): Promise<PublicUser> {
  const r = await pool.query<PublicUser>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLS}`,
    [params.email.toLowerCase(), params.password_hash, params.display_name]
  );
  return r.rows[0];
}

export type UpdateMeInput = Partial<{
  display_name: string;
  username: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
  birth_date: string | null; // YYYY-MM-DD
  avatar_url: string | null;
  cover_url: string | null;
}>;

const ALLOWED_PATCH_FIELDS = new Set<keyof UpdateMeInput>([
  "display_name",
  "username",
  "bio",
  "website",
  "location",
  "gender",
  "birth_date",
  "avatar_url",
  "cover_url",
]);

export async function updateUserById(userId: string, patch: UpdateMeInput): Promise<PublicUser> {
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(patch) as [keyof UpdateMeInput, any][]) {
    if (!ALLOWED_PATCH_FIELDS.has(k)) continue;
    if (typeof v === "undefined") continue;

    fields.push(`${k} = $${i++}`);
    values.push(v);
  }

  // rien à modifier → renvoyer user actuel
  if (fields.length === 0) {
    const current = await findUserById(userId);
    if (!current) throw new Error("Utilisateur introuvable");
    return current;
  }

  values.push(userId);

  const r = await pool.query<PublicUser>(
    `UPDATE users
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING ${PUBLIC_COLS}`,
    values
  );

  return r.rows[0];
}
