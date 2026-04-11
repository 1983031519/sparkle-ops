-- Chat messages: all authenticated users can read and insert their own messages
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_name text NOT NULL,
  user_role text NOT NULL,
  content text NOT NULL CHECK (char_length(content) > 0),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read messages" ON chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert messages" ON chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Chat reads: tracks each user's last-read timestamp for unread badge
CREATE TABLE chat_reads (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  last_read_at timestamptz DEFAULT now()
);
ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own chat_reads" ON chat_reads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own chat_reads" ON chat_reads FOR ALL TO authenticated USING (auth.uid() = user_id);

-- NOTE: After running this migration you MUST enable Realtime on chat_messages
-- in the Supabase dashboard: Table Editor → chat_messages → Enable Realtime toggle.
-- Without this step, new messages will NOT appear in real time.
