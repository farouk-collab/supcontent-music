import { pool } from "../connections";

export async function ensureChatTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id UUID PRIMARY KEY,
      match_id UUID NULL REFERENCES swipe_matches(id) ON DELETE SET NULL,
      user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chat_threads_not_self CHECK (user_a_id <> user_b_id),
      CONSTRAINT chat_threads_ordered_pair CHECK (user_a_id < user_b_id),
      CONSTRAINT chat_threads_unique_pair UNIQUE (user_a_id, user_b_id)
    )
  `);

  await pool.query(`ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS match_id UUID NULL`);

  await pool.query(`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE chat_threads
        ADD CONSTRAINT chat_threads_match_fk
        FOREIGN KEY (match_id) REFERENCES swipe_matches(id) ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_threads_user_a
    ON chat_threads(user_a_id, updated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_threads_user_b
    ON chat_threads(user_b_id, updated_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY,
      thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_type TEXT NOT NULL DEFAULT 'text',
      body TEXT NOT NULL DEFAULT '',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ NULL
    )
  `);

  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL`);
  await pool.query(`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
      EXCEPTION
        WHEN undefined_object THEN NULL;
      END;
      BEGIN
        ALTER TABLE chat_messages
        ADD CONSTRAINT chat_messages_message_type_check
        CHECK (message_type IN ('text', 'music', 'playlist', 'file', 'voice', 'call'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
    ON chat_messages(thread_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_unread
    ON chat_messages(thread_id, read_at)
  `);
}
