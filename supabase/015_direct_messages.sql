-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Sparkle Ops — Migration 015                                         ║
-- ║  Direct messages (DMs) between individual users                      ║
-- ║  Replaces the group chat in migration 014                            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  sender_name text NOT NULL,
  recipient_name text NOT NULL,
  content text NOT NULL CHECK (char_length(content) > 0),
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_dm_sender ON direct_messages(sender_id);
CREATE INDEX idx_dm_recipient ON direct_messages(recipient_id);
CREATE INDEX idx_dm_created ON direct_messages(created_at);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
  ON direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark as read"
  ON direct_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);

-- NOTE: After running this migration you MUST enable Realtime on direct_messages
-- in the Supabase dashboard: Table Editor → direct_messages → Enable Realtime toggle.
-- Without this step, new DMs will NOT appear in real time.
