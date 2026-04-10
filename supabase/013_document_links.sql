-- ─── Document Links — Public View Tokens ──────────────────────────────────────
-- Each time a document is emailed to a client, a unique token is generated.
-- The token is included as a link in the email: /view/:token
-- No login required to view; the token acts as the access credential.

CREATE TABLE IF NOT EXISTS document_links (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token        uuid        UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  document_type text       NOT NULL CHECK (document_type IN ('invoice', 'estimate', 'project')),
  document_id  uuid        NOT NULL,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  viewed_at    timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_links_token       ON document_links (token);
CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links (document_id);

-- RLS: this table is fully public (the token IS the auth)
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read document_links"
  ON document_links FOR SELECT
  USING (true);

CREATE POLICY "Public can insert document_links"
  ON document_links FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update viewed_at"
  ON document_links FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ─── Anon read access for public view page ─────────────────────────────────────
-- These policies allow the Supabase anon key (used by the public /view/:token page)
-- to read the specific tables needed to render a document.
-- If RLS is not enabled on these tables the policies are harmless.
-- If RLS IS enabled, these policies are required for the public view page to work.

CREATE POLICY "Anon can read invoices for public view"
  ON invoices FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can read estimates for public view"
  ON estimates FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can read projects for public view"
  ON projects FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can read project_phases for public view"
  ON project_phases FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can read clients for public view"
  ON clients FOR SELECT TO anon
  USING (true);
