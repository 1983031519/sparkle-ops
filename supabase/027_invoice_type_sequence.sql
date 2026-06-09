-- Migration 027: Add invoice_type, sequence_number, linked_invoice_id to invoices
-- Supports deposit/balance split invoice flow (Invoice #1 deposit + Invoice #2 balance)
-- Safe: ADD COLUMN IF NOT EXISTS with defaults — all 138 existing rows unaffected

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type TEXT
    DEFAULT 'full'
    CHECK (invoice_type IN ('full', 'deposit', 'balance'));

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER DEFAULT 1;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS linked_invoice_id UUID
    REFERENCES invoices(id) ON DELETE SET NULL;
