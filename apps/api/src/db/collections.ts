import { randomUUID } from "crypto";
import { pool } from "../connections";

export const DEFAULT_STATUS = [
  { code: "a_voir", label: "A voir" },
  { code: "en_cours", label: "En cours" },
  { code: "termine", label: "Termine" },
  { code: "abandonne", label: "Abandonne" },
] as const;

export type DefaultStatusCode = (typeof DEFAULT_STATUS)[number]["code"];

export async function ensureCollectionsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      status_code TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT collections_status_code_check
        CHECK (
          status_code IS NULL
          OR status_code IN ('a_voir', 'en_cours', 'termine', 'abandonne')
        )
    )
  `);

  // Backward compatibility: if an older collections table exists, align schema.
  await pool.query(`ALTER TABLE collections ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE collections ADD COLUMN IF NOT EXISTS status_code TEXT NULL`);
  await pool.query(`ALTER TABLE collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'collections_status_code_check'
      ) THEN
        ALTER TABLE collections
        ADD CONSTRAINT collections_status_code_check
        CHECK (
          status_code IS NULL
          OR status_code IN ('a_voir', 'en_cours', 'termine', 'abandonne')
        );
      END IF;
    END
    $$;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_collections_user_status
    ON collections(user_id, status_code)
    WHERE status_code IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_collections_user_id
    ON collections(user_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS collection_items (
      collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      media_type TEXT NOT NULL
        CHECK (media_type IN ('track', 'album', 'artist')),
      media_id TEXT NOT NULL,
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection_id, media_type, media_id)
    )
  `);

  // Schema migration: normalize legacy TEXT ids to UUID.
  await pool.query(`
    DO $$
    DECLARE
      collections_id_type text;
      collection_items_id_type text;
    BEGIN
      SELECT data_type
      INTO collections_id_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'collections' AND column_name = 'id';

      SELECT data_type
      INTO collection_items_id_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'collection_items' AND column_name = 'collection_id';

      IF collections_id_type = 'text' THEN
        ALTER TABLE collections ADD COLUMN IF NOT EXISTS id_uuid UUID;

        UPDATE collections
        SET id_uuid = CASE
          WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN id::uuid
          ELSE (
            substr(md5(id), 1, 8) || '-' ||
            substr(md5(id), 9, 4) || '-' ||
            substr(md5(id), 13, 4) || '-' ||
            substr(md5(id), 17, 4) || '-' ||
            substr(md5(id), 21, 12)
          )::uuid
        END
        WHERE id_uuid IS NULL;

        ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS collection_id_uuid UUID;
        UPDATE collection_items ci
        SET collection_id_uuid = c.id_uuid
        FROM collections c
        WHERE ci.collection_id::text = c.id::text
          AND ci.collection_id_uuid IS NULL;

        ALTER TABLE collection_items DROP CONSTRAINT IF EXISTS collection_items_collection_id_fkey;
        ALTER TABLE collection_items DROP CONSTRAINT IF EXISTS collection_items_pkey;
        ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_pkey;

        ALTER TABLE collections DROP COLUMN id;
        ALTER TABLE collections RENAME COLUMN id_uuid TO id;
        ALTER TABLE collections ADD PRIMARY KEY (id);

        ALTER TABLE collection_items DROP COLUMN collection_id;
        ALTER TABLE collection_items RENAME COLUMN collection_id_uuid TO collection_id;
        ALTER TABLE collection_items ALTER COLUMN collection_id SET NOT NULL;
        ALTER TABLE collection_items ADD PRIMARY KEY (collection_id, media_type, media_id);
        ALTER TABLE collection_items
          ADD CONSTRAINT collection_items_collection_id_fkey
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
      ELSIF collection_items_id_type = 'text' THEN
        ALTER TABLE collection_items DROP CONSTRAINT IF EXISTS collection_items_collection_id_fkey;
        ALTER TABLE collection_items
          ALTER COLUMN collection_id TYPE UUID
          USING collection_id::uuid;
        ALTER TABLE collection_items
          ADD CONSTRAINT collection_items_collection_id_fkey
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
      END IF;
    END
    $$;
  `);
}

export async function ensureDefaultCollectionsForUser(userId: string) {
  for (const st of DEFAULT_STATUS) {
    await pool.query(
      `
        INSERT INTO collections (id, user_id, name, is_public, status_code)
        SELECT $1, $2, $3, FALSE, $4
        WHERE NOT EXISTS (
          SELECT 1
          FROM collections
          WHERE user_id = $2 AND status_code = $4
        )
      `,
      [newCollectionId(), userId, st.label, st.code]
    );
  }
}

export function newCollectionId() {
  return randomUUID();
}
